"""
Image preprocessing module for pantry inventory system.

This module handles image validation, preprocessing, and optimization
for OCR text extraction. It applies various image enhancement techniques
to improve OCR accuracy.
"""

import logging
from pathlib import Path
from typing import List, Optional
from dataclasses import dataclass

import cv2
import numpy as np
from PIL import Image, ImageEnhance, UnidentifiedImageError


logger = logging.getLogger(__name__)


@dataclass
class PreprocessingConfig:
    """
    Configuration parameters for image preprocessing.
    
    Attributes:
        max_dimension: Maximum size for the longest side of the image in pixels
        contrast_factor: Contrast enhancement factor (1.0 = no change, >1.0 = more contrast)
        brightness_factor: Brightness enhancement factor (1.0 = no change, >1.0 = brighter)
        denoise_strength: Strength of denoising filter (higher = more denoising, 0 = disabled)
        output_format: Output image format (JPEG, PNG, etc.)
        jpeg_quality: JPEG compression quality (1-100, higher = better quality)
        save_originals: Whether to save original images to output directory
    """
    max_dimension: int = 4000
    contrast_factor: float = 1.2
    brightness_factor: float = 1.1
    denoise_strength: int = 10
    output_format: str = "JPEG"
    jpeg_quality: int = 95
    save_originals: bool = True
    
    def __post_init__(self):
        """Validate configuration parameters."""
        if self.max_dimension <= 0:
            raise ValueError("max_dimension must be positive")
        if self.contrast_factor < 0:
            raise ValueError("contrast_factor must be non-negative")
        if self.brightness_factor < 0:
            raise ValueError("brightness_factor must be non-negative")
        if self.denoise_strength < 0:
            raise ValueError("denoise_strength must be non-negative")
        if not 1 <= self.jpeg_quality <= 100:
            raise ValueError("jpeg_quality must be between 1 and 100")


class ImagePreprocessor:
    """
    Preprocesses images for optimal OCR text extraction.
    
    This class handles the complete preprocessing pipeline:
    1. Validates JPEG images
    2. Resizes oversized images
    3. Enhances contrast and brightness
    4. Applies denoising filters
    5. Converts to grayscale for OCR
    6. Saves preprocessed images
    
    Best practices applied:
    - Single Responsibility Principle: Each method handles one preprocessing step
    - DRY: Reusable validation and error handling
    - KISS: Simple, clear preprocessing pipeline
    - Comprehensive error handling and logging
    
    Example:
        >>> config = PreprocessingConfig(max_dimension=4000, contrast_factor=1.2)
        >>> preprocessor = ImagePreprocessor(config, output_dir="./processed")
        >>> results = preprocessor.process_directory("./images")
        >>> print(f"Processed {len(results)} images")
    """
    
    def __init__(
        self, 
        config: Optional[PreprocessingConfig] = None,
        output_dir: Optional[str] = None
    ):
        """
        Initialize the ImagePreprocessor.
        
        Args:
            config: Preprocessing configuration. If None, uses default settings.
            output_dir: Directory to save preprocessed images. If None, saves 
                       to 'preprocessed' subdirectory in the source directory.
        """
        self.config = config or PreprocessingConfig()
        self.output_dir = Path(output_dir) if output_dir else None
        logger.info(
            f"ImagePreprocessor initialized with max_dimension={self.config.max_dimension}, "
            f"contrast={self.config.contrast_factor}, brightness={self.config.brightness_factor}"
        )
    
    def _validate_jpeg(self, image_path: Path) -> bool:
        """
        Validate that a file is a valid JPEG image.
        
        Args:
            image_path: Path to the image file
            
        Returns:
            bool: True if valid JPEG, False otherwise
            
        Best practice: Fail fast - validate inputs before processing
        """
        try:
            # Check file extension
            if image_path.suffix.lower() not in ['.jpg', '.jpeg']:
                logger.debug(f"Skipping non-JPEG file: {image_path}")
                return False
            
            # Check if file exists
            if not image_path.exists():
                logger.warning(f"File does not exist: {image_path}")
                return False
            
            # Try to open and verify it's a valid image
            with Image.open(image_path) as img:
                img.verify()
            
            # Re-open to check format (verify() closes the file)
            with Image.open(image_path) as img:
                if img.format not in ['JPEG', 'JPG']:
                    logger.warning(f"File extension is .jpg but format is {img.format}: {image_path}")
                    return False
            
            logger.debug(f"Valid JPEG: {image_path}")
            return True
            
        except UnidentifiedImageError:
            logger.error(f"Corrupted or invalid image file: {image_path}")
            return False
        except OSError as e:
            logger.error(f"Error reading file {image_path}: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error validating {image_path}: {e}")
            return False
    
    def _resize_image(self, image: Image.Image) -> Image.Image:
        """
        Resize image if it exceeds maximum dimension.
        
        Args:
            image: PIL Image object
            
        Returns:
            Image.Image: Resized image (or original if within limits)
            
        Best practice: Maintain aspect ratio to preserve image quality
        """
        width, height = image.size
        max_dim = max(width, height)
        
        if max_dim <= self.config.max_dimension:
            logger.debug(f"Image size {width}x{height} within limits, no resize needed")
            return image
        
        # Calculate new dimensions maintaining aspect ratio
        scale_factor = self.config.max_dimension / max_dim
        new_width = int(width * scale_factor)
        new_height = int(height * scale_factor)
        
        logger.debug(f"Resizing from {width}x{height} to {new_width}x{new_height}")
        
        # Use LANCZOS for high-quality downsampling
        resized = image.resize((new_width, new_height), Image.Resampling.LANCZOS)
        return resized
    
    def _enhance_image(self, image: Image.Image) -> Image.Image:
        """
        Enhance image contrast and brightness for better OCR.
        
        Args:
            image: PIL Image object
            
        Returns:
            Image.Image: Enhanced image
            
        Best practice: Apply enhancements before denoising for better results
        """
        # Enhance contrast
        contrast_enhancer = ImageEnhance.Contrast(image)
        image = contrast_enhancer.enhance(self.config.contrast_factor)
        logger.debug(f"Applied contrast factor: {self.config.contrast_factor}")
        
        # Enhance brightness
        brightness_enhancer = ImageEnhance.Brightness(image)
        image = brightness_enhancer.enhance(self.config.brightness_factor)
        logger.debug(f"Applied brightness factor: {self.config.brightness_factor}")
        
        return image
    
    def _denoise_image(self, image: Image.Image) -> Image.Image:
        """
        Apply denoising filter to reduce image noise.
        
        Args:
            image: PIL Image object
            
        Returns:
            Image.Image: Denoised image
            
        Best practice: Use OpenCV's fastNlMeansDenoising for grayscale images
        Performance note: Denoising is computationally expensive but improves OCR accuracy
        """
        if self.config.denoise_strength == 0:
            logger.debug("Denoising disabled (strength=0)")
            return image
        
        try:
            # Convert PIL Image to numpy array for OpenCV
            img_array = np.array(image)
            
            # Apply denoising filter
            # fastNlMeansDenoising is optimized for grayscale images
            denoised_array = cv2.fastNlMeansDenoising(
                img_array,
                None,
                h=self.config.denoise_strength,
                templateWindowSize=7,
                searchWindowSize=21
            )
            
            logger.debug(f"Applied denoising with strength: {self.config.denoise_strength}")
            
            # Convert back to PIL Image
            return Image.fromarray(denoised_array)
            
        except Exception as e:
            logger.warning(f"Denoising failed, returning original image: {e}")
            return image
    
    def _convert_to_grayscale(self, image: Image.Image) -> Image.Image:
        """
        Convert image to grayscale for optimal OCR performance.
        
        Args:
            image: PIL Image object
            
        Returns:
            Image.Image: Grayscale image
            
        Best practice: Grayscale conversion reduces complexity and improves OCR accuracy
        """
        if image.mode == 'L':
            logger.debug("Image already in grayscale")
            return image
        
        grayscale = image.convert('L')
        logger.debug(f"Converted from {image.mode} to grayscale")
        return grayscale
    
    def preprocess_image(self, image_path: str | Path) -> Optional[Path]:
        """
        Preprocess a single image through the complete pipeline.
        
        Pipeline stages:
        1. Validate JPEG format
        2. Load image
        3. Resize if needed
        4. Enhance contrast and brightness
        5. Convert to grayscale
        6. Apply denoising
        7. Save preprocessed image
        
        Args:
            image_path: Path to input image file
            
        Returns:
            Optional[Path]: Path to preprocessed image if successful, None if failed
            
        Raises:
            No exceptions raised - all errors are caught, logged, and None is returned
            
        Best practice: Graceful error handling allows batch processing to continue
        """
        image_path = Path(image_path)
        
        # Stage 1: Validate
        if not self._validate_jpeg(image_path):
            return None
        
        try:
            logger.info(f"Processing image: {image_path}")
            
            # Stage 2: Load
            with Image.open(image_path) as img:
                # Convert RGBA to RGB if needed
                if img.mode == 'RGBA':
                    img = img.convert('RGB')
                    logger.debug("Converted RGBA to RGB")
                
                # Stage 3: Resize
                img = self._resize_image(img)
                
                # Stage 4: Enhance
                img = self._enhance_image(img)
                
                # Stage 5: Convert to grayscale
                img = self._convert_to_grayscale(img)
                
                # Stage 6: Denoise
                img = self._denoise_image(img)
                
                # Stage 7: Save
                output_path = self._get_output_path(image_path)
                output_path.parent.mkdir(parents=True, exist_ok=True)
                
                # Save with appropriate settings
                save_kwargs = {'format': self.config.output_format}
                if self.config.output_format == 'JPEG':
                    save_kwargs['quality'] = self.config.jpeg_quality
                    save_kwargs['optimize'] = True
                
                img.save(output_path, **save_kwargs)
                logger.info(f"Saved preprocessed image: {output_path}")
                
                # Optionally save original
                if self.config.save_originals:
                    original_path = self._get_original_path(image_path)
                    original_path.parent.mkdir(parents=True, exist_ok=True)
                    # Re-open original to save
                    with Image.open(image_path) as orig:
                        orig.save(original_path)
                        logger.debug(f"Saved original image: {original_path}")
                
                return output_path
                
        except Exception as e:
            logger.error(f"Failed to preprocess {image_path}: {e}", exc_info=True)
            return None
    
    def process_directory(self, directory_path: str | Path) -> List[Path]:
        """
        Process all JPEG images in a directory.
        
        Args:
            directory_path: Path to directory containing images
            
        Returns:
            List[Path]: List of successfully preprocessed image paths
            
        Raises:
            ValueError: If directory_path does not exist or is not a directory
            
        Best practice: Process images sequentially for memory efficiency
        Performance note: Could be parallelized if needed (YAGNI principle - add if required)
        """
        directory_path = Path(directory_path)
        
        if not directory_path.exists():
            raise ValueError(f"Directory does not exist: {directory_path}")
        
        if not directory_path.is_dir():
            raise ValueError(f"Path is not a directory: {directory_path}")
        
        logger.info(f"Processing directory: {directory_path}")
        
        # Find all JPEG files
        jpeg_files = []
        for pattern in ['*.jpg', '*.jpeg', '*.JPG', '*.JPEG']:
            jpeg_files.extend(directory_path.glob(pattern))
        
        logger.info(f"Found {len(jpeg_files)} JPEG files")
        
        # Process each image
        successful_paths = []
        for image_path in jpeg_files:
            result = self.preprocess_image(image_path)
            if result:
                successful_paths.append(result)
        
        logger.info(
            f"Processing complete: {len(successful_paths)}/{len(jpeg_files)} images successful"
        )
        
        return successful_paths
    
    def _get_output_path(self, input_path: Path) -> Path:
        """
        Generate output path for preprocessed image.
        
        Args:
            input_path: Path to input image
            
        Returns:
            Path: Output path for preprocessed image
        """
        if self.output_dir:
            # Use specified output directory
            output_dir = self.output_dir
        else:
            # Use 'preprocessed' subdirectory in source directory
            output_dir = input_path.parent / "preprocessed"
        
        # Generate filename: original_name_preprocessed.jpg
        stem = input_path.stem
        suffix = '.jpg' if self.config.output_format == 'JPEG' else f'.{self.config.output_format.lower()}'
        filename = f"{stem}_preprocessed{suffix}"
        
        return output_dir / filename
    
    def _get_original_path(self, input_path: Path) -> Path:
        """
        Generate path for saving original image copy.
        
        Args:
            input_path: Path to input image
            
        Returns:
            Path: Path for original image copy
        """
        if self.output_dir:
            output_dir = self.output_dir / "originals"
        else:
            output_dir = input_path.parent / "preprocessed" / "originals"
        
        return output_dir / input_path.name

