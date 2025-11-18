"""
Example usage of OCR Service for Smart Pantry Inventory System.

This demonstrates how to use the OCR service with various configurations
and backends (Google Cloud Vision and Tesseract OCR).

Run this script:
    python example_ocr_usage.py

Requirements:
    - At least one OCR backend configured (Tesseract or Google Vision)
    - For Google Vision: GOOGLE_APPLICATION_CREDENTIALS environment variable set
    - Test images in ~/Pictures/Pantry or another directory
"""

import os
import time
from pathlib import Path

from src.ocr_service import OCRConfig, OCRService, create_ocr_service


def example_basic_usage():
    """Example 1: Basic usage with default configuration."""
    print("=" * 70)
    print("EXAMPLE 1: Basic Usage (Default Configuration)")
    print("=" * 70)
    
    # Create service with default configuration (from environment)
    service = create_ocr_service()
    
    # Example image path (adjust to your test images)
    test_images_dir = Path.home() / "Pictures" / "Pantry"
    if not test_images_dir.exists():
        print(f"⚠️  Test directory not found: {test_images_dir}")
        print("   Please update the path to your test images")
        return
    
    # Get first image from directory
    images = list(test_images_dir.glob("*.jpg"))[:1]
    if not images:
        print("⚠️  No JPEG images found in test directory")
        return
    
    image_path = str(images[0])
    print(f"\n📸 Processing: {Path(image_path).name}")
    
    # Extract text
    result = service.extract_text(image_path)
    
    # Display results
    print(f"\n✅ OCR Complete!")
    print(f"   Backend: {result['backend_used']}")
    print(f"   Confidence: {result['confidence']:.2%}")
    print(f"   Processing Time: {result['processing_time']:.2f}s")
    print(f"   Cached: {result['cached']}")
    print(f"   Languages: {', '.join(result['detected_languages'])}")
    print(f"   Text Regions: {len(result['bounding_boxes'])}")
    print(f"\n📝 Extracted Text:")
    print(f"   {result['raw_text'][:200]}")
    if len(result['raw_text']) > 200:
        print(f"   ... (truncated, {len(result['raw_text'])} total chars)")
    
    # Show bounding boxes (first 3)
    if result['bounding_boxes']:
        print(f"\n📍 Sample Bounding Boxes (first 3):")
        for i, bbox in enumerate(result['bounding_boxes'][:3], 1):
            print(f"   {i}. '{bbox['text']}' at ({bbox['x']}, {bbox['y']}) "
                  f"confidence: {bbox['confidence']:.2%}")


def example_custom_config():
    """Example 2: Custom configuration."""
    print("\n" + "=" * 70)
    print("EXAMPLE 2: Custom Configuration")
    print("=" * 70)
    
    # Create custom configuration
    config = OCRConfig(
        confidence_threshold=0.75,  # Lower threshold
        cache_enabled=False,  # Disable caching
        preferred_backend="tesseract",  # Prefer Tesseract
        max_retries=1,  # Fewer retries
        rate_limit_requests=100,  # Higher rate limit
    )
    
    print(f"\n⚙️  Configuration:")
    print(f"   Confidence Threshold: {config.confidence_threshold:.2%}")
    print(f"   Cache Enabled: {config.cache_enabled}")
    print(f"   Preferred Backend: {config.preferred_backend}")
    print(f"   Max Retries: {config.max_retries}")
    print(f"   Rate Limit: {config.rate_limit_requests} req/{config.rate_limit_period}s")
    
    # Create service with custom config
    service = OCRService(config)
    
    print(f"\n📊 Available Backends: {', '.join(service.available_backends)}")


def example_batch_processing():
    """Example 3: Batch processing multiple images."""
    print("\n" + "=" * 70)
    print("EXAMPLE 3: Batch Processing")
    print("=" * 70)
    
    service = create_ocr_service()
    
    # Get test images
    test_images_dir = Path.home() / "Pictures" / "Pantry"
    if not test_images_dir.exists():
        print(f"⚠️  Test directory not found: {test_images_dir}")
        return
    
    images = list(test_images_dir.glob("*.jpg"))[:5]  # Process first 5
    if not images:
        print("⚠️  No JPEG images found in test directory")
        return
    
    print(f"\n📦 Processing {len(images)} images...")
    
    results = []
    total_start = time.time()
    
    for i, image_path in enumerate(images, 1):
        print(f"\n   [{i}/{len(images)}] {Path(image_path).name}")
        
        try:
            result = service.extract_text(str(image_path))
            results.append(result)
            
            print(f"      ✅ {result['backend_used']}: "
                  f"{len(result['raw_text'])} chars, "
                  f"{result['confidence']:.2%} confidence, "
                  f"{result['processing_time']:.2f}s, "
                  f"{'cached' if result['cached'] else 'fresh'}")
            
        except Exception as e:
            print(f"      ❌ Error: {e}")
    
    total_time = time.time() - total_start
    
    # Summary
    print(f"\n📊 Batch Summary:")
    print(f"   Total Images: {len(images)}")
    print(f"   Successful: {len(results)}")
    print(f"   Failed: {len(images) - len(results)}")
    print(f"   Total Time: {total_time:.2f}s")
    print(f"   Average Time: {total_time / len(images):.2f}s per image")
    
    if results:
        avg_conf = sum(r['confidence'] for r in results) / len(results)
        cached_count = sum(1 for r in results if r['cached'])
        print(f"   Average Confidence: {avg_conf:.2%}")
        print(f"   Cache Hit Rate: {cached_count}/{len(results)} "
              f"({cached_count/len(results):.0%})")


def example_caching():
    """Example 4: Demonstrating caching performance."""
    print("\n" + "=" * 70)
    print("EXAMPLE 4: Caching Performance")
    print("=" * 70)
    
    service = create_ocr_service()
    
    # Get test image
    test_images_dir = Path.home() / "Pictures" / "Pantry"
    if not test_images_dir.exists():
        print(f"⚠️  Test directory not found: {test_images_dir}")
        return
    
    images = list(test_images_dir.glob("*.jpg"))[:1]
    if not images:
        print("⚠️  No JPEG images found in test directory")
        return
    
    image_path = str(images[0])
    print(f"\n📸 Image: {Path(image_path).name}")
    
    # First extraction (not cached)
    print(f"\n🔄 First extraction (not cached):")
    start1 = time.time()
    result1 = service.extract_text(image_path)
    time1 = time.time() - start1
    print(f"   Time: {time1:.3f}s")
    print(f"   Cached: {result1['cached']}")
    
    # Second extraction (cached)
    print(f"\n⚡ Second extraction (cached):")
    start2 = time.time()
    result2 = service.extract_text(image_path)
    time2 = time.time() - start2
    print(f"   Time: {time2:.3f}s")
    print(f"   Cached: {result2['cached']}")
    
    # Performance improvement
    speedup = time1 / time2 if time2 > 0 else 0
    print(f"\n🚀 Speedup: {speedup:.1f}x faster with cache!")
    print(f"   Time saved: {(time1 - time2):.3f}s ({(1 - time2/time1)*100:.1f}%)")
    
    # Cache stats
    cache_stats = service.get_cache_stats()
    if cache_stats:
        print(f"\n💾 Cache Stats:")
        print(f"   Entries: {cache_stats.get('size', 0)}")
        print(f"   Directory: {cache_stats.get('directory', 'N/A')}")
        print(f"   TTL: {cache_stats.get('ttl', 0)}s")


def example_environment_config():
    """Example 5: Configuration via environment variables."""
    print("\n" + "=" * 70)
    print("EXAMPLE 5: Environment Variable Configuration")
    print("=" * 70)
    
    print(f"\n📋 Current Environment Variables:")
    env_vars = [
        "GOOGLE_APPLICATION_CREDENTIALS",
        "TESSERACT_CMD",
        "OCR_CONFIDENCE_THRESHOLD",
        "OCR_CACHE_ENABLED",
        "OCR_CACHE_DIR",
        "OCR_MAX_RETRIES",
        "OCR_RATE_LIMIT_REQUESTS",
        "OCR_PREFERRED_BACKEND",
    ]
    
    for var in env_vars:
        value = os.getenv(var)
        if value:
            # Truncate long values (like file paths)
            display_value = value if len(value) < 50 else value[:47] + "..."
            print(f"   ✅ {var} = {display_value}")
        else:
            print(f"   ⚪ {var} = (not set, using default)")
    
    # Create config from environment
    config = OCRConfig.from_env()
    
    print(f"\n⚙️  Loaded Configuration:")
    print(f"   Confidence Threshold: {config.confidence_threshold:.2%}")
    print(f"   Cache Enabled: {config.cache_enabled}")
    print(f"   Cache Directory: {config.cache_dir}")
    print(f"   Max Retries: {config.max_retries}")
    print(f"   Preferred Backend: {config.preferred_backend}")
    print(f"   Rate Limit: {config.rate_limit_requests} req/{config.rate_limit_period}s")


def main():
    """Run all examples."""
    print("\n" + "=" * 70)
    print("OCR SERVICE USAGE EXAMPLES")
    print("Smart Pantry Inventory System")
    print("=" * 70)
    
    try:
        # Example 1: Basic usage
        example_basic_usage()
        
        # Example 2: Custom configuration
        example_custom_config()
        
        # Example 3: Batch processing
        example_batch_processing()
        
        # Example 4: Caching
        example_caching()
        
        # Example 5: Environment configuration
        example_environment_config()
        
        print("\n" + "=" * 70)
        print("✅ All examples completed!")
        print("=" * 70)
        
    except KeyboardInterrupt:
        print("\n\n⚠️  Interrupted by user")
    except Exception as e:
        print(f"\n\n❌ Error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()

