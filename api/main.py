"""
FastAPI Main Application.

Implements REST API endpoints for the Smart Pantry Management System.
Provides CRUD operations, search, filtering, and statistics.
"""

import logging
from typing import List, Optional, Dict, Any
from datetime import date, timedelta, datetime
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

from fastapi import FastAPI, Depends, HTTPException, Query, status, UploadFile, File, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, JSONResponse, StreamingResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
import tempfile
import shutil

from .config import config
from .dependencies import get_pantry_service, get_db, get_current_user, get_current_admin_user
from .models import (
    ProductCreate, ProductUpdate, ProductResponse,
    InventoryItemCreate, InventoryItemUpdate, InventoryItemResponse,
    ConsumeRequest, StatisticsResponse, MessageResponse,
    HealthResponse, ErrorResponse, RecipeRequest, SingleRecipeRequest, RecipeResponse,
    SavedRecipeCreate, SavedRecipeUpdate, SavedRecipeResponse,
    RegisterRequest, LoginRequest, TokenResponse, RefreshTokenRequest, RefreshTokenResponse, UserResponse,
    PantryCreate, PantryUpdate, PantryResponse
)
from src.db_service import PantryService
from src.database import Product, InventoryItem, User
from src.ai_analyzer import create_ai_analyzer
from src.ocr_service import create_ocr_service
from src.auth_service import (
    authenticate_user, create_user, create_access_token, create_refresh_token,
    verify_token, store_refresh_token, revoke_refresh_token, hash_refresh_token,
    get_valid_refresh_token
)
from src.file_validation import validate_image_file
from src.security_logger import log_security_event, get_client_ip, get_user_agent
from recipe_generator import RecipeGenerator
from pathlib import Path
import os

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

# Initialize database on startup
@app.on_event("startup")
async def startup_event():
    """Initialize database schema on application startup."""
    try:
        from src.database import init_database, get_database_url
        db_url = get_database_url()
        logger.info(f"Initializing database: {db_url[:50]}...")
        init_database()
        logger.info("✅ Database schema initialized successfully")
    except Exception as e:
        logger.warning(f"⚠️  Database initialization warning: {e}")
        # Continue anyway - tables might already exist

# Add CORS middleware with support for Vercel preview deployments
def get_cors_origins():
    """Get CORS origins, including Vercel preview deployments."""
    origins = config.cors_origins.copy()
    
    # Add common Vercel patterns (you can add specific preview URLs here)
    # Vercel preview deployments use patterns like:
    # - https://your-app-git-branch-username.vercel.app
    # - https://your-app-*.vercel.app
    # For now, we'll use the configured origins and you can add specific preview URLs
    
    return origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add rate limiting with user-based key function
def get_user_id_for_rate_limit(request: Request) -> str:
    """
    Get user ID for rate limiting (if authenticated), otherwise use IP address.
    
    This allows per-user rate limiting for authenticated requests,
    while falling back to IP-based limiting for anonymous requests.
    """
    try:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header.replace("Bearer ", "")
            from src.auth_service import verify_token
            from api.config import config
            import os
            payload = verify_token(token, token_type="access")
            user_id = payload.get("sub")
            if user_id:
                return f"user:{user_id}"
    except Exception:
        pass
    # Fallback to IP address
    return get_remote_address(request)

limiter = Limiter(key_func=get_user_id_for_rate_limit)
app.state.limiter = limiter

# Custom rate limit exception handler with security logging
@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    """Handle rate limit exceeded with security logging."""
    try:
        # Get database session for logging
        from api.dependencies import SessionLocal
        db = SessionLocal()
        try:
            ip_address = get_client_ip(request)
            user_agent = get_user_agent(request)
            
            # Try to get user ID if authenticated
            user_id = None
            try:
                auth_header = request.headers.get("Authorization", "")
                if auth_header.startswith("Bearer "):
                    token = auth_header.replace("Bearer ", "")
                    payload = verify_token(token, token_type="access")
                    user_id = int(payload.get("sub"))
            except Exception:
                pass
            
            # Log rate limit exceeded event
            log_security_event(
                db=db,
                event_type="rate_limit_exceeded",
                user_id=user_id,
                ip_address=ip_address,
                details={
                    "endpoint": str(request.url.path),
                    "method": request.method,
                    "limit": str(exc.detail) if hasattr(exc, 'detail') else "unknown"
                },
                severity="warning",
                user_agent=user_agent
            )
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Error logging rate limit event: {e}")
    
    # Use default handler
    return _rate_limit_exceeded_handler(request, exc)

app.add_exception_handler(RateLimitExceeded, rate_limit_handler)

# Add security headers and rate limit headers middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    """Add security headers and rate limit headers to all responses."""
    response = await call_next(request)
    
    # Security headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    
    # Rate limit headers (if rate limiting is enabled)
    if config.rate_limit_enabled:
        try:
            # Get rate limit info from limiter state
            key = get_user_id_for_rate_limit(request)
            # Note: slowapi doesn't expose rate limit info directly,
            # but we can add headers indicating rate limiting is active
            response.headers["X-RateLimit-Enabled"] = "true"
        except Exception:
            pass
    
    return response


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
# Authentication Endpoints
# ============================================================================

@app.post("/api/auth/register", response_model=MessageResponse, status_code=status.HTTP_201_CREATED, tags=["Authentication"])
@limiter.limit("10/minute")
def register(
    request: Request,
    email: str = Form(...),
    password: str = Form(..., min_length=8),
    full_name: Optional[str] = Form(None),
    db: Session = Depends(get_db)
) -> MessageResponse:
    """
    Register a new user account.
    
    Security: Logs registration attempts for audit trail.
    
    - **email**: User email address (must be unique)
    - **password**: Password (minimum 8 characters)
    - **full_name**: Optional full name
    """
    ip_address = get_client_ip(request)
    user_agent = get_user_agent(request)
    
    try:
        user = create_user(db, email, password, full_name)
        
        # Log successful registration
        log_security_event(
            db=db,
            event_type="registration_success",
            user_id=user.id,
            ip_address=ip_address,
            details={"email": email, "full_name": full_name},
            severity="info",
            user_agent=user_agent
        )
        
        return MessageResponse(
            message="User registered successfully",
            details={"user_id": user.id, "email": user.email}
        )
    except HTTPException as e:
        # Log failed registration attempt
        log_security_event(
            db=db,
            event_type="registration_failed",
            user_id=None,
            ip_address=ip_address,
            details={"email": email, "error": str(e.detail)},
            severity="warning",
            user_agent=user_agent
        )
        raise
    except Exception as e:
        logger.error(f"Registration error: {e}", exc_info=True)
        
        # Log registration error
        log_security_event(
            db=db,
            event_type="registration_error",
            user_id=None,
            ip_address=ip_address,
            details={"email": email, "error": str(e)},
            severity="error",
            user_agent=user_agent
        )
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Registration failed: {str(e)}"
        )


@app.post("/api/auth/login", response_model=TokenResponse, tags=["Authentication"])
@limiter.limit("5/minute")
def login(
    request: Request,
    email: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db)
) -> TokenResponse:
    """
    Login and get access/refresh tokens.
    
    Security: Logs all login attempts (success and failure) for audit trail.
    
    - **email**: User email address
    - **password**: User password
    
    Returns JWT access token and refresh token.
    """
    ip_address = get_client_ip(request)
    user_agent = get_user_agent(request)
    
    # Log login attempt
    log_security_event(
        db=db,
        event_type="login_attempt",
        user_id=None,
        ip_address=ip_address,
        details={"email": email},
        severity="info",
        user_agent=user_agent
    )
    
    user = authenticate_user(db, email, password)
    if not user:
        # Log failed login
        log_security_event(
            db=db,
            event_type="login_failed",
            user_id=None,
            ip_address=ip_address,
            details={"email": email, "reason": "invalid_credentials"},
            severity="warning",
            user_agent=user_agent
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    # Update last login
    user.last_login = datetime.utcnow()
    db.commit()
    
    # Create tokens
    access_token = create_access_token(data={"sub": str(user.id), "email": user.email, "role": user.role})
    refresh_token = create_refresh_token(data={"sub": str(user.id)})
    
    # Store refresh token
    store_refresh_token(db, user.id, refresh_token)
    
    # Log successful login
    log_security_event(
        db=db,
        event_type="login_success",
        user_id=user.id,
        ip_address=ip_address,
        details={"email": email, "role": user.role},
        severity="info",
        user_agent=user_agent
    )
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        user=user.to_dict()
    )


@app.post("/api/auth/refresh", response_model=RefreshTokenResponse, tags=["Authentication"])
@limiter.limit("10/minute")
def refresh_token_endpoint(
    request: Request,
    refresh_token: str = Form(...),
    db: Session = Depends(get_db)
) -> RefreshTokenResponse:
    """
    Refresh access token using refresh token.
    
    - **refresh_token**: Valid refresh token
    
    Returns new access token.
    """
    # Verify refresh token
    payload = verify_token(refresh_token, token_type="refresh")
    user_id = int(payload.get("sub"))
    
    # Check if token is valid in database
    token_hash = hash_refresh_token(refresh_token)
    token_record = get_valid_refresh_token(db, token_hash)
    
    if not token_record:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token"
        )
    
    # Get user
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive"
        )
    
    # Create new access token
    access_token = create_access_token(data={"sub": str(user.id), "email": user.email, "role": user.role})
    
    return RefreshTokenResponse(
        access_token=access_token,
        token_type="bearer"
    )


@app.post("/api/auth/logout", response_model=MessageResponse, tags=["Authentication"])
@limiter.limit("10/minute")
def logout(
    request: Request,
    refresh_token: str = Form(...),
    db: Session = Depends(get_db)
) -> MessageResponse:
    """
    Logout and revoke refresh token.
    
    - **refresh_token**: Refresh token to revoke
    """
    token_hash = hash_refresh_token(refresh_token)
    if revoke_refresh_token(db, token_hash):
        return MessageResponse(message="Logged out successfully")
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Invalid refresh token"
    )


@app.get("/api/auth/me", response_model=UserResponse, tags=["Authentication"])
def get_current_user_info(
    current_user: User = Depends(get_current_user)
) -> UserResponse:
    """
    Get current authenticated user information.
    
    Returns user details for the authenticated user.
    """
    try:
        # Use from_attributes=True to convert SQLAlchemy model directly
        # This is more efficient than converting to dict first
        return UserResponse.model_validate(current_user)
    except Exception as e:
        logger.error(f"Error getting current user info: {e}", exc_info=True)
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve user information: {str(e)}"
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
@limiter.limit("100/minute")
def get_inventory(
    request: Request,
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum records to return"),
    location: Optional[str] = Query(None, description="Filter by storage location"),
    status: Optional[str] = Query(None, description="Filter by status"),
    pantry_id: Optional[int] = Query(None, description="Filter by pantry ID"),
    current_user: User = Depends(get_current_user),
    service: PantryService = Depends(get_pantry_service)
) -> List[Dict]:
    """
    Get all inventory items with optional filtering.
    
    - **skip**: Number of records to skip (pagination)
    - **limit**: Maximum number of records to return
    - **location**: Filter by storage location (pantry/fridge/freezer)
    - **status**: Filter by item status (in_stock/low/expired/consumed)
    - **pantry_id**: Filter by pantry ID (optional, defaults to user's default pantry if not specified)
    """
    try:
        # If pantry_id not specified, use default pantry
        if pantry_id is None and current_user:
            default_pantry = service.get_or_create_default_pantry(current_user.id)
            pantry_id = default_pantry.id
        
        # Filter by user_id and pantry_id
        items = service.get_all_inventory(
            user_id=current_user.id if current_user else None,
            pantry_id=pantry_id
        )
        
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
@limiter.limit("20/minute")
def create_inventory_item(
    request: Request,
    item_data: InventoryItemCreate,
    current_user: User = Depends(get_current_user),
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
        
        # Get or create default pantry if pantry_id not provided
        pantry_id = item_data.pantry_id
        if pantry_id is None:
            default_pantry = service.get_or_create_default_pantry(current_user.id)
            pantry_id = default_pantry.id
        
        item = service.add_inventory_item(
            product_id=item_data.product_id,
            quantity=item_data.quantity,
            unit=item_data.unit,
            purchase_date=item_data.purchase_date,
            expiration_date=item_data.expiration_date,
            storage_location=item_data.storage_location,
            image_path=item_data.image_path,
            notes=item_data.notes,
            status=item_data.status,
            user_id=current_user.id,
            pantry_id=pantry_id
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
    current_user: User = Depends(get_current_user),
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
        
        # Ensure user can only update their own items
        if item.user_id and item.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only update your own inventory items"
            )
        
        # Update only provided fields
        update_data = item_data.model_dump(exclude_unset=True)
        
        # Convert date objects to strings for the service method
        if 'purchase_date' in update_data and update_data['purchase_date']:
            if isinstance(update_data['purchase_date'], date):
                update_data['purchase_date'] = update_data['purchase_date'].isoformat()
        if 'expiration_date' in update_data and update_data['expiration_date']:
            if isinstance(update_data['expiration_date'], date):
                update_data['expiration_date'] = update_data['expiration_date'].isoformat()
        
        # If product_id is being updated, verify it exists
        if 'product_id' in update_data:
            product = service.get_product_by_id(update_data['product_id'])
            if not product:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Product with ID {update_data['product_id']} not found"
                )
        
        # If pantry_id is being updated, verify it belongs to the user
        if 'pantry_id' in update_data and update_data['pantry_id'] is not None:
            pantry = service.get_pantry(update_data['pantry_id'], current_user.id)
            if not pantry:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Pantry with ID {update_data['pantry_id']} not found"
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
# Pantry Endpoints
# ============================================================================

@app.post("/api/pantries", response_model=PantryResponse, tags=["Pantries"])
@limiter.limit("20/minute")
def create_pantry(
    request: Request,
    pantry_data: PantryCreate,
    current_user: User = Depends(get_current_user),
    service: PantryService = Depends(get_pantry_service)
) -> PantryResponse:
    """
    Create a new pantry for the current user.
    
    - **name**: Pantry name (required)
    - **description**: Optional description
    - **location**: Optional location/address
    - **is_default**: Whether this should be the default pantry
    """
    try:
        pantry = service.create_pantry(
            user_id=current_user.id,
            name=pantry_data.name,
            description=pantry_data.description,
            location=pantry_data.location,
            is_default=pantry_data.is_default
        )
        logger.info(f"Created pantry '{pantry.name}' for user {current_user.id}")
        return pantry
        
    except Exception as e:
        logger.error(f"Error creating pantry: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create pantry"
        )


@app.get("/api/pantries", response_model=List[PantryResponse], tags=["Pantries"])
@limiter.limit("100/minute")
def get_pantries(
    request: Request,
    current_user: User = Depends(get_current_user),
    service: PantryService = Depends(get_pantry_service)
) -> List[PantryResponse]:
    """
    Get all pantries for the current user.
    
    Returns list of pantries, with default pantry first.
    """
    try:
        pantries = service.get_user_pantries(current_user.id)
        
        # If user has no pantries, create a default one
        if not pantries:
            default_pantry = service.get_or_create_default_pantry(current_user.id)
            pantries = [default_pantry]
        
        logger.info(f"Retrieved {len(pantries)} pantries for user {current_user.id}")
        return pantries
        
    except Exception as e:
        logger.error(f"Error retrieving pantries: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve pantries"
        )


@app.get("/api/pantries/{pantry_id}", response_model=PantryResponse, tags=["Pantries"])
@limiter.limit("100/minute")
def get_pantry(
    request: Request,
    pantry_id: int,
    current_user: User = Depends(get_current_user),
    service: PantryService = Depends(get_pantry_service)
) -> PantryResponse:
    """
    Get a specific pantry by ID.
    
    - **pantry_id**: Pantry ID
    """
    try:
        pantry = service.get_pantry(pantry_id, current_user.id)
        if not pantry:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Pantry with ID {pantry_id} not found"
            )
        
        return pantry
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving pantry {pantry_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve pantry"
        )


@app.get("/api/pantries/default", response_model=PantryResponse, tags=["Pantries"])
@limiter.limit("100/minute")
def get_default_pantry(
    request: Request,
    current_user: User = Depends(get_current_user),
    service: PantryService = Depends(get_pantry_service)
) -> PantryResponse:
    """
    Get or create the default pantry for the current user.
    
    If no default pantry exists, creates one named "Home".
    """
    try:
        pantry = service.get_or_create_default_pantry(current_user.id)
        return pantry
        
    except Exception as e:
        logger.error(f"Error getting default pantry: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get default pantry"
        )


@app.put("/api/pantries/{pantry_id}", response_model=PantryResponse, tags=["Pantries"])
@limiter.limit("20/minute")
def update_pantry(
    request: Request,
    pantry_id: int,
    pantry_data: PantryUpdate,
    current_user: User = Depends(get_current_user),
    service: PantryService = Depends(get_pantry_service)
) -> PantryResponse:
    """
    Update a pantry.
    
    - **pantry_id**: Pantry ID
    - Only provided fields will be updated
    """
    try:
        pantry = service.update_pantry(
            pantry_id=pantry_id,
            user_id=current_user.id,
            name=pantry_data.name,
            description=pantry_data.description,
            location=pantry_data.location,
            is_default=pantry_data.is_default
        )
        
        if not pantry:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Pantry with ID {pantry_id} not found"
            )
        
        logger.info(f"Updated pantry ID {pantry_id}")
        return pantry
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating pantry {pantry_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update pantry"
        )


@app.delete("/api/pantries/{pantry_id}", response_model=MessageResponse, tags=["Pantries"])
@limiter.limit("20/minute")
def delete_pantry(
    request: Request,
    pantry_id: int,
    current_user: User = Depends(get_current_user),
    service: PantryService = Depends(get_pantry_service)
) -> MessageResponse:
    """
    Delete a pantry.
    
    Note: Inventory items in this pantry will have pantry_id set to NULL.
    
    - **pantry_id**: Pantry ID
    """
    try:
        deleted = service.delete_pantry(pantry_id, current_user.id)
        
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Pantry with ID {pantry_id} not found"
            )
        
        logger.info(f"Deleted pantry ID {pantry_id}")
        return MessageResponse(
            message=f"Pantry {pantry_id} deleted successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting pantry {pantry_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete pantry"
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
# Image Processing & Source Directory Management
# ============================================================================

@app.get("/api/config/source-directory", tags=["Configuration"])
def get_source_directory() -> Dict:
    """Get the configured source images directory."""
    source_dir = os.getenv("SOURCE_IMAGES_DIR", str(Path.home() / "Pictures" / "Pantry"))
    return {
        "source_directory": source_dir,
        "exists": os.path.exists(source_dir),
        "is_directory": os.path.isdir(source_dir) if os.path.exists(source_dir) else False
    }


@app.post("/api/config/source-directory", tags=["Configuration"])
def set_source_directory(request: Dict) -> Dict:
    """Set the source images directory."""
    try:
        directory = request.get("directory")
        if not directory:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Directory parameter is required"
            )
        
        dir_path = Path(directory).expanduser().resolve()
        
        if not dir_path.exists():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Directory does not exist: {directory}"
            )
        
        if not dir_path.is_dir():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Path is not a directory: {directory}"
            )
        
        # Store in environment or config file (for now, just validate)
        # In production, you'd want to persist this to a config file
        return {
            "source_directory": str(dir_path),
            "message": "Source directory set successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error setting source directory: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to set source directory: {str(e)}"
        )


@app.post("/api/inventory/process-image", tags=["Inventory"])
@limiter.limit("10/minute")
def process_single_image(
    request: Request,
    file: UploadFile = File(...),
    storage_location: str = Form("pantry"),
    current_user: User = Depends(get_current_user),
    service: PantryService = Depends(get_pantry_service),
    db: Session = Depends(get_db)
) -> Dict:
    """
    Process a single uploaded image through OCR and AI analysis.
    
    Security: Enhanced file validation and security event logging.
    """
    ip_address = get_client_ip(request)
    user_agent = get_user_agent(request)
    
    try:
        # Validate storage_location
        if storage_location not in ["pantry", "fridge", "freezer"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="storage_location must be one of: pantry, fridge, freezer"
            )
        
        # Enhanced file validation (Phase 2 security)
        try:
            validate_image_file(file)
        except HTTPException as e:
            # Log file validation failure
            log_security_event(
                db=db,
                event_type="file_upload_validation_failed",
                user_id=current_user.id,
                ip_address=ip_address,
                details={
                    "filename": file.filename,
                    "content_type": file.content_type,
                    "error": str(e.detail)
                },
                severity="warning",
                user_agent=user_agent
            )
            raise
        except Exception as e:
            logger.error(f"File validation error: {e}", exc_info=True)
            log_security_event(
                db=db,
                event_type="file_upload_validation_error",
                user_id=current_user.id,
                ip_address=ip_address,
                details={
                    "filename": file.filename,
                    "error": str(e)
                },
                severity="error",
                user_agent=user_agent
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File validation failed: {str(e)}"
            )
        
        # Save uploaded file temporarily
        try:
            suffix = Path(file.filename).suffix if file.filename else '.jpg'
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp_file:
                shutil.copyfileobj(file.file, tmp_file)
                tmp_path = Path(tmp_file.name)
        except Exception as e:
            logger.error(f"Error saving uploaded file: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to save uploaded file: {str(e)}"
            )
        
        try:
            # Initialize services with error handling
            try:
                ocr_service = create_ocr_service()
            except Exception as e:
                logger.error(f"Failed to initialize OCR service: {e}", exc_info=True)
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"OCR service unavailable: {str(e)}"
                )
            
            try:
                ai_analyzer = create_ai_analyzer()
            except Exception as e:
                logger.error(f"Failed to initialize AI analyzer: {e}", exc_info=True)
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"AI analyzer unavailable: {str(e)}"
                )
            
            # Run OCR
            logger.info(f"Processing image: {file.filename}")
            try:
                ocr_result = ocr_service.extract_text(str(tmp_path))
            except Exception as e:
                logger.error(f"OCR extraction failed: {e}", exc_info=True)
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"OCR extraction failed: {str(e)}"
                )
            ocr_confidence = ocr_result.get("confidence", 0)
            
            if not ocr_result.get("raw_text", "").strip():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No text extracted from image. Please ensure the image contains readable product labels."
                )
            
            # Run AI analysis
            try:
                product_data = ai_analyzer.analyze_product(ocr_result)
                ai_confidence = product_data.confidence
            except Exception as e:
                logger.error(f"AI analysis failed: {e}", exc_info=True)
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"AI analysis failed: {str(e)}"
                )
            
            if not product_data.product_name:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Could not identify product from image. Please try a clearer image."
                )
            
            # Create or get product
            product = service.add_product(
                product_name=product_data.product_name,
                brand=product_data.brand,
                category=product_data.category or "Other",
                subcategory=product_data.subcategory
            )
            
            # Parse expiration date if available
            exp_date = None
            if product_data.expiration_date:
                try:
                    # Handle different date formats
                    date_str = str(product_data.expiration_date)
                    if "Z" in date_str:
                        date_str = date_str.replace("Z", "+00:00")
                    exp_date = datetime.fromisoformat(date_str).date()
                except (ValueError, AttributeError, TypeError) as e:
                    logger.warning(f"Could not parse expiration date: {product_data.expiration_date}, error: {e}")
                    exp_date = None
            
            # Get or create default pantry for user
            default_pantry = service.get_or_create_default_pantry(current_user.id)
            
            # Create inventory item
            item = service.add_inventory_item(
                product_id=product.id,
                quantity=1.0,
                unit="count",
                storage_location=storage_location,
                expiration_date=exp_date,
                image_path=file.filename,
                notes=f"Processed from uploaded image",
                user_id=current_user.id,
                pantry_id=default_pantry.id
            )
            
            # Create processing log
            service.add_processing_log(
                image_path=file.filename,
                ocr_confidence=ocr_confidence,
                ai_confidence=ai_confidence,
                status="success" if ai_confidence >= 0.6 else "manual_review",
                raw_ocr_data=ocr_result,
                raw_ai_data=product_data.to_dict(),
                inventory_item_id=item.id
            )
            
            # Enrich response
            # Refresh item to ensure relationship is loaded
            service.session.refresh(item)
            result = enrich_inventory_item(item)
            
            logger.info(f"Successfully processed image: {product_data.product_name}")
            
            # Log successful file upload
            log_security_event(
                db=db,
                event_type="file_upload_success",
                user_id=current_user.id,
                ip_address=ip_address,
                details={
                    "filename": file.filename,
                    "product_name": product_data.product_name,
                    "file_size": file.size if hasattr(file, 'size') else None,
                    "ocr_confidence": ocr_confidence,
                    "ai_confidence": ai_confidence
                },
                severity="info",
                user_agent=user_agent
            )
            
            return {
                "success": True,
                "message": f"Successfully processed {product_data.product_name}",
                "item": result,
                "confidence": {
                    "ocr": ocr_confidence,
                    "ai": ai_confidence,
                    "combined": (ocr_confidence + ai_confidence) / 2
                }
            }
            
        finally:
            # Clean up temporary file
            if tmp_path.exists():
                tmp_path.unlink()
                
    except HTTPException as e:
        # Log HTTP exceptions (validation errors, etc.)
        log_security_event(
            db=db,
            event_type="file_upload_failed",
            user_id=current_user.id if 'current_user' in locals() else None,
            ip_address=ip_address if 'ip_address' in locals() else get_client_ip(request),
            details={
                "filename": file.filename if file else None,
                "error": str(e.detail),
                "status_code": e.status_code
            },
            severity="warning",
            user_agent=user_agent if 'user_agent' in locals() else get_user_agent(request)
        )
        raise
    except Exception as e:
        logger.error(f"Error processing image: {e}", exc_info=True)
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        
        # Log file upload error
        log_security_event(
            db=db,
            event_type="file_upload_error",
            user_id=current_user.id if 'current_user' in locals() else None,
            ip_address=ip_address if 'ip_address' in locals() else get_client_ip(request),
            details={
                "filename": file.filename if file else None,
                "error": str(e)
            },
            severity="error",
            user_agent=user_agent if 'user_agent' in locals() else get_user_agent(request)
        )
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process image: {str(e)}"
        )


@app.post("/api/inventory/refresh", tags=["Inventory"])
def refresh_inventory(
    request: Dict,
    service: PantryService = Depends(get_pantry_service)
) -> Dict:
    """Refresh inventory by processing all images in the source directory."""
    try:
        # Get parameters from request
        source_directory = request.get("source_directory")
        storage_location = request.get("storage_location", "pantry")
        min_confidence = request.get("min_confidence", 0.6)
        
        # Validate storage_location
        if storage_location not in ["pantry", "fridge", "freezer"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="storage_location must be one of: pantry, fridge, freezer"
            )
        
        # Validate min_confidence
        if not isinstance(min_confidence, (int, float)) or min_confidence < 0.0 or min_confidence > 1.0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="min_confidence must be between 0.0 and 1.0"
            )
        
        # Get source directory
        if not source_directory:
            source_directory = os.getenv("SOURCE_IMAGES_DIR", str(Path.home() / "Pictures" / "Pantry"))
        
        source_dir = Path(source_directory).expanduser().resolve()
        
        if not source_dir.exists():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Source directory does not exist: {source_directory}"
            )
        
        if not source_dir.is_dir():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Path is not a directory: {source_directory}"
            )
        
        # Find all images
        image_files = list(source_dir.glob("*.jpg")) + list(source_dir.glob("*.jpeg"))
        image_files.sort()
        
        if not image_files:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No images found in {source_directory}"
            )
        
        # Initialize services
        ocr_service = create_ocr_service()
        ai_analyzer = create_ai_analyzer()
        
        # Get existing processed images from logs
        existing_logs = service.get_processing_logs(limit=10000)
        processed_images = {log.image_path for log in existing_logs if log.image_path}
        
        # Process images
        results = {
            "processed": 0,
            "skipped": 0,
            "failed": 0,
            "items_created": 0,
            "items_updated": 0,
            "errors": []
        }
        
        for image_path in image_files:
            image_name = image_path.name
            
            # Skip if already processed
            if image_name in processed_images:
                results["skipped"] += 1
                continue
            
            try:
                # Run OCR
                ocr_result = ocr_service.extract_text(str(image_path))
                ocr_confidence = ocr_result.get("confidence", 0)
                
                if not ocr_result.get("raw_text", "").strip():
                    results["skipped"] += 1
                    continue
                
                # Run AI analysis
                product_data = ai_analyzer.analyze_product(ocr_result)
                ai_confidence = product_data.confidence
                
                # Check confidence threshold
                if ai_confidence < min_confidence:
                    results["skipped"] += 1
                    continue
                
                if not product_data.product_name:
                    results["skipped"] += 1
                    continue
                
                # Create or get product
                product = service.add_product(
                    product_name=product_data.product_name,
                    brand=product_data.brand,
                    category=product_data.category or "Other",
                    subcategory=product_data.subcategory
                )
                
                # Parse expiration date if available
                exp_date = None
                if product_data.expiration_date:
                    try:
                        from datetime import datetime
                        exp_date = datetime.fromisoformat(product_data.expiration_date.replace("Z", "+00:00"))
                    except (ValueError, AttributeError):
                        pass
                
                # Create inventory item
                item = service.add_inventory_item(
                    product_id=product.id,
                    quantity=1.0,
                    unit="count",
                    storage_location=storage_location,
                    expiration_date=exp_date,
                    image_path=image_name,
                    notes=f"Processed from {source_directory}"
                )
                
                # Create processing log
                service.add_processing_log(
                    image_path=image_name,
                    ocr_confidence=ocr_confidence,
                    ai_confidence=ai_confidence,
                    status="success" if ai_confidence >= 0.6 else "manual_review",
                    raw_ocr_data=ocr_result,
                    raw_ai_data=product_data.to_dict(),
                    inventory_item_id=item.id
                )
                
                results["processed"] += 1
                results["items_created"] += 1
                
            except Exception as e:
                results["failed"] += 1
                results["errors"].append({
                    "image": image_name,
                    "error": str(e)
                })
                logger.error(f"Error processing {image_name}: {e}")
        
        logger.info(f"Refresh complete: {results['processed']} processed, {results['skipped']} skipped, {results['failed']} failed")
        return {
            "success": True,
            "message": f"Processed {results['processed']} images",
            "source_directory": str(source_dir),
            "results": results
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error refreshing inventory: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to refresh inventory: {str(e)}"
        )


# ============================================================================
# Recipe Generation Endpoints
# ============================================================================

@app.post("/api/recipes/generate-one", response_model=RecipeResponse, tags=["Recipes"])
@limiter.limit(f"{config.rate_limit_recipe_per_hour}/hour")
def generate_single_recipe(
    request: Request,
    recipe_request: SingleRecipeRequest,
    current_user: User = Depends(get_current_user),
    service: PantryService = Depends(get_pantry_service)
) -> Dict:
    """
    Generate a single recipe (for incremental display).
    
    Uses the user's default pantry if pantry_id is not specified in the request.
    """
    try:
        # Get pantry_id from request or use default
        pantry_id = recipe_request.pantry_id
        if pantry_id is None and current_user:
            default_pantry = service.get_or_create_default_pantry(current_user.id)
            pantry_id = default_pantry.id
        
        # Get inventory items filtered by pantry
        all_items = service.get_all_inventory(
            user_id=current_user.id if current_user else None,
            pantry_id=pantry_id
        )
        available_items = [item for item in all_items if item.status == "in_stock"]
        
        if not available_items:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No items in stock. Add items to your pantry first."
            )
        
        # Filter out excluded ingredients
        excluded_names = set(recipe_request.excluded_ingredients or [])
        filtered_items = []
        for item in available_items:
            product_name = item.product.product_name if item.product else None
            if product_name and product_name not in excluded_names:
                filtered_items.append(item)
        
        if not filtered_items:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No available ingredients after applying exclusions."
            )
        
        # Verify required ingredients are available
        if recipe_request.required_ingredients:
            required_names = set(recipe_request.required_ingredients)
            available_names = {item.product.product_name for item in filtered_items if item.product}
            missing_required = required_names - available_names
            
            if missing_required:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Required ingredients not available: {', '.join(missing_required)}"
                )
        
        # Convert to format expected by RecipeGenerator
        pantry_items = []
        for item in filtered_items:
            product_name = item.product.product_name if item.product else "Unknown"
            brand = item.product.brand if item.product else None
            
            pantry_items.append({
                "product": {
                    "product_name": product_name,
                    "brand": brand
                }
            })
        
        # Extract ingredient list (all available, minus excluded)
        ingredient_list = []
        for item in pantry_items:
            product = item['product']
            name = product['product_name']
            brand = product.get('brand')
            if brand:
                ingredient_list.append(f"{brand} {name}")
            else:
                ingredient_list.append(name)
        
        # Extract required ingredient names (for prompt)
        required_ingredient_names = None
        if recipe_request.required_ingredients:
            required_ingredient_names = []
            for item in pantry_items:
                product = item['product']
                name = product['product_name']
                if name in recipe_request.required_ingredients:
                    brand = product.get('brand')
                    if brand:
                        required_ingredient_names.append(f"{brand} {name}")
                    else:
                        required_ingredient_names.append(name)
        
        # Initialize AI analyzer and recipe generator
        ai_analyzer = create_ai_analyzer()
        recipe_generator = RecipeGenerator(ai_analyzer)
        
        # Generate single recipe
        logger.info(f"Generating 1 recipe from {len(pantry_items)} ingredients")
        recipe = recipe_generator._generate_single_recipe(
            ingredients=ingredient_list,
            cuisine=recipe_request.cuisine,
            difficulty=recipe_request.difficulty,
            dietary_restrictions=recipe_request.dietary_restrictions,
            avoid_previous=recipe_request.avoid_names or [],
            required_ingredients=required_ingredient_names,
            excluded_ingredients=recipe_request.excluded_ingredients,
            allow_missing_ingredients=recipe_request.allow_missing_ingredients
        )
        
        if not recipe:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to generate recipe"
            )
        
        # Convert to response format
        used_ingredients = []
        for ing in recipe.get('ingredients', []):
            if isinstance(ing, dict):
                used_ingredients.append(ing.get('item', ing.get('name', '')))
            else:
                used_ingredients.append(str(ing))
        
        result = {
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
            "missing_ingredients": recipe.get('missing_ingredients', []),
            "flavor_pairings": recipe.get('flavor_pairings', [])
        }
        
        logger.info(f"Successfully generated recipe: {result['name']}")
        return result
        
    except HTTPException:
        raise
    except ValueError as e:
        if "No AI backends available" in str(e):
            logger.error("AI API keys not configured")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="AI service not available. Please configure OpenAI or Anthropic API key in .env file."
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error generating recipe: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate recipe: {str(e)}"
        )


@app.post("/api/recipes/generate", response_model=List[RecipeResponse], tags=["Recipes"])
@limiter.limit(f"{config.rate_limit_recipe_per_hour}/hour")
def generate_recipes(
    request: Request,
    recipe_request: RecipeRequest,
    current_user: User = Depends(get_current_user),
    service: PantryService = Depends(get_pantry_service)
) -> List[Dict]:
    """
    Generate AI-powered recipes using available pantry ingredients.
    
    - **required_ingredients**: Optional list of ingredient names that must be included. Recipes can also use other available ingredients.
    - **excluded_ingredients**: Optional list of ingredient names to exclude from recipes.
    - **max_recipes**: Number of recipes to generate (1-20)
    - **cuisine**: Optional cuisine type (italian, mexican, asian, etc.)
    - **difficulty**: Optional difficulty level (easy, medium, hard)
    - **dietary_restrictions**: Optional list of dietary restrictions
    - **allow_missing_ingredients**: If True, allow recipes to include 2-4 ingredients not in pantry (will be listed as missing)
    - **pantry_id**: Optional pantry ID (defaults to user's default pantry)
    """
    try:
        # Get pantry_id from request or use default
        pantry_id = recipe_request.pantry_id
        if pantry_id is None and current_user:
            default_pantry = service.get_or_create_default_pantry(current_user.id)
            pantry_id = default_pantry.id
        
        # Get inventory items filtered by pantry
        all_items = service.get_all_inventory(
            user_id=current_user.id if current_user else None,
            pantry_id=pantry_id
        )
        
        # Filter to in_stock items only
        available_items = [item for item in all_items if item.status == "in_stock"]
        
        if not available_items:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No items in stock. Add items to your pantry first."
            )
        
        # Filter out excluded ingredients
        excluded_names = set(recipe_request.excluded_ingredients or [])
        filtered_items = []
        for item in available_items:
            product_name = item.product.product_name if item.product else None
            if product_name and product_name not in excluded_names:
                filtered_items.append(item)
        
        if not filtered_items:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No available ingredients after applying exclusions."
            )
        
        # Verify required ingredients are available
        if recipe_request.required_ingredients:
            required_names = set(recipe_request.required_ingredients)
            available_names = {item.product.product_name for item in filtered_items if item.product}
            missing_required = required_names - available_names
            
            if missing_required:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Required ingredients not available: {', '.join(missing_required)}"
                )
        
        # Convert to format expected by RecipeGenerator
        pantry_items = []
        for item in filtered_items:
            product_name = item.product.product_name if item.product else "Unknown"
            brand = item.product.brand if item.product else None
            
            pantry_items.append({
                "product": {
                    "product_name": product_name,
                    "brand": brand
                }
            })
        
        # Extract required ingredient names (for prompt)
        required_ingredient_names = None
        if recipe_request.required_ingredients:
            required_ingredient_names = []
            for item in pantry_items:
                product = item['product']
                name = product['product_name']
                if name in recipe_request.required_ingredients:
                    brand = product.get('brand')
                    if brand:
                        required_ingredient_names.append(f"{brand} {name}")
                    else:
                        required_ingredient_names.append(name)
        
        # Initialize AI analyzer and recipe generator
        ai_analyzer = create_ai_analyzer()
        recipe_generator = RecipeGenerator(ai_analyzer)
        
        # Generate recipes
        logger.info(f"Generating {recipe_request.max_recipes} recipes from {len(pantry_items)} ingredients")
        recipes = recipe_generator.generate_recipes(
            pantry_items=pantry_items,
            num_recipes=recipe_request.max_recipes,
            cuisine=recipe_request.cuisine,
            difficulty=recipe_request.difficulty,
            dietary_restrictions=recipe_request.dietary_restrictions,
            required_ingredients=required_ingredient_names,
            excluded_ingredients=recipe_request.excluded_ingredients,
            allow_missing_ingredients=recipe_request.allow_missing_ingredients
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
                "missing_ingredients": recipe.get('missing_ingredients', []),
                "flavor_pairings": recipe.get('flavor_pairings', [])
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
    current_user: User = Depends(get_current_user),
    service: PantryService = Depends(get_pantry_service)
) -> Dict:
    """
    Save a recipe to the recipe box.
    
    Saves a recipe for later viewing. Can be a generated recipe or custom recipe.
    """
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
    current_user: User = Depends(get_current_user),
    service: PantryService = Depends(get_pantry_service)
) -> List[Dict]:
    """
    Get all saved recipes from recipe box.
    
    Returns only recipes for the current authenticated user.
    
    - **cuisine**: Optional cuisine filter
    - **difficulty**: Optional difficulty filter
    - **limit**: Maximum number of recipes to return
    """
    try:
        recipes = service.get_saved_recipes(
            user_id=current_user.id,
            cuisine=cuisine,
            difficulty=difficulty,
            limit=limit
        )
        
        # Convert recipes to dict, handling any serialization issues
        result = []
        for recipe in recipes:
            try:
                recipe_dict = recipe.to_dict()
                result.append(recipe_dict)
            except Exception as e:
                logger.warning(f"Error serializing recipe {recipe.id}: {e}")
                # Try alternative serialization
                try:
                    result.append(SavedRecipeResponse.model_validate(recipe).model_dump())
                except Exception as e2:
                    logger.error(f"Failed to serialize recipe {recipe.id}: {e2}")
                    # Skip this recipe
                    continue
        
        logger.info(f"Retrieved {len(result)} saved recipes")
        return result
        
    except Exception as e:
        logger.error(f"Error retrieving saved recipes: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve saved recipes: {str(e)}"
        )


@app.get("/api/recipes/saved/{recipe_id}", response_model=SavedRecipeResponse, tags=["Recipes"])
def get_saved_recipe(
    recipe_id: int,
    current_user: User = Depends(get_current_user),
    service: PantryService = Depends(get_pantry_service)
) -> Dict:
    """
    Get a specific saved recipe by ID.
    
    Returns only if the recipe belongs to the current authenticated user.
    
    - **recipe_id**: Recipe ID to retrieve
    """
    try:
        recipe = service.get_saved_recipe(recipe_id)
        if not recipe:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Recipe with ID {recipe_id} not found"
            )
        
        # Ensure recipe belongs to current user
        if recipe.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to access this recipe"
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
    current_user: User = Depends(get_current_user),
    service: PantryService = Depends(get_pantry_service)
) -> Dict:
    """
    Update a saved recipe (notes, rating, tags).
    
    Only allows updating recipes that belong to the current authenticated user.
    
    - **recipe_id**: Recipe ID to update
    """
    try:
        recipe = service.get_saved_recipe(recipe_id)
        if not recipe:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Recipe with ID {recipe_id} not found"
            )
        
        # Ensure recipe belongs to current user
        if recipe.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to update this recipe"
            )
        
        updated_recipe = service.update_saved_recipe(
            recipe_id=recipe_id,
            notes=recipe_data.notes,
            rating=recipe_data.rating,
            tags=recipe_data.tags
        )
        
        logger.info(f"Updated recipe ID {recipe_id}")
        return updated_recipe.to_dict()
        
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
    current_user: User = Depends(get_current_user),
    service: PantryService = Depends(get_pantry_service)
) -> MessageResponse:
    """
    Delete a saved recipe.
    
    Only allows deleting recipes that belong to the current authenticated user.
    
    - **recipe_id**: Recipe ID to delete
    """
    try:
        recipe = service.get_saved_recipe(recipe_id)
        if not recipe:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Recipe with ID {recipe_id} not found"
            )
        
        # Ensure recipe belongs to current user
        if recipe.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to delete this recipe"
            )
        
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
# Admin Endpoints - Security Audit Logging (Phase 2)
# ============================================================================

@app.get("/api/admin/audit-logs", tags=["Admin"])
def get_audit_logs(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum records to return"),
    event_type: Optional[str] = Query(None, description="Filter by event type"),
    severity: Optional[str] = Query(None, description="Filter by severity"),
    user_id: Optional[int] = Query(None, description="Filter by user ID"),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
) -> List[Dict]:
    """
    Get security audit logs (admin only).
    
    Returns security events for monitoring and auditing purposes.
    Filterable by event type, severity, and user ID.
    """
    try:
        from src.database import SecurityEvent
        
        # Build query
        query = db.query(SecurityEvent)
        
        # Apply filters
        if event_type:
            query = query.filter(SecurityEvent.event_type == event_type)
        if severity:
            query = query.filter(SecurityEvent.severity == severity)
        if user_id:
            query = query.filter(SecurityEvent.user_id == user_id)
        
        # Order by most recent first
        query = query.order_by(SecurityEvent.created_at.desc())
        
        # Apply pagination
        events = query.offset(skip).limit(limit).all()
        
        # Convert to dict
        return [event.to_dict() for event in events]
        
    except Exception as e:
        logger.error(f"Error retrieving audit logs: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve audit logs: {str(e)}"
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

