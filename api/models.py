"""
Pydantic Models Module.

Defines request and response models for API endpoints.
Provides automatic validation and serialization/deserialization.
"""

from typing import Optional, List, Dict, Any
from datetime import datetime, date
from pydantic import BaseModel, Field, ConfigDict, EmailStr


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
    pantry_id: Optional[int] = Field(None, description="Pantry ID (optional)")


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
    pantry_id: Optional[int] = Field(None, description="Pantry ID (optional)")


class InventoryItemResponse(InventoryItemBase):
    """Response model for inventory item data."""
    id: int
    created_at: datetime
    updated_at: datetime
    user_id: Optional[int] = Field(None, description="User ID")
    pantry_id: Optional[int] = Field(None, description="Pantry ID")
    pantry_name: Optional[str] = Field(None, description="Pantry name")
    
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


class ProcessFromTextRequest(BaseModel):
    """Request model for processing OCR text from device (e.g. ML Kit) without server-side OCR."""
    raw_text: str = Field(..., min_length=1, description="Text extracted on-device from label/receipt image")
    storage_location: str = Field(default="pantry", description="pantry, fridge, or freezer")
    pantry_id: Optional[int] = Field(None, description="Pantry ID (optional)")


# ============================================================================
# Pantry Models
# ============================================================================

class PantryBase(BaseModel):
    """Base model for pantry data."""
    name: str = Field(..., min_length=1, max_length=255, description="Pantry name")
    description: Optional[str] = Field(None, description="Pantry description")
    location: Optional[str] = Field(None, max_length=255, description="Location/address")
    is_default: bool = Field(False, description="Whether this is the default pantry")


class PantryCreate(PantryBase):
    """Request model for creating a pantry."""
    pass


class PantryUpdate(BaseModel):
    """Request model for updating a pantry. All fields are optional."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    location: Optional[str] = Field(None, max_length=255)
    is_default: Optional[bool] = None


class PantryResponse(PantryBase):
    """Response model for pantry data."""
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class UserSettingsResponse(BaseModel):
    """Response model for user settings."""
    id: int
    user_id: int
    ai_provider: Optional[str] = None
    ai_model: Optional[str] = None
    default_ai_provider: Optional[str] = None
    default_ai_model: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class UserSettingsUpdate(BaseModel):
    """Request model for updating user settings."""
    ai_provider: Optional[str] = Field(None, description="AI provider: 'openai' or 'anthropic'")
    ai_model: Optional[str] = Field(None, description="AI model name (e.g., 'gpt-4o', 'claude-sonnet-4-20250514')")


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
    # Core counts
    total_items: int
    total_products: int
    in_stock: int
    low_stock: int
    expired: int
    consumed: int
    expiring_soon: int  # Within 7 days
    
    # Pantry Health Score (0-100)
    health_score: int = Field(default=0, ge=0, le=100)
    health_factors: Dict[str, int] = Field(default_factory=dict)  # Breakdown of score
    
    # Expiration Timeline
    expiring_tomorrow: int = 0
    expiring_this_week: int = 0
    expiring_this_month: int = 0
    
    # Recipe Activity
    recipes_generated: int = 0
    recipes_saved: int = 0
    
    # Recent Activity
    items_added_this_week: int = 0
    items_added_this_month: int = 0
    
    # Storage Distribution (for visual bars)
    storage_counts: Dict[str, int] = Field(default_factory=dict)
    
    # Legacy breakdowns
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
    required_ingredients: Optional[List[str]] = Field(None, description="Required ingredients that must be included in recipes. Recipes can also use other available ingredients.")
    excluded_ingredients: Optional[List[str]] = Field(None, description="Ingredients to exclude from recipes.")
    max_recipes: int = Field(default=5, ge=1, le=20, description="Maximum number of recipes")
    cuisine: Optional[str] = Field(None, description="Preferred cuisine type")
    difficulty: Optional[str] = Field(None, description="Difficulty level (easy/medium/hard)")
    dietary_restrictions: Optional[List[str]] = Field(None, description="Dietary restrictions")
    allow_missing_ingredients: bool = Field(default=False, description="Allow recipes to include 2-4 ingredients not in pantry (will be listed as missing)")
    pantry_id: Optional[int] = Field(None, description="Pantry ID to use (defaults to user's default pantry)")


class SingleRecipeRequest(BaseModel):
    """Request model for single recipe generation (incremental display)."""
    required_ingredients: Optional[List[str]] = Field(None, description="Required ingredients that must be included in recipes. Recipes can also use other available ingredients.")
    excluded_ingredients: Optional[List[str]] = Field(None, description="Ingredients to exclude from recipes.")
    cuisine: Optional[str] = Field(None, description="Preferred cuisine type")
    difficulty: Optional[str] = Field(None, description="Difficulty level (easy/medium/hard)")
    dietary_restrictions: Optional[List[str]] = Field(None, description="Dietary restrictions")
    avoid_names: Optional[List[str]] = Field(None, description="List of recipe names to avoid (for variety)")
    allow_missing_ingredients: bool = Field(default=False, description="Allow recipes to include 2-4 ingredients not in pantry (will be listed as missing)")
    pantry_id: Optional[int] = Field(None, description="Pantry ID to use (defaults to user's default pantry)")


class FlavorPairing(BaseModel):
    """Model for flavor pairing information."""
    ingredients: List[str] = Field(..., description="Ingredients that pair together")
    compounds: str = Field(..., description="Shared chemical compounds (e.g., vanillin, eugenol, terpenes)")
    effect: str = Field(..., description="Description of how these flavors work together")


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
    flavor_pairings: Optional[List[FlavorPairing]] = Field(None, description="Flavor pairings based on shared chemical compounds")
    ai_model: Optional[str] = Field(None, description="AI model used to generate this recipe")
    tags: Optional[List[str]] = Field(None, description="Filterable categories: cuisine, meal type, dietary, cooking method, difficulty")


# ============================================================================
# Saved Recipe Models
# ============================================================================

class SavedRecipeCreate(BaseModel):
    """Request model for saving a recipe."""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    cuisine: Optional[str] = Field(None, max_length=100)
    difficulty: Optional[str] = Field(None, max_length=50)
    prep_time: Optional[int] = Field(None, ge=0)
    cook_time: Optional[int] = Field(None, ge=0)
    servings: Optional[int] = Field(None, ge=1)
    ingredients: List[Dict[str, Any]] = Field(default_factory=list)
    instructions: List[str] = Field(default_factory=list)
    notes: Optional[str] = None
    rating: Optional[int] = Field(None, ge=1, le=5)
    tags: Optional[List[str]] = None
    ai_model: Optional[str] = Field(None, max_length=100, description="AI model used to generate this recipe")
    flavor_pairings: Optional[List[FlavorPairing]] = Field(None, description="Flavor pairings with chemical compounds")


class SavedRecipeUpdate(BaseModel):
    """Request model for updating a saved recipe."""
    notes: Optional[str] = None
    rating: Optional[int] = Field(None, ge=1, le=5)
    tags: Optional[List[str]] = None


class SavedRecipeResponse(BaseModel):
    """Response model for saved recipe."""
    id: int
    name: str
    description: Optional[str] = None
    cuisine: Optional[str] = None
    difficulty: Optional[str] = None
    prep_time: Optional[int] = None
    cook_time: Optional[int] = None
    servings: Optional[int] = None
    ingredients: List[Dict[str, Any]]
    instructions: List[str]
    notes: Optional[str] = None
    rating: Optional[int] = None
    tags: List[str]
    ai_model: Optional[str] = Field(None, description="AI model used to generate this recipe")
    flavor_pairings: Optional[List[FlavorPairing]] = Field(None, description="Flavor pairings with chemical compounds")
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class SavedRecipeSearchResult(BaseModel):
    """One semantic search hit: recipe plus similarity score (0-1)."""
    recipe: SavedRecipeResponse
    score: float = Field(..., ge=0, le=1, description="Cosine similarity to query (0-1)")


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


# ============================================================================
# Authentication Models
# ============================================================================

class RegisterRequest(BaseModel):
    """Request model for user registration."""
    email: EmailStr = Field(..., description="User email address")
    password: str = Field(..., min_length=8, description="Password (minimum 8 characters)")
    full_name: Optional[str] = Field(None, max_length=255, description="User's full name")


class LoginRequest(BaseModel):
    """Request model for user login."""
    email: EmailStr = Field(..., description="User email address")
    password: str = Field(..., description="User password")


class TokenResponse(BaseModel):
    """Response model for authentication tokens."""
    access_token: str = Field(..., description="JWT access token")
    refresh_token: str = Field(..., description="JWT refresh token")
    token_type: str = Field(default="bearer", description="Token type")
    user: Dict[str, Any] = Field(..., description="User information")


class RefreshTokenRequest(BaseModel):
    """Request model for refreshing access token."""
    refresh_token: str = Field(..., description="Refresh token")


class RefreshTokenResponse(BaseModel):
    """Response model for refreshed access token."""
    access_token: str = Field(..., description="New JWT access token")
    token_type: str = Field(default="bearer", description="Token type")


class UserResponse(BaseModel):
    """Response model for user information."""
    id: int
    email: str
    full_name: Optional[str] = None
    role: str
    email_verified: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime
    last_login: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)


class ForgotPasswordResponse(BaseModel):
    """Response for forgot-password (TOTP and/or recovery-questions flow)."""
    has_existing_totp: bool = Field(..., description="True if user already has Authenticator set up")
    totp_uri: Optional[str] = Field(None, description="Provisioning URI for new Authenticator (if no existing TOTP)")
    qr_image_base64: Optional[str] = Field(None, description="QR code image as base64 (if no existing TOTP)")
    has_recovery_questions: bool = Field(False, description="True if user has set recovery questions (easy reset path)")
    recovery_questions: Optional[List[dict]] = Field(None, description="Question id/text for user's recovery questions (if has_recovery_questions)")


class RecoveryQuestionItem(BaseModel):
    """One recovery question (id + text)."""
    id: int = Field(..., description="Question id")
    text: str = Field(..., description="Question text")


class GetRecoveryQuestionsResponse(BaseModel):
    """All predefined questions + user's current question ids (if any)."""
    all_questions: List[RecoveryQuestionItem] = Field(..., description="All available questions")
    user_question_ids: List[int] = Field(default_factory=list, description="Ids of questions user has set (empty if none)")


class RecoveryAnswerInput(BaseModel):
    """One answer for recovery questions (set or verify)."""
    question_id: int = Field(..., description="Question id")
    answer: str = Field(..., min_length=1, description="User's answer")


class SetRecoveryQuestionsRequest(BaseModel):
    """Set or update recovery answers. 2–3 (question_id, answer) pairs."""
    answers: List[RecoveryAnswerInput] = Field(..., min_length=2, max_length=3, description="List of question_id + answer")


class VerifyResetTotpResponse(BaseModel):
    """Response for verify-reset-totp."""
    reset_token: str = Field(..., description="JWT to use for POST /api/auth/reset-password")


class VerifyResetRecoveryResponse(BaseModel):
    """Response for verify-reset-recovery (same token shape as TOTP)."""
    reset_token: str = Field(..., description="JWT to use for POST /api/auth/reset-password")


class VerifyResetRecoveryRequest(BaseModel):
    """Request body for verify-reset-recovery."""
    email: str = Field(..., description="User email")
    answers: List[RecoveryAnswerInput] = Field(..., min_length=2, max_length=3, description="Answers to recovery questions")


# ============================================================================
# Instacart Integration Models
# ============================================================================

class InstacartIngredient(BaseModel):
    """Ingredient/item model for Instacart shopping requests."""
    name: str = Field(..., min_length=1, max_length=255, description="Product/ingredient name")
    quantity: Optional[float] = Field(1.0, gt=0, description="Quantity")
    unit: Optional[str] = Field("each", max_length=50, description="Unit of measurement")
    display_text: Optional[str] = Field(None, max_length=255, description="Display text override")


class InstacartRecipeLinkRequest(BaseModel):
    """Request model for creating an Instacart recipe shopping link."""
    title: str = Field(..., min_length=1, max_length=255, description="Recipe title")
    ingredients: List[InstacartIngredient] = Field(..., min_length=1, description="List of ingredients")
    instructions: Optional[List[str]] = Field(None, description="Cooking instructions")
    servings: Optional[int] = Field(None, ge=1, description="Number of servings")
    cooking_time_minutes: Optional[int] = Field(None, ge=1, description="Cooking time in minutes")


class InstacartShoppingListRequest(BaseModel):
    """Request model for creating an Instacart shopping list link."""
    title: str = Field(..., min_length=1, max_length=255, description="Shopping list title")
    items: List[InstacartIngredient] = Field(..., min_length=1, description="List of items to shop for")


class InstacartLinkResponse(BaseModel):
    """Response model for Instacart shopping link."""
    products_link_url: str = Field(..., description="URL to Instacart shopping page")
    expires_at: Optional[datetime] = Field(None, description="When the link expires")


class InstacartStatusResponse(BaseModel):
    """Response model for Instacart service status."""
    enabled: bool = Field(..., description="Whether Instacart integration is enabled")
    available: bool = Field(..., description="Whether Instacart service is available")

