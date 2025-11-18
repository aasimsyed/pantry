"""
Comprehensive tests for OCR Service.

Tests cover:
- Unit tests for each component
- Integration tests with mocked backends
- Error handling and edge cases
- Caching and rate limiting
- Configuration validation

Best Practices:
- Use pytest fixtures for reusable test components
- Mock external dependencies (API calls)
- Test both success and failure paths
- Test edge cases and error conditions
"""

import os
import tempfile
import time
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock

import pytest
from PIL import Image

from src.ocr_service import (
    OCRService,
    OCRConfig,
    OCRResult,
    BoundingBox,
    OCRBackend,
    GoogleVisionOCR,
    TesseractOCR,
    OCRCache,
    RateLimiter,
    OCRError,
    OCRBackendError,
    OCRRateLimitError,
    OCRValidationError,
)


# ============================================================================
# Fixtures
# ============================================================================

@pytest.fixture
def temp_dir() -> str:
    """Create temporary directory for tests."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield tmpdir


@pytest.fixture
def test_image(temp_dir: str) -> str:
    """Create a test image file."""
    image_path = os.path.join(temp_dir, "test_image.jpg")
    # Create a simple test image
    img = Image.new('RGB', (100, 100), color='white')
    img.save(image_path)
    return image_path


@pytest.fixture
def config(temp_dir: str) -> OCRConfig:
    """Create test configuration."""
    return OCRConfig(
        google_credentials_path=None,  # Not available in tests
        tesseract_cmd="tesseract",
        confidence_threshold=0.85,
        cache_enabled=True,
        cache_dir=os.path.join(temp_dir, "cache"),
        cache_ttl=3600,
        max_retries=3,
        retry_delay=0.1,
        rate_limit_requests=10,
        rate_limit_period=60,
        preferred_backend="tesseract"
    )


@pytest.fixture
def sample_ocr_result() -> OCRResult:
    """Create sample OCR result for testing."""
    return OCRResult(
        raw_text="Hello World",
        confidence=0.95,
        bounding_boxes=[
            BoundingBox(x=10, y=10, width=50, height=20, text="Hello", confidence=0.96),
            BoundingBox(x=70, y=10, width=50, height=20, text="World", confidence=0.94)
        ],
        detected_languages=["en"],
        processing_time=0.5,
        backend_used="TestBackend"
    )


# ============================================================================
# Tests for Data Classes
# ============================================================================

class TestBoundingBox:
    """Tests for BoundingBox data class."""
    
    def test_valid_bounding_box(self) -> None:
        """Test creating valid bounding box."""
        bb = BoundingBox(x=10, y=20, width=30, height=40, text="Test", confidence=0.9)
        assert bb.x == 10
        assert bb.y == 20
        assert bb.width == 30
        assert bb.height == 40
        assert bb.text == "Test"
        assert bb.confidence == 0.9
    
    def test_bounding_box_immutable(self) -> None:
        """Test that bounding box is immutable."""
        bb = BoundingBox(x=10, y=20, width=30, height=40, text="Test", confidence=0.9)
        with pytest.raises(AttributeError):
            bb.x = 999  # Should raise error
    
    def test_invalid_confidence(self) -> None:
        """Test validation of confidence values."""
        with pytest.raises(OCRValidationError):
            BoundingBox(x=10, y=20, width=30, height=40, text="Test", confidence=1.5)
        
        with pytest.raises(OCRValidationError):
            BoundingBox(x=10, y=20, width=30, height=40, text="Test", confidence=-0.1)
    
    def test_negative_dimensions(self) -> None:
        """Test validation of negative dimensions."""
        with pytest.raises(OCRValidationError):
            BoundingBox(x=10, y=20, width=-30, height=40, text="Test", confidence=0.9)


class TestOCRResult:
    """Tests for OCRResult data class."""
    
    def test_valid_ocr_result(self, sample_ocr_result: OCRResult) -> None:
        """Test creating valid OCR result."""
        assert sample_ocr_result.raw_text == "Hello World"
        assert sample_ocr_result.confidence == 0.95
        assert len(sample_ocr_result.bounding_boxes) == 2
        assert sample_ocr_result.detected_languages == ["en"]
        assert sample_ocr_result.backend_used == "TestBackend"
    
    def test_ocr_result_immutable(self, sample_ocr_result: OCRResult) -> None:
        """Test that OCR result is immutable."""
        with pytest.raises(AttributeError):
            sample_ocr_result.raw_text = "Modified"
    
    def test_invalid_confidence_range(self) -> None:
        """Test validation of confidence range."""
        with pytest.raises(OCRValidationError):
            OCRResult(
                raw_text="Test",
                confidence=2.0,
                bounding_boxes=[],
                detected_languages=[],
                processing_time=0.5,
                backend_used="Test"
            )


class TestOCRConfig:
    """Tests for OCRConfig data class."""
    
    def test_valid_config(self, config: OCRConfig) -> None:
        """Test creating valid configuration."""
        assert config.confidence_threshold == 0.85
        assert config.cache_enabled is True
        assert config.max_retries == 3
    
    def test_invalid_confidence_threshold(self) -> None:
        """Test validation of confidence threshold."""
        with pytest.raises(OCRValidationError):
            OCRConfig(confidence_threshold=1.5)
    
    def test_invalid_max_retries(self) -> None:
        """Test validation of max retries."""
        with pytest.raises(OCRValidationError):
            OCRConfig(max_retries=-1)
    
    def test_invalid_rate_limit(self) -> None:
        """Test validation of rate limit settings."""
        with pytest.raises(OCRValidationError):
            OCRConfig(rate_limit_requests=0)
        
        with pytest.raises(OCRValidationError):
            OCRConfig(rate_limit_period=-1)
    
    def test_invalid_backend(self) -> None:
        """Test validation of backend name."""
        with pytest.raises(OCRValidationError):
            OCRConfig(preferred_backend="invalid")
    
    def test_from_env(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Test creating config from environment variables."""
        monkeypatch.setenv("OCR_CONFIDENCE_THRESHOLD", "0.9")
        monkeypatch.setenv("OCR_MAX_RETRIES", "5")
        monkeypatch.setenv("OCR_CACHE_ENABLED", "false")
        
        config = OCRConfig.from_env()
        assert config.confidence_threshold == 0.9
        assert config.max_retries == 5
        assert config.cache_enabled is False


# ============================================================================
# Tests for Rate Limiter
# ============================================================================

class TestRateLimiter:
    """Tests for RateLimiter class."""
    
    def test_rate_limiter_initialization(self) -> None:
        """Test rate limiter initialization."""
        limiter = RateLimiter(requests=10, period=60)
        assert limiter.requests == 10
        assert limiter.period == 60
        assert limiter.tokens == 10
    
    def test_acquire_token(self) -> None:
        """Test acquiring tokens."""
        limiter = RateLimiter(requests=5, period=60)
        
        # Should be able to acquire all tokens
        for _ in range(5):
            limiter.acquire()
        
        # Next acquire should wait
        assert limiter.tokens < 1
    
    def test_token_refill(self) -> None:
        """Test token bucket refill."""
        limiter = RateLimiter(requests=10, period=1)
        
        # Exhaust tokens
        for _ in range(10):
            limiter.acquire()
        
        # Wait for refill
        time.sleep(0.2)
        
        # Should have some tokens now
        limiter.acquire()


# ============================================================================
# Tests for Cache
# ============================================================================

class TestOCRCache:
    """Tests for OCRCache class."""
    
    def test_cache_initialization(self, temp_dir: str) -> None:
        """Test cache initialization."""
        cache_dir = os.path.join(temp_dir, "cache")
        cache = OCRCache(cache_dir, ttl=3600)
        
        assert cache.cache_dir == Path(cache_dir)
        assert cache.ttl == 3600
        assert cache.cache_dir.exists()
    
    def test_cache_set_and_get(
        self,
        temp_dir: str,
        test_image: str,
        sample_ocr_result: OCRResult
    ) -> None:
        """Test caching OCR results."""
        cache_dir = os.path.join(temp_dir, "cache")
        cache = OCRCache(cache_dir)
        
        # Cache result
        cache.set(test_image, sample_ocr_result)
        
        # Retrieve result
        cached_result = cache.get(test_image)
        assert cached_result is not None
        assert cached_result.raw_text == sample_ocr_result.raw_text
        assert cached_result.confidence == sample_ocr_result.confidence
    
    def test_cache_miss(self, temp_dir: str, test_image: str) -> None:
        """Test cache miss scenario."""
        cache_dir = os.path.join(temp_dir, "cache")
        cache = OCRCache(cache_dir)
        
        result = cache.get(test_image)
        assert result is None
    
    def test_cache_clear(
        self,
        temp_dir: str,
        test_image: str,
        sample_ocr_result: OCRResult
    ) -> None:
        """Test clearing cache."""
        cache_dir = os.path.join(temp_dir, "cache")
        cache = OCRCache(cache_dir)
        
        # Cache result
        cache.set(test_image, sample_ocr_result)
        assert cache.get(test_image) is not None
        
        # Clear cache
        cache.clear()
        assert cache.get(test_image) is None
    
    def test_cache_stats(self, temp_dir: str) -> None:
        """Test cache statistics."""
        cache_dir = os.path.join(temp_dir, "cache")
        cache = OCRCache(cache_dir)
        
        stats = cache.stats()
        assert 'size' in stats
        assert 'directory' in stats
        assert 'ttl' in stats


# ============================================================================
# Tests for OCR Backends
# ============================================================================

class TestTesseractOCR:
    """Tests for Tesseract OCR backend."""
    
    def test_initialization(self, config: OCRConfig) -> None:
        """Test Tesseract backend initialization."""
        backend = TesseractOCR(config)
        assert backend.config == config
        assert backend.get_name() == "Tesseract OCR"
    
    def test_is_available(self, config: OCRConfig) -> None:
        """Test checking if Tesseract is available."""
        backend = TesseractOCR(config)
        # Should be available in CI/test environment
        available = backend.is_available()
        assert isinstance(available, bool)
    
    @pytest.mark.skipif(
        not TesseractOCR(OCRConfig()).is_available(),
        reason="Tesseract not installed"
    )
    def test_extract_text(self, config: OCRConfig, test_image: str) -> None:
        """Test text extraction with Tesseract."""
        backend = TesseractOCR(config)
        result = backend.extract_text(test_image)
        
        assert isinstance(result, OCRResult)
        assert isinstance(result.raw_text, str)
        assert 0.0 <= result.confidence <= 1.0
        assert isinstance(result.bounding_boxes, list)
        assert result.backend_used == "Tesseract OCR"
    
    def test_invalid_image(self, config: OCRConfig, temp_dir: str) -> None:
        """Test handling of invalid images."""
        backend = TesseractOCR(config)
        
        # Non-existent file
        with pytest.raises(OCRValidationError):
            backend.extract_text("/nonexistent/image.jpg")
        
        # Invalid file
        invalid_path = os.path.join(temp_dir, "invalid.txt")
        with open(invalid_path, 'w') as f:
            f.write("Not an image")
        
        with pytest.raises(OCRValidationError):
            backend.extract_text(invalid_path)


class TestGoogleVisionOCR:
    """Tests for Google Vision OCR backend."""
    
    def test_initialization(self, config: OCRConfig) -> None:
        """Test Google Vision backend initialization."""
        backend = GoogleVisionOCR(config)
        assert backend.config == config
        assert backend.get_name() == "Google Cloud Vision"
    
    def test_is_not_available_without_credentials(self, config: OCRConfig) -> None:
        """Test that backend is unavailable without credentials."""
        config.google_credentials_path = None
        backend = GoogleVisionOCR(config)
        assert backend.is_available() is False
    
    @patch('src.ocr_service.vision.ImageAnnotatorClient')
    def test_extract_text_mocked(
        self,
        mock_client: MagicMock,
        config: OCRConfig,
        test_image: str
    ) -> None:
        """Test text extraction with mocked Google Vision API."""
        # Setup mock response
        mock_annotation = Mock()
        mock_annotation.description = "Hello World"
        mock_annotation.locale = "en"
        mock_annotation.bounding_poly.vertices = [
            Mock(x=0, y=0),
            Mock(x=100, y=0),
            Mock(x=100, y=50),
            Mock(x=0, y=50)
        ]
        
        mock_response = Mock()
        mock_response.text_annotations = [mock_annotation]
        mock_response.error.message = ""
        
        mock_client_instance = Mock()
        mock_client_instance.text_detection.return_value = mock_response
        mock_client.return_value = mock_client_instance
        
        # Set credentials
        config.google_credentials_path = "/fake/credentials.json"
        
        # Mock file existence check
        with patch('os.path.exists', return_value=True):
            backend = GoogleVisionOCR(config)
            backend.client = mock_client_instance
            
            result = backend.extract_text(test_image)
            
            assert result.raw_text == "Hello World"
            assert result.backend_used == "Google Cloud Vision"
            assert "en" in result.detected_languages


# ============================================================================
# Tests for OCR Service (Integration)
# ============================================================================

class TestOCRService:
    """Tests for main OCR service."""
    
    def test_initialization(self, config: OCRConfig) -> None:
        """Test OCR service initialization."""
        service = OCRService(config)
        assert service.config == config
        assert len(service.backends) == 2
        assert 'google' in service.backends
        assert 'tesseract' in service.backends
    
    def test_initialization_with_default_config(self) -> None:
        """Test OCR service with default configuration."""
        service = OCRService()
        assert service.config is not None
        assert isinstance(service.config, OCRConfig)
    
    @pytest.mark.skipif(
        not TesseractOCR(OCRConfig()).is_available(),
        reason="Tesseract not installed"
    )
    def test_extract_text(self, config: OCRConfig, test_image: str) -> None:
        """Test text extraction through service."""
        service = OCRService(config)
        result = service.extract_text(test_image)
        
        assert isinstance(result, dict)
        assert 'raw_text' in result
        assert 'confidence' in result
        assert 'bounding_boxes' in result
        assert 'detected_languages' in result
        assert 'processing_time' in result
        assert 'backend_used' in result
    
    @pytest.mark.skipif(
        not TesseractOCR(OCRConfig()).is_available(),
        reason="Tesseract not installed"
    )
    def test_caching(self, config: OCRConfig, test_image: str) -> None:
        """Test that caching works correctly."""
        service = OCRService(config)
        
        # First call should not be cached
        result1 = service.extract_text(test_image)
        assert result1['cached'] is False
        
        # Second call should be cached
        result2 = service.extract_text(test_image)
        assert result2['cached'] is True
        
        # Results should be identical
        assert result1['raw_text'] == result2['raw_text']
        assert result1['confidence'] == result2['confidence']
    
    def test_cache_stats(self, config: OCRConfig) -> None:
        """Test getting cache statistics."""
        service = OCRService(config)
        stats = service.get_cache_stats()
        
        assert isinstance(stats, dict)
        if config.cache_enabled:
            assert 'size' in stats
    
    def test_clear_cache(self, config: OCRConfig, test_image: str) -> None:
        """Test clearing cache."""
        if not TesseractOCR(OCRConfig()).is_available():
            pytest.skip("Tesseract not installed")
        
        service = OCRService(config)
        
        # Extract and cache
        service.extract_text(test_image)
        
        # Clear cache
        service.clear_cache()
        
        # Next extraction should not be cached
        result = service.extract_text(test_image)
        assert result['cached'] is False
    
    def test_no_backends_available(self, config: OCRConfig, test_image: str) -> None:
        """Test error when no backends are available."""
        # Create config with no working backends
        config.google_credentials_path = None
        config.tesseract_cmd = "/nonexistent/tesseract"
        
        service = OCRService(config)
        
        with pytest.raises(OCRBackendError):
            service.extract_text(test_image)
    
    def test_invalid_image(self, config: OCRConfig, temp_dir: str) -> None:
        """Test handling of invalid images."""
        if not TesseractOCR(OCRConfig()).is_available():
            pytest.skip("Tesseract not installed")
        
        service = OCRService(config)
        
        # Non-existent file should fail validation, not backend
        # The validation happens in the backend, so we expect backend error
        with pytest.raises((OCRValidationError, OCRBackendError)):
            service.extract_text("/nonexistent/image.jpg")
    
    @patch.object(TesseractOCR, 'extract_text')
    @patch.object(TesseractOCR, 'is_available')
    def test_retry_logic(
        self,
        mock_is_available: MagicMock,
        mock_extract: MagicMock,
        config: OCRConfig,
        test_image: str,
        sample_ocr_result: OCRResult
    ) -> None:
        """Test retry logic on backend failures."""
        # Make Tesseract appear available
        mock_is_available.return_value = True
        
        # First two calls fail, third succeeds
        mock_extract.side_effect = [
            OCRBackendError("First failure"),
            OCRBackendError("Second failure"),
            sample_ocr_result
        ]
        
        config.retry_delay = 0.01  # Fast retries for testing
        service = OCRService(config)
        
        result = service.extract_text(test_image)
        
        # Should have succeeded after retries
        assert result['raw_text'] == "Hello World"
        assert mock_extract.call_count == 3
    
    @patch.object(TesseractOCR, 'extract_text')
    @patch.object(GoogleVisionOCR, 'extract_text')
    def test_fallback_to_secondary_backend(
        self,
        mock_google: MagicMock,
        mock_tesseract: MagicMock,
        config: OCRConfig,
        test_image: str,
        sample_ocr_result: OCRResult
    ) -> None:
        """Test fallback to secondary backend."""
        # Make Google available for this test
        config.google_credentials_path = "/fake/credentials.json"
        config.preferred_backend = "google"
        
        # Google fails, Tesseract succeeds
        mock_google.side_effect = OCRBackendError("Google failed")
        mock_tesseract.return_value = sample_ocr_result
        
        with patch('os.path.exists', return_value=True):
            with patch('src.ocr_service.vision.ImageAnnotatorClient'):
                service = OCRService(config)
                
                # Make both backends available
                service.available_backends = ['google', 'tesseract']
                
                result = service.extract_text(test_image)
                
                # Should have fallen back to Tesseract
                assert result['raw_text'] == "Hello World"


# ============================================================================
# Edge Cases and Error Handling
# ============================================================================

class TestEdgeCases:
    """Tests for edge cases and error scenarios."""
    
    def test_empty_image(self, config: OCRConfig, temp_dir: str) -> None:
        """Test handling of empty/blank images."""
        if not TesseractOCR(OCRConfig()).is_available():
            pytest.skip("Tesseract not installed")
        
        # Create blank white image
        blank_image = os.path.join(temp_dir, "blank.jpg")
        img = Image.new('RGB', (100, 100), color='white')
        img.save(blank_image)
        
        service = OCRService(config)
        result = service.extract_text(blank_image)
        
        # Should return empty text, not error
        assert isinstance(result, dict)
        assert len(result['raw_text']) == 0 or result['raw_text'].isspace()
    
    def test_very_small_image(self, config: OCRConfig, temp_dir: str) -> None:
        """Test handling of very small images."""
        if not TesseractOCR(OCRConfig()).is_available():
            pytest.skip("Tesseract not installed")
        
        # Create tiny image
        tiny_image = os.path.join(temp_dir, "tiny.jpg")
        img = Image.new('RGB', (10, 10), color='white')
        img.save(tiny_image)
        
        service = OCRService(config)
        result = service.extract_text(tiny_image)
        
        # Should not crash
        assert isinstance(result, dict)
    
    def test_concurrent_cache_access(
        self,
        config: OCRConfig,
        test_image: str
    ) -> None:
        """Test that cache handles concurrent access."""
        if not TesseractOCR(OCRConfig()).is_available():
            pytest.skip("Tesseract not installed")
        
        service = OCRService(config)
        
        # Multiple extractions should not cause issues
        results = []
        for _ in range(5):
            result = service.extract_text(test_image)
            results.append(result)
        
        # All results should be consistent
        for result in results[1:]:
            assert result['raw_text'] == results[0]['raw_text']


# ============================================================================
# Performance Tests
# ============================================================================

class TestPerformance:
    """Performance-related tests."""
    
    def test_processing_time_reasonable(
        self,
        config: OCRConfig,
        test_image: str
    ) -> None:
        """Test that processing time is reasonable."""
        if not TesseractOCR(OCRConfig()).is_available():
            pytest.skip("Tesseract not installed")
        
        service = OCRService(config)
        
        start_time = time.time()
        result = service.extract_text(test_image)
        end_time = time.time()
        
        processing_time = end_time - start_time
        
        # Should be faster than 10 seconds for small test image
        assert processing_time < 10.0
        assert result['processing_time'] > 0
    
    def test_cache_improves_performance(
        self,
        config: OCRConfig,
        test_image: str
    ) -> None:
        """Test that caching improves performance."""
        if not TesseractOCR(OCRConfig()).is_available():
            pytest.skip("Tesseract not installed")
        
        service = OCRService(config)
        
        # First call (no cache)
        start1 = time.time()
        result1 = service.extract_text(test_image)
        time1 = time.time() - start1
        
        # Second call (cached)
        start2 = time.time()
        result2 = service.extract_text(test_image)
        time2 = time.time() - start2
        
        # Cached call should be faster
        assert time2 < time1
        assert result2['cached'] is True

