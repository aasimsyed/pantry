# Next Task: OCR Service Implementation

## Objective
Create a Python class called OCRService that provides a unified interface for OCR operations.

## Requirements

### 1. Support Multiple OCR Backends

**Primary:**
- Google Cloud Vision API

**Fallback/Local:**
- Tesseract OCR

### 2. Core Methods

#### `extract_text(image_path: str) -> dict`

**Returns:**
```python
{
    'raw_text': str,              # Extracted text content
    'confidence': float,          # Overall confidence score (0-1)
    'bounding_boxes': list,       # Text region coordinates
    'detected_languages': list    # Detected language codes
}
```

### 3. Features to Implement

- **Automatic Language Detection**
  - Detect text language automatically
  - Support multiple languages in single image

- **Text Region Detection with Coordinates**
  - Provide bounding box coordinates for each text region
  - Support word-level and line-level detection

- **Confidence Scoring**
  - Per-word confidence scores
  - Overall document confidence
  - Threshold-based quality gating

- **Batch Processing Support**
  - Process multiple images efficiently
  - Async/parallel processing capability
  - Progress tracking

- **Rate Limiting for API Calls**
  - Respect API rate limits
  - Exponential backoff on failures
  - Queue management for batch operations

- **Caching to Avoid Re-processing**
  - Cache results based on image hash
  - Configurable cache expiration
  - Persistent cache storage option

### 4. Error Handling

- **API Failures with Automatic Retry**
  - Retry logic with exponential backoff
  - Maximum retry attempts configuration
  - Different strategies for different error types

- **Graceful Degradation to Fallback OCR**
  - Automatically switch to Tesseract if Google Vision fails
  - Log fallback usage for monitoring
  - Configurable fallback behavior

- **Invalid Image Format Handling**
  - Validate image before processing
  - Clear error messages for unsupported formats
  - Attempt format conversion when possible

### 5. Configuration

**Environment Variables:**
```bash
# Google Cloud Vision
GOOGLE_CLOUD_VISION_KEY=path/to/credentials.json
GOOGLE_CLOUD_VISION_PROJECT_ID=project-id

# Tesseract
TESSERACT_CMD=/usr/local/bin/tesseract
TESSERACT_LANG=eng

# OCR Settings
OCR_CONFIDENCE_THRESHOLD=0.85
OCR_CACHE_ENABLED=true
OCR_CACHE_DIR=./cache/ocr
OCR_MAX_RETRIES=3
OCR_RETRY_DELAY=1.0

# Rate Limiting
OCR_RATE_LIMIT_REQUESTS=60
OCR_RATE_LIMIT_PERIOD=60
```

### 6. Logging Requirements

- Comprehensive error logging with stack traces
- Performance metrics (processing time per image)
- API usage statistics
- Cache hit/miss rates
- Fallback trigger events

## Implementation Guidelines

### Best Practices to Follow:
- **SOLID Principles**: Separate concerns, single responsibility
- **DRY**: Reusable code, no duplication
- **KISS**: Simple, clear implementation
- **Type Hints**: 100% coverage
- **Docstrings**: Comprehensive documentation
- **Error Handling**: Graceful failures, informative messages
- **Testing**: Unit tests with mocked API calls

### Code Structure:
```
src/ocr_service.py
├── OCRConfig (configuration dataclass)
├── OCRResult (result dataclass)
├── OCRBackend (abstract base class)
│   ├── GoogleVisionOCR
│   └── TesseractOCR
├── OCRCache (caching layer)
├── OCRService (main unified interface)
└── RateLimiter (API rate limiting)
```

### Integration Points:
- Use preprocessed images from ImagePreprocessor
- Return standardized results for AI analyzer
- Cache results for repeated processing
- Log all operations for audit trail

## Success Criteria

1. ✅ Successfully extract text from preprocessed images
2. ✅ Achieve >85% confidence on clear images
3. ✅ Automatic fallback works when primary fails
4. ✅ Caching reduces redundant API calls
5. ✅ Rate limiting prevents API quota exhaustion
6. ✅ Comprehensive error handling and logging
7. ✅ Unit tests with >90% coverage
8. ✅ Integration with existing ImagePreprocessor

## Testing Strategy

### Unit Tests:
- Mock API responses
- Test confidence thresholds
- Test fallback logic
- Test caching mechanism
- Test rate limiting

### Integration Tests:
- Process real preprocessed images
- Verify text extraction accuracy
- Test with various image qualities
- Measure performance metrics

### Edge Cases:
- Empty images
- Non-text images
- Corrupted images
- API timeout scenarios
- Rate limit scenarios

## Performance Targets

- **Processing Time**: <2 seconds per image (Google Vision)
- **Processing Time**: <5 seconds per image (Tesseract)
- **Cache Hit Ratio**: >80% on repeated images
- **Accuracy**: >85% confidence on preprocessed images
- **API Success Rate**: >95% with retry logic

## Dependencies

- `google-cloud-vision>=3.4.0` - Google Cloud Vision API
- `pytesseract>=0.3.10` - Tesseract OCR wrapper
- `Pillow>=10.1.0` - Image handling
- `aiohttp>=3.9.0` - Async HTTP for batch processing
- `diskcache>=5.6.0` or `redis>=4.5.0` - Caching backend

## Notes

- Prioritize Google Cloud Vision for accuracy
- Use Tesseract as fallback to reduce costs
- Cache aggressively to minimize API costs
- Consider implementing OCR confidence threshold tuning
- May need to handle PDF/multi-page documents in future

## Related Files

- `src/image_processor.py` - Provides preprocessed images
- `README.md` - Architecture overview (lines 394-414)
- Project uses Python 3.10+ with type hints
- Follow existing code style and documentation patterns


