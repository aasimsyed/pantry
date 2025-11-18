"""
Unit tests for image_processor module.

Tests cover validation, preprocessing, and error handling.
"""

from pathlib import Path
from typing import Any

import pytest
from PIL import Image

from src.image_processor import ImagePreprocessor, PreprocessingConfig


@pytest.fixture
def config() -> PreprocessingConfig:
    """Fixture for default preprocessing configuration."""
    return PreprocessingConfig(
        max_dimension=2000,
        contrast_factor=1.2,
        brightness_factor=1.1,
        denoise_strength=10,
        jpeg_quality=95
    )


@pytest.fixture
def preprocessor(
    config: PreprocessingConfig, tmp_path: Any
) -> ImagePreprocessor:
    """Fixture for ImagePreprocessor with temporary output directory."""
    return ImagePreprocessor(
        config=config, output_dir=str(tmp_path / "output")
    )


@pytest.fixture
def sample_image(tmp_path: Any) -> Path:
    """Fixture to create a sample JPEG image for testing."""
    image_path = tmp_path / "test_image.jpg"
    # Create a simple test image (100x100 RGB)
    img = Image.new('RGB', (100, 100), color='red')
    img.save(image_path, format='JPEG')
    return image_path


@pytest.fixture
def large_image(tmp_path: Any) -> Path:
    """Fixture to create a large image that needs resizing."""
    image_path = tmp_path / "large_image.jpg"
    # Create a 5000x5000 image
    img = Image.new('RGB', (5000, 5000), color='blue')
    img.save(image_path, format='JPEG')
    return image_path


class TestPreprocessingConfig:
    """Test PreprocessingConfig dataclass."""

    @pytest.mark.smoke
    def test_default_config(self):
        """Test default configuration values."""
        config = PreprocessingConfig()
        assert config.max_dimension == 4000
        assert config.contrast_factor == 1.2
        assert config.brightness_factor == 1.1
        assert config.denoise_strength == 10
        assert config.output_format == "JPEG"
        assert config.jpeg_quality == 95

    @pytest.mark.smoke
    def test_custom_config(self):
        """Test custom configuration values."""
        config = PreprocessingConfig(
            max_dimension=2000,
            contrast_factor=1.5,
            brightness_factor=1.3,
            denoise_strength=5,
            jpeg_quality=90
        )
        assert config.max_dimension == 2000
        assert config.contrast_factor == 1.5
        assert config.brightness_factor == 1.3
        assert config.denoise_strength == 5
        assert config.jpeg_quality == 90

    def test_invalid_max_dimension(self):
        """Test validation of max_dimension parameter."""
        with pytest.raises(
            ValueError, match="max_dimension must be positive"
        ):
            PreprocessingConfig(max_dimension=-100)

    def test_invalid_jpeg_quality(self):
        """Test validation of jpeg_quality parameter."""
        with pytest.raises(
            ValueError, match="jpeg_quality must be between 1 and 100"
        ):
            PreprocessingConfig(jpeg_quality=150)

    def test_invalid_contrast_factor(self):
        """Test validation of contrast_factor parameter."""
        with pytest.raises(
            ValueError, match="contrast_factor must be non-negative"
        ):
            PreprocessingConfig(contrast_factor=-1.0)


class TestImagePreprocessor:
    """Test ImagePreprocessor class."""

    @pytest.mark.smoke
    def test_initialization(self, config):
        """Test preprocessor initialization."""
        preprocessor = ImagePreprocessor(
            config=config, output_dir="/tmp/test"
        )
        assert preprocessor.config == config
        assert preprocessor.output_dir == Path("/tmp/test")

    def test_initialization_default_config(self):
        """Test preprocessor initialization with default config."""
        preprocessor = ImagePreprocessor()
        assert preprocessor.config is not None
        assert preprocessor.output_dir is None

    @pytest.mark.smoke
    def test_validate_jpeg_valid(self, preprocessor, sample_image):
        """Test validation of valid JPEG image."""
        assert preprocessor._validate_jpeg(sample_image) is True

    def test_validate_jpeg_invalid_extension(self, preprocessor, tmp_path):
        """Test rejection of non-JPEG file extension."""
        png_file = tmp_path / "test.png"
        png_file.touch()
        assert preprocessor._validate_jpeg(png_file) is False

    def test_validate_jpeg_nonexistent_file(self, preprocessor, tmp_path):
        """Test handling of nonexistent file."""
        fake_path = tmp_path / "nonexistent.jpg"
        assert preprocessor._validate_jpeg(fake_path) is False

    def test_validate_jpeg_corrupted_file(self, preprocessor, tmp_path):
        """Test handling of corrupted JPEG file."""
        corrupted = tmp_path / "corrupted.jpg"
        corrupted.write_text("This is not a valid JPEG file")
        assert preprocessor._validate_jpeg(corrupted) is False

    def test_resize_image_no_resize_needed(self, preprocessor):
        """Test that small images are not resized."""
        img = Image.new('RGB', (100, 100))
        result = preprocessor._resize_image(img)
        assert result.size == (100, 100)

    @pytest.mark.smoke
    def test_resize_image_resize_needed(self, preprocessor):
        """Test resizing of oversized images."""
        # Create 3000x3000 image, config max is 2000
        img = Image.new('RGB', (3000, 3000))
        result = preprocessor._resize_image(img)
        # Should be resized to 2000x2000 (maintaining aspect ratio)
        assert result.size == (2000, 2000)

    def test_resize_image_maintains_aspect_ratio(self, preprocessor):
        """Test that resizing maintains aspect ratio."""
        # Create 4000x2000 image (2:1 ratio)
        img = Image.new('RGB', (4000, 2000))
        result = preprocessor._resize_image(img)
        # Should be resized to 2000x1000 (maintaining 2:1 ratio)
        assert result.size == (2000, 1000)

    @pytest.mark.smoke
    def test_enhance_image(self, preprocessor):
        """Test image enhancement."""
        img = Image.new('RGB', (100, 100), color='gray')
        result = preprocessor._enhance_image(img)
        assert result is not None
        assert result.size == img.size

    def test_denoise_image(self, preprocessor):
        """Test denoising filter application."""
        img = Image.new('L', (100, 100), color=128)
        result = preprocessor._denoise_image(img)
        assert result is not None
        assert result.size == img.size

    def test_denoise_image_disabled(self, preprocessor):
        """Test that denoising can be disabled."""
        preprocessor.config.denoise_strength = 0
        img = Image.new('L', (100, 100))
        result = preprocessor._denoise_image(img)
        assert result == img

    @pytest.mark.smoke
    def test_convert_to_grayscale(self, preprocessor):
        """Test conversion to grayscale."""
        img = Image.new('RGB', (100, 100), color='red')
        result = preprocessor._convert_to_grayscale(img)
        assert result.mode == 'L'
        assert result.size == img.size

    def test_convert_to_grayscale_already_grayscale(self, preprocessor):
        """Test that grayscale images are not converted again."""
        img = Image.new('L', (100, 100))
        result = preprocessor._convert_to_grayscale(img)
        assert result == img

    @pytest.mark.smoke
    def test_preprocess_image_success(self, preprocessor, sample_image):
        """Test successful preprocessing of a single image."""
        result = preprocessor.preprocess_image(sample_image)
        assert result is not None
        assert result.exists()
        assert result.name.endswith('_preprocessed.jpg')

    def test_preprocess_image_invalid_file(self, preprocessor, tmp_path):
        """Test preprocessing of invalid file returns None."""
        invalid_file = tmp_path / "invalid.txt"
        invalid_file.write_text("Not an image")
        result = preprocessor.preprocess_image(invalid_file)
        assert result is None

    def test_preprocess_image_large_image(self, preprocessor, large_image):
        """Test preprocessing of large image includes resizing."""
        result = preprocessor.preprocess_image(large_image)
        assert result is not None

        # Verify the output image is resized
        with Image.open(result) as img:
            assert max(img.size) <= preprocessor.config.max_dimension

    @pytest.mark.smoke
    def test_process_directory_success(self, preprocessor, tmp_path):
        """Test processing all images in a directory."""
        # Create multiple test images
        for i in range(3):
            img_path = tmp_path / f"test_{i}.jpg"
            img = Image.new('RGB', (100, 100), color='green')
            img.save(img_path)

        results = preprocessor.process_directory(tmp_path)
        assert len(results) == 3
        assert all(r.exists() for r in results)

    def test_process_directory_mixed_files(self, preprocessor, tmp_path):
        """Test directory processing skips non-JPEG files."""
        # Create JPEG and non-JPEG files
        jpg_path = tmp_path / "valid.jpg"
        Image.new('RGB', (100, 100)).save(jpg_path)

        txt_path = tmp_path / "readme.txt"
        txt_path.write_text("Not an image")

        results = preprocessor.process_directory(tmp_path)
        assert len(results) == 1

    def test_process_directory_nonexistent(self, preprocessor):
        """Test processing nonexistent directory raises error."""
        with pytest.raises(ValueError, match="does not exist"):
            preprocessor.process_directory("/nonexistent/path")

    def test_process_directory_not_a_directory(
        self, preprocessor, sample_image
    ):
        """Test processing file instead of directory raises error."""
        with pytest.raises(ValueError, match="not a directory"):
            preprocessor.process_directory(sample_image)

    def test_get_output_path_with_output_dir(self, preprocessor, tmp_path):
        """Test output path generation with specified output directory."""
        input_path = tmp_path / "test.jpg"
        output_path = preprocessor._get_output_path(input_path)

        assert output_path.parent == preprocessor.output_dir
        assert output_path.name == "test_preprocessed.jpg"

    def test_get_output_path_without_output_dir(self, config, tmp_path):
        """Test output path generation without specified output directory."""
        preprocessor = ImagePreprocessor(config=config, output_dir=None)
        input_path = tmp_path / "test.jpg"
        output_path = preprocessor._get_output_path(input_path)

        assert output_path.parent == tmp_path / "preprocessed"
        assert output_path.name == "test_preprocessed.jpg"

    def test_save_originals_enabled(self, preprocessor, sample_image):
        """Test that originals are saved when enabled."""
        preprocessor.config.save_originals = True
        preprocessor.preprocess_image(sample_image)

        # Check that original was saved
        original_path = preprocessor._get_original_path(sample_image)
        assert original_path.exists()

    def test_save_originals_disabled(self, preprocessor, sample_image):
        """Test that originals are not saved when disabled."""
        preprocessor.config.save_originals = False
        preprocessor.preprocess_image(sample_image)

        # Check that original was not saved
        original_path = preprocessor._get_original_path(sample_image)
        assert not original_path.exists()


class TestIntegration:
    """Integration tests for complete preprocessing pipeline."""

    @pytest.mark.smoke
    def test_full_pipeline_with_real_image(self, tmp_path):
        """Test complete preprocessing pipeline end-to-end."""
        # Create test image
        input_dir = tmp_path / "input"
        input_dir.mkdir()
        img_path = input_dir / "product.jpg"

        # Create realistic test image (2000x1500 with some content)
        img = Image.new('RGB', (2000, 1500), color='white')
        img.save(img_path, quality=90)

        # Setup preprocessor
        config = PreprocessingConfig(
            max_dimension=1500,
            contrast_factor=1.3,
            brightness_factor=1.2,
            denoise_strength=5
        )
        output_dir = tmp_path / "output"
        preprocessor = ImagePreprocessor(
            config=config, output_dir=str(output_dir)
        )

        # Process
        results = preprocessor.process_directory(input_dir)

        # Verify results
        assert len(results) == 1
        assert results[0].exists()

        # Verify processed image properties
        with Image.open(results[0]) as processed:
            assert processed.mode == 'L'  # Grayscale
            assert max(processed.size) <= config.max_dimension

    def test_batch_processing_performance(self, tmp_path):
        """Test batch processing multiple images efficiently."""
        # Create 10 test images
        input_dir = tmp_path / "batch"
        input_dir.mkdir()

        for i in range(10):
            img_path = input_dir / f"image_{i}.jpg"
            img = Image.new('RGB', (800, 600), color=(i * 25, 100, 200))
            img.save(img_path)

        # Process batch
        config = PreprocessingConfig(denoise_strength=5)
        output_dir = tmp_path / "processed"
        preprocessor = ImagePreprocessor(
            config=config, output_dir=str(output_dir)
        )

        results = preprocessor.process_directory(input_dir)

        # Verify all processed
        assert len(results) == 10
        assert all(r.exists() for r in results)

