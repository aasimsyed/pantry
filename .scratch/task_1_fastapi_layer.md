# Task 1: FastAPI Layer Implementation

## 🎯 Objective

Create a clean, RESTful API layer using FastAPI that exposes the existing `PantryService` functionality without modifying any existing backend code.

## 📋 Requirements

### Must Have
- ✅ All CRUD operations for Products and InventoryItems
- ✅ Search and filtering endpoints
- ✅ Expiration tracking endpoints
- ✅ Statistics endpoints
- ✅ Recipe generation endpoint
- ✅ OCR processing endpoint (for future use)
- ✅ Auto-generated API documentation (Swagger/ReDoc)
- ✅ Proper HTTP status codes
- ✅ Comprehensive error handling
- ✅ Type hints throughout
- ✅ Pydantic models for requests/responses

### Should Have
- ✅ Request validation
- ✅ Dependency injection for database sessions
- ✅ CORS configuration (for future React app)
- ✅ Logging for all requests
- ✅ Pagination support for list endpoints

### Nice to Have
- Response caching headers
- Rate limiting (future)
- API versioning (future)

## 🏗️ Implementation Steps

### Step 1: Create Directory Structure

Create the following files:
```bash
api/
├── __init__.py
├── main.py           # FastAPI app & routes
├── models.py         # Pydantic request/response models
├── dependencies.py   # Dependency injection
└── config.py         # API configuration
```

### Step 2: Implement `api/config.py`

**Purpose**: Configuration management for the API

**Requirements**:
- Load from environment variables
- Provide defaults for development
- CORS settings
- Database connection string
- API metadata (title, version, description)

**Implementation Details**:
```python
from pydantic_settings import BaseSettings
from typing import List

class APIConfig(BaseSettings):
    # API Metadata
    api_title: str = "Smart Pantry API"
    api_version: str = "1.0.0"
    api_description: str = "REST API for Smart Pantry Management"
    
    # CORS
    cors_origins: List[str] = ["http://localhost:8501", "http://localhost:3000"]
    
    # Database
    database_url: str = "sqlite:///pantry.db"
    
    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    reload: bool = True
    
    class Config:
        env_file = ".env"
        env_prefix = "API_"
```

### Step 3: Implement `api/dependencies.py`

**Purpose**: Dependency injection for database sessions and services

**Requirements**:
- Provide database session for each request
- Handle session cleanup (close after request)
- Provide `PantryService` instance
- Error handling for database connections

**Implementation Details**:
```python
from typing import Generator
from sqlalchemy.orm import Session
from src.database import get_engine
from src.db_service import PantryService
from sqlalchemy.orm import sessionmaker

# Create session factory
SessionLocal = sessionmaker(bind=get_engine())

def get_db() -> Generator[Session, None, None]:
    """
    Dependency that provides a database session.
    Ensures session is closed after request.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_pantry_service(db: Session = Depends(get_db)) -> PantryService:
    """
    Dependency that provides a PantryService instance.
    """
    return PantryService(db)
```

### Step 4: Implement `api/models.py`

**Purpose**: Pydantic models for API request/response validation

**Requirements**:
- Response models for all entities (Product, InventoryItem, etc.)
- Request models for create/update operations
- Statistics response models
- Error response models
- Use snake_case for JSON fields (Python convention)
- Match database schema

**Implementation Details**:

Create models for:
1. **ProductResponse** - Product data in responses
2. **ProductCreate** - Product creation request
3. **ProductUpdate** - Product update request
4. **InventoryItemResponse** - Inventory item in responses
5. **InventoryItemCreate** - Inventory item creation
6. **InventoryItemUpdate** - Inventory item update
7. **StatisticsResponse** - Statistics data
8. **ErrorResponse** - Error details
9. **PaginatedResponse** - Generic pagination wrapper

**Example**:
```python
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Generic, TypeVar
from datetime import datetime, date

class ProductResponse(BaseModel):
    """Product data in API responses."""
    id: int
    product_name: str
    brand: Optional[str] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    barcode: Optional[str] = None
    default_storage_location: Optional[str] = None
    typical_shelf_life_days: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class ProductCreate(BaseModel):
    """Request body for creating a product."""
    product_name: str = Field(..., min_length=1, max_length=255)
    brand: Optional[str] = Field(None, max_length=255)
    category: Optional[str] = Field(None, max_length=100)
    subcategory: Optional[str] = Field(None, max_length=100)
    barcode: Optional[str] = Field(None, max_length=50)
    default_storage_location: Optional[str] = Field(None, max_length=50)
    typical_shelf_life_days: Optional[int] = Field(None, ge=1)

# ... similar for other models
```

### Step 5: Implement `api/main.py`

**Purpose**: Main FastAPI application with all routes

**Requirements**:
- FastAPI app initialization
- CORS middleware
- All CRUD endpoints
- Search/filter endpoints
- Statistics endpoints
- Error handlers
- Request logging
- Swagger documentation configuration

**Endpoint Structure**:

#### Product Endpoints
- `GET /api/products` - List all products (with pagination)
- `GET /api/products/{id}` - Get single product
- `POST /api/products` - Create new product
- `PUT /api/products/{id}` - Update product
- `DELETE /api/products/{id}` - Delete product
- `GET /api/products/search` - Search products by name/brand/category

#### Inventory Endpoints
- `GET /api/inventory` - List all inventory items (with pagination)
- `GET /api/inventory/{id}` - Get single inventory item
- `POST /api/inventory` - Add new inventory item
- `PUT /api/inventory/{id}` - Update inventory item
- `DELETE /api/inventory/{id}` - Delete inventory item
- `POST /api/inventory/{id}/consume` - Mark item as consumed or decrement quantity

#### Expiration Endpoints
- `GET /api/expiring` - Get items expiring soon (default: 7 days)
- `GET /api/expired` - Get all expired items

#### Statistics Endpoints
- `GET /api/statistics` - Get overall pantry statistics
- `GET /api/statistics/by-category` - Statistics by category
- `GET /api/statistics/by-location` - Statistics by storage location

#### Recipe Endpoint (Future)
- `POST /api/recipes/generate` - Generate recipes from available items

#### Health Check
- `GET /health` - API health check
- `GET /` - API info (redirect to docs)

**Implementation Pattern**:
```python
from fastapi import FastAPI, Depends, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
import logging

from .config import APIConfig
from .dependencies import get_pantry_service
from .models import *
from src.db_service import PantryService

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load configuration
config = APIConfig()

# Create FastAPI app
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

# Example endpoint implementation
@app.get("/api/inventory", response_model=List[InventoryItemResponse])
def get_inventory(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    location: Optional[str] = None,
    status: Optional[str] = None,
    service: PantryService = Depends(get_pantry_service)
):
    """
    Get all inventory items with optional filtering.
    
    - **skip**: Number of items to skip (pagination)
    - **limit**: Maximum number of items to return
    - **location**: Filter by storage location
    - **status**: Filter by item status
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
        
        logger.info(f"Retrieved {len(items)} inventory items")
        return items
    
    except Exception as e:
        logger.error(f"Error retrieving inventory: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

# Health check
@app.get("/health")
def health_check():
    """API health check endpoint."""
    return {"status": "healthy", "service": "Smart Pantry API"}

# Root redirect to docs
@app.get("/")
def root():
    """Redirect to API documentation."""
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url="/docs")
```

## 🧪 Testing Requirements

### Manual Testing (During Development)

1. **Start the API server**:
   ```bash
   cd /Users/aasim/src/pantry
   uvicorn api.main:app --reload --port 8000
   ```

2. **Test endpoints using curl or httpie**:
   ```bash
   # Health check
   curl http://localhost:8000/health
   
   # Get inventory
   curl http://localhost:8000/api/inventory
   
   # Get expiring items
   curl http://localhost:8000/api/expiring?days=7
   ```

3. **Access interactive docs**:
   - Swagger UI: http://localhost:8000/docs
   - ReDoc: http://localhost:8000/redoc

### Validation Checklist

- ✅ API starts without errors
- ✅ Swagger docs accessible
- ✅ All endpoints respond correctly
- ✅ Error handling works (try invalid IDs)
- ✅ Pagination works
- ✅ Filtering works
- ✅ Database queries use `PantryService` (not direct ORM)
- ✅ No changes to existing `src/` code
- ✅ Proper HTTP status codes (200, 201, 404, 500)
- ✅ Response models match Pydantic schemas

## 📝 Best Practices to Follow

### Code Quality
- ✅ Type hints for all functions
- ✅ Docstrings for all endpoints (shown in Swagger)
- ✅ Proper error handling with try/except
- ✅ Logging for important operations
- ✅ Use Pydantic for validation (no manual checks)

### Architecture
- ✅ Use dependency injection (`Depends()`)
- ✅ Keep route handlers thin - delegate to `PantryService`
- ✅ Don't access database directly - always use service layer
- ✅ Return Pydantic models, not ORM objects directly
- ✅ Handle database sessions properly (auto-close)

### Security
- ✅ Validate all inputs (Pydantic does this)
- ✅ Use parameterized queries (SQLAlchemy does this)
- ✅ Configure CORS properly
- ✅ Don't expose internal error details in production

### Performance
- ✅ Use pagination for list endpoints
- ✅ Add query limits (max 1000 items per request)
- ✅ Close database sessions after each request
- ✅ Consider adding response caching headers

## 🚫 What NOT to Do

- ❌ Don't modify existing `src/` files
- ❌ Don't access database directly (use `PantryService`)
- ❌ Don't return ORM objects directly (use Pydantic models)
- ❌ Don't catch and silence exceptions
- ❌ Don't use global database connections
- ❌ Don't expose sensitive information in errors
- ❌ Don't implement authentication yet (not needed)

## 📦 Dependencies to Add

Update `requirements.txt`:
```txt
# FastAPI Layer
fastapi>=0.104.0
uvicorn[standard]>=0.24.0
python-multipart>=0.0.6
```

## ✅ Definition of Done

This task is complete when:

1. ✅ All files created (`main.py`, `models.py`, `dependencies.py`, `config.py`)
2. ✅ API starts without errors: `uvicorn api.main:app --reload`
3. ✅ Swagger docs accessible at `/docs`
4. ✅ All endpoints listed in requirements are implemented
5. ✅ Manual testing passes for key endpoints
6. ✅ No linter errors in new code
7. ✅ All endpoints use `PantryService` (no direct ORM access)
8. ✅ Proper error handling and logging
9. ✅ Type hints throughout
10. ✅ Dependencies added to `requirements.txt`

## 🔄 Next Steps

After completing this task:
1. Test all endpoints manually using Swagger UI
2. Verify no changes were made to existing `src/` code
3. Run existing tests to ensure nothing broke
4. Proceed to `task_2_streamlit_dashboard.md`

---

**Estimated Time**: 30 minutes  
**Difficulty**: Easy (mostly boilerplate)  
**Dependencies**: None (uses existing backend)

