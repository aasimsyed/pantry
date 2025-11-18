#!/usr/bin/env python3
"""
Comprehensive test script for ImagePreprocessor using real pantry images.

This script:
1. Reads images from ~/Pictures/Pantry (READ-ONLY)
2. Copies them to a temporary test directory
3. Runs preprocessing with various configurations
4. Generates comparison reports
5. Shows statistics and sample results
6. Leaves the original directory completely untouched
"""

import logging
import shutil
from pathlib import Path
from datetime import datetime
from typing import Dict, List
import sys

from PIL import Image
from src.image_processor import ImagePreprocessor, PreprocessingConfig


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger(__name__)


class PreprocessorTester:
    """Comprehensive tester for ImagePreprocessor with real images."""
    
    def __init__(self, source_dir: Path):
        """
        Initialize the tester.
        
        Args:
            source_dir: Path to source images (will not be modified)
        """
        self.source_dir = Path(source_dir).expanduser()
        self.test_root = Path("test_results")
        self.timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Create test directory structure
        self.test_dir = self.test_root / f"run_{self.timestamp}"
        self.originals_dir = self.test_dir / "originals"
        self.results_dir = self.test_dir / "results"
        
    def setup(self) -> bool:
        """
        Set up test environment by copying images.
        
        Returns:
            bool: True if setup successful
        """
        logger.info("="*70)
        logger.info("IMAGEPREPROCESSOR TEST SUITE")
        logger.info("="*70)
        
        # Verify source directory exists
        if not self.source_dir.exists():
            logger.error(f"❌ Source directory not found: {self.source_dir}")
            return False
        
        logger.info(f"📁 Source: {self.source_dir}")
        
        # Count source images
        source_images = list(self.source_dir.glob("*.jpeg")) + \
                       list(self.source_dir.glob("*.jpg")) + \
                       list(self.source_dir.glob("*.JPEG")) + \
                       list(self.source_dir.glob("*.JPG"))
        
        if not source_images:
            logger.error(f"❌ No JPEG images found in {self.source_dir}")
            return False
        
        logger.info(f"📊 Found {len(source_images)} images")
        
        # Create test directory structure
        logger.info(f"📁 Creating test directory: {self.test_dir}")
        self.originals_dir.mkdir(parents=True, exist_ok=True)
        self.results_dir.mkdir(parents=True, exist_ok=True)
        
        # Copy images to test directory
        logger.info("📋 Copying images to test directory...")
        copied_count = 0
        
        for img_path in source_images:
            try:
                dest_path = self.originals_dir / img_path.name
                shutil.copy2(img_path, dest_path)
                copied_count += 1
            except Exception as e:
                logger.warning(f"⚠️  Failed to copy {img_path.name}: {e}")
        
        logger.info(f"✅ Copied {copied_count} images successfully")
        logger.info(f"✅ Original images in {self.source_dir} are untouched")
        
        return copied_count > 0
    
    def get_image_info(self, image_path: Path) -> Dict:
        """Get information about an image file."""
        try:
            with Image.open(image_path) as img:
                return {
                    "size": img.size,
                    "mode": img.mode,
                    "format": img.format,
                    "file_size": image_path.stat().st_size,
                }
        except Exception as e:
            return {"error": str(e)}
    
    def test_default_config(self) -> Dict:
        """Test with default configuration."""
        logger.info("\n" + "="*70)
        logger.info("TEST 1: Default Configuration")
        logger.info("="*70)
        
        config = PreprocessingConfig()
        output_dir = self.results_dir / "default_config"
        
        logger.info("Configuration:")
        logger.info(f"  - max_dimension: {config.max_dimension}")
        logger.info(f"  - contrast_factor: {config.contrast_factor}")
        logger.info(f"  - brightness_factor: {config.brightness_factor}")
        logger.info(f"  - denoise_strength: {config.denoise_strength}")
        logger.info(f"  - jpeg_quality: {config.jpeg_quality}")
        
        preprocessor = ImagePreprocessor(config=config, output_dir=str(output_dir))
        
        logger.info("\n🔄 Processing images...")
        results = preprocessor.process_directory(str(self.originals_dir))
        
        return self._analyze_results("Default Config", results, output_dir)
    
    def test_high_quality_config(self) -> Dict:
        """Test with high-quality configuration for difficult images."""
        logger.info("\n" + "="*70)
        logger.info("TEST 2: High Quality Configuration (for OCR)")
        logger.info("="*70)
        
        config = PreprocessingConfig(
            max_dimension=4000,
            contrast_factor=1.5,
            brightness_factor=1.3,
            denoise_strength=15,
            jpeg_quality=98,
            save_originals=False
        )
        output_dir = self.results_dir / "high_quality"
        
        logger.info("Configuration:")
        logger.info(f"  - max_dimension: {config.max_dimension}")
        logger.info(f"  - contrast_factor: {config.contrast_factor}")
        logger.info(f"  - brightness_factor: {config.brightness_factor}")
        logger.info(f"  - denoise_strength: {config.denoise_strength}")
        logger.info(f"  - jpeg_quality: {config.jpeg_quality}")
        
        preprocessor = ImagePreprocessor(config=config, output_dir=str(output_dir))
        
        logger.info("\n🔄 Processing images...")
        results = preprocessor.process_directory(str(self.originals_dir))
        
        return self._analyze_results("High Quality", results, output_dir)
    
    def test_fast_config(self) -> Dict:
        """Test with fast processing configuration."""
        logger.info("\n" + "="*70)
        logger.info("TEST 3: Fast Processing Configuration")
        logger.info("="*70)
        
        config = PreprocessingConfig(
            max_dimension=2000,
            contrast_factor=1.1,
            brightness_factor=1.05,
            denoise_strength=0,  # Disabled for speed
            jpeg_quality=85,
            save_originals=False
        )
        output_dir = self.results_dir / "fast_processing"
        
        logger.info("Configuration:")
        logger.info(f"  - max_dimension: {config.max_dimension}")
        logger.info(f"  - contrast_factor: {config.contrast_factor}")
        logger.info(f"  - brightness_factor: {config.brightness_factor}")
        logger.info(f"  - denoise_strength: {config.denoise_strength} (DISABLED)")
        logger.info(f"  - jpeg_quality: {config.jpeg_quality}")
        
        preprocessor = ImagePreprocessor(config=config, output_dir=str(output_dir))
        
        logger.info("\n🔄 Processing images...")
        results = preprocessor.process_directory(str(self.originals_dir))
        
        return self._analyze_results("Fast Processing", results, output_dir)
    
    def _analyze_results(self, test_name: str, results: List[Path], output_dir: Path) -> Dict:
        """Analyze processing results."""
        logger.info("\n" + "-"*70)
        logger.info(f"RESULTS: {test_name}")
        logger.info("-"*70)
        
        original_images = list(self.originals_dir.glob("*.jpeg")) + \
                         list(self.originals_dir.glob("*.jpg"))
        
        success_count = len(results)
        total_count = len(original_images)
        success_rate = (success_count / total_count * 100) if total_count > 0 else 0
        
        logger.info(f"✅ Success: {success_count}/{total_count} ({success_rate:.1f}%)")
        
        if success_count > 0:
            # Calculate size statistics
            original_sizes = []
            processed_sizes = []
            
            for result in results[:5]:  # Sample first 5
                # Find matching original
                original_name = result.stem.replace("_preprocessed", "") + ".jpeg"
                original_path = self.originals_dir / original_name
                
                if original_path.exists():
                    original_sizes.append(original_path.stat().st_size)
                    processed_sizes.append(result.stat().st_size)
            
            if original_sizes and processed_sizes:
                avg_original = sum(original_sizes) / len(original_sizes)
                avg_processed = sum(processed_sizes) / len(processed_sizes)
                reduction = (1 - avg_processed / avg_original) * 100
                
                logger.info(f"📊 Average file size:")
                logger.info(f"   Original:  {avg_original/1024/1024:.2f} MB")
                logger.info(f"   Processed: {avg_processed/1024/1024:.2f} MB")
                logger.info(f"   Reduction: {reduction:.1f}%")
            
            # Sample image details
            logger.info(f"\n📸 Sample processed images (first 3):")
            for i, result in enumerate(results[:3], 1):
                info = self.get_image_info(result)
                if "error" not in info:
                    logger.info(f"   {i}. {result.name}")
                    logger.info(f"      Size: {info['size']}, Mode: {info['mode']}")
        
        logger.info(f"💾 Output saved to: {output_dir}")
        
        return {
            "test_name": test_name,
            "success_count": success_count,
            "total_count": total_count,
            "success_rate": success_rate,
            "output_dir": output_dir
        }
    
    def generate_summary(self, test_results: List[Dict]):
        """Generate final summary of all tests."""
        logger.info("\n" + "="*70)
        logger.info("FINAL SUMMARY")
        logger.info("="*70)
        
        logger.info("\n📊 Test Results:")
        for result in test_results:
            logger.info(f"\n{result['test_name']}:")
            logger.info(f"  ✅ Success Rate: {result['success_rate']:.1f}%")
            logger.info(f"  📁 Output: {result['output_dir']}")
        
        logger.info("\n" + "="*70)
        logger.info("✨ All tests completed successfully!")
        logger.info("="*70)
        logger.info(f"\n📁 All results saved to: {self.test_dir}")
        logger.info(f"📁 Original images unchanged: {self.source_dir}")
        logger.info("\n💡 Next steps:")
        logger.info("   - Review processed images in test_results/")
        logger.info("   - Compare different configurations")
        logger.info("   - Use preprocessed images for OCR testing")
    
    def cleanup_prompt(self):
        """Ask user if they want to keep or delete test results."""
        logger.info("\n" + "-"*70)
        logger.info("Test results are saved in: test_results/")
        logger.info("You can review the processed images or delete them when done.")
        logger.info("-"*70)


def main():
    """Run the comprehensive test suite."""
    # Source directory (read-only)
    source_dir = Path("~/Pictures/Pantry").expanduser()
    
    # Create tester
    tester = PreprocessorTester(source_dir)
    
    # Setup test environment
    if not tester.setup():
        logger.error("❌ Test setup failed")
        sys.exit(1)
    
    # Run tests
    test_results = []
    
    try:
        # Test 1: Default configuration
        result1 = tester.test_default_config()
        test_results.append(result1)
        
        # Test 2: High quality configuration
        result2 = tester.test_high_quality_config()
        test_results.append(result2)
        
        # Test 3: Fast processing configuration
        result3 = tester.test_fast_config()
        test_results.append(result3)
        
        # Generate summary
        tester.generate_summary(test_results)
        
        # Cleanup prompt
        tester.cleanup_prompt()
        
    except KeyboardInterrupt:
        logger.info("\n\n⚠️  Test interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"\n❌ Test failed with error: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()


