"""
Pydantic Models Module.

Defines request and response models for API endpoints.
Provides automatic validation and serialization/deserialization.
"""

from typing import Optional, List, Dict, Any
from datetime import datetime, date
from pydantic import BaseModel, Field, ConfigDict


# ============================================================================
# Product Models
# ============================================================================

class ProductBase(BaseModel):
    """Base model for product data."""
    product_name: str = Field(..., min_length=1, max_length=255, description="Product name")
    brand: Optional[str] = Field(None, max_length=255, description="Brand name")
    category: Optional[str] = Field(None, max_length=100, description="Product category")
    subcategory: Optional[str] = Field(None, max_length=100, description="Product subcategory")
    barcode: Optional[str] = Field(None, max_length=50, description="Barcode/UPC")
    default_storage_location: Optional[str] = Field(None, max_length=50, description="Default storage location")
    typical_shelf_life_days: Optional[int] = Field(None, ge=1, description="Typical shelf life in days")


class ProductCreate(ProductBase):
    """Request model for creating a product."""
    pass


class ProductUpdate(BaseModel):
    """Request model for updating a product. All fields are optional."""
    product_name: Optional[str] = Field(None, min_length=1, max_length=255)
    brand: Optional[str] = Field(None, max_length=255)
    category: Optional[str] = Field(None, max_length=100)
    subcategory: Optional[str] = Field(None, max_length=100)
    barcode: Optional[str] = Field(None, max_length=50)
    default_storage_location: Optional[str] = Field(None, max_length=50)
    typical_shelf_life_days: Optional[int] = Field(None, ge=1)


class ProductResponse(ProductBase):
    """Response model for product data."""
    id: int
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# Inventory Item Models
# ============================================================================

class InventoryItemBase(BaseModel):
    """Base model for inventory item data."""
    product_id: int = Field(..., gt=0, description="Product ID reference")
    quantity: float = Field(..., gt=0, description="Quantity")
    unit: str = Field(..., max_length=50, description="Unit of measurement")
    purchase_date: Optional[date] = Field(None, description="Purchase date")
    expiration_date: Optional[date] = Field(None, description="Expiration date")
    storage_location: str = Field(..., max_length=50, description="Storage location (pantry/fridge/freezer)")
    image_path: Optional[str] = Field(None, max_length=500, description="Path to item image")
    notes: Optional[str] = Field(None, description="Additional notes")
    status: str = Field(default="in_stock", max_length=50, description="Item status")


class InventoryItemCreate(InventoryItemBase):
    """Request model for creating an inventory item."""
    pass


class InventoryItemUpdate(BaseModel):
    """Request model for updating an inventory item. All fields are optional."""
    product_id: Optional[int] = Field(None, gt=0)
    quantity: Optional[float] = Field(None, gt=0)
    unit: Optional[str] = Field(None, max_length=50)
    purchase_date: Optional[date] = None
    expiration_date: Optional[date] = None
    storage_location: Optional[str] = Field(None, max_length=50)
    image_path: Optional[str] = Field(None, max_length=500)
    notes: Optional[str] = None
    status: Optional[str] = Field(None, max_length=50)


class InventoryItemResponse(InventoryItemBase):
    """Response model for inventory item data."""
    id: int
    created_at: datetime
    updated_at: datetime
    
    # Computed fields from helper properties
    days_until_expiration: Optional[int] = Field(None, description="Days until expiration (negative if expired)")
    is_expired: bool = Field(False, description="Whether the item is expired")
    
    # Product information (from relationship)
    product_name: Optional[str] = Field(None, description="Product name from related product")
    brand: Optional[str] = Field(None, description="Brand from related product")
    category: Optional[str] = Field(None, description="Category from related product")
    
    model_config = ConfigDict(from_attributes=True)


class ConsumeRequest(BaseModel):
    """Request model for consuming an item."""
    quantity: Optional[float] = Field(None, gt=0, description="Quantity to consume (if partial)")


# ============================================================================
# Processing Log Models
# ============================================================================

class ProcessingLogCreate(BaseModel):
    """Request model for creating a processing log entry."""
    image_path: str = Field(..., max_length=500)
    processing_date: datetime = Field(default_factory=datetime.now)
    ocr_confidence: Optional[float] = Field(None, ge=0, le=1)
    ai_confidence: Optional[float] = Field(None, ge=0, le=1)
    status: str = Field(..., max_length=50)
    error_message: Optional[str] = None
    raw_ocr_data: Optional[Dict[str, Any]] = None
    raw_ai_data: Optional[Dict[str, Any]] = None


class ProcessingLogResponse(ProcessingLogCreate):
    """Response model for processing log data."""
    id: int
    
    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# Statistics Models
# ============================================================================

class StatisticsResponse(BaseModel):
    """Response model for overall pantry statistics."""
    total_items: int
    total_products: int
    in_stock: int
    low_stock: int
    expired: int
    consumed: int
    expiring_soon: int  # Within 7 days
    by_category: Dict[str, int]
    by_location: Dict[str, int]
    by_status: Dict[str, int]


class CategoryStatisticsResponse(BaseModel):
    """Response model for category-grouped statistics."""
    category: str
    item_count: int
    product_count: int


class LocationStatisticsResponse(BaseModel):
    """Response model for location-grouped statistics."""
    location: str
    item_count: int
    by_status: Dict[str, int]


# ============================================================================
# Recipe Models
# ============================================================================

class RecipeRequest(BaseModel):
    """Request model for recipe generation."""
    ingredients: Optional[List[str]] = Field(None, description="List of ingredient names to use. If empty, uses all available ingredients.")
    max_recipes: int = Field(default=5, ge=1, le=20, description="Maximum number of recipes")
    cuisine: Optional[str] = Field(None, description="Preferred cuisine type")
    difficulty: Optional[str] = Field(None, description="Difficulty level (easy/medium/hard)")
    dietary_restrictions: Optional[List[str]] = Field(None, description="Dietary restrictions")


class RecipeResponse(BaseModel):
    """Response model for generated recipe."""
    name: str
    description: str
    difficulty: str
    prep_time: int  # minutes
    cook_time: int  # minutes
    servings: int
    cuisine: str
    ingredients: List[Dict[str, Any]]
    instructions: List[str]
    available_ingredients: List[str]
    missing_ingredients: List[str]


# ============================================================================
# Search Models
# ============================================================================

class SearchRequest(BaseModel):
    """Request model for product search."""
    query: str = Field(..., min_length=1, description="Search query")
    category: Optional[str] = Field(None, description="Filter by category")
    brand: Optional[str] = Field(None, description="Filter by brand")


# ============================================================================
# Error Models
# ============================================================================

class ErrorResponse(BaseModel):
    """Response model for API errors."""
    detail: str = Field(..., description="Error message")
    error_code: Optional[str] = Field(None, description="Error code for programmatic handling")
    timestamp: datetime = Field(default_factory=datetime.now)


# ============================================================================
# Generic Models
# ============================================================================

class MessageResponse(BaseModel):
    """Generic message response."""
    message: str
    details: Optional[Dict[str, Any]] = None


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    service: str
    version: str
    timestamp: datetime = Field(default_factory=datetime.now)

