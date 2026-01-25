"""Product CRUD and search."""

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from api.dependencies import get_pantry_service
from api.models import (
    MessageResponse,
    ProductCreate,
    ProductResponse,
    ProductUpdate,
)
from src.database import Product
from src.db_service import PantryService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/products", tags=["Products"])


@router.get("", response_model=List[ProductResponse])
def get_products(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum records to return"),
    service: PantryService = Depends(get_pantry_service),
) -> List[Product]:
    """Get all products with pagination."""
    try:
        db_session = service.session
        products = db_session.query(Product).offset(skip).limit(limit).all()
        logger.info("Retrieved %d products", len(products))
        return products
    except SQLAlchemyError as e:
        logger.error("Database error retrieving products: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve products",
        ) from e


@router.get("/search", response_model=List[ProductResponse])
def search_products(
    q: str = Query(..., min_length=1, description="Search query"),
    category: Optional[str] = Query(None, description="Filter by category"),
    brand: Optional[str] = Query(None, description="Filter by brand"),
    service: PantryService = Depends(get_pantry_service),
) -> List[Product]:
    """Search products by name, brand, or category."""
    try:
        products = service.search_products(query=q, category=category, brand=brand)
        logger.info("Search for %r returned %d products", q, len(products))
        return products
    except Exception as e:
        logger.error("Error searching products: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to search products",
        ) from e


@router.get("/{product_id}", response_model=ProductResponse)
def get_product(
    product_id: int,
    service: PantryService = Depends(get_pantry_service),
) -> Product:
    """Get a specific product by ID."""
    try:
        product = service.get_product(product_id)
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product with ID {product_id} not found",
            )
        return product
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error retrieving product %s: %s", product_id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve product",
        ) from e


@router.post("", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(
    product_data: ProductCreate,
    service: PantryService = Depends(get_pantry_service),
) -> Product:
    """Create a new product."""
    try:
        product = service.add_product(
            product_name=product_data.product_name,
            brand=product_data.brand,
            category=product_data.category or "Other",
            subcategory=product_data.subcategory,
            barcode=product_data.barcode,
            default_storage_location=product_data.default_storage_location,
            typical_shelf_life_days=product_data.typical_shelf_life_days,
        )
        logger.info("Created product: %s (ID: %s)", product.product_name, product.id)
        return product
    except IntegrityError as e:
        logger.error("Integrity error creating product: %s", e)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Product with this barcode already exists or invalid data",
        ) from e
    except Exception as e:
        logger.error("Error creating product: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create product",
        ) from e


@router.put("/{product_id}", response_model=ProductResponse)
def update_product(
    product_id: int,
    product_data: ProductUpdate,
    service: PantryService = Depends(get_pantry_service),
) -> Product:
    """Update an existing product."""
    try:
        product = service.get_product(product_id)
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product with ID {product_id} not found",
            )
        update_data = product_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(product, field, value)
        service.session.commit()
        service.session.refresh(product)
        logger.info("Updated product ID %s", product_id)
        return product
    except HTTPException:
        raise
    except IntegrityError as e:
        service.session.rollback()
        logger.error("Integrity error updating product: %s", e)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid data or duplicate barcode",
        ) from e
    except Exception as e:
        service.session.rollback()
        logger.error("Error updating product %s: %s", product_id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update product",
        ) from e


@router.delete("/{product_id}", response_model=MessageResponse)
def delete_product(
    product_id: int,
    service: PantryService = Depends(get_pantry_service),
) -> MessageResponse:
    """Delete a product (cascades to inventory items)."""
    try:
        product = service.get_product(product_id)
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product with ID {product_id} not found",
            )
        service.session.delete(product)
        service.session.commit()
        logger.info("Deleted product ID %s", product_id)
        return MessageResponse(message=f"Product {product_id} deleted successfully")
    except HTTPException:
        raise
    except Exception as e:
        service.session.rollback()
        logger.error("Error deleting product %s: %s", product_id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete product",
        ) from e
