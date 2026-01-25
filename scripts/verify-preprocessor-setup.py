#!/usr/bin/env python3
"""
Verify ImagePreprocessor with real pantry images.

Reads from ~/Pictures/Pantry (READ-ONLY), copies to test_results/, runs configs,
shows stats. Run from project root: python scripts/verify-preprocessor-setup.py
"""

import logging
import shutil
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List

from PIL import Image

from src.image_processor import ImagePreprocessor, PreprocessingConfig

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)


class PreprocessorTester:
    """Comprehensive tester for ImagePreprocessor with real images."""

    def __init__(self, source_dir: Path):
        self.source_dir = Path(source_dir).expanduser()
        self.test_root = Path("test_results")
        self.timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.test_dir = self.test_root / f"run_{self.timestamp}"
        self.originals_dir = self.test_dir / "originals"
        self.results_dir = self.test_dir / "results"

    def setup(self) -> bool:
        logger.info("=" * 70)
        logger.info("IMAGEPREPROCESSOR TEST SUITE")
        logger.info("=" * 70)
        if not self.source_dir.exists():
            logger.error("❌ Source directory not found: %s", self.source_dir)
            return False
        logger.info("📁 Source: %s", self.source_dir)
        source_images = (
            list(self.source_dir.glob("*.jpeg"))
            + list(self.source_dir.glob("*.jpg"))
            + list(self.source_dir.glob("*.JPEG"))
            + list(self.source_dir.glob("*.JPG"))
        )
        if not source_images:
            logger.error("❌ No JPEG images in %s", self.source_dir)
            return False
        logger.info("📊 Found %d images", len(source_images))
        self.originals_dir.mkdir(parents=True, exist_ok=True)
        self.results_dir.mkdir(parents=True, exist_ok=True)
        copied = 0
        for img_path in source_images:
            try:
                shutil.copy2(img_path, self.originals_dir / img_path.name)
                copied += 1
            except Exception as e:
                logger.warning("⚠️  Failed to copy %s: %s", img_path.name, e)
        logger.info("✅ Copied %d images", copied)
        return copied > 0

    def get_image_info(self, image_path: Path) -> Dict:
        try:
            with Image.open(image_path) as img:
                return {"size": img.size, "mode": img.mode, "format": img.format, "file_size": image_path.stat().st_size}
        except Exception as e:
            return {"error": str(e)}

    def test_default_config(self) -> Dict:
        logger.info("\n" + "=" * 70 + "\nTEST 1: Default Configuration\n" + "=" * 70)
        config = PreprocessingConfig()
        output_dir = self.results_dir / "default_config"
        preprocessor = ImagePreprocessor(config=config, output_dir=str(output_dir))
        results = preprocessor.process_directory(str(self.originals_dir))
        return self._analyze_results("Default Config", results, output_dir)

    def test_high_quality_config(self) -> Dict:
        logger.info("\n" + "=" * 70 + "\nTEST 2: High Quality (OCR)\n" + "=" * 70)
        config = PreprocessingConfig(
            max_dimension=4000,
            contrast_factor=1.5,
            brightness_factor=1.3,
            denoise_strength=15,
            jpeg_quality=98,
            save_originals=False,
        )
        output_dir = self.results_dir / "high_quality"
        preprocessor = ImagePreprocessor(config=config, output_dir=str(output_dir))
        results = preprocessor.process_directory(str(self.originals_dir))
        return self._analyze_results("High Quality", results, output_dir)

    def test_fast_config(self) -> Dict:
        logger.info("\n" + "=" * 70 + "\nTEST 3: Fast Processing\n" + "=" * 70)
        config = PreprocessingConfig(
            max_dimension=2000,
            contrast_factor=1.1,
            brightness_factor=1.05,
            denoise_strength=0,
            jpeg_quality=85,
            save_originals=False,
        )
        output_dir = self.results_dir / "fast_processing"
        preprocessor = ImagePreprocessor(config=config, output_dir=str(output_dir))
        results = preprocessor.process_directory(str(self.originals_dir))
        return self._analyze_results("Fast Processing", results, output_dir)

    def _analyze_results(self, test_name: str, results: List[Path], output_dir: Path) -> Dict:
        logger.info("\n" + "-" * 70 + "\nRESULTS: %s\n" + "-" * 70, test_name)
        originals = list(self.originals_dir.glob("*.jpeg")) + list(self.originals_dir.glob("*.jpg"))
        total = len(originals)
        success = len(results)
        rate = (success / total * 100) if total else 0
        logger.info("✅ Success: %d/%d (%.1f%%)", success, total, rate)
        if success > 0:
            orig_sizes, proc_sizes = [], []
            for r in results[:5]:
                oname = r.stem.replace("_preprocessed", "") + ".jpeg"
                opath = self.originals_dir / oname
                if opath.exists():
                    orig_sizes.append(opath.stat().st_size)
                    proc_sizes.append(r.stat().st_size)
            if orig_sizes and proc_sizes:
                avg_o = sum(orig_sizes) / len(orig_sizes)
                avg_p = sum(proc_sizes) / len(proc_sizes)
                logger.info("📊 Original avg %.2f MB → Processed %.2f MB (%.1f%% reduction)", avg_o / 1024 / 1024, avg_p / 1024 / 1024, (1 - avg_p / avg_o) * 100)
            for i, r in enumerate(results[:3], 1):
                info = self.get_image_info(r)
                if "error" not in info:
                    logger.info("   %d. %s %s %s", i, r.name, info["size"], info["mode"])
        logger.info("💾 Output: %s", output_dir)
        return {"test_name": test_name, "success_count": success, "total_count": total, "success_rate": rate, "output_dir": output_dir}

    def generate_summary(self, test_results: List[Dict]) -> None:
        logger.info("\n" + "=" * 70 + "\nFINAL SUMMARY\n" + "=" * 70)
        for r in test_results:
            logger.info("%s: %.1f%% → %s", r["test_name"], r["success_rate"], r["output_dir"])
        logger.info("\n✨ All tests completed. Results in %s", self.test_dir)
        logger.info("💡 Review test_results/ or run OCR: python scripts/verify-ocr-setup.py")

    def cleanup_prompt(self) -> None:
        logger.info("\nTest results in test_results/. Review or delete when done.")


def main() -> None:
    source_dir = Path("~/Pictures/Pantry").expanduser()
    tester = PreprocessorTester(source_dir)
    if not tester.setup():
        logger.error("❌ Test setup failed")
        sys.exit(1)
    test_results = []
    try:
        test_results.append(tester.test_default_config())
        test_results.append(tester.test_high_quality_config())
        test_results.append(tester.test_fast_config())
        tester.generate_summary(test_results)
        tester.cleanup_prompt()
    except KeyboardInterrupt:
        logger.info("\n⚠️  Interrupted")
        sys.exit(1)
    except Exception as e:
        logger.exception("❌ Test failed: %s", e)
        sys.exit(1)


if __name__ == "__main__":
    main()
