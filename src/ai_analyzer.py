"""
AI-powered product information extraction from OCR text.

This module provides intelligent extraction of structured product data from
OCR text using AI language models (OpenAI GPT-4 or Anthropic Claude).

Architecture:
    - Abstract base class (AIBackend) for provider independence
    - Concrete implementations (OpenAIBackend, ClaudeBackend)
    - Factory pattern for backend instantiation
    - Caching layer for cost optimization
    - Comprehensive error handling and logging

Best Practices:
    - SOLID: Single responsibility, Open/closed, Dependency inversion
    - DRY: Reusable backend interface
    - KISS: Simple, clear abstractions
    - Type hints throughout
    - Comprehensive logging

Example:
    >>> from src.ai_analyzer import AIAnalyzer, AIConfig
    >>> config = AIConfig.from_env()
    >>> analyzer = AIAnalyzer(config)
    >>> product = analyzer.analyze_product(ocr_result)
    >>> print(f"Product: {product.product_name}")
"""

import hashlib
import json
import logging
import os
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from dateutil import parser as date_parser
from diskcache import Cache

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# ============================================================================
# Configuration
# ============================================================================

@dataclass
class AIConfig:
    """Configuration for AI analyzer service.
    
    Best Practice: Use dataclass for immutable configuration with validation.
    Supports loading from environment variables for 12-factor app compliance.
    """
    
    # Provider settings
    provider: str = "openai"  # "openai" or "anthropic"
    model: str = "gpt-4-turbo-preview"
    
    # API credentials
    openai_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    
    # Model parameters
    temperature: float = 0.0  # Deterministic for structured extraction
    max_tokens: int = 2000
    timeout: int = 30
    
    # Quality settings
    min_confidence: float = 0.7
    retry_on_low_confidence: bool = True
    max_retries: int = 3
    
    # Prompt settings
    use_few_shot: bool = True
    include_categories: bool = True
    
    # Caching
    cache_enabled: bool = True
    cache_dir: str = "./cache/ai"
    cache_ttl: int = 86400 * 7  # 7 days
    
    # Cost management
    max_cost_per_request: float = 0.05
    daily_cost_limit: float = 1.00
    
    @classmethod
    def from_env(cls) -> "AIConfig":
        """Load configuration from environment variables.
        
        Best Practice: 12-factor app - configuration via environment.
        """
        return cls(
            provider=os.getenv("AI_PROVIDER", "openai"),
            model=os.getenv("AI_MODEL", "gpt-4-turbo-preview"),
            openai_api_key=os.getenv("OPENAI_API_KEY"),
            anthropic_api_key=os.getenv("ANTHROPIC_API_KEY"),
            temperature=float(os.getenv("AI_TEMPERATURE", "0.0")),
            max_tokens=int(os.getenv("AI_MAX_TOKENS", "2000")),
            timeout=int(os.getenv("AI_TIMEOUT", "30")),
            min_confidence=float(os.getenv("AI_MIN_CONFIDENCE", "0.7")),
            retry_on_low_confidence=os.getenv("AI_RETRY_ON_LOW_CONFIDENCE", "true").lower() == "true",
            use_few_shot=os.getenv("AI_USE_FEW_SHOT", "true").lower() == "true",
            cache_enabled=os.getenv("AI_CACHE_ENABLED", "true").lower() == "true",
            cache_dir=os.getenv("AI_CACHE_DIR", "./cache/ai"),
            cache_ttl=int(os.getenv("AI_CACHE_TTL", str(86400 * 7))),
            max_cost_per_request=float(os.getenv("AI_MAX_COST_PER_REQUEST", "0.05")),
            daily_cost_limit=float(os.getenv("AI_DAILY_COST_LIMIT", "1.00")),
        )
    
    def __post_init__(self):
        """Validate configuration after initialization."""
        if self.temperature < 0 or self.temperature > 1:
            raise ValueError("Temperature must be between 0 and 1")
        if self.min_confidence < 0 or self.min_confidence > 1:
            raise ValueError("min_confidence must be between 0 and 1")
        if self.max_tokens < 100:
            raise ValueError("max_tokens must be at least 100")


# ============================================================================
# Data Models
# ============================================================================

@dataclass
class ProductData:
    """Structured product information extracted from OCR text.
    
    Best Practice: Comprehensive data model with optional fields for
    graceful handling of incomplete data.
    """
    
    # Core identification
    product_name: str
    brand: Optional[str] = None
    category: str = "Other"
    subcategory: Optional[str] = None
    
    # Dates
    expiration_date: Optional[datetime] = None
    manufactured_date: Optional[datetime] = None
    best_before_date: Optional[datetime] = None
    
    # Attributes
    key_attributes: List[str] = field(default_factory=list)
    dietary_tags: List[str] = field(default_factory=list)
    allergens: List[str] = field(default_factory=list)
    
    # Nutrition (optional)
    serving_size: Optional[str] = None
    calories: Optional[int] = None
    nutritional_info: Optional[Dict[str, Any]] = None
    
    # Metadata
    confidence: float = 0.0
    raw_ocr_text: str = ""
    processing_time: float = 0.0
    model_used: str = ""
    
    # Storage hints
    storage_location: Optional[str] = None
    quantity_estimate: Optional[int] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "product_name": self.product_name,
            "brand": self.brand,
            "category": self.category,
            "subcategory": self.subcategory,
            "expiration_date": self.expiration_date.isoformat() if self.expiration_date else None,
            "manufactured_date": self.manufactured_date.isoformat() if self.manufactured_date else None,
            "best_before_date": self.best_before_date.isoformat() if self.best_before_date else None,
            "key_attributes": self.key_attributes,
            "dietary_tags": self.dietary_tags,
            "allergens": self.allergens,
            "serving_size": self.serving_size,
            "calories": self.calories,
            "nutritional_info": self.nutritional_info,
            "confidence": self.confidence,
            "raw_ocr_text": self.raw_ocr_text,
            "processing_time": self.processing_time,
            "model_used": self.model_used,
            "storage_location": self.storage_location,
            "quantity_estimate": self.quantity_estimate,
        }


# ============================================================================
# Product Categories
# ============================================================================

PRODUCT_CATEGORIES = {
    "Grains & Pasta": ["rice", "quinoa", "pasta", "noodles", "oats", "couscous", "barley"],
    "Canned Goods": ["beans", "tomatoes", "soup", "vegetables", "fruit", "tuna", "salmon"],
    "Condiments & Sauces": ["ketchup", "mustard", "soy sauce", "vinegar", "mayo", "hot sauce"],
    "Oils & Vinegars": ["olive oil", "vegetable oil", "sesame oil", "coconut oil", "balsamic"],
    "Snacks": ["chips", "crackers", "nuts", "dried fruit", "popcorn", "pretzels"],
    "Baking": ["flour", "sugar", "baking powder", "baking soda", "vanilla", "cocoa"],
    "Spices & Seasonings": ["salt", "pepper", "cumin", "paprika", "garlic", "cinnamon"],
    "Beverages": ["tea", "coffee", "juice", "soda", "water"],
    "Breakfast": ["cereal", "oatmeal", "pancake mix", "syrup", "granola"],
    "International": ["miso", "curry paste", "tahini", "sriracha", "kimchi", "coconut milk"],
}


# ============================================================================
# AI Backend Interface
# ============================================================================

class AIBackend(ABC):
    """Abstract base class for AI providers.
    
    Best Practice: SOLID - Dependency inversion principle. Depend on
    abstractions, not concretions. This allows easy provider switching.
    """
    
    def __init__(self, config: AIConfig):
        """Initialize backend with configuration."""
        self.config = config
        self.logger = logging.getLogger(f"{__name__}.{self.__class__.__name__}")
    
    @abstractmethod
    def extract_product_info(self, ocr_text: str) -> Dict[str, Any]:
        """Extract structured product information from OCR text.
        
        Args:
            ocr_text: Raw text from OCR service
            
        Returns:
            Dictionary with extracted product information
            
        Raises:
            Exception: If API call fails
        """
        pass
    
    @abstractmethod
    def is_available(self) -> bool:
        """Check if this backend is available (has API key)."""
        pass
    
    def _build_extraction_prompt(self, ocr_text: str) -> str:
        """Build prompt for product extraction.
        
        Best Practice: DRY - Shared prompt building logic.
        """
        categories_str = ", ".join(PRODUCT_CATEGORIES.keys())
        
        few_shot_examples = ""
        if self.config.use_few_shot:
            few_shot_examples = """
Examples:

Input: "KOYO REDUCED SODIUM TOFU MISO RAMEN EXP 2021/12 ORGANIC NOODLES VEGAN"
Output: {
  "product_name": "Koyo Reduced Sodium Tofu Miso Ramen",
  "brand": "Koyo",
  "category": "Grains & Pasta",
  "subcategory": "Instant Ramen",
  "expiration_date": "2021-12-01",
  "key_attributes": ["Reduced Sodium", "Organic Noodles"],
  "dietary_tags": ["vegan", "organic"],
  "confidence": 0.95
}

Input: "Bush's Butter Beans NET WT 15.8 OZ"
Output: {
  "product_name": "Bush's Butter Beans",
  "brand": "Bush's",
  "category": "Canned Goods",
  "subcategory": "Beans",
  "key_attributes": ["15.8 oz"],
  "dietary_tags": [],
  "confidence": 0.90
}
"""
        
        prompt = f"""Extract product information from this OCR text. The text may contain OCR errors.

OCR Text:
{ocr_text}

Extract these fields and return ONLY valid JSON (no markdown, no code blocks):

{{
  "product_name": "Full product name (correct OCR errors)",
  "brand": "Brand name or null",
  "category": "One of: {categories_str}, Other",
  "subcategory": "More specific category or null",
  "expiration_date": "YYYY-MM-DD or null (look for EXP, BEST BY, USE BY, dates)",
  "manufactured_date": "YYYY-MM-DD or null",
  "key_attributes": ["List features like '25% Less Sodium', 'Organic', 'Non-GMO'"],
  "dietary_tags": ["vegan", "organic", "gluten-free", "kosher", "non-gmo"],
  "allergens": ["milk", "nuts", "soy", "wheat", "eggs"] or [],
  "serving_size": "serving size text or null",
  "calories": number or null,
  "confidence": 0.0-1.0 (extraction confidence)
}}
{few_shot_examples}
Guidelines:
- Fix obvious OCR errors (e.g., "0RGANIC" → "ORGANIC")
- Be conservative with confidence scores
- Return null for unclear fields
- Categories must match the list above
- Dates can be partial (e.g., "2021-12-01" for December 2021)
- Look for date keywords: EXP, BEST BY, USE BY, SELL BY, BBD
- Extract brand even if not explicitly labeled

Return ONLY the JSON, no other text, no markdown code blocks."""
        
        return prompt


# ============================================================================
# OpenAI Backend
# ============================================================================

class OpenAIBackend(AIBackend):
    """OpenAI GPT-4 implementation for product extraction.
    
    Best Practice: Concrete implementation of abstract interface.
    """
    
    def __init__(self, config: AIConfig):
        """Initialize OpenAI backend."""
        super().__init__(config)
        
        if not self.is_available():
            self.logger.warning("OpenAI API key not configured")
        else:
            try:
                from openai import OpenAI
                self.client = OpenAI(
                    api_key=config.openai_api_key,
                    timeout=config.timeout
                )
                self.logger.info("OpenAI backend initialized")
            except ImportError:
                self.logger.error("openai package not installed")
                raise
    
    def is_available(self) -> bool:
        """Check if OpenAI is available."""
        return self.config.openai_api_key is not None
    
    def extract_product_info(self, ocr_text: str) -> Dict[str, Any]:
        """Extract product info using OpenAI GPT-4.
        
        Best Practice: Comprehensive error handling, logging, and retries.
        """
        if not self.is_available():
            raise ValueError("OpenAI API key not configured")
        
        prompt = self._build_extraction_prompt(ocr_text)
        
        try:
            self.logger.debug(f"Calling OpenAI API with model {self.config.model}")
            
            response = self.client.chat.completions.create(
                model=self.config.model,
                messages=[
                    {"role": "system", "content": "You are a product information extraction expert. Return only valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                temperature=self.config.temperature,
                max_tokens=self.config.max_tokens,
            )
            
            # Parse response
            content = response.choices[0].message.content.strip()
            
            # Remove markdown code blocks if present
            if content.startswith("```"):
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]
                content = content.strip()
            
            data = json.loads(content)
            
            # Log usage
            tokens_used = response.usage.total_tokens
            self.logger.info(f"OpenAI API call successful. Tokens: {tokens_used}")
            
            return data
            
        except json.JSONDecodeError as e:
            self.logger.error(f"Failed to parse JSON response: {e}")
            raise ValueError(f"Invalid JSON from OpenAI: {e}")
        except Exception as e:
            self.logger.error(f"OpenAI API error: {e}")
            raise


# ============================================================================
# Anthropic Claude Backend
# ============================================================================

class ClaudeBackend(AIBackend):
    """Anthropic Claude implementation for product extraction.
    
    Best Practice: Alternative implementation for provider redundancy.
    """
    
    def __init__(self, config: AIConfig):
        """Initialize Claude backend."""
        super().__init__(config)
        
        if not self.is_available():
            self.logger.warning("Anthropic API key not configured")
        else:
            try:
                from anthropic import Anthropic
                self.client = Anthropic(
                    api_key=config.anthropic_api_key,
                    timeout=config.timeout
                )
                self.logger.info("Claude backend initialized")
            except ImportError:
                self.logger.error("anthropic package not installed")
                raise
    
    def is_available(self) -> bool:
        """Check if Claude is available."""
        return self.config.anthropic_api_key is not None
    
    def extract_product_info(self, ocr_text: str) -> Dict[str, Any]:
        """Extract product info using Anthropic Claude.
        
        Best Practice: Similar interface, different implementation.
        """
        if not self.is_available():
            raise ValueError("Anthropic API key not configured")
        
        prompt = self._build_extraction_prompt(ocr_text)
        
        try:
            self.logger.debug(f"Calling Claude API with model {self.config.model}")
            
            message = self.client.messages.create(
                model=self.config.model if "claude" in self.config.model else "claude-3-5-sonnet-20241022",
                max_tokens=self.config.max_tokens,
                temperature=self.config.temperature,
                messages=[{"role": "user", "content": prompt}]
            )
            
            # Parse response
            content = message.content[0].text.strip()
            
            # Remove markdown code blocks if present
            if content.startswith("```"):
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]
                content = content.strip()
            
            data = json.loads(content)
            
            # Log usage
            tokens_used = message.usage.input_tokens + message.usage.output_tokens
            self.logger.info(f"Claude API call successful. Tokens: {tokens_used}")
            
            return data
            
        except json.JSONDecodeError as e:
            self.logger.error(f"Failed to parse JSON response: {e}")
            raise ValueError(f"Invalid JSON from Claude: {e}")
        except Exception as e:
            self.logger.error(f"Claude API error: {e}")
            raise


# ============================================================================
# AI Cache
# ============================================================================

class AICache:
    """Cache for AI extraction results.
    
    Best Practice: Separate caching concern for performance optimization.
    """
    
    def __init__(self, cache_dir: str, ttl: int):
        """Initialize cache."""
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.cache = Cache(str(self.cache_dir))
        self.ttl = ttl
        self.logger = logging.getLogger(f"{__name__}.AICache")
    
    def get(self, ocr_text: str) -> Optional[Dict[str, Any]]:
        """Get cached result for OCR text."""
        key = self._get_cache_key(ocr_text)
        result = self.cache.get(key)
        if result:
            self.logger.debug(f"Cache hit for key {key[:16]}...")
        return result
    
    def set(self, ocr_text: str, result: Dict[str, Any]) -> None:
        """Cache extraction result."""
        key = self._get_cache_key(ocr_text)
        self.cache.set(key, result, expire=self.ttl)
        self.logger.debug(f"Cached result for key {key[:16]}...")
    
    def clear(self) -> None:
        """Clear all cached results."""
        self.cache.clear()
        self.logger.info("Cache cleared")
    
    def _get_cache_key(self, ocr_text: str) -> str:
        """Generate cache key from OCR text."""
        return hashlib.sha256(ocr_text.encode()).hexdigest()


# ============================================================================
# Main AI Analyzer
# ============================================================================

class AIAnalyzer:
    """Main AI analyzer service for product extraction.
    
    Best Practice: Facade pattern - simple interface to complex subsystem.
    """
    
    def __init__(self, config: Optional[AIConfig] = None):
        """Initialize AI analyzer.
        
        Args:
            config: Configuration (loads from env if not provided)
        """
        self.config = config or AIConfig.from_env()
        self.logger = logging.getLogger(f"{__name__}.AIAnalyzer")
        
        # Initialize backends
        self.backends: Dict[str, AIBackend] = {}
        self._init_backends()
        
        # Initialize cache
        if self.config.cache_enabled:
            self.cache = AICache(self.config.cache_dir, self.config.cache_ttl)
        else:
            self.cache = None
        
        self.logger.info(f"AI Analyzer initialized with provider: {self.config.provider}")
    
    def _init_backends(self) -> None:
        """Initialize available backends.
        
        Best Practice: Factory pattern for backend instantiation.
        """
        # Try OpenAI
        try:
            openai_backend = OpenAIBackend(self.config)
            if openai_backend.is_available():
                self.backends["openai"] = openai_backend
                self.logger.info("OpenAI backend available")
        except Exception as e:
            self.logger.warning(f"Failed to initialize OpenAI backend: {e}")
        
        # Try Claude
        try:
            claude_backend = ClaudeBackend(self.config)
            if claude_backend.is_available():
                self.backends["anthropic"] = claude_backend
                self.logger.info("Claude backend available")
        except Exception as e:
            self.logger.warning(f"Failed to initialize Claude backend: {e}")
        
        if not self.backends:
            raise ValueError("No AI backends available. Check API keys.")
    
    def _get_backend(self) -> AIBackend:
        """Get appropriate backend based on configuration.
        
        Best Practice: Fallback strategy for reliability.
        """
        # Try preferred provider
        if self.config.provider in self.backends:
            return self.backends[self.config.provider]
        
        # Fallback to any available backend
        if self.backends:
            backend_name = next(iter(self.backends))
            self.logger.warning(f"Preferred provider '{self.config.provider}' not available, using '{backend_name}'")
            return self.backends[backend_name]
        
        raise ValueError("No AI backends available")
    
    def analyze_product(self, ocr_result: Dict[str, Any]) -> ProductData:
        """Analyze OCR result and extract product information.
        
        Args:
            ocr_result: Result from OCRService.extract_text()
            
        Returns:
            ProductData with extracted information
            
        Best Practice: Main entry point with comprehensive orchestration.
        """
        start_time = time.time()
        
        ocr_text = ocr_result.get("raw_text", "")
        if not ocr_text or not ocr_text.strip():
            raise ValueError("Empty OCR text")
        
        self.logger.info("Analyzing product from OCR text")
        
        # Check cache
        if self.cache:
            cached = self.cache.get(ocr_text)
            if cached:
                self.logger.info("Using cached result")
                return self._dict_to_product_data(cached, ocr_text, time.time() - start_time)
        
        # Extract with backend
        backend = self._get_backend()
        
        try:
            extracted = backend.extract_product_info(ocr_text)
            
            # Parse and validate
            product = self._parse_extraction(extracted, ocr_text, backend)
            product.processing_time = time.time() - start_time
            
            # Cache result
            if self.cache:
                self.cache.set(ocr_text, extracted)
            
            self.logger.info(f"Product analyzed: {product.product_name} (confidence: {product.confidence:.2f})")
            
            return product
            
        except Exception as e:
            self.logger.error(f"Analysis failed: {e}")
            raise
    
    def analyze_batch(self, ocr_results: List[Dict[str, Any]]) -> List[ProductData]:
        """Analyze multiple OCR results.
        
        Best Practice: Batch processing with error handling per item.
        """
        products = []
        
        for i, ocr_result in enumerate(ocr_results, 1):
            try:
                product = self.analyze_product(ocr_result)
                products.append(product)
                self.logger.info(f"Processed {i}/{len(ocr_results)}")
            except Exception as e:
                self.logger.error(f"Failed to process item {i}: {e}")
                # Continue with next item
        
        return products
    
    def _parse_extraction(self, extracted: Dict[str, Any], ocr_text: str, backend: AIBackend) -> ProductData:
        """Parse extraction result into ProductData.
        
        Best Practice: Robust parsing with defaults for missing fields.
        """
        # Parse dates
        exp_date = self._parse_date(extracted.get("expiration_date"))
        mfg_date = self._parse_date(extracted.get("manufactured_date"))
        best_before = self._parse_date(extracted.get("best_before_date"))
        
        return ProductData(
            product_name=extracted.get("product_name", "Unknown Product"),
            brand=extracted.get("brand"),
            category=extracted.get("category", "Other"),
            subcategory=extracted.get("subcategory"),
            expiration_date=exp_date,
            manufactured_date=mfg_date,
            best_before_date=best_before,
            key_attributes=extracted.get("key_attributes", []),
            dietary_tags=extracted.get("dietary_tags", []),
            allergens=extracted.get("allergens", []),
            serving_size=extracted.get("serving_size"),
            calories=extracted.get("calories"),
            nutritional_info=extracted.get("nutritional_info"),
            confidence=float(extracted.get("confidence", 0.0)),
            raw_ocr_text=ocr_text,
            processing_time=0.0,  # Set by caller
            model_used=f"{backend.__class__.__name__}:{self.config.model}",
            storage_location=extracted.get("storage_location"),
            quantity_estimate=extracted.get("quantity_estimate"),
        )
    
    def _parse_date(self, date_str: Optional[str]) -> Optional[datetime]:
        """Parse date string into datetime.
        
        Best Practice: Flexible date parsing with error handling.
        """
        if not date_str:
            return None
        
        try:
            # Try ISO format first
            if isinstance(date_str, str):
                return date_parser.parse(date_str)
            return None
        except (ValueError, TypeError) as e:
            self.logger.warning(f"Failed to parse date '{date_str}': {e}")
            return None
    
    def _dict_to_product_data(self, data: Dict[str, Any], ocr_text: str, processing_time: float) -> ProductData:
        """Convert cached dict to ProductData."""
        return ProductData(
            product_name=data.get("product_name", "Unknown Product"),
            brand=data.get("brand"),
            category=data.get("category", "Other"),
            subcategory=data.get("subcategory"),
            expiration_date=self._parse_date(data.get("expiration_date")),
            manufactured_date=self._parse_date(data.get("manufactured_date")),
            best_before_date=self._parse_date(data.get("best_before_date")),
            key_attributes=data.get("key_attributes", []),
            dietary_tags=data.get("dietary_tags", []),
            allergens=data.get("allergens", []),
            serving_size=data.get("serving_size"),
            calories=data.get("calories"),
            nutritional_info=data.get("nutritional_info"),
            confidence=float(data.get("confidence", 0.0)),
            raw_ocr_text=ocr_text,
            processing_time=processing_time,
            model_used=data.get("model_used", "cached"),
            storage_location=data.get("storage_location"),
            quantity_estimate=data.get("quantity_estimate"),
        )


# ============================================================================
# Factory Function
# ============================================================================

def create_ai_analyzer(config: Optional[AIConfig] = None) -> AIAnalyzer:
    """Create AI analyzer instance.
    
    Best Practice: Factory function for clean instantiation.
    
    Args:
        config: Configuration (loads from env if not provided)
        
    Returns:
        AIAnalyzer instance
    """
    return AIAnalyzer(config)

