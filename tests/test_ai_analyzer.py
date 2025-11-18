"""
Comprehensive tests for AI Analyzer module.

Tests cover:
- Configuration loading and validation
- Data models and serialization
- Backend availability and selection
- OpenAI integration
- Claude integration  
- Caching behavior
- Batch processing
- Error handling

Run:
    pytest tests/test_ai_analyzer.py -v
    pytest tests/test_ai_analyzer.py --cov=src.ai_analyzer
"""

import json
import os
from datetime import datetime
from pathlib import Path
from unittest.mock import MagicMock, Mock, patch

import pytest

from src.ai_analyzer import (
    AIAnalyzer,
    AIBackend,
    AICache,
    AIConfig,
    ClaudeBackend,
    OpenAIBackend,
    PRODUCT_CATEGORIES,
    ProductData,
    create_ai_analyzer,
)


# ============================================================================
# Fixtures
# ============================================================================

@pytest.fixture
def config() -> AIConfig:
    """Create test configuration."""
    return AIConfig(
        provider="openai",
        model="gpt-4-turbo-preview",
        openai_api_key="test-openai-key",
        anthropic_api_key="test-anthropic-key",
        temperature=0.0,
        max_tokens=2000,
        min_confidence=0.7,
        cache_enabled=True,
        cache_dir="./test_cache/ai",
    )


@pytest.fixture
def mock_openai_response() -> dict:
    """Mock OpenAI API response."""
    return {
        "product_name": "Test Product",
        "brand": "Test Brand",
        "category": "Grains & Pasta",
        "subcategory": "Rice",
        "expiration_date": "2025-12-31",
        "key_attributes": ["Organic", "Non-GMO"],
        "dietary_tags": ["vegan", "organic"],
        "allergens": [],
        "confidence": 0.95
    }


@pytest.fixture
def mock_claude_response() -> dict:
    """Mock Claude API response."""
    return {
        "product_name": "Claude Test Product",
        "brand": "Claude Brand",
        "category": "Canned Goods",
        "expiration_date": "2024-06-30",
        "key_attributes": ["Low Sodium"],
        "dietary_tags": ["gluten-free"],
        "allergens": ["soy"],
        "confidence": 0.92
    }


@pytest.fixture
def sample_ocr_result() -> dict:
    """Sample OCR result for testing."""
    return {
        "raw_text": "KOYO REDUCED SODIUM TOFU MISO RAMEN VEGAN EXP 2021/12",
        "confidence": 0.95,
        "bounding_boxes": [],
        "detected_languages": ["en"],
    }


@pytest.fixture
def cleanup_cache():
    """Clean up test cache after tests."""
    yield
    cache_dir = Path("./test_cache/ai")
    if cache_dir.exists():
        import shutil
        shutil.rmtree(cache_dir)


# ============================================================================
# Configuration Tests
# ============================================================================

def test_ai_config_creation():
    """Test AI configuration creation with defaults."""
    config = AIConfig()
    
    assert config.provider == "openai"
    assert config.model == "gpt-4-turbo-preview"
    assert config.temperature == 0.0
    assert config.max_tokens == 2000
    assert config.min_confidence == 0.7
    assert config.cache_enabled is True


def test_ai_config_validation():
    """Test configuration validation."""
    # Invalid temperature
    with pytest.raises(ValueError, match="Temperature must be"):
        AIConfig(temperature=1.5)
    
    # Invalid confidence
    with pytest.raises(ValueError, match="min_confidence must be"):
        AIConfig(min_confidence=-0.1)
    
    # Invalid max_tokens
    with pytest.raises(ValueError, match="max_tokens must be"):
        AIConfig(max_tokens=50)


def test_ai_config_from_env():
    """Test loading configuration from environment."""
    with patch.dict(os.environ, {
        "AI_PROVIDER": "anthropic",
        "AI_MODEL": "claude-3-5-sonnet-20241022",
        "AI_TEMPERATURE": "0.1",
        "AI_MAX_TOKENS": "1500",
        "AI_MIN_CONFIDENCE": "0.8",
        "OPENAI_API_KEY": "env-openai-key",
        "ANTHROPIC_API_KEY": "env-anthropic-key",
    }):
        config = AIConfig.from_env()
        
        assert config.provider == "anthropic"
        assert config.model == "claude-3-5-sonnet-20241022"
        assert config.temperature == 0.1
        assert config.max_tokens == 1500
        assert config.min_confidence == 0.8
        assert config.openai_api_key == "env-openai-key"
        assert config.anthropic_api_key == "env-anthropic-key"


# ============================================================================
# Data Model Tests
# ============================================================================

def test_product_data_creation():
    """Test ProductData creation."""
    product = ProductData(
        product_name="Test Product",
        brand="Test Brand",
        category="Grains & Pasta",
        confidence=0.95,
        raw_ocr_text="test text",
    )
    
    assert product.product_name == "Test Product"
    assert product.brand == "Test Brand"
    assert product.category == "Grains & Pasta"
    assert product.confidence == 0.95
    assert product.key_attributes == []
    assert product.dietary_tags == []


def test_product_data_to_dict():
    """Test ProductData serialization."""
    product = ProductData(
        product_name="Test Product",
        brand="Test Brand",
        category="Snacks",
        expiration_date=datetime(2025, 12, 31),
        key_attributes=["Organic"],
        dietary_tags=["vegan"],
        confidence=0.90,
        raw_ocr_text="test",
    )
    
    data = product.to_dict()
    
    assert data["product_name"] == "Test Product"
    assert data["brand"] == "Test Brand"
    assert data["category"] == "Snacks"
    assert data["expiration_date"] == "2025-12-31T00:00:00"
    assert data["key_attributes"] == ["Organic"]
    assert data["dietary_tags"] == ["vegan"]
    assert data["confidence"] == 0.90


# ============================================================================
# Category Tests
# ============================================================================

def test_product_categories_defined():
    """Test that product categories are defined."""
    assert len(PRODUCT_CATEGORIES) > 0
    assert "Grains & Pasta" in PRODUCT_CATEGORIES
    assert "Canned Goods" in PRODUCT_CATEGORIES
    assert "Condiments & Sauces" in PRODUCT_CATEGORIES


# ============================================================================
# Backend Tests
# ============================================================================

def test_openai_backend_availability(config: AIConfig):
    """Test OpenAI backend availability check."""
    backend = OpenAIBackend(config)
    assert backend.is_available() is True
    
    # Test without API key
    config_no_key = AIConfig(openai_api_key=None)
    backend_no_key = OpenAIBackend(config_no_key)
    assert backend_no_key.is_available() is False


def test_claude_backend_availability(config: AIConfig):
    """Test Claude backend availability check."""
    backend = ClaudeBackend(config)
    assert backend.is_available() is True
    
    # Test without API key
    config_no_key = AIConfig(anthropic_api_key=None)
    backend_no_key = ClaudeBackend(config_no_key)
    assert backend_no_key.is_available() is False


def test_backend_prompt_building(config: AIConfig):
    """Test prompt building."""
    backend = OpenAIBackend(config)
    
    prompt = backend._build_extraction_prompt("TEST OCR TEXT")
    
    assert "TEST OCR TEXT" in prompt
    assert "product_name" in prompt
    assert "brand" in prompt
    assert "category" in prompt
    assert "confidence" in prompt
    
    # Check few-shot examples included
    assert "Koyo" in prompt or "KOYO" in prompt.upper()


@patch('openai.OpenAI')
def test_openai_extraction(mock_openai_class, config: AIConfig, mock_openai_response: dict):
    """Test OpenAI product extraction."""
    # Mock OpenAI client
    mock_client = Mock()
    mock_openai_class.return_value = mock_client
    
    # Mock response
    mock_response = Mock()
    mock_response.choices = [Mock()]
    mock_response.choices[0].message.content = json.dumps(mock_openai_response)
    mock_response.usage.total_tokens = 500
    mock_client.chat.completions.create.return_value = mock_response
    
    # Create backend and extract
    backend = OpenAIBackend(config)
    result = backend.extract_product_info("test ocr text")
    
    assert result["product_name"] == "Test Product"
    assert result["brand"] == "Test Brand"
    assert result["confidence"] == 0.95


@patch('anthropic.Anthropic')
def test_claude_extraction(mock_anthropic_class, config: AIConfig, mock_claude_response: dict):
    """Test Claude product extraction."""
    # Mock Anthropic client
    mock_client = Mock()
    mock_anthropic_class.return_value = mock_client
    
    # Mock response
    mock_message = Mock()
    mock_message.content = [Mock()]
    mock_message.content[0].text = json.dumps(mock_claude_response)
    mock_message.usage.input_tokens = 200
    mock_message.usage.output_tokens = 300
    mock_client.messages.create.return_value = mock_message
    
    # Create backend and extract
    backend = ClaudeBackend(config)
    result = backend.extract_product_info("test ocr text")
    
    assert result["product_name"] == "Claude Test Product"
    assert result["brand"] == "Claude Brand"
    assert result["confidence"] == 0.92


# ============================================================================
# Cache Tests
# ============================================================================

def test_cache_initialization(cleanup_cache):
    """Test cache initialization."""
    cache = AICache(cache_dir="./test_cache/ai", ttl=3600)
    
    assert cache.cache_dir.exists()
    assert cache.ttl == 3600


def test_cache_set_get(cleanup_cache):
    """Test cache set and get operations."""
    cache = AICache(cache_dir="./test_cache/ai", ttl=3600)
    
    test_data = {"product_name": "Cached Product", "confidence": 0.88}
    ocr_text = "test cache text"
    
    # Set cache
    cache.set(ocr_text, test_data)
    
    # Get cache
    cached_data = cache.get(ocr_text)
    
    assert cached_data is not None
    assert cached_data["product_name"] == "Cached Product"
    assert cached_data["confidence"] == 0.88


def test_cache_miss(cleanup_cache):
    """Test cache miss."""
    cache = AICache(cache_dir="./test_cache/ai", ttl=3600)
    
    result = cache.get("nonexistent text")
    assert result is None


def test_cache_clear(cleanup_cache):
    """Test cache clearing."""
    cache = AICache(cache_dir="./test_cache/ai", ttl=3600)
    
    # Add some data
    cache.set("text1", {"data": 1})
    cache.set("text2", {"data": 2})
    
    # Clear cache
    cache.clear()
    
    # Verify cleared
    assert cache.get("text1") is None
    assert cache.get("text2") is None


# ============================================================================
# AI Analyzer Tests
# ============================================================================

@patch.dict(os.environ, {"OPENAI_API_KEY": "test-key"})
def test_analyzer_initialization():
    """Test analyzer initialization."""
    analyzer = AIAnalyzer()
    
    assert analyzer.config is not None
    assert len(analyzer.backends) > 0


@patch.dict(os.environ, {"OPENAI_API_KEY": "test-key"})
def test_analyzer_backend_selection():
    """Test backend selection logic."""
    analyzer = AIAnalyzer()
    
    backend = analyzer._get_backend()
    assert backend is not None
    assert isinstance(backend, AIBackend)


@patch('openai.OpenAI')
@patch.dict(os.environ, {"OPENAI_API_KEY": "test-key"})
def test_analyzer_product_analysis(mock_openai_class, sample_ocr_result: dict, mock_openai_response: dict, cleanup_cache):
    """Test full product analysis."""
    # Mock OpenAI
    mock_client = Mock()
    mock_openai_class.return_value = mock_client
    
    mock_response = Mock()
    mock_response.choices = [Mock()]
    mock_response.choices[0].message.content = json.dumps(mock_openai_response)
    mock_response.usage.total_tokens = 500
    mock_client.chat.completions.create.return_value = mock_response
    
    # Create analyzer
    config = AIConfig(
        openai_api_key="test-key",
        cache_enabled=True,
        cache_dir="./test_cache/ai"
    )
    analyzer = AIAnalyzer(config)
    
    # Analyze
    product = analyzer.analyze_product(sample_ocr_result)
    
    assert product.product_name == "Test Product"
    assert product.brand == "Test Brand"
    assert product.category == "Grains & Pasta"
    assert product.confidence == 0.95
    assert product.processing_time > 0


@patch('openai.OpenAI')
@patch.dict(os.environ, {"OPENAI_API_KEY": "test-key"})
def test_analyzer_caching(mock_openai_class, sample_ocr_result: dict, mock_openai_response: dict, cleanup_cache):
    """Test that caching works."""
    # Mock OpenAI
    mock_client = Mock()
    mock_openai_class.return_value = mock_client
    
    mock_response = Mock()
    mock_response.choices = [Mock()]
    mock_response.choices[0].message.content = json.dumps(mock_openai_response)
    mock_response.usage.total_tokens = 500
    mock_client.chat.completions.create.return_value = mock_response
    
    # Create analyzer with cache
    config = AIConfig(
        openai_api_key="test-key",
        cache_enabled=True,
        cache_dir="./test_cache/ai"
    )
    analyzer = AIAnalyzer(config)
    
    # First call
    product1 = analyzer.analyze_product(sample_ocr_result)
    
    # Second call (should be cached)
    product2 = analyzer.analyze_product(sample_ocr_result)
    
    # API should only be called once
    assert mock_client.chat.completions.create.call_count == 1
    
    # Results should match
    assert product1.product_name == product2.product_name
    assert product1.confidence == product2.confidence


@patch('openai.OpenAI')
@patch.dict(os.environ, {"OPENAI_API_KEY": "test-key"})
def test_analyzer_batch_processing(mock_openai_class, mock_openai_response: dict, cleanup_cache):
    """Test batch processing."""
    # Mock OpenAI
    mock_client = Mock()
    mock_openai_class.return_value = mock_client
    
    mock_response = Mock()
    mock_response.choices = [Mock()]
    mock_response.choices[0].message.content = json.dumps(mock_openai_response)
    mock_response.usage.total_tokens = 500
    mock_client.chat.completions.create.return_value = mock_response
    
    # Create analyzer
    config = AIConfig(
        openai_api_key="test-key",
        cache_enabled=False  # Disable cache for this test
    )
    analyzer = AIAnalyzer(config)
    
    # Batch process
    ocr_results = [
        {"raw_text": "Product 1", "confidence": 0.9},
        {"raw_text": "Product 2", "confidence": 0.85},
        {"raw_text": "Product 3", "confidence": 0.92},
    ]
    
    products = analyzer.analyze_batch(ocr_results)
    
    assert len(products) == 3
    assert all(p.product_name == "Test Product" for p in products)


# ============================================================================
# Error Handling Tests
# ============================================================================

def test_analyzer_empty_ocr_text():
    """Test handling of empty OCR text."""
    config = AIConfig(openai_api_key="test-key")
    analyzer = AIAnalyzer(config)
    
    with pytest.raises(ValueError, match="Empty OCR text"):
        analyzer.analyze_product({"raw_text": "", "confidence": 0.5})


def test_analyzer_no_backends():
    """Test initialization with no available backends."""
    config = AIConfig(openai_api_key=None, anthropic_api_key=None)
    
    with pytest.raises(ValueError, match="No AI backends available"):
        AIAnalyzer(config)


@patch('openai.OpenAI')
@patch.dict(os.environ, {"OPENAI_API_KEY": "test-key"})
def test_analyzer_api_error(mock_openai_class, sample_ocr_result: dict):
    """Test handling of API errors."""
    # Mock OpenAI to raise error
    mock_client = Mock()
    mock_openai_class.return_value = mock_client
    mock_client.chat.completions.create.side_effect = Exception("API Error")
    
    config = AIConfig(openai_api_key="test-key", cache_enabled=False)
    analyzer = AIAnalyzer(config)
    
    with pytest.raises(Exception, match="API Error"):
        analyzer.analyze_product(sample_ocr_result)


# ============================================================================
# Factory Function Tests
# ============================================================================

@patch.dict(os.environ, {"OPENAI_API_KEY": "test-key"})
def test_create_ai_analyzer():
    """Test factory function."""
    analyzer = create_ai_analyzer()
    
    assert isinstance(analyzer, AIAnalyzer)
    assert analyzer.config is not None


@patch.dict(os.environ, {"OPENAI_API_KEY": "test-key"})
def test_create_ai_analyzer_with_config():
    """Test factory function with custom config."""
    config = AIConfig(openai_api_key="test-key", temperature=0.5)
    analyzer = create_ai_analyzer(config)
    
    assert isinstance(analyzer, AIAnalyzer)
    assert analyzer.config.temperature == 0.5


# ============================================================================
# Integration Test (skipped if no API key)
# ============================================================================

@pytest.mark.skipif(
    not os.getenv("OPENAI_API_KEY"),
    reason="OpenAI API key not available"
)
def test_real_openai_integration(cleanup_cache):
    """Test real OpenAI integration (requires API key)."""
    config = AIConfig.from_env()
    config.cache_enabled = True
    config.cache_dir = "./test_cache/ai"
    
    analyzer = AIAnalyzer(config)
    
    ocr_result = {
        "raw_text": "KOYO REDUCED SODIUM TOFU MISO RAMEN VEGAN",
        "confidence": 0.95
    }
    
    product = analyzer.analyze_product(ocr_result)
    
    assert product.product_name
    assert product.confidence > 0
    assert product.model_used

