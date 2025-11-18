# ImagePreprocessor Usage Guide

## Quick Start

The `ImagePreprocessor` class prepares images for optimal OCR text extraction by applying a series of enhancement techniques.

### Installation

```bash
# Install required dependencies
pip install -r requirements.txt

# Or install just the core dependencies
pip install Pillow opencv-python numpy
```

### Basic Usage

```python
from src.image_processor import ImagePreprocessor, PreprocessingConfig

# Use default settings
preprocessor = ImagePreprocessor()

# Process all images in a directory
results = preprocessor.process_directory("./images")
print(f"Processed {len(results)} images")
```

## Configuration Options

### PreprocessingConfig Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `max_dimension` | int | 4000 | Maximum size for longest side (px) |
| `contrast_factor` | float | 1.2 | Contrast enhancement (1.0 = no change) |
| `brightness_factor` | float | 1.1 | Brightness enhancement (1.0 = no change) |
| `denoise_strength` | int | 10 | Denoising filter strength (0 = disabled) |
| `output_format` | str | "JPEG" | Output image format |
| `jpeg_quality` | int | 95 | JPEG compression quality (1-100) |
| `save_originals` | bool | True | Save copies of original images |

### Custom Configuration

```python
config = PreprocessingConfig(
    max_dimension=3000,
    contrast_factor=1.5,
    brightness_factor=1.3,
    denoise_strength=15,
    jpeg_quality=98,
    save_originals=True
)

preprocessor = ImagePreprocessor(
    config=config,
    output_dir="./processed"
)
```

## Common Use Cases

### 1. Single Image Processing

```python
from src.image_processor import ImagePreprocessor

preprocessor = ImagePreprocessor(output_dir="./processed")
result = preprocessor.preprocess_image("product_label.jpg")

if result:
    print(f"Preprocessed image saved to: {result}")
else:
    print("Preprocessing failed")
```

### 2. Batch Processing

```python
preprocessor = ImagePreprocessor(output_dir="./processed_batch")
results = preprocessor.process_directory("./raw_images")

print(f"Successfully processed {len(results)} images:")
for path in results:
    print(f"  - {path}")
```

### 3. High-Quality OCR Preprocessing

For best OCR results with difficult images:

```python
config = PreprocessingConfig(
    max_dimension=4000,         # Keep large images
    contrast_factor=1.5,        # Strong contrast boost
    brightness_factor=1.3,      # Significant brightening
    denoise_strength=15,        # Heavy denoising
    jpeg_quality=98            # Maximum quality
)

preprocessor = ImagePreprocessor(config=config)
results = preprocessor.process_directory("./difficult_images")
```

### 4. Fast Processing (Low Quality Images)

For quick processing when images are already clean:

```python
config = PreprocessingConfig(
    max_dimension=2000,         # Smaller max size (faster)
    contrast_factor=1.1,        # Minimal contrast
    brightness_factor=1.05,     # Minimal brightness
    denoise_strength=0,         # No denoising (much faster)
    jpeg_quality=85,           # Lower quality (smaller files)
    save_originals=False       # Don't save originals
)

preprocessor = ImagePreprocessor(config=config)
```

### 5. Processing with Error Handling

```python
from pathlib import Path

preprocessor = ImagePreprocessor()
image_dir = Path("./images")

# Process with error handling
for image_path in image_dir.glob("*.jpg"):
    result = preprocessor.preprocess_image(image_path)
    
    if result:
        print(f"✓ {image_path.name} → {result.name}")
    else:
        print(f"✗ Failed: {image_path.name}")
```

## Output Directory Structure

By default (with `output_dir="./processed"`):

```
processed/
├── image1_preprocessed.jpg
├── image2_preprocessed.jpg
└── originals/              # If save_originals=True
    ├── image1.jpg
    └── image2.jpg
```

Without specifying `output_dir` (images saved next to originals):

```
images/
├── image1.jpg
├── image2.jpg
└── preprocessed/
    ├── image1_preprocessed.jpg
    ├── image2_preprocessed.jpg
    └── originals/
        ├── image1.jpg
        └── image2.jpg
```

## Processing Pipeline

Each image goes through these stages:

1. **Validation** - Verify JPEG format and file integrity
2. **Load** - Open image with Pillow
3. **Resize** - Scale down if exceeds max_dimension
4. **Enhance** - Apply contrast and brightness adjustments
5. **Grayscale** - Convert to single-channel for OCR
6. **Denoise** - Apply OpenCV denoising filter
7. **Save** - Write preprocessed image to disk

## Best Practices

### For OCR Accuracy

1. **Keep images reasonably large**: Don't set `max_dimension` too small
2. **Use moderate enhancements**: `contrast_factor=1.2-1.5` works well
3. **Enable denoising**: Helps with camera phone images
4. **High JPEG quality**: Use 90-98 for best OCR results

### For Performance

1. **Disable denoising**: Set `denoise_strength=0` for 2-3x speed boost
2. **Lower max_dimension**: Smaller images process faster
3. **Sequential processing**: Current implementation (parallel can be added)
4. **Disable save_originals**: Skip saving original copies

### For Storage

1. **Lower JPEG quality**: 80-85 still good, much smaller files
2. **Disable save_originals**: Saves 50% disk space
3. **Smaller max_dimension**: Reduces file sizes significantly

## Logging

Enable logging to see detailed processing information:

```python
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Now run preprocessing - you'll see detailed logs
preprocessor = ImagePreprocessor()
preprocessor.process_directory("./images")
```

Log levels:
- `INFO`: High-level progress (processing started/completed)
- `DEBUG`: Detailed step-by-step information
- `WARNING`: Validation failures, corrupted files
- `ERROR`: Processing errors

## Error Handling

The preprocessor handles errors gracefully:

- **Invalid files**: Automatically skipped
- **Corrupted images**: Logged and skipped
- **Missing files**: Returns None
- **Permission errors**: Logged and skipped

Batch processing continues even if individual images fail.

## Testing

Run the comprehensive test suite:

```bash
# Run all tests
pytest tests/test_image_processor.py -v

# Run only smoke tests (quick validation)
pytest tests/test_image_processor.py -v -m smoke

# Run with coverage report
pytest tests/test_image_processor.py --cov=src --cov-report=html
```

## Performance Characteristics

**Processing time per image** (approximate, on modern hardware):

| Image Size | With Denoising | Without Denoising |
|------------|----------------|-------------------|
| 1000x1000  | ~0.5s         | ~0.1s            |
| 2000x2000  | ~1.5s         | ~0.3s            |
| 4000x4000  | ~4s           | ~0.8s            |

**Memory usage**: Peak ~3x the uncompressed image size

## Troubleshooting

### Images appear too dark/light

Adjust `brightness_factor`:
- Too dark: Increase to 1.3-1.5
- Too bright: Decrease to 1.0-1.1

### Text still blurry after preprocessing

Increase `denoise_strength` to 15-20 or increase `contrast_factor` to 1.5-2.0

### Processing is too slow

- Set `denoise_strength=0`
- Reduce `max_dimension` to 2000 or less
- Use lower `jpeg_quality` (80-85)

### Out of memory errors

- Reduce `max_dimension`
- Process fewer images at once
- Close other applications

## Integration with OCR

The preprocessed images are optimized for OCR tools like Tesseract:

```python
from src.image_processor import ImagePreprocessor
import pytesseract

# Preprocess
preprocessor = ImagePreprocessor()
processed_path = preprocessor.preprocess_image("label.jpg")

# OCR on preprocessed image
text = pytesseract.image_to_string(processed_path)
print(text)
```

## License

This module is part of the Smart Pantry Inventory System.

