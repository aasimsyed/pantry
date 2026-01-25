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

import base64
import hashlib
import logging
import os
import time
from abc import ABC, abstractmethod
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import diskcache
import numpy as np
from PIL import Image, ImageStat, ImageEnhance

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

# OSD script → Tesseract lang code. Used for auto-detect when OCR_TESSERACT_LANG not set.
SCRIPT_TO_LANG: dict[str, str] = {
    "Latin": "eng",
    "Cyrillic": "rus",
    "Greek": "ell",
    "Hebrew": "heb",
    "Arabic": "ara",
    "Han": "chi_sim",
    "Japanese": "jpn",
    "Katakana": "jpn",
    "Hiragana": "jpn",
    "Korean": "kor",
}

# OSD scripts that often misdetect English labels (logos, stylized fonts, curved text).
# Don't use script-derived language for these; use English.
OSD_SCRIPT_OFTEN_MISDETECTS: frozenset[str] = frozenset({"Katakana", "Cyrillic", "Han", "Hiragana"})


def _rotate_image(im: Image.Image, degrees: float) -> Image.Image:
    """Rotate PIL image by degrees (CCW). expand=True keeps full image."""
    if abs(degrees) < 0.01:
        return im
    fill = (255, 255, 255) if im.mode == "RGB" else 255
    return im.rotate(-degrees, expand=True, resample=Image.BICUBIC, fillcolor=fill)


def _deskew_image(im: Image.Image) -> Image.Image:
    """Estimate skew via OpenCV minAreaRect and rotate to correct. Handles slightly tilted packaging."""
    try:
        import cv2
    except ImportError:
        return im
    arr = np.array(im)
    if im.mode == "RGB":
        gray = cv2.cvtColor(arr, cv2.COLOR_RGB2GRAY)
    else:
        gray = np.asarray(im.convert("L"))
    gray = cv2.bitwise_not(gray)
    thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)[1]
    coords = np.column_stack(np.where(thresh > 0))
    if coords.size < 100:
        return im
    angle = cv2.minAreaRect(coords)[-1]
    if angle < -45:
        angle = 90 + angle
    elif angle > 45:
        angle = angle - 90
    if abs(angle) < 0.5:
        return im
    h, w = arr.shape[:2]
    center = (w // 2, h // 2)
    M = cv2.getRotationMatrix2D(center, angle, 1.0)
    rotated = cv2.warpAffine(
        arr, M, (w, h),
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_REPLICATE,
    )
    if len(arr.shape) == 3:
        return Image.fromarray(rotated)
    return Image.fromarray(rotated).convert("L")


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
        google_credentials_path: Path to Google Cloud credentials JSON (or JSON string)
        google_vision_api_key: Google Vision API key (alternative to service account)
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
    google_vision_api_key: Optional[str] = None
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
    tesseract_lang: Optional[str] = None  # If set, force this lang; else OSD auto-detect
    
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
            GOOGLE_APPLICATION_CREDENTIALS: Path to Google Cloud credentials JSON
            GOOGLE_VISION_API_KEY: Vision API key (alternative to service account)
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
            google_credentials_path=os.getenv("GOOGLE_APPLICATION_CREDENTIALS") or None,
            google_vision_api_key=os.getenv("GOOGLE_VISION_API_KEY") or None,
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
            tesseract_lang=os.getenv("OCR_TESSERACT_LANG") or None,
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
    
    Auth: GOOGLE_APPLICATION_CREDENTIALS (service account) or GOOGLE_VISION_API_KEY.
    
    Pros:
        - High accuracy (especially for complex layouts, curved can labels)
        - Excellent language detection
        - Reliable bounding boxes
        
    Cons:
        - Requires API key or credentials and internet
        - Costs money per request
        - Rate limited by Google
    """
    
    def __init__(self, config: OCRConfig) -> None:
        """Initialize Google Vision OCR backend."""
        super().__init__(config)
        self.client: Optional[ImageAnnotatorClient] = None
        self._api_key: Optional[str] = (
            (config.google_vision_api_key or "").strip() or None
        )
        self._using_adc = False

        if self._api_key:
            logger.info("Google Vision OCR backend initialized (API key)")
            return

        if self._creds_available():
            try:
                creds_value = self.config.google_credentials_path
                if creds_value and creds_value.strip().startswith('{'):
                    import json
                    import tempfile
                    creds_dict = json.loads(creds_value)
                    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
                        json.dump(creds_dict, f)
                        temp_creds_path = f.name
                    os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = temp_creds_path
                    logger.info("Using Google credentials from environment variable (JSON content)")
                elif creds_value and os.path.exists(creds_value):
                    os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = creds_value
                    logger.info(f"Using Google credentials from file: {creds_value}")
                else:
                    raise ValueError("Credentials path invalid")
                self.client = vision.ImageAnnotatorClient()
                logger.info("Google Vision OCR backend initialized (service account)")
                return
            except Exception as e:
                logger.warning(f"Vision service-account init failed: {e}")
                self.client = None

        # No API key or explicit creds: try ADC (Cloud Run workload identity).
        # On Cloud Run, the service account provides credentials via the metadata server.
        try:
            self.client = vision.ImageAnnotatorClient()
            self._using_adc = True
            logger.info("Google Vision OCR backend initialized (Application Default Credentials)")
        except Exception as e:
            logger.info("Google Vision ADC not available: %s", e)
            self.client = None
    
    def _creds_available(self) -> bool:
        """True if service-account credentials are configured."""
        v = self.config.google_credentials_path
        if not v:
            return False
        if v.strip().startswith('{'):
            try:
                import json
                json.loads(v)
                return True
            except (json.JSONDecodeError, ValueError):
                return False
        return os.path.exists(v)
    
    def is_available(self) -> bool:
        """Check if Google Vision is configured.
        
        Supports:
        - GOOGLE_VISION_API_KEY: API key (REST)
        - GOOGLE_APPLICATION_CREDENTIALS: file path or JSON (service account)
        - ADC: Cloud Run workload identity (no key needed)
        """
        if self._api_key:
            return True
        if self._creds_available():
            return self.client is not None
        return self.client is not None
    
    def get_name(self) -> str:
        """Get backend name."""
        return "Google Cloud Vision"
    
    def _extract_text_via_rest(self, image_path: str) -> OCRResult:
        """Call Vision API via REST with API key. Used when GOOGLE_VISION_API_KEY is set."""
        import httpx
        
        start_time = time.time()
        with open(image_path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode("utf-8")
        
        url = "https://vision.googleapis.com/v1/images:annotate"
        params = {"key": self._api_key}
        payload = {
            "requests": [{
                "image": {"content": b64},
                "features": [{"type": "TEXT_DETECTION", "maxResults": 50}],
            }]
        }
        
        try:
            resp = httpx.post(url, params=params, json=payload, timeout=30.0)
            resp.raise_for_status()
            data = resp.json()
        except Exception as e:
            raise OCRBackendError(f"Google Vision REST API error: {e}")
        
        err = data.get("responses", [{}])[0].get("error")
        if err:
            raise OCRBackendError(
                f"Google Vision API error: {err.get('message', str(err))}"
            )
        
        ann = data.get("responses", [{}])[0].get("textAnnotations") or []
        if not ann:
            return OCRResult(
                raw_text="",
                confidence=0.0,
                bounding_boxes=[],
                detected_languages=[],
                processing_time=time.time() - start_time,
                backend_used=self.get_name(),
            )
        
        full_text = ann[0].get("description", "")
        bounding_boxes = []
        confidences = []
        for t in ann[1:]:
            desc = (t.get("description") or "").strip()
            if not desc:
                continue
            verts = (t.get("boundingPoly") or {}).get("vertices") or []
            if len(verts) >= 3:
                x = verts[0].get("x", 0)
                y = verts[0].get("y", 0)
                w = max(1, (verts[1].get("x", x) - x))
                h = max(1, (verts[2].get("y", y) - y))
                bounding_boxes.append(BoundingBox(x=x, y=y, width=w, height=h, text=desc, confidence=1.0))
                confidences.append(1.0)
        
        overall = sum(confidences) / len(confidences) if confidences else 0.95
        locale = (ann[0].get("locale") or "").strip()
        detected = [locale] if locale else []
        
        elapsed = time.time() - start_time
        logger.info(
            f"Google Vision OCR (REST) completed in {elapsed:.2f}s: "
            f"{len(full_text)} chars, {len(bounding_boxes)} regions"
        )
        return OCRResult(
            raw_text=full_text,
            confidence=overall,
            bounding_boxes=bounding_boxes,
            detected_languages=detected,
            processing_time=elapsed,
            backend_used=self.get_name(),
        )
    
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
        
        if not self.is_available():
            raise OCRBackendError("Google Vision not configured")
        
        if self._api_key:
            return self._extract_text_via_rest(image_path)
        
        if self.client is None:
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
    
    def _debug_image_stats(self, image: Image.Image, label: str = "image") -> None:
        """Log image statistics for OCR debugging."""
        try:
            extrema = image.getextrema()
            logger.info(f"🔍 [OCR DEBUG] {label} getextrema: {extrema}")
            stat = ImageStat.Stat(image)
            logger.info(
                f"🔍 [OCR DEBUG] {label} ImageStat: mean={stat.mean}, rms={stat.rms}"
            )
        except Exception as e:
            logger.warning(f"🔍 [OCR DEBUG] {label} stats failed: {e}")

    def _debug_tesseract_data(self, data: dict, label: str = "image_to_data") -> None:
        """Log Tesseract image_to_data summary when result is empty."""
        n = len(data.get("text", []))
        texts = [t.strip() for t in data.get("text", []) if t and str(t).strip()]
        confs = [float(c) for c in data.get("conf", []) if c and float(c) >= 0]
        logger.info(
            f"🔍 [OCR DEBUG] {label}: n_boxes={n}, "
            f"non_empty_text_count={len(texts)}, conf_count={len(confs)}"
        )
        if confs:
            logger.info(f"🔍 [OCR DEBUG] {label} conf min/max/avg: {min(confs):.1f} / {max(confs):.1f} / {sum(confs)/len(confs):.1f}")
        if texts:
            logger.info(f"🔍 [OCR DEBUG] {label} sample texts: {texts[:20]!r}")
        # Log block/line/word levels
        levels = data.get("level", [])
        if levels:
            logger.info(f"🔍 [OCR DEBUG] {label} level counts: {dict(Counter(levels))}")

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
        
        ocr_debug = os.getenv("OCR_DEBUG", "").lower() in ("1", "true", "yes")
        deskew = os.getenv("OCR_DESKEW", "").lower() in ("1", "true", "yes")
        
        start_time = time.time()
        
        def run_ocr(im: Image.Image, lang: str, psm: int = 6) -> tuple[str, dict]:
            cfg = f"--psm {psm} -l {lang}"
            text = pytesseract.image_to_string(im, config=cfg)
            d = pytesseract.image_to_data(im, config=cfg, output_type=pytesseract.Output.DICT)
            return text, d
        
        try:
            try:
                ver = pytesseract.get_tesseract_version()
                logger.info(f"🔍 [OCR DEBUG] Tesseract version: {ver}")
            except Exception as ve:
                logger.warning(f"🔍 [OCR DEBUG] Tesseract version check failed: {ve}")
            
            image = Image.open(image_path)
            if image.mode not in ("RGB", "L"):
                image = image.convert("RGB")
            
            logger.info(
                f"🔍 [OCR DEBUG] Tesseract input: size={image.size}, mode={image.mode}, "
                f"format={image.format}"
            )
            self._debug_image_stats(image, "input")
            
            # OSD: orientation + script for sideways/tilted packaging and auto language
            osd_rotate = 0.0
            osd_script = "Latin"
            lang = self.config.tesseract_lang or "eng"
            try:
                osd = pytesseract.image_to_osd(image, output_type=pytesseract.Output.DICT)
                osd_rotate = float(osd.get("rotate", 0))
                osd_script = str(osd.get("script", "Latin"))
                if not self.config.tesseract_lang:
                    if osd_script in OSD_SCRIPT_OFTEN_MISDETECTS:
                        lang = "eng"
                        logger.info(
                            f"🔍 [OCR DEBUG] OSD: rotate={osd_rotate}, script={osd_script} "
                            "(often misdetects English) → using eng"
                        )
                    else:
                        lang = SCRIPT_TO_LANG.get(osd_script, "eng")
                        logger.info(
                            f"🔍 [OCR DEBUG] OSD: rotate={osd_rotate}, script={osd_script}, lang={lang}"
                        )
                else:
                    logger.info(
                        f"🔍 [OCR DEBUG] OSD: rotate={osd_rotate}, script={osd_script}, lang={lang}"
                    )
            except Exception as oce:
                logger.info(f"🔍 [OCR DEBUG] OSD failed (using lang={lang}): {oce}")
            
            # Ensure chosen language is installed (e.g. jpn/rus often missing)
            try:
                available = set(pytesseract.get_languages())
            except Exception:
                available = {"eng"}
            if lang not in available:
                logger.info(
                    f"🔍 [OCR DEBUG] Language '{lang}' not installed (available: {sorted(available)}), "
                    "using eng"
                )
                lang = "eng"
            
            # Correct orientation (sideways / upside-down text)
            if abs(osd_rotate) >= 0.5:
                image = _rotate_image(image, osd_rotate)
                logger.info(f"🔍 [OCR DEBUG] Rotated by {osd_rotate}° for orientation correction")
            
            # Optional deskew for slightly tilted cans/curved packaging
            if deskew:
                image = _deskew_image(image)
                if ocr_debug:
                    logger.info("🔍 [OCR DEBUG] Deskew applied")
            
            def _mean_conf(d: dict) -> float:
                vals = [float(c) / 100.0 for c in d["conf"] if c is not None and float(c) >= 0]
                return sum(vals) / len(vals) if vals else 0.0
            
            full_text, data = run_ocr(image, lang, 6)
            
            logger.info(
                f"🔍 [OCR DEBUG] image_to_string (PSM 6, -l {lang}): "
                f"len={len(full_text)}, first 100 chars: {repr(full_text[:100])}"
            )
            
            if len(full_text.strip()) == 0:
                self._debug_tesseract_data(data, "image_to_data")
            
            best_conf = _mean_conf(data)
            # Multi-orientation fallback: try 90, 180, 270 if result poor or low confidence
            min_chars = 10
            min_conf = 0.4
            best_text, best_data = full_text, data
            if len(full_text.strip()) < min_chars or best_conf < min_conf:
                for deg in (90, 180, 270):
                    try:
                        rot = _rotate_image(image, float(deg))
                        t, d = run_ocr(rot, lang, 6)
                        c = _mean_conf(d)
                        better = (
                            len(t.strip()) > len(best_text.strip())
                            or (c > best_conf and len(t.strip()) >= min_chars)
                        )
                        if better:
                            best_text, best_data = t, d
                            best_conf = c
                            logger.info(
                                f"🔍 [OCR DEBUG] Multi-orientation: {deg}° gave better result "
                                f"(len={len(t)}, conf={c:.2f})"
                            )
                    except Exception as moe:
                        logger.warning(f"🔍 [OCR DEBUG] Multi-orientation {deg}° failed: {moe}")
                full_text, data = best_text, best_data
            
            # Grayscale + PSM / contrast fallback when still empty
            if len(full_text.strip()) == 0:
                gray = image.convert("L")
                if ocr_debug:
                    self._debug_image_stats(gray, "grayscale")
                for psm in (6, 11, 13, 3):
                    try:
                        t, d = run_ocr(gray, lang, psm)
                        logger.info(
                            f"🔍 [OCR DEBUG] PSM={psm} grayscale: len={len(t)}, "
                            f"sample: {repr(t[:80])}"
                        )
                        if t.strip():
                            full_text, data = t, d
                            logger.info(f"🔍 [OCR DEBUG] Using PSM={psm} grayscale result")
                            break
                    except Exception as pe:
                        logger.warning(f"🔍 [OCR DEBUG] PSM={psm} failed: {pe}")
                if not full_text.strip():
                    enhancer = ImageEnhance.Contrast(gray)
                    contrasted = enhancer.enhance(1.5)
                    try:
                        t, d = run_ocr(contrasted, lang, 6)
                        logger.info(
                            f"🔍 [OCR DEBUG] Contrast 1.5x + PSM 6: len={len(t)}, "
                            f"sample: {repr(t[:80])}"
                        )
                        if t.strip():
                            full_text, data = t, d
                    except Exception as ce:
                        logger.warning(f"🔍 [OCR DEBUG] Contrast run failed: {ce}")
                if ocr_debug and not full_text.strip():
                    try:
                        debug_dir = Path(os.getenv("OCR_DEBUG_DIR", "logs/ocr_debug"))
                        debug_dir.mkdir(parents=True, exist_ok=True)
                        base = Path(image_path).stem
                        gray_path = debug_dir / f"{base}_gray.png"
                        gray.save(gray_path)
                        logger.info(f"🔍 [OCR DEBUG] Saved grayscale debug image: {gray_path}")
                    except Exception as de:
                        logger.warning(f"🔍 [OCR DEBUG] Save debug image failed: {de}")
            
            # Build bounding boxes from detailed data
            bounding_boxes = []
            confidences = []
            n_boxes = len(data["text"])
            for i in range(n_boxes):
                text = data["text"][i].strip()
                if not text:
                    continue
                conf = float(data["conf"][i]) / 100.0
                if conf < 0:
                    conf = 0.0
                confidences.append(conf)
                bounding_boxes.append(BoundingBox(
                    x=int(data["left"][i]),
                    y=int(data["top"][i]),
                    width=int(data["width"][i]),
                    height=int(data["height"][i]),
                    text=text,
                    confidence=conf,
                ))
            
            detected_languages = [lang]
            
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
        ocr_debug = os.getenv("OCR_DEBUG", "").lower() in ("1", "true", "yes")
        if ocr_debug:
            logger.info(
                f"🔍 [OCR DEBUG] Backend order: {backend_order}, "
                f"preferred={self.config.preferred_backend}, "
                f"confidence_threshold={self.config.confidence_threshold}"
            )
        for backend_name in backend_order:
            try:
                if ocr_debug:
                    logger.info(f"🔍 [OCR DEBUG] Trying backend: {backend_name}")
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
                
                # Cache only when confidence is decent (avoid caching "Unknown Product" OCR)
                cache_min_conf = float(os.getenv("OCR_CACHE_MIN_CONFIDENCE", "0.4"))
                if self.cache and result.confidence >= cache_min_conf:
                    self.cache.set(image_path, result)
                elif self.cache and result.confidence < cache_min_conf:
                    logger.info(
                        f"🔍 [OCR DEBUG] Skipping cache (confidence {result.confidence:.2f} "
                        f"< {cache_min_conf})"
                    )
                
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

