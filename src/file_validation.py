"""
File Upload Validation Module.

Provides secure file validation for uploaded images,
including size limits, MIME type checking, and image verification.
"""

import logging
from pathlib import Path
from typing import Optional
from fastapi import UploadFile, HTTPException, status
from PIL import Image
import io

logger = logging.getLogger(__name__)

# Configuration
ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"]
ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


def validate_image_file(file: UploadFile, max_size: int = MAX_FILE_SIZE) -> None:
    """
    Validate uploaded image file with comprehensive security checks.
    
    Checks:
    - File size limits
    - File extension
    - MIME type (if provided)
    - Image validity (PIL verification)
    
    Args:
        file: Uploaded file object
        max_size: Maximum file size in bytes (default: 10MB)
        
    Raises:
        HTTPException: If validation fails
    """
    # Check file size
    file.file.seek(0, 2)  # Seek to end
    size = file.file.tell()
    file.file.seek(0)  # Reset
    
    if size > max_size:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large. Maximum size is {max_size / (1024 * 1024):.1f}MB, got {size / (1024 * 1024):.1f}MB"
        )
    
    if size == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File is empty"
        )
    
    # Check file extension
    if file.filename:
        ext = Path(file.filename).suffix.lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid file extension. Allowed: {', '.join(ALLOWED_EXTENSIONS)}, got: {ext}"
            )
    
    # Check MIME type (if provided)
    if file.content_type:
        if file.content_type not in ALLOWED_MIME_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_MIME_TYPES)}, got: {file.content_type}"
            )
    
    # Verify it's a valid image using PIL
    try:
        # Read first chunk to verify
        file.file.seek(0)
        image_data = file.file.read(1024 * 1024)  # Read up to 1MB for verification
        file.file.seek(0)  # Reset
        
        # Try to open and verify the image
        img = Image.open(io.BytesIO(image_data))
        img.verify()  # Verify the image is valid
        
        # Reopen for actual use (verify() closes the image)
        file.file.seek(0)
        
    except Exception as e:
        logger.warning(f"Image validation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid or corrupted image file: {str(e)}"
        )


def get_file_size(file: UploadFile) -> int:
    """
    Get the size of an uploaded file in bytes.
    
    Args:
        file: Uploaded file object
        
    Returns:
        File size in bytes
    """
    current_pos = file.file.tell()
    file.file.seek(0, 2)  # Seek to end
    size = file.file.tell()
    file.file.seek(current_pos)  # Restore position
    return size


