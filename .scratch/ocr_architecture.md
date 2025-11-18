# OCR Service Architecture

## Design Overview

Following **SOLID principles** and **Clean Architecture**, the OCR Service is structured in layers:

```
┌─────────────────────────────────────┐
│       OCRService (Facade)           │  ← Main Interface
├─────────────────────────────────────┤
│  RateLimiter │ OCRCache             │  ← Cross-cutting concerns
├─────────────────────────────────────┤
│  GoogleVisionOCR │ TesseractOCR     │  ← Strategy Pattern
├─────────────────────────────────────┤
│       OCRBackend (ABC)              │  ← Abstraction
└─────────────────────────────────────┘
```

## Design Patterns Used

### 1. **Strategy Pattern** (OCRBackend)
- **Why**: Allows switching between OCR engines at runtime
- **Best Practice**: Program to interfaces, not implementations

### 2. **Facade Pattern** (OCRService)
- **Why**: Simplifies complex subsystem (caching, rate limiting, multiple backends)
- **Best Practice**: Single entry point, hide complexity

### 3. **Dependency Injection**
- **Why**: Testable, flexible configuration
- **Best Practice**: Pass dependencies via constructor

### 4. **Cache-Aside Pattern**
- **Why**: Performance optimization, reduce API costs
- **Best Practice**: Check cache first, populate on miss

## Class Structure

### 1. Data Classes (Immutable)

```python
@dataclass(frozen=True)
class BoundingBox:
    """Represents text region coordinates"""
    x: int
    y: int
    width: int
    height: int
    text: str
    confidence: float

@dataclass(frozen=True)
class OCRResult:
    """Standardized OCR output"""
    raw_text: str
    confidence: float
    bounding_boxes: list[BoundingBox]
    detected_languages: list[str]
    processing_time: float
    backend_used: str
    
@dataclass
class OCRConfig:
    """Configuration with validation"""
    google_credentials_path: Optional[str] = None
    tesseract_cmd: str = "tesseract"
    confidence_threshold: float = 0.85
    cache_enabled: bool = True
    cache_dir: str = "./cache/ocr"
    max_retries: int = 3
    retry_delay: float = 1.0
    rate_limit_requests: int = 60
    rate_limit_period: int = 60
```

### 2. Abstract Base Class

```python
class OCRBackend(ABC):
    """Abstract OCR backend - Open/Closed Principle"""
    
    @abstractmethod
    def extract_text(self, image_path: str) -> OCRResult:
        """Extract text from image"""
        pass
    
    @abstractmethod
    def is_available(self) -> bool:
        """Check if backend is configured and available"""
        pass
```

### 3. Concrete Implementations

```python
class GoogleVisionOCR(OCRBackend):
    """Google Cloud Vision implementation"""
    # High accuracy, costs money, requires API key
    
class TesseractOCR(OCRBackend):
    """Tesseract OCR implementation"""
    # Free, local, good for fallback
```

### 4. Supporting Services

```python
class RateLimiter:
    """Token bucket algorithm for API rate limiting"""
    
class OCRCache:
    """Disk-based cache with hash-based keys"""
```

### 5. Main Service

```python
class OCRService:
    """
    Unified OCR interface with:
    - Automatic fallback
    - Rate limiting
    - Caching
    - Error handling
    """
```

## Best Practices Applied

### 1. **SOLID Principles**

- **S**ingle Responsibility: Each class has one job
  - `OCRService`: Coordinate OCR operations
  - `OCRCache`: Handle caching
  - `RateLimiter`: Manage rate limits
  - `GoogleVisionOCR`/`TesseractOCR`: Perform OCR

- **O**pen/Closed: Open for extension, closed for modification
  - Add new OCR backends without changing existing code
  - `OCRBackend` ABC makes this easy

- **L**iskov Substitution: Any `OCRBackend` can replace another
  - All backends return `OCRResult`
  - Same interface, different implementations

- **I**nterface Segregation: Small, focused interfaces
  - `OCRBackend` only has essential methods
  - Config is separate from implementation

- **D**ependency Inversion: Depend on abstractions
  - `OCRService` depends on `OCRBackend` (abstract)
  - Not on concrete implementations

### 2. **DRY (Don't Repeat Yourself)**
- Shared retry logic in base class
- Common validation in config
- Reusable caching mechanism

### 3. **KISS (Keep It Simple, Stupid)**
- Clear class names
- Single-purpose methods
- No over-engineering

### 4. **YAGNI (You Aren't Gonna Need It)**
- Only implement required features
- No speculative generality
- Future PDF support: NOT implemented now

### 5. **Defensive Programming**
- Validate all inputs
- Handle all error cases
- Never fail silently
- Log everything important

## Error Handling Strategy

### 1. Exception Hierarchy
```python
class OCRError(Exception): pass
class OCRBackendError(OCRError): pass
class OCRRateLimitError(OCRError): pass
class OCRValidationError(OCRError): pass
```

### 2. Retry Logic with Exponential Backoff
```python
def retry_with_backoff(func, max_retries, delay):
    for attempt in range(max_retries):
        try:
            return func()
        except TransientError:
            sleep(delay * (2 ** attempt))
    raise
```

### 3. Graceful Degradation
```python
# Try primary → retry → try fallback → fail with clear error
try:
    result = google_vision_ocr.extract_text(image)
except OCRBackendError:
    logger.warning("Google Vision failed, trying Tesseract")
    result = tesseract_ocr.extract_text(image)
```

## Performance Optimizations

### 1. **Caching Strategy**
- Key: SHA256 hash of image content
- Value: Serialized `OCRResult`
- Invalidation: Manual or TTL-based

### 2. **Rate Limiting**
- Token bucket algorithm
- Prevents API quota exhaustion
- Configurable limits

### 3. **Batch Processing** (Future)
- Process multiple images in parallel
- Use `asyncio` for I/O-bound operations
- Progress tracking with callbacks

## Testing Strategy

### 1. Unit Tests
- Mock external dependencies
- Test each class in isolation
- Coverage >90%

### 2. Integration Tests
- Use real test images
- Verify end-to-end flow
- Measure performance

### 3. Property-Based Tests
- Test with random inputs
- Verify invariants
- Edge case discovery

## Implementation Order

1. ✅ Data classes (`OCRResult`, `BoundingBox`, `OCRConfig`)
2. ✅ Abstract base class (`OCRBackend`)
3. ✅ Concrete implementations (`GoogleVisionOCR`, `TesseractOCR`)
4. ✅ Supporting services (`OCRCache`, `RateLimiter`)
5. ✅ Main service (`OCRService`)
6. ✅ Error handling and logging
7. ✅ Unit tests
8. ✅ Integration tests

## Dependencies

```python
# Core
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional, Protocol
import hashlib
import logging
import time

# Image processing
from PIL import Image

# OCR backends
from google.cloud import vision
import pytesseract

# Caching
import diskcache

# Async (future)
import asyncio
import aiohttp
```

## Configuration

Environment variables managed with `pydantic-settings`:

```python
class Settings(BaseSettings):
    google_application_credentials: Optional[str] = None
    tesseract_cmd: str = "tesseract"
    ocr_confidence_threshold: float = 0.85
    ocr_cache_enabled: bool = True
    ocr_cache_dir: str = "./cache/ocr"
    ocr_max_retries: int = 3
    ocr_retry_delay: float = 1.0
    ocr_rate_limit_requests: int = 60
    ocr_rate_limit_period: int = 60
    
    class Config:
        env_file = ".env"
```

## Logging

Structured logging with context:

```python
logger.info(
    "OCR completed",
    extra={
        "image": image_path,
        "backend": backend_name,
        "confidence": result.confidence,
        "processing_time": result.processing_time,
        "cache_hit": was_cached
    }
)
```

## Success Metrics

- ✅ Code coverage >90%
- ✅ Type checking passes (mypy --strict)
- ✅ All linters pass (ruff, pylint)
- ✅ Processing time <2s (Google Vision)
- ✅ Cache hit ratio >80% on repeated images
- ✅ Fallback works automatically
- ✅ All error cases handled gracefully

