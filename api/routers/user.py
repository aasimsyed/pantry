"""User settings endpoints."""

import logging
from typing import Dict

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from api.dependencies import get_current_user, get_db, get_pantry_service
from api.limiter import limiter
from api.models import AIUsageResponse, UserSettingsResponse, UserSettingsUpdate
from src.ai_budget import usage_summary
from src.config import settings as app_settings
from src.database import User
from src.db_service import PantryService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/user", tags=["User"])


def _settings_response(settings) -> Dict:
    """Build settings response with system default AI provider/model."""
    data = settings.to_dict()
    data["default_ai_provider"] = app_settings.ai_provider
    data["default_ai_model"] = app_settings.ai_model
    return data


@router.get("/settings", response_model=UserSettingsResponse)
def get_user_settings(
    current_user: User = Depends(get_current_user),
    service: PantryService = Depends(get_pantry_service),
) -> Dict:
    """Get user settings and preferences."""
    try:
        settings = service.get_user_settings(current_user.id)
        return _settings_response(settings)
    except Exception as e:
        logger.error("Error getting user settings: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get user settings: {str(e)}",
        ) from e


@router.get("/ai-usage", response_model=AIUsageResponse)
@limiter.limit("30/minute")
def get_ai_usage(
    request: Request,
    refresh: bool = Query(False, description="Re-check subscription status, e.g. after a purchase"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict:
    """Today's AI spend, daily limit and subscription tier."""
    return usage_summary(db, current_user, refresh)


@router.put("/settings", response_model=UserSettingsResponse)
def update_user_settings(
    settings_data: UserSettingsUpdate,
    current_user: User = Depends(get_current_user),
    service: PantryService = Depends(get_pantry_service),
) -> Dict:
    """Update user settings (ai_provider, ai_model)."""
    try:
        if settings_data.ai_provider and settings_data.ai_provider not in ("openai", "anthropic"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="ai_provider must be 'openai' or 'anthropic'",
            )
        settings = service.update_user_settings(
            user_id=current_user.id,
            ai_provider=settings_data.ai_provider,
            ai_model=settings_data.ai_model,
        )
        return _settings_response(settings)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error updating user settings: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update user settings: {str(e)}",
        ) from e
