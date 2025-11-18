"""
Example usage of the ImagePreprocessor class.

This script demonstrates how to use the ImagePreprocessor to prepare
images for OCR text extraction.
"""

import logging
from pathlib import Path
from src.image_processor import ImagePreprocessor, PreprocessingConfig


# Configure logging to see what's happening
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)


def example_single_image():
    """Example: Process a single image."""
    logger.info("=== Example 1: Process Single Image ===")
    
    # Configure preprocessing parameters
    config = PreprocessingConfig(
        max_dimension=4000,
        contrast_factor=1.3,
        brightness_factor=1.2,
        denoise_strength=10,
        jpeg_quality=95
    )
    
    # Create preprocessor
    preprocessor = ImagePreprocessor(
        config=config,
        output_dir="./processed_images"
    )
    
    # Process a single image
    image_path = "./images/product_label.jpg"
    result = preprocessor.preprocess_image(image_path)
    
    if result:
        logger.info(f"✓ Successfully preprocessed: {result}")
    else:
        logger.error(f"✗ Failed to preprocess: {image_path}")


def example_batch_processing():
    """Example: Process all images in a directory."""
    logger.info("\n=== Example 2: Batch Process Directory ===")
    
    # Use default configuration
    config = PreprocessingConfig()
    
    # Create preprocessor with custom output directory
    preprocessor = ImagePreprocessor(
        config=config,
        output_dir="./batch_processed"
    )
    
    # Process entire directory
    input_directory = "./images"
    results = preprocessor.process_directory(input_directory)
    
    logger.info(f"✓ Processed {len(results)} images successfully")
    for result_path in results:
        logger.info(f"  - {result_path}")


def example_custom_pipeline():
    """Example: Custom preprocessing with specific parameters."""
    logger.info("\n=== Example 3: Custom Processing Pipeline ===")
    
    # Custom configuration for high-quality OCR
    config = PreprocessingConfig(
        max_dimension=3000,        # Slightly smaller max size
        contrast_factor=1.5,        # More contrast for faded labels
        brightness_factor=1.3,      # Brighter for dark images
        denoise_strength=15,        # More denoising for noisy images
        jpeg_quality=98,            # Higher quality output
        save_originals=True         # Keep original copies
    )
    
    preprocessor = ImagePreprocessor(
        config=config,
        output_dir="./high_quality_processed"
    )
    
    # Process directory
    results = preprocessor.process_directory("./images")
    
    logger.info(f"✓ High-quality processing complete: {len(results)} images")


def example_minimal_processing():
    """Example: Minimal preprocessing (no denoising, mild enhancements)."""
    logger.info("\n=== Example 4: Minimal Processing ===")
    
    # Minimal configuration for already-clean images
    config = PreprocessingConfig(
        max_dimension=4000,
        contrast_factor=1.1,        # Very mild contrast boost
        brightness_factor=1.05,     # Very mild brightness boost
        denoise_strength=0,         # No denoising (faster)
        save_originals=False        # Don't save originals
    )
    
    preprocessor = ImagePreprocessor(
        config=config,
        output_dir="./minimal_processed"
    )
    
    # Process
    results = preprocessor.process_directory("./images")
    logger.info(f"✓ Fast processing complete: {len(results)} images")


def example_error_handling():
    """Example: Robust error handling with mixed file types."""
    logger.info("\n=== Example 5: Error Handling ===")
    
    config = PreprocessingConfig()
    preprocessor = ImagePreprocessor(config=config, output_dir="./robust_processed")
    
    # Process directory that may contain non-image files
    # The preprocessor will skip invalid files and continue
    try:
        results = preprocessor.process_directory("./mixed_files")
        logger.info(f"✓ Processed {len(results)} valid images")
        logger.info("  Invalid files were automatically skipped")
    except ValueError as e:
        logger.error(f"✗ Directory error: {e}")


def main():
    """Run all examples."""
    logger.info("╔════════════════════════════════════════════════════╗")
    logger.info("║   ImagePreprocessor Usage Examples                ║")
    logger.info("╚════════════════════════════════════════════════════╝\n")
    
    # Note: These examples assume ./images directory exists with JPEG files
    # Create sample images if needed for testing
    
    try:
        example_single_image()
        example_batch_processing()
        example_custom_pipeline()
        example_minimal_processing()
        example_error_handling()
        
        logger.info("\n" + "="*50)
        logger.info("All examples completed successfully!")
        logger.info("="*50)
        
    except Exception as e:
        logger.error(f"Example failed: {e}", exc_info=True)


if __name__ == "__main__":
    main()

