"""Pantry CRUD endpoints."""

import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request, status

from api.dependencies import get_current_user, get_pantry_service
from api.limiter import limiter
from api.models import MessageResponse, PantryCreate, PantryResponse, PantryUpdate
from src.database import User
from src.db_service import PantryService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/pantries", tags=["Pantries"])


@router.post("", response_model=PantryResponse)
@limiter.limit("20/minute")
def create_pantry(
    request: Request,
    pantry_data: PantryCreate,
    current_user: User = Depends(get_current_user),
    service: PantryService = Depends(get_pantry_service),
) -> PantryResponse:
    """Create a new pantry for the current user."""
    try:
        pantry = service.create_pantry(
            user_id=current_user.id,
            name=pantry_data.name,
            description=pantry_data.description,
            location=pantry_data.location,
            is_default=pantry_data.is_default,
        )
        logger.info("Created pantry %r for user %s", pantry.name, current_user.id)
        return pantry
    except Exception as e:
        logger.error("Error creating pantry: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create pantry",
        ) from e


@router.get("", response_model=List[PantryResponse])
@limiter.limit("100/minute")
def get_pantries(
    request: Request,
    current_user: User = Depends(get_current_user),
    service: PantryService = Depends(get_pantry_service),
):
    """Get all pantries for the current user."""
    try:
        pantries = service.get_user_pantries(current_user.id)
        if not pantries:
            default_pantry = service.get_or_create_default_pantry(current_user.id)
            pantries = [default_pantry]
        logger.info("Retrieved %d pantries for user %s", len(pantries), current_user.id)
        return pantries
    except Exception as e:
        logger.error("Error retrieving pantries: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve pantries",
        ) from e


@router.get("/default", response_model=PantryResponse)
@limiter.limit("100/minute")
def get_default_pantry(
    request: Request,
    current_user: User = Depends(get_current_user),
    service: PantryService = Depends(get_pantry_service),
) -> PantryResponse:
    """Get or create the default pantry for the current user."""
    try:
        return service.get_or_create_default_pantry(current_user.id)
    except Exception as e:
        logger.error("Error getting default pantry: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get default pantry",
        ) from e


@router.get("/{pantry_id}", response_model=PantryResponse)
@limiter.limit("100/minute")
def get_pantry(
    request: Request,
    pantry_id: int,
    current_user: User = Depends(get_current_user),
    service: PantryService = Depends(get_pantry_service),
) -> PantryResponse:
    """Get a specific pantry by ID."""
    try:
        pantry = service.get_pantry(pantry_id, current_user.id)
        if not pantry:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Pantry with ID {pantry_id} not found",
            )
        return pantry
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error retrieving pantry %s: %s", pantry_id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve pantry",
        ) from e


@router.put("/{pantry_id}", response_model=PantryResponse)
@limiter.limit("20/minute")
def update_pantry(
    request: Request,
    pantry_id: int,
    pantry_data: PantryUpdate,
    current_user: User = Depends(get_current_user),
    service: PantryService = Depends(get_pantry_service),
) -> PantryResponse:
    """Update a pantry."""
    try:
        pantry = service.update_pantry(
            pantry_id=pantry_id,
            user_id=current_user.id,
            name=pantry_data.name,
            description=pantry_data.description,
            location=pantry_data.location,
            is_default=pantry_data.is_default,
        )
        if not pantry:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Pantry with ID {pantry_id} not found",
            )
        logger.info("Updated pantry ID %s", pantry_id)
        return pantry
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error updating pantry %s: %s", pantry_id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update pantry",
        ) from e


@router.delete("/{pantry_id}", response_model=MessageResponse)
@limiter.limit("20/minute")
def delete_pantry(
    request: Request,
    pantry_id: int,
    current_user: User = Depends(get_current_user),
    service: PantryService = Depends(get_pantry_service),
) -> MessageResponse:
    """Delete a pantry."""
    try:
        deleted = service.delete_pantry(pantry_id, current_user.id)
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Pantry with ID {pantry_id} not found",
            )
        logger.info("Deleted pantry ID %s", pantry_id)
        return MessageResponse(message=f"Pantry {pantry_id} deleted successfully")
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error deleting pantry %s: %s", pantry_id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete pantry",
        ) from e
