"""
Instacart integration API endpoints.

Provides endpoints for creating Instacart shopping links
from recipes and inventory items.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from api.dependencies import get_current_user, get_db
from api.limiter import limiter
from api.models import (
    InstacartLinkResponse,
    InstacartRecipeLinkRequest,
    InstacartShoppingListRequest,
    InstacartStatusResponse,
)
from src.database import User
from src.instacart_service import (
    instacart_service,
    InstacartAPIError,
    InstacartConfigError,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/instacart", tags=["Instacart"])


@router.get("/status", response_model=InstacartStatusResponse)
async def get_instacart_status(
    request: Request,
    current_user: User = Depends(get_current_user),
) -> InstacartStatusResponse:
    """
    Check if Instacart integration is available.
    
    Returns the status of the Instacart integration,
    including whether it's enabled and configured.
    """
    return InstacartStatusResponse(
        enabled=instacart_service.enabled,
        available=instacart_service.is_available(),
    )


@router.post("/recipe-link", response_model=InstacartLinkResponse)
@limiter.limit("10/minute")
async def create_recipe_link(
    request: Request,
    data: InstacartRecipeLinkRequest,
    current_user: User = Depends(get_current_user),
) -> InstacartLinkResponse:
    """
    Create an Instacart shopping link for recipe ingredients.
    
    Generates a shareable link to an Instacart recipe page where
    users can add matched products to their cart and checkout.
    
    Rate limited to 10 requests per minute.
    """
    try:
        # Convert Pydantic models to dicts for the service
        ingredients = [
            {
                "name": ing.name,
                "quantity": ing.quantity,
                "unit": ing.unit,
                "display_text": ing.display_text,
            }
            for ing in data.ingredients
        ]
        
        result = await instacart_service.create_recipe_link(
            title=data.title,
            ingredients=ingredients,
            instructions=data.instructions,
            servings=data.servings,
            cooking_time_minutes=data.cooking_time_minutes,
        )
        
        logger.info(
            f"User {current_user.id} created Instacart recipe link: {data.title}"
        )
        
        return InstacartLinkResponse(
            products_link_url=result["products_link_url"],
            expires_at=result.get("expires_at"),
        )
        
    except InstacartConfigError as e:
        logger.warning(f"Instacart config error: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Instacart integration is not available",
        )
    except InstacartAPIError as e:
        logger.error(f"Instacart API error: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Instacart API error: {str(e)}",
        )
    except Exception as e:
        logger.error(f"Error creating Instacart recipe link: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create Instacart shopping link",
        )


@router.post("/shopping-list-link", response_model=InstacartLinkResponse)
@limiter.limit("10/minute")
async def create_shopping_list_link(
    request: Request,
    data: InstacartShoppingListRequest,
    current_user: User = Depends(get_current_user),
) -> InstacartLinkResponse:
    """
    Create an Instacart shopping link for a list of items.
    
    Generates a shareable link to an Instacart shopping list page
    where users can add matched products to their cart and checkout.
    
    Useful for restocking low inventory items.
    
    Rate limited to 10 requests per minute.
    """
    try:
        # Convert Pydantic models to dicts for the service
        items = [
            {
                "name": item.name,
                "quantity": item.quantity,
                "unit": item.unit,
                "display_text": item.display_text,
            }
            for item in data.items
        ]
        
        result = await instacart_service.create_shopping_list_link(
            title=data.title,
            items=items,
        )
        
        logger.info(
            f"User {current_user.id} created Instacart shopping list link: {data.title}"
        )
        
        return InstacartLinkResponse(
            products_link_url=result["products_link_url"],
            expires_at=result.get("expires_at"),
        )
        
    except InstacartConfigError as e:
        logger.warning(f"Instacart config error: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Instacart integration is not available",
        )
    except InstacartAPIError as e:
        logger.error(f"Instacart API error: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Instacart API error: {str(e)}",
        )
    except Exception as e:
        logger.error(f"Error creating Instacart shopping list link: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create Instacart shopping link",
        )
