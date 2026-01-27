"""
FastAPI Main Application.

Implements REST API endpoints for the Smart Pantry Management System.
Provides CRUD operations, search, filtering, and statistics.
"""

import logging
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

import asyncio
import json
import os
import shutil
import tempfile
import uuid
from pathlib import Path

from fastapi import Depends, FastAPI, File, Form, HTTPException, Query, Request, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse, StreamingResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy.exc import IntegrityError, ProgrammingError, SQLAlchemyError
from sqlalchemy.orm import Session

from recipe_generator import RecipeGenerator
from src.ai_analyzer import create_ai_analyzer
from src.auth_service import (
    authenticate_user,
    create_access_token,
    create_refresh_token,
    create_user,
    get_valid_refresh_token,
    hash_refresh_token,
    revoke_refresh_token,
    store_refresh_token,
    verify_token,
)
from src.database import InventoryItem, Product, User
from src.db_service import PantryService
from src.file_validation import validate_image_file
from src.ocr_service import create_ocr_service
from src.security_logger import get_client_ip, get_user_agent, log_security_event

from .config import config
from .dependencies import get_current_admin_user, get_current_user, get_db, get_pantry_service
from .models import (
    ConsumeRequest,
    ErrorResponse,
    HealthResponse,
    InventoryItemCreate,
    InventoryItemResponse,
    InventoryItemUpdate,
    LoginRequest,
    MessageResponse,
    PantryCreate,
    PantryResponse,
    PantryUpdate,
    ProductCreate,
    ProductResponse,
    ProductUpdate,
    RecipeRequest,
    RecipeResponse,
    RefreshTokenRequest,
    RefreshTokenResponse,
    RegisterRequest,
    SavedRecipeCreate,
    SavedRecipeResponse,
    SavedRecipeUpdate,
    SingleRecipeRequest,
    StatisticsResponse,
    TokenResponse,
    UserResponse,
    UserSettingsResponse,
    UserSettingsUpdate,
)

# Configure logging
logging.basicConfig(
    level=getattr(logging, config.log_level.upper()),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

from api.utils import _SCHEMA_ERROR_MSG, detail_for_db_error, enrich_inventory_item

# Optional Sentry error tracking (set SENTRY_DSN to enable)
if config.sentry_dsn_stripped:
    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration

        sentry_sdk.init(
            dsn=config.sentry_dsn_stripped,
            environment=config.sentry_environment,
            traces_sample_rate=0.1,
            send_default_pii=True,
            debug=True,
            integrations=[FastApiIntegration()],
        )
        logger.info("Sentry error tracking enabled")
    except Exception as e:
        logger.warning("Sentry init failed: %s", e)


# Create FastAPI application
app = FastAPI(
    title=config.api_title,
    version=config.api_version,
    description=config.api_description,
    docs_url="/docs",
    redoc_url="/redoc",
)


# Sentry verification route (always registered; triggers 500 to verify Sentry when DSN set)
@app.get("/sentry-debug")
async def sentry_debug_trigger_error(request: Request):
    """Trigger an error to verify Sentry installation. See Performance + Errors in Sentry."""
    try:
        raise ZeroDivisionError("division by zero")
    except ZeroDivisionError as exc:
        request_id = getattr(request.state, "request_id", None)
        if config.sentry_dsn_stripped:
            try:
                import sentry_sdk
                sentry_sdk.set_tag("request_id", request_id or "")
                sentry_sdk.capture_exception(exc)
                sentry_sdk.flush(timeout=2.0)
                logger.info("Sentry: captured /sentry-debug exception (check Sentry Issues)")
            except Exception as e:
                logger.warning("Sentry: capture_exception failed: %s", e)
        else:
            logger.info("Sentry: skipping capture (SENTRY_DSN not set)")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "detail": "Sentry debug: error triggered and reported. Check Sentry Issues.",
                "error_code": "500",
                "request_id": request_id,
            },
        )


# Initialize database on startup
@app.on_event("startup")
async def startup_event():
    """Initialize database schema on application startup."""
    try:
        from src.database import get_database_url, init_database

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

    # Add Vercel deployment URLs
    # Vercel uses patterns like: https://frontend-*.vercel.app
    # We'll check these dynamically in the origin validator
    return origins


def is_vercel_origin(origin: str) -> bool:
    """Check if origin is a Vercel deployment."""
    return origin.endswith(".vercel.app")


app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_origin_regex=r"https://.*\.vercel\.app",  # Allow all Vercel deployments
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Rate limiting
from api.limiter import limiter

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
                    "limit": str(exc.detail) if hasattr(exc, "detail") else "unknown",
                },
                severity="warning",
                user_agent=user_agent,
            )
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Error logging rate limit event: {e}")

    # Use default handler
    return _rate_limit_exceeded_handler(request, exc)


app.add_exception_handler(RateLimitExceeded, rate_limit_handler)


# Request ID middleware: assign UUID per request for log correlation (e.g. Cloud Logging)
@app.middleware("http")
async def add_request_id(request: Request, call_next):
    """Assign request_id to each request; log and add X-Request-ID header."""
    request_id = uuid.uuid4().hex
    request.state.request_id = request_id
    logger.info("request_id=%s method=%s path=%s", request_id, request.method, request.url.path)
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response


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


# Routers
from api.routers import admin as admin_router
from api.routers import auth as auth_router
from api.routers import config as config_router
from api.routers import health as health_router
from api.routers import instacart as instacart_router
from api.routers import inventory as inventory_router
from api.routers import pantries as pantries_router
from api.routers import products as products_router
from api.routers import recipes as recipes_router
from api.routers import statistics as statistics_router
from api.routers import user as user_router

app.include_router(health_router.router)
app.include_router(auth_router.router)
app.include_router(products_router.router)
app.include_router(pantries_router.router)
app.include_router(statistics_router.router)
app.include_router(config_router.router)
app.include_router(inventory_router.router)
app.include_router(recipes_router.router)
app.include_router(user_router.router)
app.include_router(admin_router.router)
app.include_router(instacart_router.router)

# ============================================================================
# Recipe Generation Endpoints
# ============================================================================


@app.post("/api/recipes/generate-one", response_model=RecipeResponse, tags=["Recipes"])
@limiter.limit(f"{config.rate_limit_recipe_per_hour}/hour")
def generate_single_recipe(
    request: Request,
    recipe_request: SingleRecipeRequest,
    current_user: User = Depends(get_current_user),
    service: PantryService = Depends(get_pantry_service),
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
            user_id=current_user.id if current_user else None, pantry_id=pantry_id
        )
        available_items = [item for item in all_items if item.status == "in_stock"]

        if not available_items:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No items in stock. Add items to your pantry first.",
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
                detail="No available ingredients after applying exclusions.",
            )

        # Verify required ingredients are available
        if recipe_request.required_ingredients:
            required_names = set(recipe_request.required_ingredients)
            available_names = {item.product.product_name for item in filtered_items if item.product}
            missing_required = required_names - available_names

            if missing_required:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Required ingredients not available: {', '.join(missing_required)}",
                )

        # Convert to format expected by RecipeGenerator
        pantry_items = []
        for item in filtered_items:
            product_name = item.product.product_name if item.product else "Unknown"
            brand = item.product.brand if item.product else None

            pantry_items.append({"product": {"product_name": product_name, "brand": brand}})

        # Extract ingredient list (all available, minus excluded)
        ingredient_list = []
        for item in pantry_items:
            product = item["product"]
            name = product["product_name"]
            brand = product.get("brand")
            if brand:
                ingredient_list.append(f"{brand} {name}")
            else:
                ingredient_list.append(name)

        # Extract required ingredient names (for prompt)
        required_ingredient_names = None
        if recipe_request.required_ingredients:
            required_ingredient_names = []
            for item in pantry_items:
                product = item["product"]
                name = product["product_name"]
                if name in recipe_request.required_ingredients:
                    brand = product.get("brand")
                    if brand:
                        required_ingredient_names.append(f"{brand} {name}")
                    else:
                        required_ingredient_names.append(name)

        # Initialize AI analyzer with user's preferred model
        try:
            user_settings = service.get_user_settings(current_user.id)
            ai_config = None

            if user_settings.ai_provider or user_settings.ai_model:
                import os

                from src.ai_analyzer import AIConfig

                # Create custom config with user preferences
                ai_config = AIConfig.from_env()
                if user_settings.ai_provider:
                    ai_config.provider = user_settings.ai_provider
                if user_settings.ai_model:
                    ai_config.model = user_settings.ai_model

                from src.ai_analyzer import AIAnalyzer

                ai_analyzer = AIAnalyzer(ai_config)
            else:
                # Use default system config
                ai_analyzer = create_ai_analyzer()
        except AttributeError:
            # Fallback if get_user_settings method doesn't exist (old backend version)
            logger.warning("get_user_settings method not available, using default AI config")
            ai_analyzer = create_ai_analyzer()
        except Exception as e:
            # Fallback on any other error
            logger.error(f"Error getting user settings, using default: {e}")
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
            allow_missing_ingredients=recipe_request.allow_missing_ingredients,
        )

        if not recipe:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to generate recipe",
            )

        # Convert to response format
        used_ingredients = []
        for ing in recipe.get("ingredients", []):
            if isinstance(ing, dict):
                used_ingredients.append(ing.get("item", ing.get("name", "")))
            else:
                used_ingredients.append(str(ing))

        result = {
            "name": recipe.get("name", "Unnamed Recipe"),
            "description": recipe.get("description", ""),
            "difficulty": recipe.get("difficulty") or recipe_request.difficulty or "medium",
            "prep_time": _parse_time(recipe.get("prep_time", "0 minutes")),
            "cook_time": _parse_time(recipe.get("cook_time", "0 minutes")),
            "servings": recipe.get("servings", 4),
            "cuisine": recipe.get("cuisine", ""),
            "ingredients": recipe.get("ingredients", []),
            "instructions": recipe.get("instructions", []),
            "available_ingredients": used_ingredients,
            "missing_ingredients": recipe.get("missing_ingredients", []),
            "flavor_pairings": recipe.get("flavor_pairings", []),
            "ai_model": recipe.get("ai_model"),  # Track which AI model generated this recipe
        }

        # Save to recent recipes so user can go back and save it later
        if current_user:
            try:
                recent_recipe = service.save_recent_recipe(
                    user_id=current_user.id,
                    name=result["name"],
                    description=result["description"],
                    cuisine=result["cuisine"],
                    difficulty=result["difficulty"],
                    prep_time=result["prep_time"],
                    cook_time=result["cook_time"],
                    servings=result["servings"],
                    ingredients=result["ingredients"],
                    instructions=result["instructions"],
                    available_ingredients=result["available_ingredients"],
                    missing_ingredients=result["missing_ingredients"],
                    flavor_pairings=result["flavor_pairings"],
                    ai_model=result["ai_model"]
                )
                result["recent_recipe_id"] = recent_recipe.id
                logger.info(f"Saved generated recipe to recent recipes (ID: {recent_recipe.id})")
            except Exception as e:
                logger.warning(f"Failed to save to recent recipes: {e}")

        logger.info(f"Successfully generated recipe: {result['name']}")
        return result

    except HTTPException:
        raise
    except ValueError as e:
        if "No AI backends available" in str(e):
            logger.error("AI API keys not configured")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="AI service not available. Please configure OpenAI or Anthropic API key in .env file.",
            )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error generating recipe: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate recipe: {str(e)}",
        )


@app.post("/api/recipes/generate", response_model=List[RecipeResponse], tags=["Recipes"])
@limiter.limit(f"{config.rate_limit_recipe_per_hour}/hour")
def generate_recipes(
    request: Request,
    recipe_request: RecipeRequest,
    current_user: User = Depends(get_current_user),
    service: PantryService = Depends(get_pantry_service),
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
            user_id=current_user.id if current_user else None, pantry_id=pantry_id
        )

        # Filter to in_stock items only
        available_items = [item for item in all_items if item.status == "in_stock"]

        if not available_items:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No items in stock. Add items to your pantry first.",
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
                detail="No available ingredients after applying exclusions.",
            )

        # Verify required ingredients are available
        if recipe_request.required_ingredients:
            required_names = set(recipe_request.required_ingredients)
            available_names = {item.product.product_name for item in filtered_items if item.product}
            missing_required = required_names - available_names

            if missing_required:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Required ingredients not available: {', '.join(missing_required)}",
                )

        # Convert to format expected by RecipeGenerator
        pantry_items = []
        for item in filtered_items:
            product_name = item.product.product_name if item.product else "Unknown"
            brand = item.product.brand if item.product else None

            pantry_items.append({"product": {"product_name": product_name, "brand": brand}})

        # Extract required ingredient names (for prompt)
        required_ingredient_names = None
        if recipe_request.required_ingredients:
            required_ingredient_names = []
            for item in pantry_items:
                product = item["product"]
                name = product["product_name"]
                if name in recipe_request.required_ingredients:
                    brand = product.get("brand")
                    if brand:
                        required_ingredient_names.append(f"{brand} {name}")
                    else:
                        required_ingredient_names.append(name)

        # Initialize AI analyzer with user's preferred model
        try:
            user_settings = service.get_user_settings(current_user.id)
            ai_config = None

            if user_settings.ai_provider or user_settings.ai_model:
                import os

                from src.ai_analyzer import AIConfig

                # Create custom config with user preferences
                ai_config = AIConfig.from_env()
                if user_settings.ai_provider:
                    ai_config.provider = user_settings.ai_provider
                if user_settings.ai_model:
                    ai_config.model = user_settings.ai_model

                from src.ai_analyzer import AIAnalyzer

                ai_analyzer = AIAnalyzer(ai_config)
            else:
                # Use default system config
                ai_analyzer = create_ai_analyzer()
        except AttributeError:
            # Fallback if get_user_settings method doesn't exist (old backend version)
            logger.warning("get_user_settings method not available, using default AI config")
            ai_analyzer = create_ai_analyzer()
        except Exception as e:
            # Fallback on any other error
            logger.error(f"Error getting user settings, using default: {e}")
            ai_analyzer = create_ai_analyzer()

        recipe_generator = RecipeGenerator(ai_analyzer)

        # Generate recipes with timeout protection
        # Limit generation to ~50s to avoid HTTP gateway timeouts
        logger.info(
            f"Generating {recipe_request.max_recipes} recipes from {len(pantry_items)} ingredients"
        )
        try:
            recipes = recipe_generator.generate_recipes(
                pantry_items=pantry_items,
                num_recipes=recipe_request.max_recipes,
                cuisine=recipe_request.cuisine,
                difficulty=recipe_request.difficulty,
                dietary_restrictions=recipe_request.dietary_restrictions,
                required_ingredients=required_ingredient_names,
                excluded_ingredients=recipe_request.excluded_ingredients,
                allow_missing_ingredients=recipe_request.allow_missing_ingredients,
            )
        except Exception as e:
            # If generation fails partway, try to return what we have
            logger.warning(f"Recipe generation interrupted: {e}")
            recipes = []

        # Convert to response format
        result = []
        for recipe in recipes:
            # Extract available ingredients used
            used_ingredients = []
            for ing in recipe.get("ingredients", []):
                if isinstance(ing, dict):
                    used_ingredients.append(ing.get("item", ing.get("name", "")))
                else:
                    used_ingredients.append(str(ing))

            result.append(
                {
                    "name": recipe.get("name", "Unnamed Recipe"),
                    "description": recipe.get("description", ""),
                    "difficulty": recipe.get("difficulty") or recipe_request.difficulty or "medium",
                    "prep_time": _parse_time(recipe.get("prep_time", "0 minutes")),
                    "cook_time": _parse_time(recipe.get("cook_time", "0 minutes")),
                    "servings": recipe.get("servings", 4),
                    "cuisine": recipe.get("cuisine", ""),
                    "ingredients": recipe.get("ingredients", []),
                    "instructions": recipe.get("instructions", []),
                    "available_ingredients": used_ingredients,
                    "missing_ingredients": recipe.get("missing_ingredients", []),
                    "flavor_pairings": recipe.get("flavor_pairings", []),
                    "ai_model": recipe.get(
                        "ai_model"
                    ),  # Track which AI model generated this recipe
                }
            )

        logger.info(f"Successfully generated {len(result)}/{recipe_request.max_recipes} recipes")

        # Save all generated recipes to recent recipes so user can go back and save them later
        if current_user:
            for recipe_data in result:
                try:
                    recent_recipe = service.save_recent_recipe(
                        user_id=current_user.id,
                        name=recipe_data["name"],
                        description=recipe_data["description"],
                        cuisine=recipe_data["cuisine"],
                        difficulty=recipe_data["difficulty"],
                        prep_time=recipe_data["prep_time"],
                        cook_time=recipe_data["cook_time"],
                        servings=recipe_data["servings"],
                        ingredients=recipe_data["ingredients"],
                        instructions=recipe_data["instructions"],
                        available_ingredients=recipe_data["available_ingredients"],
                        missing_ingredients=recipe_data["missing_ingredients"],
                        flavor_pairings=recipe_data["flavor_pairings"],
                        ai_model=recipe_data["ai_model"]
                    )
                    recipe_data["recent_recipe_id"] = recent_recipe.id
                except Exception as e:
                    logger.warning(f"Failed to save recipe '{recipe_data['name']}' to recent recipes: {e}")

        # If we got fewer recipes than requested, add a note in the response
        if len(result) < recipe_request.max_recipes:
            logger.warning(
                f"Only generated {len(result)} out of {recipe_request.max_recipes} requested recipes (likely due to timeout)"
            )

        return result

    except HTTPException:
        raise
    except ValueError as e:
        # Handle missing AI API keys
        if "No AI backends available" in str(e):
            logger.error("AI API keys not configured")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="AI service not available. Please configure OpenAI or Anthropic API key in .env file. See README for setup instructions.",
            )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error generating recipes: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate recipes: {str(e)}",
        )


@app.post("/api/recipes/generate-stream", tags=["Recipes"])
@limiter.limit(f"{config.rate_limit_recipe_per_hour}/hour")
async def generate_recipes_stream(
    request: Request,
    recipe_request: RecipeRequest,
    current_user: User = Depends(get_current_user),
    service: PantryService = Depends(get_pantry_service),
):
    """
    Generate AI-powered recipes using streaming (Server-Sent Events).

    This endpoint streams recipes as they're generated, allowing for large
    numbers of recipes (10-20+) without hitting HTTP gateway timeouts.

    Recipes are sent as Server-Sent Events (SSE) in JSON format.
    Each recipe is sent as soon as it's generated.

    Use this endpoint when generating many recipes with Claude (which is slower).
    """

    async def generate_and_stream():
        try:
            # Get pantry_id from request or use default
            pantry_id = recipe_request.pantry_id
            if pantry_id is None and current_user:
                default_pantry = service.get_or_create_default_pantry(current_user.id)
                pantry_id = default_pantry.id

            # Get inventory items filtered by pantry
            all_items = service.get_all_inventory(
                user_id=current_user.id if current_user else None, pantry_id=pantry_id
            )

            # Filter to in_stock items only
            available_items = [item for item in all_items if item.status == "in_stock"]

            if not available_items:
                yield f"data: {json.dumps({'error': 'No items in stock. Add items to your pantry first.'})}\n\n"
                return

            # Filter out excluded ingredients
            excluded_names = set(recipe_request.excluded_ingredients or [])
            filtered_items = []
            for item in available_items:
                product_name = item.product.product_name if item.product else None
                if product_name and product_name not in excluded_names:
                    filtered_items.append(item)

            if not filtered_items:
                yield f"data: {json.dumps({'error': 'No available ingredients after applying exclusions.'})}\n\n"
                return

            # Verify required ingredients are available
            if recipe_request.required_ingredients:
                required_names = set(recipe_request.required_ingredients)
                available_names = {
                    item.product.product_name for item in filtered_items if item.product
                }
                missing_required = required_names - available_names

                if missing_required:
                    missing_list = ", ".join(missing_required)
                    yield f"data: {json.dumps({'error': f'Required ingredients not available: {missing_list}'})}\n\n"
                    return

            # Convert to format expected by RecipeGenerator
            pantry_items = []
            for item in filtered_items:
                product_name = item.product.product_name if item.product else "Unknown"
                brand = item.product.brand if item.product else None

                pantry_items.append({"product": {"product_name": product_name, "brand": brand}})

            # Extract required ingredient names (for prompt)
            required_ingredient_names = None
            if recipe_request.required_ingredients:
                required_ingredient_names = []
                for item in pantry_items:
                    product = item["product"]
                    name = product["product_name"]
                    if name in recipe_request.required_ingredients:
                        brand = product.get("brand")
                        if brand:
                            required_ingredient_names.append(f"{brand} {name}")
                        else:
                            required_ingredient_names.append(name)

            # Initialize AI analyzer with user's preferred model
            try:
                user_settings = service.get_user_settings(current_user.id)
                ai_config = None

                if user_settings.ai_provider or user_settings.ai_model:
                    import os

                    from src.ai_analyzer import AIConfig

                    # Create custom config with user preferences
                    ai_config = AIConfig.from_env()
                    if user_settings.ai_provider:
                        ai_config.provider = user_settings.ai_provider
                    if user_settings.ai_model:
                        ai_config.model = user_settings.ai_model

                    from src.ai_analyzer import AIAnalyzer

                    ai_analyzer = AIAnalyzer(ai_config)
                else:
                    # Use default system config
                    ai_analyzer = create_ai_analyzer()
            except AttributeError:
                logger.warning("get_user_settings method not available, using default AI config")
                ai_analyzer = create_ai_analyzer()
            except Exception as e:
                logger.error(f"Error getting user settings, using default: {e}")
                ai_analyzer = create_ai_analyzer()

            recipe_generator = RecipeGenerator(ai_analyzer)

            # Send initial status
            yield f"data: {json.dumps({'status': 'started', 'total': recipe_request.max_recipes})}\n\n"

            # Generate recipes with streaming
            logger.info(
                f"Streaming {recipe_request.max_recipes} recipes from {len(pantry_items)} ingredients"
            )

            recipe_count = 0
            for recipe in recipe_generator.generate_recipes(
                pantry_items=pantry_items,
                num_recipes=recipe_request.max_recipes,
                cuisine=recipe_request.cuisine,
                difficulty=recipe_request.difficulty,
                dietary_restrictions=recipe_request.dietary_restrictions,
                required_ingredients=required_ingredient_names,
                excluded_ingredients=recipe_request.excluded_ingredients,
                allow_missing_ingredients=recipe_request.allow_missing_ingredients,
                stream=True,  # Enable streaming
            ):
                if "error" in recipe:
                    yield f"data: {json.dumps({'error': recipe['error']})}\n\n"
                    continue

                # Extract available ingredients used
                used_ingredients = []
                for ing in recipe.get("ingredients", []):
                    if isinstance(ing, dict):
                        used_ingredients.append(ing.get("item", ing.get("name", "")))
                    else:
                        used_ingredients.append(str(ing))

                # Convert to response format
                recipe_response = {
                    "name": recipe.get("name", "Unnamed Recipe"),
                    "description": recipe.get("description", ""),
                    "difficulty": recipe.get("difficulty") or recipe_request.difficulty or "medium",
                    "prep_time": _parse_time(recipe.get("prep_time", "0 minutes")),
                    "cook_time": _parse_time(recipe.get("cook_time", "0 minutes")),
                    "servings": recipe.get("servings", 4),
                    "cuisine": recipe.get("cuisine", ""),
                    "ingredients": recipe.get("ingredients", []),
                    "instructions": recipe.get("instructions", []),
                    "available_ingredients": used_ingredients,
                    "missing_ingredients": recipe.get("missing_ingredients", []),
                    "flavor_pairings": recipe.get("flavor_pairings", []),
                    "ai_model": recipe.get("ai_model"),
                }

                recipe_count += 1
                recipe_response["index"] = recipe_count
                recipe_response["total"] = recipe_request.max_recipes

                # Send recipe as SSE
                yield f"data: {json.dumps(recipe_response)}\n\n"

                # Small delay to prevent overwhelming the client
                await asyncio.sleep(0.1)

            # Send completion status
            yield f"data: {json.dumps({'status': 'completed', 'count': recipe_count})}\n\n"

        except Exception as e:
            logger.error(f"Error in streaming recipe generation: {e}", exc_info=True)
            yield f"data: {json.dumps({'error': f'Failed to generate recipes: {str(e)}'})}\n\n"

    return StreamingResponse(
        generate_and_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        },
    )


def _parse_time(time_str: str) -> int:
    """Parse time string like '30 minutes' to integer minutes."""
    try:
        if isinstance(time_str, int):
            return time_str
        if isinstance(time_str, str):
            # Extract number from string
            import re

            match = re.search(r"(\d+)", time_str)
            if match:
                return int(match.group(1))
        return 0
    except:
        return 0



# ============================================================================
# Error Handlers
# ============================================================================


def _get_request_id(request: Request) -> str | None:
    """Get request_id from request state (set by middleware)."""
    return getattr(request.state, "request_id", None)


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Custom HTTP exception handler."""
    request_id = _get_request_id(request)
    extra = f" request_id={request_id}" if request_id else ""
    logger.warning("HTTP %s: %s%s", exc.status_code, exc.detail, extra)
    if exc.status_code == 500 and config.sentry_dsn_stripped:
        try:
            import sentry_sdk
            sentry_sdk.set_tag("request_id", request_id or "")
            sentry_sdk.capture_message(f"HTTP 500: {exc.detail}", level="error")
        except Exception:
            pass
    content: dict = {"detail": exc.detail, "error_code": str(exc.status_code)}
    if request_id and exc.status_code == 500:
        content["request_id"] = request_id
    return JSONResponse(status_code=exc.status_code, content=content)


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Catch-all exception handler. Logs full traceback; returns 500 with request_id for log lookup."""
    request_id = _get_request_id(request)
    extra = f" request_id={request_id}" if request_id else ""
    logger.error("Unhandled exception%s: %s", extra, exc, exc_info=True)
    if config.sentry_dsn_stripped:
        try:
            import sentry_sdk
            sentry_sdk.set_tag("request_id", request_id or "")
            sentry_sdk.capture_exception(exc)
        except Exception:
            pass

    import os

    hide_errors = config.hide_error_details
    raw = "" if hide_errors else (str(exc) or "").strip()
    error_detail = raw if raw else "An unexpected error occurred"
    if request_id and not raw:
        error_detail = f"{error_detail} (request_id={request_id}, check logs)"

    content: dict = {"detail": error_detail, "error_code": "500"}
    if request_id:
        content["request_id"] = request_id
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=content,
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "api.main:app",
        host=config.host,
        port=config.port,
        reload=config.reload,
        log_level=config.log_level,
    )
