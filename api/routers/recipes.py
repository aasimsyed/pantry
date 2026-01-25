"""Recipe Box (saved recipes) endpoints. Generation (generate-one, generate, generate-stream) remains in main."""

import logging
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from api.dependencies import get_current_user, get_pantry_service
from api.models import MessageResponse, SavedRecipeCreate, SavedRecipeResponse, SavedRecipeUpdate
from api.utils import detail_for_db_error
from src.database import User
from src.db_service import PantryService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/recipes", tags=["Recipes"])


@router.post("/save", response_model=SavedRecipeResponse, status_code=status.HTTP_201_CREATED)
def save_recipe(
    recipe_data: SavedRecipeCreate,
    current_user: User = Depends(get_current_user),
    service: PantryService = Depends(get_pantry_service),
) -> Dict:
    """Save a recipe to the recipe box."""
    try:
        recipe = service.save_recipe(
            name=recipe_data.name,
            user_id=current_user.id,
            description=recipe_data.description,
            cuisine=recipe_data.cuisine,
            difficulty=recipe_data.difficulty,
            prep_time=recipe_data.prep_time,
            cook_time=recipe_data.cook_time,
            servings=recipe_data.servings,
            ingredients=recipe_data.ingredients,
            instructions=recipe_data.instructions,
            notes=recipe_data.notes,
            rating=recipe_data.rating,
            tags=recipe_data.tags,
            ai_model=recipe_data.ai_model,
        )
        logger.info("Saved recipe: %s (ID: %s)", recipe.name, recipe.id)
        return recipe.to_dict()
    except ValueError as e:
        logger.warning("Duplicate recipe attempt: %s", e)
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e)) from e
    except Exception as e:
        logger.error("Error saving recipe: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save recipe: {str(e)}",
        ) from e


@router.get("/saved", response_model=List[SavedRecipeResponse])
def get_saved_recipes(
    cuisine: Optional[str] = Query(None, description="Filter by cuisine"),
    difficulty: Optional[str] = Query(None, description="Filter by difficulty"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum recipes to return"),
    current_user: User = Depends(get_current_user),
    service: PantryService = Depends(get_pantry_service),
) -> List[Dict]:
    """Get all saved recipes from recipe box."""
    try:
        recipes = service.get_saved_recipes(
            user_id=current_user.id,
            cuisine=cuisine,
            difficulty=difficulty,
            limit=limit,
        )
        result = []
        for recipe in recipes:
            try:
                result.append(recipe.to_dict())
            except Exception as e:
                logger.warning("Error serializing recipe %s: %s", recipe.id, e)
                try:
                    result.append(SavedRecipeResponse.model_validate(recipe).model_dump())
                except Exception:
                    continue
        logger.info("Retrieved %d saved recipes", len(result))
        return result
    except Exception as e:
        logger.error("Error retrieving saved recipes: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=detail_for_db_error(e, f"Failed to retrieve saved recipes: {e!s}"),
        ) from e


@router.get("/saved/{recipe_id}", response_model=SavedRecipeResponse)
def get_saved_recipe(
    recipe_id: int,
    current_user: User = Depends(get_current_user),
    service: PantryService = Depends(get_pantry_service),
) -> Dict:
    """Get a specific saved recipe by ID."""
    try:
        recipe = service.get_saved_recipe(recipe_id)
        if not recipe:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Recipe with ID {recipe_id} not found",
            )
        if recipe.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to access this recipe",
            )
        return recipe.to_dict()
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error retrieving recipe %s: %s", recipe_id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve recipe",
        ) from e


@router.put("/saved/{recipe_id}", response_model=SavedRecipeResponse)
def update_saved_recipe(
    recipe_id: int,
    recipe_data: SavedRecipeUpdate,
    current_user: User = Depends(get_current_user),
    service: PantryService = Depends(get_pantry_service),
) -> Dict:
    """Update a saved recipe (notes, rating, tags)."""
    try:
        recipe = service.get_saved_recipe(recipe_id)
        if not recipe:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Recipe with ID {recipe_id} not found",
            )
        if recipe.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to update this recipe",
            )
        updated_recipe = service.update_saved_recipe(
            recipe_id=recipe_id,
            notes=recipe_data.notes,
            rating=recipe_data.rating,
            tags=recipe_data.tags,
        )
        logger.info("Updated recipe ID %s", recipe_id)
        return updated_recipe.to_dict()
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error updating recipe %s: %s", recipe_id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update recipe",
        ) from e


@router.delete("/saved/{recipe_id}", response_model=MessageResponse)
def delete_saved_recipe(
    recipe_id: int,
    current_user: User = Depends(get_current_user),
    service: PantryService = Depends(get_pantry_service),
) -> MessageResponse:
    """Delete a saved recipe."""
    try:
        recipe = service.get_saved_recipe(recipe_id)
        if not recipe:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Recipe with ID {recipe_id} not found",
            )
        if recipe.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to delete this recipe",
            )
        deleted = service.delete_saved_recipe(recipe_id)
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Recipe with ID {recipe_id} not found",
            )
        logger.info("Deleted recipe ID %s", recipe_id)
        return MessageResponse(message=f"Recipe {recipe_id} deleted successfully")
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error deleting recipe %s: %s", recipe_id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete recipe",
        ) from e
