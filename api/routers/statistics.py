"""Statistics endpoints."""

import logging

from fastapi import APIRouter, Depends, HTTPException, status

from api.dependencies import get_pantry_service
from api.models import StatisticsResponse
from src.db_service import PantryService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/statistics", tags=["Statistics"])


@router.get("", response_model=StatisticsResponse)
def get_statistics(
    service: PantryService = Depends(get_pantry_service),
) -> StatisticsResponse:
    """Get overall pantry statistics."""
    try:
        stats = service.get_statistics()
        logger.info("Retrieved pantry statistics")
        return StatisticsResponse(
            total_items=stats.get("total_items", 0),
            total_products=stats.get("total_products", 0),
            in_stock=stats.get("by_status", {}).get("in_stock", 0),
            low_stock=stats.get("by_status", {}).get("low", 0),
            expired=stats.get("by_status", {}).get("expired", 0),
            consumed=stats.get("by_status", {}).get("consumed", 0),
            expiring_soon=stats.get("expiring_soon", 0),
            by_category=stats.get("by_category", {}),
            by_location=stats.get("by_location", {}),
            by_status=stats.get("by_status", {}),
        )
    except Exception as e:
        logger.error("Error retrieving statistics: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve statistics",
        ) from e


@router.get("/by-category")
def get_statistics_by_category(
    service: PantryService = Depends(get_pantry_service),
) -> dict:
    """Get statistics grouped by category."""
    try:
        stats = service.get_statistics()
        return stats.get("by_category", {})
    except Exception as e:
        logger.error("Error retrieving category statistics: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve category statistics",
        ) from e


@router.get("/by-location")
def get_statistics_by_location(
    service: PantryService = Depends(get_pantry_service),
) -> dict:
    """Get statistics grouped by storage location."""
    try:
        stats = service.get_statistics()
        return stats.get("by_location", {})
    except Exception as e:
        logger.error("Error retrieving location statistics: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve location statistics",
        ) from e
