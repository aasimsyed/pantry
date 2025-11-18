"""
FastAPI Main Application.

Implements REST API endpoints for the Smart Pantry Management System.
Provides CRUD operations, search, filtering, and statistics.
"""

import logging
from typing import List, Optional, Dict, Any
from datetime import date, timedelta
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

from fastapi import FastAPI, Depends, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from .config import config
from .dependencies import get_pantry_service, get_db
from .models import (
    ProductCreate, ProductUpdate, ProductResponse,
    InventoryItemCreate, InventoryItemUpdate, InventoryItemResponse,
    ConsumeRequest, StatisticsResponse, MessageResponse,
    HealthResponse, ErrorResponse, RecipeRequest, RecipeResponse,
    SavedRecipeCreate, SavedRecipeUpdate, SavedRecipeResponse
)
from src.db_service import PantryService
from src.database import Product, InventoryItem
from src.ai_analyzer import create_ai_analyzer
from recipe_generator import RecipeGenerator

# Configure logging
logging.basicConfig(
    level=getattr(logging, config.log_level.upper()),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create FastAPI application
app = FastAPI(
    title=config.api_title,
    version=config.api_version,
    description=config.api_description,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================================
# Root & Health Endpoints
# ============================================================================

@app.get("/", include_in_schema=False)
def root() -> RedirectResponse:
    """Redirect root to API documentation."""
    return RedirectResponse(url="/docs")


@app.get("/health", response_model=HealthResponse, tags=["Health"])
def health_check() -> HealthResponse:
    """
    Check API health status.
    
    Returns basic health information and confirms the API is running.
    """
    return HealthResponse(
        status="healthy",
        service="Smart Pantry API",
        version=config.api_version
    )


# ============================================================================
# Product Endpoints
# ============================================================================

@app.get("/api/products", response_model=List[ProductResponse], tags=["Products"])
def get_products(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum records to return"),
    service: PantryService = Depends(get_pantry_service)
) -> List[Product]:
    """
    Get all products with pagination.
    
    - **skip**: Number of records to skip (for pagination)
    - **limit**: Maximum number of records to return
    """
    try:
        db_session = service.session
        products = db_session.query(Product).offset(skip).limit(limit).all()
        logger.info(f"Retrieved {len(products)} products")
        return products
    except SQLAlchemyError as e:
        logger.error(f"Database error retrieving products: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve products"
        )


@app.get("/api/products/{product_id}", response_model=ProductResponse, tags=["Products"])
def get_product(
    product_id: int,
    service: PantryService = Depends(get_pantry_service)
) -> Product:
    """
    Get a specific product by ID.
    
    - **product_id**: Product ID to retrieve
    """
    try:
        product = service.get_product(product_id)
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product with ID {product_id} not found"
            )
        return product
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving product {product_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve product"
        )


@app.post("/api/products", response_model=ProductResponse, status_code=status.HTTP_201_CREATED, tags=["Products"])
def create_product(
    product_data: ProductCreate,
    service: PantryService = Depends(get_pantry_service)
) -> Product:
    """
    Create a new product.
    
    - **product_name**: Required product name
    - **brand**: Optional brand name
    - **category**: Optional category
    - **subcategory**: Optional subcategory
    - **barcode**: Optional barcode/UPC
    - **default_storage_location**: Optional default storage location
    - **typical_shelf_life_days**: Optional typical shelf life in days
    """
    try:
        product = service.add_product(
            product_name=product_data.product_name,
            brand=product_data.brand,
            category=product_data.category,
            subcategory=product_data.subcategory,
            barcode=product_data.barcode,
            default_storage_location=product_data.default_storage_location,
            typical_shelf_life_days=product_data.typical_shelf_life_days
        )
        logger.info(f"Created product: {product.product_name} (ID: {product.id})")
        return product
    except IntegrityError as e:
        logger.error(f"Integrity error creating product: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Product with this barcode already exists or invalid data"
        )
    except Exception as e:
        logger.error(f"Error creating product: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create product"
        )


@app.put("/api/products/{product_id}", response_model=ProductResponse, tags=["Products"])
def update_product(
    product_id: int,
    product_data: ProductUpdate,
    service: PantryService = Depends(get_pantry_service)
) -> Product:
    """
    Update an existing product.
    
    Only provided fields will be updated. Omitted fields remain unchanged.
    
    - **product_id**: ID of product to update
    """
    try:
        product = service.get_product(product_id)
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product with ID {product_id} not found"
            )
        
        # Update only provided fields
        update_data = product_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(product, field, value)
        
        service.session.commit()
        service.session.refresh(product)
        logger.info(f"Updated product ID {product_id}")
        return product
        
    except HTTPException:
        raise
    except IntegrityError as e:
        service.session.rollback()
        logger.error(f"Integrity error updating product: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid data or duplicate barcode"
        )
    except Exception as e:
        service.session.rollback()
        logger.error(f"Error updating product {product_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update product"
        )


@app.delete("/api/products/{product_id}", response_model=MessageResponse, tags=["Products"])
def delete_product(
    product_id: int,
    service: PantryService = Depends(get_pantry_service)
) -> MessageResponse:
    """
    Delete a product.
    
    This will also delete all associated inventory items due to cascade.
    
    - **product_id**: ID of product to delete
    """
    try:
        product = service.get_product(product_id)
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product with ID {product_id} not found"
            )
        
        service.session.delete(product)
        service.session.commit()
        logger.info(f"Deleted product ID {product_id}")
        
        return MessageResponse(
            message=f"Product {product_id} deleted successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        service.session.rollback()
        logger.error(f"Error deleting product {product_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete product"
        )


@app.get("/api/products/search", response_model=List[ProductResponse], tags=["Products"])
def search_products(
    q: str = Query(..., min_length=1, description="Search query"),
    category: Optional[str] = Query(None, description="Filter by category"),
    brand: Optional[str] = Query(None, description="Filter by brand"),
    service: PantryService = Depends(get_pantry_service)
) -> List[Product]:
    """
    Search products by name, brand, or category.
    
    - **q**: Search query (searches name, brand, category)
    - **category**: Optional category filter
    - **brand**: Optional brand filter
    """
    try:
        products = service.search_products(
            query=q,
            category=category,
            brand=brand
        )
        logger.info(f"Search for '{q}' returned {len(products)} products")
        return products
    except Exception as e:
        logger.error(f"Error searching products: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to search products"
        )


# ============================================================================
# Helper Functions
# ============================================================================

def enrich_inventory_item(item: InventoryItem) -> Dict:
    """
    Enrich inventory item with product information from relationship.
    
    Args:
        item: InventoryItem ORM object
        
    Returns:
        Dictionary with item data including product information
    """
    return {
        "id": item.id,
        "product_id": item.product_id,
        "quantity": item.quantity,
        "unit": item.unit,
        "purchase_date": item.purchase_date,
        "expiration_date": item.expiration_date,
        "storage_location": item.storage_location,
        "image_path": item.image_path,
        "notes": item.notes,
        "status": item.status,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
        "days_until_expiration": item.days_until_expiration,
        "is_expired": item.is_expired,
        # Add product information from relationship
        "product_name": item.product.product_name if item.product else None,
        "brand": item.product.brand if item.product else None,
        "category": item.product.category if item.product else None,
    }


# ============================================================================
# Inventory Endpoints
# ============================================================================

@app.get("/api/inventory", response_model=List[InventoryItemResponse], tags=["Inventory"])
def get_inventory(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum records to return"),
    location: Optional[str] = Query(None, description="Filter by storage location"),
    status: Optional[str] = Query(None, description="Filter by status"),
    service: PantryService = Depends(get_pantry_service)
) -> List[Dict]:
    """
    Get all inventory items with optional filtering.
    
    - **skip**: Number of records to skip (pagination)
    - **limit**: Maximum number of records to return
    - **location**: Filter by storage location (pantry/fridge/freezer)
    - **status**: Filter by item status (in_stock/low/expired/consumed)
    """
    try:
        items = service.get_all_inventory()
        
        # Apply filters
        if location:
            items = [i for i in items if i.storage_location == location]
        if status:
            items = [i for i in items if i.status == status]
        
        # Apply pagination
        items = items[skip:skip + limit]
        
        # Enrich with product information
        result = [enrich_inventory_item(item) for item in items]
        
        logger.info(f"Retrieved {len(result)} inventory items")
        return result
        
    except Exception as e:
        logger.error(f"Error retrieving inventory: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve inventory"
        )


@app.get("/api/inventory/{item_id}", response_model=InventoryItemResponse, tags=["Inventory"])
def get_inventory_item(
    item_id: int,
    service: PantryService = Depends(get_pantry_service)
) -> Dict:
    """
    Get a specific inventory item by ID.
    
    - **item_id**: Inventory item ID to retrieve
    """
    try:
        item = service.get_inventory_item(item_id)
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Inventory item with ID {item_id} not found"
            )
        
        # Enrich with product information
        return enrich_inventory_item(item)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving inventory item {item_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve inventory item"
        )


@app.post("/api/inventory", response_model=InventoryItemResponse, status_code=status.HTTP_201_CREATED, tags=["Inventory"])
def create_inventory_item(
    item_data: InventoryItemCreate,
    service: PantryService = Depends(get_pantry_service)
) -> Dict:
    """
    Add a new inventory item.
    
    - **product_id**: ID of the product
    - **quantity**: Quantity
    - **unit**: Unit of measurement
    - **storage_location**: Where item is stored
    - **expiration_date**: Optional expiration date
    - **purchase_date**: Optional purchase date
    - **notes**: Optional notes
    """
    try:
        # Verify product exists
        product = service.get_product_by_id(item_data.product_id)
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product with ID {item_data.product_id} not found"
            )
        
        item = service.add_inventory_item(
            product_id=item_data.product_id,
            quantity=item_data.quantity,
            unit=item_data.unit,
            purchase_date=item_data.purchase_date,
            expiration_date=item_data.expiration_date,
            storage_location=item_data.storage_location,
            image_path=item_data.image_path,
            notes=item_data.notes,
            status=item_data.status
        )
        logger.info(f"Created inventory item ID {item.id}")
        return enrich_inventory_item(item)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating inventory item: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create inventory item"
        )


@app.put("/api/inventory/{item_id}", response_model=InventoryItemResponse, tags=["Inventory"])
def update_inventory_item(
    item_id: int,
    item_data: InventoryItemUpdate,
    service: PantryService = Depends(get_pantry_service)
) -> Dict:
    """
    Update an existing inventory item.
    
    Only provided fields will be updated. Omitted fields remain unchanged.
    
    - **item_id**: ID of item to update
    """
    try:
        item = service.get_inventory_item(item_id)
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Inventory item with ID {item_id} not found"
            )
        
        # Update only provided fields
        update_data = item_data.model_dump(exclude_unset=True)
        
        # If product_id is being updated, verify it exists
        if 'product_id' in update_data:
            product = service.get_product_by_id(update_data['product_id'])
            if not product:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Product with ID {update_data['product_id']} not found"
                )
        
        updated_item = service.update_inventory_item(item_id, **update_data)
        logger.info(f"Updated inventory item ID {item_id}")
        return enrich_inventory_item(updated_item)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating inventory item {item_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update inventory item"
        )


@app.delete("/api/inventory/{item_id}", response_model=MessageResponse, tags=["Inventory"])
def delete_inventory_item(
    item_id: int,
    service: PantryService = Depends(get_pantry_service)
) -> MessageResponse:
    """
    Delete an inventory item.
    
    - **item_id**: ID of item to delete
    """
    try:
        item = service.get_inventory_item(item_id)
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Inventory item with ID {item_id} not found"
            )
        
        service.session.delete(item)
        service.session.commit()
        logger.info(f"Deleted inventory item ID {item_id}")
        
        return MessageResponse(
            message=f"Inventory item {item_id} deleted successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        service.session.rollback()
        logger.error(f"Error deleting inventory item {item_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete inventory item"
        )


@app.post("/api/inventory/{item_id}/consume", response_model=InventoryItemResponse, tags=["Inventory"])
def consume_inventory_item(
    item_id: int,
    consume_data: Optional[ConsumeRequest] = None,
    service: PantryService = Depends(get_pantry_service)
) -> Dict:
    """
    Consume an inventory item.
    
    If quantity is provided, decrements by that amount.
    If no quantity provided, marks entire item as consumed.
    
    - **item_id**: ID of item to consume
    - **quantity**: Optional quantity to consume (partial consumption)
    """
    try:
        quantity = consume_data.quantity if consume_data else None
        item = service.consume_item(item_id, quantity)
        
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Inventory item with ID {item_id} not found"
            )
        
        logger.info(f"Consumed inventory item ID {item_id}")
        return enrich_inventory_item(item)
        
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error consuming inventory item {item_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to consume inventory item"
        )


# ============================================================================
# Expiration Endpoints
# ============================================================================

@app.get("/api/expiring", response_model=List[InventoryItemResponse], tags=["Expiration"])
def get_expiring_items(
    days: int = Query(7, ge=1, le=365, description="Days to look ahead"),
    service: PantryService = Depends(get_pantry_service)
) -> List[Dict]:
    """
    Get items expiring within specified number of days.
    
    - **days**: Number of days to look ahead (default: 7)
    """
    try:
        items = service.get_expiring_items(days)
        result = [enrich_inventory_item(item) for item in items]
        logger.info(f"Found {len(result)} items expiring within {days} days")
        return result
    except Exception as e:
        logger.error(f"Error retrieving expiring items: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve expiring items"
        )


@app.get("/api/expired", response_model=List[InventoryItemResponse], tags=["Expiration"])
def get_expired_items(
    service: PantryService = Depends(get_pantry_service)
) -> List[Dict]:
    """
    Get all expired items.
    
    Returns items where expiration_date < today.
    """
    try:
        items = service.get_expired_items()
        result = [enrich_inventory_item(item) for item in items]
        logger.info(f"Found {len(result)} expired items")
        return result
    except Exception as e:
        logger.error(f"Error retrieving expired items: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve expired items"
        )


# ============================================================================
# Statistics Endpoints
# ============================================================================

@app.get("/api/statistics", response_model=StatisticsResponse, tags=["Statistics"])
def get_statistics(
    service: PantryService = Depends(get_pantry_service)
) -> StatisticsResponse:
    """
    Get overall pantry statistics.
    
    Returns comprehensive statistics including:
    - Total counts
    - Status breakdown
    - Category distribution
    - Location distribution
    """
    try:
        stats = service.get_statistics()
        logger.info("Retrieved pantry statistics")
        
        return StatisticsResponse(
            total_items=stats.get('total_items', 0),
            total_products=stats.get('total_products', 0),
            in_stock=stats.get('by_status', {}).get('in_stock', 0),
            low_stock=stats.get('by_status', {}).get('low', 0),
            expired=stats.get('by_status', {}).get('expired', 0),
            consumed=stats.get('by_status', {}).get('consumed', 0),
            expiring_soon=stats.get('expiring_soon', 0),
            by_category=stats.get('by_category', {}),
            by_location=stats.get('by_location', {}),
            by_status=stats.get('by_status', {})
        )
        
    except Exception as e:
        logger.error(f"Error retrieving statistics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve statistics"
        )


@app.get("/api/statistics/by-category", tags=["Statistics"])
def get_statistics_by_category(
    service: PantryService = Depends(get_pantry_service)
) -> dict:
    """
    Get statistics grouped by category.
    
    Returns item counts per category.
    """
    try:
        stats = service.get_statistics()
        return stats.get('by_category', {})
    except Exception as e:
        logger.error(f"Error retrieving category statistics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve category statistics"
        )


@app.get("/api/statistics/by-location", tags=["Statistics"])
def get_statistics_by_location(
    service: PantryService = Depends(get_pantry_service)
) -> dict:
    """
    Get statistics grouped by storage location.
    
    Returns item counts per location (pantry/fridge/freezer).
    """
    try:
        stats = service.get_statistics()
        return stats.get('by_location', {})
    except Exception as e:
        logger.error(f"Error retrieving location statistics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve location statistics"
        )


# ============================================================================
# Recipe Generation Endpoints
# ============================================================================

@app.post("/api/recipes/generate", response_model=List[RecipeResponse], tags=["Recipes"])
def generate_recipes(
    request: RecipeRequest,
    service: PantryService = Depends(get_pantry_service)
) -> List[Dict]:
    """
    Generate AI-powered recipes using available pantry ingredients.
    
    - **ingredients**: Optional list of ingredient names. If empty, uses all available items.
    - **max_recipes**: Number of recipes to generate (1-20)
    - **cuisine**: Optional cuisine type (italian, mexican, asian, etc.)
    - **difficulty**: Optional difficulty level (easy, medium, hard)
    - **dietary_restrictions**: Optional list of dietary restrictions
    """
    try:
        # Get inventory items
        all_items = service.get_all_inventory()
        
        # Filter to in_stock items only
        available_items = [item for item in all_items if item.status == "in_stock"]
        
        if not available_items:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No items in stock. Add items to your pantry first."
            )
        
        # Build ingredient list
        if request.ingredients and len(request.ingredients) > 0:
            # Use selected ingredients
            selected_names = set(request.ingredients)
            selected_items = []
            for item in available_items:
                product_name = item.product.product_name if item.product else None
                if product_name and product_name in selected_names:
                    selected_items.append(item)
            
            if not selected_items:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="None of the selected ingredients are available in stock."
                )
            items_to_use = selected_items
        else:
            # Use all available items
            items_to_use = available_items
        
        # Convert to format expected by RecipeGenerator
        pantry_items = []
        for item in items_to_use:
            product_name = item.product.product_name if item.product else "Unknown"
            brand = item.product.brand if item.product else None
            
            pantry_items.append({
                "product": {
                    "product_name": product_name,
                    "brand": brand
                }
            })
        
        # Initialize AI analyzer and recipe generator
        ai_analyzer = create_ai_analyzer()
        recipe_generator = RecipeGenerator(ai_analyzer)
        
        # Generate recipes
        logger.info(f"Generating {request.max_recipes} recipes from {len(pantry_items)} ingredients")
        recipes = recipe_generator.generate_recipes(
            pantry_items=pantry_items,
            num_recipes=request.max_recipes,
            cuisine=request.cuisine,
            difficulty=request.difficulty,
            dietary_restrictions=request.dietary_restrictions
        )
        
        # Convert to response format
        result = []
        for recipe in recipes:
            # Extract available ingredients used
            used_ingredients = []
            for ing in recipe.get('ingredients', []):
                if isinstance(ing, dict):
                    used_ingredients.append(ing.get('item', ing.get('name', '')))
                else:
                    used_ingredients.append(str(ing))
            
            result.append({
                "name": recipe.get('name', 'Unnamed Recipe'),
                "description": recipe.get('description', ''),
                "difficulty": recipe.get('difficulty', 'medium'),
                "prep_time": _parse_time(recipe.get('prep_time', '0 minutes')),
                "cook_time": _parse_time(recipe.get('cook_time', '0 minutes')),
                "servings": recipe.get('servings', 4),
                "cuisine": recipe.get('cuisine', ''),
                "ingredients": recipe.get('ingredients', []),
                "instructions": recipe.get('instructions', []),
                "available_ingredients": used_ingredients,
                "missing_ingredients": recipe.get('missing_ingredients', [])
            })
        
        logger.info(f"Successfully generated {len(result)} recipes")
        return result
        
    except HTTPException:
        raise
    except ValueError as e:
        # Handle missing AI API keys
        if "No AI backends available" in str(e):
            logger.error("AI API keys not configured")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="AI service not available. Please configure OpenAI or Anthropic API key in .env file. See README for setup instructions."
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error generating recipes: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate recipes: {str(e)}"
        )


def _parse_time(time_str: str) -> int:
    """Parse time string like '30 minutes' to integer minutes."""
    try:
        if isinstance(time_str, int):
            return time_str
        if isinstance(time_str, str):
            # Extract number from string
            import re
            match = re.search(r'(\d+)', time_str)
            if match:
                return int(match.group(1))
        return 0
    except:
        return 0


# ============================================================================
# Saved Recipe Endpoints (Recipe Box)
# ============================================================================

@app.post("/api/recipes/save", response_model=SavedRecipeResponse, status_code=status.HTTP_201_CREATED, tags=["Recipes"])
def save_recipe(
    recipe_data: SavedRecipeCreate,
    service: PantryService = Depends(get_pantry_service)
) -> Dict:
    """
    Save a recipe to the recipe box.
    
    Saves a recipe for later viewing. Can be a generated recipe or custom recipe.
    """
    try:
        recipe = service.save_recipe(
            name=recipe_data.name,
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
            tags=recipe_data.tags
        )
        
        logger.info(f"Saved recipe: {recipe.name} (ID: {recipe.id})")
        return recipe.to_dict()
        
    except Exception as e:
        logger.error(f"Error saving recipe: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save recipe: {str(e)}"
        )


@app.get("/api/recipes/saved", response_model=List[SavedRecipeResponse], tags=["Recipes"])
def get_saved_recipes(
    cuisine: Optional[str] = Query(None, description="Filter by cuisine"),
    difficulty: Optional[str] = Query(None, description="Filter by difficulty"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum recipes to return"),
    service: PantryService = Depends(get_pantry_service)
) -> List[Dict]:
    """
    Get all saved recipes from recipe box.
    
    - **cuisine**: Optional cuisine filter
    - **difficulty**: Optional difficulty filter
    - **limit**: Maximum number of recipes to return
    """
    try:
        recipes = service.get_saved_recipes(
            cuisine=cuisine,
            difficulty=difficulty,
            limit=limit
        )
        
        result = [recipe.to_dict() for recipe in recipes]
        logger.info(f"Retrieved {len(result)} saved recipes")
        return result
        
    except Exception as e:
        logger.error(f"Error retrieving saved recipes: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve saved recipes"
        )


@app.get("/api/recipes/saved/{recipe_id}", response_model=SavedRecipeResponse, tags=["Recipes"])
def get_saved_recipe(
    recipe_id: int,
    service: PantryService = Depends(get_pantry_service)
) -> Dict:
    """
    Get a specific saved recipe by ID.
    
    - **recipe_id**: Recipe ID to retrieve
    """
    try:
        recipe = service.get_saved_recipe(recipe_id)
        if not recipe:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Recipe with ID {recipe_id} not found"
            )
        
        return recipe.to_dict()
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving recipe {recipe_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve recipe"
        )


@app.put("/api/recipes/saved/{recipe_id}", response_model=SavedRecipeResponse, tags=["Recipes"])
def update_saved_recipe(
    recipe_id: int,
    recipe_data: SavedRecipeUpdate,
    service: PantryService = Depends(get_pantry_service)
) -> Dict:
    """
    Update a saved recipe (notes, rating, tags).
    
    - **recipe_id**: Recipe ID to update
    """
    try:
        recipe = service.update_saved_recipe(
            recipe_id=recipe_id,
            notes=recipe_data.notes,
            rating=recipe_data.rating,
            tags=recipe_data.tags
        )
        
        if not recipe:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Recipe with ID {recipe_id} not found"
            )
        
        logger.info(f"Updated recipe ID {recipe_id}")
        return recipe.to_dict()
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating recipe {recipe_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update recipe"
        )


@app.delete("/api/recipes/saved/{recipe_id}", response_model=MessageResponse, tags=["Recipes"])
def delete_saved_recipe(
    recipe_id: int,
    service: PantryService = Depends(get_pantry_service)
) -> MessageResponse:
    """
    Delete a saved recipe.
    
    - **recipe_id**: Recipe ID to delete
    """
    try:
        deleted = service.delete_saved_recipe(recipe_id)
        
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Recipe with ID {recipe_id} not found"
            )
        
        logger.info(f"Deleted recipe ID {recipe_id}")
        return MessageResponse(
            message=f"Recipe {recipe_id} deleted successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting recipe {recipe_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete recipe"
        )


# ============================================================================
# Error Handlers
# ============================================================================

@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc: HTTPException):
    """Custom HTTP exception handler."""
    logger.warning(f"HTTP {exc.status_code}: {exc.detail}")
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": exc.detail,
            "error_code": str(exc.status_code)
        }
    )


@app.exception_handler(Exception)
async def general_exception_handler(request, exc: Exception):
    """Catch-all exception handler."""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "An unexpected error occurred",
            "error_code": "500"
        }
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "api.main:app",
        host=config.host,
        port=config.port,
        reload=config.reload,
        log_level=config.log_level
    )

