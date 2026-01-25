"""Configuration endpoints (source directory)."""

from pathlib import Path
from typing import Any, Dict

from fastapi import APIRouter, Body, HTTPException, status

from api.config import config

router = APIRouter(prefix="/api/config", tags=["Configuration"])


@router.get("/source-directory")
def get_source_directory() -> Dict[str, Any]:
    """Get the configured source images directory."""
    source_dir = config.source_images_dir
    p = Path(source_dir)
    return {
        "source_directory": source_dir,
        "exists": p.exists(),
        "is_directory": p.is_dir() if p.exists() else False,
    }


@router.post("/source-directory")
def set_source_directory(body: Dict[str, Any] = Body(default_factory=dict)) -> Dict[str, Any]:
    """Set the source images directory (validates path only; does not persist)."""
    try:
        directory = body.get("directory")
        if not directory:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Directory parameter is required",
            )
        dir_path = Path(directory).expanduser().resolve()
        if not dir_path.exists():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Directory does not exist: {directory}",
            )
        if not dir_path.is_dir():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Path is not a directory: {directory}",
            )
        return {"source_directory": str(dir_path), "message": "Source directory set successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to set source directory: {str(e)}",
        ) from e
