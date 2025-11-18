"""
OCR Service for Smart Pantry Inventory System.

This module provides a unified interface for optical character recognition (OCR)
using multiple backends (Google Cloud Vision API and Tesseract OCR).

Best Practices Applied:
- SOLID Principles: Single responsibility, Open/Closed, Dependency Inversion
- Strategy Pattern: Pluggable OCR backends
- Facade Pattern: Simple interface hiding complexity
- DRY: Reusable components (caching, rate limiting, retry logic)
- KISS: Clear, simple implementation
- Defensive Programming: Validate inputs, handle all errors
- Type Hints: 100% coverage for better IDE support and type checking
- Comprehensive Documentation: Docstrings for all public APIs

Author: Smart Pantry Team
Date: 2025-11-18
"""

import hashlib
import logging
import os
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import diskcache
from PIL import Image

# OCR backends
from google.cloud import vision
from google.cloud.vision_v1 import ImageAnnotatorClient
import pytesseract

# Configure logging with structured format
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# ============================================================================
# Custom Exceptions - Clear Error Hierarchy
# ============================================================================
# Best Practice: Specific exception types make error handling more precise

class OCRError(Exception):
    """Base exception for OCR-related errors."""
    pass


class OCRBackendError(OCRError):
    """Raised when an OCR backend fails."""
    pass


class OCRRateLimitError(OCRError):
    """Raised when rate limit is exceeded."""
    pass


class OCRValidationError(OCRError):
    """Raised when input validation fails."""
    pass


# ============================================================================
# Data Classes - Immutable, Type-Safe Data Structures
# ============================================================================
# Best Practice: Use dataclasses for data containers (less boilerplate)
# Best Practice: frozen=True makes them immutable (safer, hashable)

@dataclass(frozen=True)
class BoundingBox:
    """
    Represents a text region with coordinates.
    
    Immutable data structure containing the location and content of
    detected text within an image.
    
    Attributes:
        x: X-coordinate of top-left corner (pixels)
        y: Y-coordinate of top-left corner (pixels)
        width: Width of bounding box (pixels)
        height: Height of bounding box (pixels)
        text: Extracted text content
        confidence: Confidence score (0.0 to 1.0)
    """
    x: int
    y: int
    width: int
    height: int
    text: str
    confidence: float
    
    def __post_init__(self) -> None:
        """Validate bounding box data."""
        # Best Practice: Validate data at construction time
        if not 0.0 <= self.confidence <= 1.0:
            raise OCRValidationError(
                f"Confidence must be between 0 and 1, got {self.confidence}"
            )
        if self.width < 0 or self.height < 0:
            raise OCRValidationError("Width and height must be non-negative")


@dataclass(frozen=True)
class OCRResult:
    """
    Standardized OCR output across all backends.
    
    This immutable data structure ensures consistent results regardless
    of which OCR backend was used.
    
    Attributes:
        raw_text: Complete extracted text
        confidence: Overall confidence score (0.0 to 1.0)
        bounding_boxes: List of text regions with coordinates
        detected_languages: List of ISO 639-1 language codes
        processing_time: Time taken to process (seconds)
        backend_used: Name of OCR backend used
        cached: Whether result came from cache
    """
    raw_text: str
    confidence: float
    bounding_boxes: list[BoundingBox]
    detected_languages: list[str]
    processing_time: float
    backend_used: str
    cached: bool = False
    
    def __post_init__(self) -> None:
        """Validate OCR result data."""
        if not 0.0 <= self.confidence <= 1.0:
            raise OCRValidationError(
                f"Confidence must be between 0 and 1, got {self.confidence}"
            )


@dataclass
class OCRConfig:
    """
    Configuration for OCR service.
    
    Centralizes all configuration options with sensible defaults.
    Best Practice: Single source of truth for configuration.
    
    Attributes:
        google_credentials_path: Path to Google Cloud credentials JSON
        tesseract_cmd: Path to Tesseract executable
        confidence_threshold: Minimum confidence to accept results
        cache_enabled: Whether to use result caching
        cache_dir: Directory for cache storage
        cache_ttl: Time-to-live for cached results (seconds)
        max_retries: Maximum retry attempts on failure
        retry_delay: Initial delay between retries (seconds)
        rate_limit_requests: Max requests per period
        rate_limit_period: Period for rate limiting (seconds)
        preferred_backend: Preferred OCR backend ('google' or 'tesseract')
    """
    google_credentials_path: Optional[str] = None
    tesseract_cmd: str = "tesseract"
    confidence_threshold: float = 0.85
    cache_enabled: bool = True
    cache_dir: str = "./cache/ocr"
    cache_ttl: int = 86400  # 24 hours
    max_retries: int = 3
    retry_delay: float = 1.0
    rate_limit_requests: int = 60
    rate_limit_period: int = 60
    preferred_backend: str = "google"
    
    def __post_init__(self) -> None:
        """Validate configuration values."""
        # Best Practice: Fail fast with clear error messages
        if not 0.0 <= self.confidence_threshold <= 1.0:
            raise OCRValidationError(
                f"Confidence threshold must be 0-1, got {self.confidence_threshold}"
            )
        if self.max_retries < 0:
            raise OCRValidationError("max_retries must be non-negative")
        if self.retry_delay < 0:
            raise OCRValidationError("retry_delay must be non-negative")
        if self.rate_limit_requests <= 0:
            raise OCRValidationError("rate_limit_requests must be positive")
        if self.rate_limit_period <= 0:
            raise OCRValidationError("rate_limit_period must be positive")
        if self.preferred_backend not in ("google", "tesseract"):
            raise OCRValidationError(
                f"preferred_backend must be 'google' or 'tesseract', "
                f"got '{self.preferred_backend}'"
            )
    
    @classmethod
    def from_env(cls) -> "OCRConfig":
        """
        Create configuration from environment variables.
        
        Best Practice: 12-Factor App - Configuration via environment.
        
        Environment Variables:
            GOOGLE_APPLICATION_CREDENTIALS: Path to Google Cloud credentials
            TESSERACT_CMD: Path to Tesseract executable
            OCR_CONFIDENCE_THRESHOLD: Minimum confidence threshold
            OCR_CACHE_ENABLED: Enable/disable caching (true/false)
            OCR_CACHE_DIR: Cache directory path
            OCR_CACHE_TTL: Cache time-to-live (seconds)
            OCR_MAX_RETRIES: Maximum retry attempts
            OCR_RETRY_DELAY: Retry delay (seconds)
            OCR_RATE_LIMIT_REQUESTS: Rate limit requests per period
            OCR_RATE_LIMIT_PERIOD: Rate limit period (seconds)
            OCR_PREFERRED_BACKEND: Preferred backend (google/tesseract)
        
        Returns:
            OCRConfig instance with values from environment
        """
        return cls(
            google_credentials_path=os.getenv("GOOGLE_APPLICATION_CREDENTIALS"),
            tesseract_cmd=os.getenv("TESSERACT_CMD", "tesseract"),
            confidence_threshold=float(
                os.getenv("OCR_CONFIDENCE_THRESHOLD", "0.85")
            ),
            cache_enabled=os.getenv("OCR_CACHE_ENABLED", "true").lower() == "true",
            cache_dir=os.getenv("OCR_CACHE_DIR", "./cache/ocr"),
            cache_ttl=int(os.getenv("OCR_CACHE_TTL", "86400")),
            max_retries=int(os.getenv("OCR_MAX_RETRIES", "3")),
            retry_delay=float(os.getenv("OCR_RETRY_DELAY", "1.0")),
            rate_limit_requests=int(os.getenv("OCR_RATE_LIMIT_REQUESTS", "60")),
            rate_limit_period=int(os.getenv("OCR_RATE_LIMIT_PERIOD", "60")),
            preferred_backend=os.getenv("OCR_PREFERRED_BACKEND", "google"),
        )


# ============================================================================
# Rate Limiter - Token Bucket Algorithm
# ============================================================================
# Best Practice: Prevent API quota exhaustion with rate limiting

class RateLimiter:
    """
    Rate limiter using token bucket algorithm.
    
    Ensures API calls stay within configured limits to prevent quota
    exhaustion and additional costs.
    
    Best Practice: Token bucket allows bursts while maintaining average rate.
    """
    
    def __init__(self, requests: int, period: int) -> None:
        """
        Initialize rate limiter.
        
        Args:
            requests: Maximum requests allowed per period
            period: Time period in seconds
        """
        self.requests = requests
        self.period = period
        self.tokens = requests
        self.last_update = time.time()
        logger.info(
            f"Rate limiter initialized: {requests} requests per {period}s"
        )
    
    def acquire(self) -> None:
        """
        Acquire a token, blocking if necessary.
        
        Best Practice: Block instead of fail to provide smooth experience.
        
        Raises:
            OCRRateLimitError: If rate limit would be exceeded
        """
        now = time.time()
        elapsed = now - self.last_update
        
        # Refill tokens based on elapsed time
        # Best Practice: Token bucket refills gradually
        self.tokens = min(
            self.requests,
            self.tokens + (elapsed * self.requests / self.period)
        )
        self.last_update = now
        
        if self.tokens < 1:
            # Calculate wait time
            wait_time = (1 - self.tokens) * self.period / self.requests
            logger.warning(f"Rate limit reached, waiting {wait_time:.2f}s")
            time.sleep(wait_time)
            self.tokens = 0
        else:
            self.tokens -= 1


# ============================================================================
# Cache Layer - Disk-Based Caching
# ============================================================================
# Best Practice: Cache expensive operations to reduce costs and latency

class OCRCache:
    """
    Disk-based cache for OCR results.
    
    Uses content-based hashing (SHA256) to avoid re-processing identical images.
    Best Practice: Caching by content hash ensures cache hits even if file moves.
    """
    
    def __init__(self, cache_dir: str, ttl: int = 86400) -> None:
        """
        Initialize cache.
        
        Args:
            cache_dir: Directory for cache storage
            ttl: Time-to-live for cached entries (seconds)
        """
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.ttl = ttl
        # Best Practice: Use battle-tested library (diskcache) instead of rolling own
        self.cache = diskcache.Cache(str(self.cache_dir))
        logger.info(f"Cache initialized at {self.cache_dir} with TTL {ttl}s")
    
    def _compute_hash(self, image_path: str) -> str:
        """
        Compute SHA256 hash of image content.
        
        Best Practice: Hash content, not filename (robust to file moves).
        
        Args:
            image_path: Path to image file
            
        Returns:
            Hexadecimal hash string
        """
        sha256 = hashlib.sha256()
        with open(image_path, 'rb') as f:
            # Read in chunks for memory efficiency
            for chunk in iter(lambda: f.read(8192), b''):
                sha256.update(chunk)
        return sha256.hexdigest()
    
    def get(self, image_path: str) -> Optional[OCRResult]:
        """
        Retrieve cached OCR result.
        
        Args:
            image_path: Path to image file
            
        Returns:
            Cached OCRResult or None if not found/expired
        """
        try:
            key = self._compute_hash(image_path)
            result = self.cache.get(key)
            if result:
                logger.info(f"Cache hit for {Path(image_path).name}")
                return result
            logger.debug(f"Cache miss for {Path(image_path).name}")
            return None
        except Exception as e:
            logger.warning(f"Cache get failed: {e}")
            return None
    
    def set(self, image_path: str, result: OCRResult) -> None:
        """
        Store OCR result in cache.
        
        Args:
            image_path: Path to image file
            result: OCR result to cache
        """
        try:
            key = self._compute_hash(image_path)
            self.cache.set(key, result, expire=self.ttl)
            logger.debug(f"Cached result for {Path(image_path).name}")
        except Exception as e:
            logger.warning(f"Cache set failed: {e}")
    
    def clear(self) -> None:
        """Clear all cached entries."""
        self.cache.clear()
        logger.info("Cache cleared")
    
    def stats(self) -> dict:
        """
        Get cache statistics.
        
        Returns:
            Dictionary with cache stats (size, hit rate, etc.)
        """
        return {
            'size': len(self.cache),
            'directory': str(self.cache_dir),
            'ttl': self.ttl
        }


# ============================================================================
# Abstract Base Class - OCR Backend Interface
# ============================================================================
# Best Practice: Program to interfaces, not implementations (SOLID)
# Best Practice: Open/Closed Principle - open for extension, closed for modification

class OCRBackend(ABC):
    """
    Abstract base class for OCR backends.
    
    Defines the interface that all OCR implementations must follow.
    This allows adding new backends without modifying existing code.
    
    Best Practice: Strategy Pattern - encapsulate interchangeable algorithms.
    """
    
    def __init__(self, config: OCRConfig) -> None:
        """
        Initialize OCR backend.
        
        Args:
            config: OCR configuration
        """
        self.config = config
    
    @abstractmethod
    def extract_text(self, image_path: str) -> OCRResult:
        """
        Extract text from image.
        
        Args:
            image_path: Path to image file
            
        Returns:
            OCR result with extracted text and metadata
            
        Raises:
            OCRBackendError: If OCR extraction fails
            OCRValidationError: If image is invalid
        """
        pass
    
    @abstractmethod
    def is_available(self) -> bool:
        """
        Check if backend is configured and available.
        
        Returns:
            True if backend can be used, False otherwise
        """
        pass
    
    @abstractmethod
    def get_name(self) -> str:
        """
        Get backend name.
        
        Returns:
            Human-readable backend name
        """
        pass
    
    def _validate_image(self, image_path: str) -> None:
        """
        Validate image file.
        
        Best Practice: Validate inputs early (fail fast).
        
        Args:
            image_path: Path to image file
            
        Raises:
            OCRValidationError: If image is invalid
        """
        path = Path(image_path)
        
        if not path.exists():
            raise OCRValidationError(f"Image file not found: {image_path}")
        
        if not path.is_file():
            raise OCRValidationError(f"Not a file: {image_path}")
        
        # Validate image can be opened
        try:
            with Image.open(image_path) as img:
                img.verify()
        except Exception as e:
            raise OCRValidationError(f"Invalid image file: {e}")


# ============================================================================
# Google Cloud Vision OCR Backend
# ============================================================================

class GoogleVisionOCR(OCRBackend):
    """
    Google Cloud Vision API OCR backend.
    
    High accuracy, cloud-based OCR with excellent language support.
    Best suited as primary backend due to superior accuracy.
    
    Pros:
        - High accuracy (especially for complex layouts)
        - Excellent language detection
        - Reliable bounding boxes
        
    Cons:
        - Requires API key and internet
        - Costs money per request
        - Rate limited by Google
    """
    
    def __init__(self, config: OCRConfig) -> None:
        """Initialize Google Vision OCR backend."""
        super().__init__(config)
        self.client: Optional[ImageAnnotatorClient] = None
        
        if self.is_available():
            try:
                # Handle credentials: file path (local) or JSON content (Railway)
                creds_value = self.config.google_credentials_path
                if creds_value and creds_value.startswith('{'):
                    # JSON content in environment variable (Railway)
                    import json
                    import tempfile
                    creds_dict = json.loads(creds_value)
                    # Create temporary file for credentials
                    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
                        json.dump(creds_dict, f)
                        temp_creds_path = f.name
                    os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = temp_creds_path
                    logger.info("Using Google credentials from environment variable (JSON content)")
                elif creds_value and os.path.exists(creds_value):
                    # File path (local development)
                    os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = creds_value
                    logger.info(f"Using Google credentials from file: {creds_value}")
                
                self.client = vision.ImageAnnotatorClient()
                logger.info("Google Vision OCR backend initialized")
            except Exception as e:
                logger.error(f"Failed to initialize Google Vision client: {e}")
                self.client = None
    
    def is_available(self) -> bool:
        """Check if Google Vision is configured.
        
        Supports both:
        - File path (local): /path/to/credentials.json
        - JSON content (Railway): {"type":"service_account",...}
        """
        creds_value = self.config.google_credentials_path
        if not creds_value:
            return False
        
        # Check if it's JSON content (starts with {)
        if creds_value.strip().startswith('{'):
            try:
                import json
                json.loads(creds_value)  # Validate JSON
                return True
            except (json.JSONDecodeError, ValueError):
                return False
        
        # Check if it's a valid file path
        return os.path.exists(creds_value)
    
    def get_name(self) -> str:
        """Get backend name."""
        return "Google Cloud Vision"
    
    def extract_text(self, image_path: str) -> OCRResult:
        """
        Extract text using Google Cloud Vision API.
        
        Args:
            image_path: Path to image file
            
        Returns:
            OCR result with extracted text and metadata
            
        Raises:
            OCRBackendError: If API call fails
            OCRValidationError: If image is invalid
        """
        self._validate_image(image_path)
        
        if not self.is_available() or self.client is None:
            raise OCRBackendError("Google Vision client not available")
        
        start_time = time.time()
        
        try:
            # Read image content
            with open(image_path, 'rb') as image_file:
                content = image_file.read()
            
            image = vision.Image(content=content)
            
            # Perform text detection
            response = self.client.text_detection(image=image)
            
            if response.error.message:
                raise OCRBackendError(
                    f"Google Vision API error: {response.error.message}"
                )
            
            # Extract full text
            texts = response.text_annotations
            if not texts:
                # No text detected
                processing_time = time.time() - start_time
                return OCRResult(
                    raw_text="",
                    confidence=0.0,
                    bounding_boxes=[],
                    detected_languages=[],
                    processing_time=processing_time,
                    backend_used=self.get_name()
                )
            
            # First annotation contains full text
            full_text = texts[0].description
            
            # Extract bounding boxes from remaining annotations
            bounding_boxes = []
            confidences = []
            
            for text in texts[1:]:  # Skip first (full text)
                vertices = text.bounding_poly.vertices
                if len(vertices) >= 2:
                    x = vertices[0].x
                    y = vertices[0].y
                    width = vertices[1].x - vertices[0].x
                    height = vertices[2].y - vertices[0].y
                    
                    # Google Vision doesn't provide word-level confidence
                    # Use 1.0 as placeholder (indicates high-quality source)
                    confidence = 1.0
                    confidences.append(confidence)
                    
                    bounding_boxes.append(BoundingBox(
                        x=x,
                        y=y,
                        width=max(width, 1),
                        height=max(height, 1),
                        text=text.description,
                        confidence=confidence
                    ))
            
            # Detect languages
            detected_languages = []
            if texts[0].locale:
                detected_languages.append(texts[0].locale)
            
            # Calculate overall confidence (Google Vision is typically high)
            overall_confidence = sum(confidences) / len(confidences) if confidences else 0.95
            
            processing_time = time.time() - start_time
            
            logger.info(
                f"Google Vision OCR completed in {processing_time:.2f}s: "
                f"{len(full_text)} chars, {len(bounding_boxes)} regions"
            )
            
            return OCRResult(
                raw_text=full_text,
                confidence=overall_confidence,
                bounding_boxes=bounding_boxes,
                detected_languages=detected_languages,
                processing_time=processing_time,
                backend_used=self.get_name()
            )
            
        except Exception as e:
            raise OCRBackendError(f"Google Vision extraction failed: {e}")


# ============================================================================
# Tesseract OCR Backend
# ============================================================================

class TesseractOCR(OCRBackend):
    """
    Tesseract OCR backend.
    
    Free, open-source, local OCR engine.
    Best suited as fallback or for offline use.
    
    Pros:
        - Free and open source
        - Works offline
        - No rate limits
        
    Cons:
        - Lower accuracy than cloud services
        - Slower processing
        - Requires local installation
    """
    
    def __init__(self, config: OCRConfig) -> None:
        """Initialize Tesseract OCR backend."""
        super().__init__(config)
        
        # Configure Tesseract command path
        if config.tesseract_cmd != "tesseract":
            pytesseract.pytesseract.tesseract_cmd = config.tesseract_cmd
        
        if self.is_available():
            logger.info("Tesseract OCR backend initialized")
    
    def is_available(self) -> bool:
        """Check if Tesseract is installed."""
        try:
            pytesseract.get_tesseract_version()
            return True
        except Exception:
            return False
    
    def get_name(self) -> str:
        """Get backend name."""
        return "Tesseract OCR"
    
    def extract_text(self, image_path: str) -> OCRResult:
        """
        Extract text using Tesseract OCR.
        
        Args:
            image_path: Path to image file
            
        Returns:
            OCR result with extracted text and metadata
            
        Raises:
            OCRBackendError: If OCR fails
            OCRValidationError: If image is invalid
        """
        self._validate_image(image_path)
        
        if not self.is_available():
            raise OCRBackendError("Tesseract is not installed")
        
        start_time = time.time()
        
        try:
            # Open image
            image = Image.open(image_path)
            
            # Extract full text
            full_text = pytesseract.image_to_string(image)
            
            # Extract detailed data with bounding boxes
            data = pytesseract.image_to_data(
                image,
                output_type=pytesseract.Output.DICT
            )
            
            # Build bounding boxes from detailed data
            bounding_boxes = []
            confidences = []
            
            n_boxes = len(data['text'])
            for i in range(n_boxes):
                text = data['text'][i].strip()
                if not text:
                    continue
                
                conf = float(data['conf'][i]) / 100.0  # Convert 0-100 to 0-1
                if conf < 0:  # Tesseract uses -1 for no confidence
                    conf = 0.0
                
                confidences.append(conf)
                
                bounding_boxes.append(BoundingBox(
                    x=int(data['left'][i]),
                    y=int(data['top'][i]),
                    width=int(data['width'][i]),
                    height=int(data['height'][i]),
                    text=text,
                    confidence=conf
                ))
            
            # Detect languages (Tesseract can detect, but it's less reliable)
            try:
                osd = pytesseract.image_to_osd(image, output_type=pytesseract.Output.DICT)
                detected_languages = [osd.get('script', 'eng').lower()]
            except Exception:
                detected_languages = ['eng']  # Default to English
            
            # Calculate overall confidence
            overall_confidence = sum(confidences) / len(confidences) if confidences else 0.0
            
            processing_time = time.time() - start_time
            
            logger.info(
                f"Tesseract OCR completed in {processing_time:.2f}s: "
                f"{len(full_text)} chars, {len(bounding_boxes)} regions, "
                f"confidence {overall_confidence:.2f}"
            )
            
            return OCRResult(
                raw_text=full_text,
                confidence=overall_confidence,
                bounding_boxes=bounding_boxes,
                detected_languages=detected_languages,
                processing_time=processing_time,
                backend_used=self.get_name()
            )
            
        except Exception as e:
            raise OCRBackendError(f"Tesseract extraction failed: {e}")


# ============================================================================
# Main OCR Service - Facade Pattern
# ============================================================================
# Best Practice: Facade provides simple interface to complex subsystem

class OCRService:
    """
    Unified OCR service with multiple backends and intelligent fallback.
    
    This is the main entry point for OCR operations. It coordinates
    multiple OCR backends, caching, rate limiting, and error handling.
    
    Features:
        - Multiple OCR backends (Google Vision, Tesseract)
        - Automatic fallback on failure
        - Result caching to reduce costs
        - Rate limiting to prevent quota exhaustion
        - Retry logic with exponential backoff
        - Comprehensive error handling
        
    Best Practices:
        - Facade Pattern: Simple interface hiding complexity
        - Strategy Pattern: Pluggable OCR backends
        - Dependency Injection: Testable design
        - Graceful Degradation: Fallback to alternative backends
    
    Example:
        >>> config = OCRConfig.from_env()
        >>> service = OCRService(config)
        >>> result = service.extract_text("image.jpg")
        >>> print(f"Text: {result.raw_text}")
        >>> print(f"Confidence: {result.confidence:.2%}")
    """
    
    def __init__(self, config: Optional[OCRConfig] = None) -> None:
        """
        Initialize OCR service.
        
        Args:
            config: OCR configuration (defaults to environment-based config)
        """
        self.config = config or OCRConfig.from_env()
        
        # Initialize backends
        self.backends: dict[str, OCRBackend] = {
            'google': GoogleVisionOCR(self.config),
            'tesseract': TesseractOCR(self.config)
        }
        
        # Initialize cache
        self.cache: Optional[OCRCache] = None
        if self.config.cache_enabled:
            self.cache = OCRCache(self.config.cache_dir, self.config.cache_ttl)
        
        # Initialize rate limiter
        self.rate_limiter = RateLimiter(
            self.config.rate_limit_requests,
            self.config.rate_limit_period
        )
        
        # Determine available backends
        self.available_backends = [
            name for name, backend in self.backends.items()
            if backend.is_available()
        ]
        
        if not self.available_backends:
            logger.warning("No OCR backends available!")
        else:
            logger.info(f"Available OCR backends: {', '.join(self.available_backends)}")
    
    def extract_text(self, image_path: str) -> dict:
        """
        Extract text from image using best available backend.
        
        This method:
        1. Checks cache first (if enabled)
        2. Validates image
        3. Applies rate limiting
        4. Tries preferred backend with retry logic
        5. Falls back to alternative backend on failure
        6. Caches successful results
        
        Best Practice: Cache-Aside Pattern for performance.
        Best Practice: Graceful degradation with fallback.
        
        Args:
            image_path: Path to image file
            
        Returns:
            Dictionary with OCR results:
            {
                'raw_text': str,
                'confidence': float,
                'bounding_boxes': list[dict],
                'detected_languages': list[str]
            }
            
        Raises:
            OCRValidationError: If image is invalid
            OCRBackendError: If all backends fail
        """
        # Check cache first
        if self.cache:
            cached_result = self.cache.get(image_path)
            if cached_result:
                # Return cached result as dict
                return self._result_to_dict(cached_result, cached=True)
        
        # Determine backend order
        backend_order = self._get_backend_order()
        
        if not backend_order:
            raise OCRBackendError("No OCR backends available")
        
        # Try each backend with retry logic
        last_error = None
        for backend_name in backend_order:
            try:
                # Apply rate limiting (mainly for API backends)
                if backend_name == 'google':
                    self.rate_limiter.acquire()
                
                # Extract with retry
                result = self._extract_with_retry(backend_name, image_path)
                
                # Check confidence threshold
                if result.confidence < self.config.confidence_threshold:
                    logger.warning(
                        f"{result.backend_used} confidence {result.confidence:.2f} "
                        f"below threshold {self.config.confidence_threshold:.2f}"
                    )
                    # Don't fail, just warn (might be legitimate low-confidence result)
                
                # Cache successful result
                if self.cache:
                    self.cache.set(image_path, result)
                
                # Return as dict
                return self._result_to_dict(result)
                
            except (OCRBackendError, OCRValidationError) as e:
                last_error = e
                logger.warning(
                    f"{backend_name} failed: {e}, "
                    f"trying next backend..."
                )
                continue
        
        # All backends failed
        raise OCRBackendError(
            f"All OCR backends failed. Last error: {last_error}"
        )
    
    def _get_backend_order(self) -> list[str]:
        """
        Determine backend processing order.
        
        Best Practice: Prefer faster/better backends first.
        
        Returns:
            List of backend names in order of preference
        """
        preferred = self.config.preferred_backend
        
        if preferred in self.available_backends:
            # Preferred backend first, others as fallback
            order = [preferred]
            order.extend([b for b in self.available_backends if b != preferred])
            return order
        else:
            # Preferred not available, use any available
            return self.available_backends
    
    def _extract_with_retry(
        self,
        backend_name: str,
        image_path: str
    ) -> OCRResult:
        """
        Extract text with exponential backoff retry.
        
        Best Practice: Retry transient failures with exponential backoff.
        
        Args:
            backend_name: Name of backend to use
            image_path: Path to image file
            
        Returns:
            OCR result
            
        Raises:
            OCRBackendError: If all retries fail
        """
        backend = self.backends[backend_name]
        
        for attempt in range(self.config.max_retries):
            try:
                return backend.extract_text(image_path)
            except OCRBackendError as e:
                if attempt < self.config.max_retries - 1:
                    # Exponential backoff: delay * 2^attempt
                    delay = self.config.retry_delay * (2 ** attempt)
                    logger.warning(
                        f"{backend_name} attempt {attempt + 1} failed: {e}, "
                        f"retrying in {delay:.2f}s..."
                    )
                    time.sleep(delay)
                else:
                    # Last attempt failed
                    raise
        
        # Should never reach here, but for type checker
        raise OCRBackendError(f"{backend_name} exhausted all retries")
    
    def _result_to_dict(
        self,
        result: OCRResult,
        cached: bool = False
    ) -> dict:
        """
        Convert OCRResult to dictionary format.
        
        Args:
            result: OCR result object
            cached: Whether result came from cache
            
        Returns:
            Dictionary representation matching API contract
        """
        return {
            'raw_text': result.raw_text,
            'confidence': result.confidence,
            'bounding_boxes': [
                {
                    'x': bb.x,
                    'y': bb.y,
                    'width': bb.width,
                    'height': bb.height,
                    'text': bb.text,
                    'confidence': bb.confidence
                }
                for bb in result.bounding_boxes
            ],
            'detected_languages': result.detected_languages,
            'processing_time': result.processing_time,
            'backend_used': result.backend_used,
            'cached': cached or result.cached
        }
    
    def get_cache_stats(self) -> dict:
        """
        Get cache statistics.
        
        Returns:
            Dictionary with cache stats or empty dict if cache disabled
        """
        if self.cache:
            return self.cache.stats()
        return {}
    
    def clear_cache(self) -> None:
        """Clear cache if enabled."""
        if self.cache:
            self.cache.clear()
            logger.info("OCR cache cleared")


# ============================================================================
# Module-level convenience functions
# ============================================================================

def create_ocr_service(config: Optional[OCRConfig] = None) -> OCRService:
    """
    Factory function to create OCR service.
    
    Best Practice: Factory pattern for object creation.
    
    Args:
        config: Optional configuration (defaults to environment-based)
        
    Returns:
        Configured OCR service instance
    """
    return OCRService(config)


__all__ = [
    'OCRService',
    'OCRConfig',
    'OCRResult',
    'BoundingBox',
    'OCRBackend',
    'GoogleVisionOCR',
    'TesseractOCR',
    'OCRCache',
    'RateLimiter',
    'OCRError',
    'OCRBackendError',
    'OCRRateLimitError',
    'OCRValidationError',
    'create_ocr_service',
]

