# Task 3: Integration Testing & Deployment Prep

## 🎯 Objective

Add comprehensive testing for the new FastAPI endpoints and ensure the entire system (backend + API + dashboard) works seamlessly together.

## 📋 Requirements

### Must Have
- ✅ API endpoint tests (pytest)
- ✅ Integration tests (API + Database)
- ✅ Test coverage report
- ✅ Run scripts for easy startup
- ✅ Environment validation
- ✅ No broken existing tests

### Should Have
- ✅ CI/CD configuration (GitHub Actions)
- ✅ Docker Compose setup (future)
- ✅ Performance benchmarks
- ✅ Load testing (basic)

### Nice to Have
- Streamlit UI tests (selenium/playwright)
- End-to-end tests
- API monitoring

## 🏗️ Implementation Steps

### Step 1: Create API Tests (`tests/test_api.py`)

**Purpose**: Test all FastAPI endpoints

**Requirements**:
- Use `httpx` for async HTTP testing
- Use FastAPI's `TestClient`
- Test all CRUD operations
- Test error cases (404, 400, 500)
- Test pagination
- Test filtering
- Use fixtures for test data

**Implementation Details**:
```python
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from typing import Generator

from api.main import app
from api.dependencies import get_db
from src.database import Base, Product, InventoryItem

# Test database (in-memory SQLite)
SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///./test_pantry.db"

engine = create_engine(
    SQLALCHEMY_TEST_DATABASE_URL,
    connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def test_db() -> Generator:
    """Create test database and tables."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def db_session(test_db) -> Generator:
    """Get test database session."""
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture(scope="function")
def client(db_session) -> TestClient:
    """Get test client with overridden dependencies."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
    
    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def sample_product(db_session) -> Product:
    """Create a sample product for testing."""
    product = Product(
        product_name="Test Product",
        brand="Test Brand",
        category="Test Category",
        subcategory="Test Subcategory",
        default_storage_location="pantry",
        typical_shelf_life_days=365
    )
    db_session.add(product)
    db_session.commit()
    db_session.refresh(product)
    return product


@pytest.fixture
def sample_inventory_item(db_session, sample_product) -> InventoryItem:
    """Create a sample inventory item for testing."""
    from datetime import date, timedelta
    
    item = InventoryItem(
        product_id=sample_product.id,
        quantity=2.0,
        unit="count",
        purchase_date=date.today(),
        expiration_date=date.today() + timedelta(days=30),
        storage_location="pantry",
        status="in_stock"
    )
    db_session.add(item)
    db_session.commit()
    db_session.refresh(item)
    return item


# Health Check Tests
def test_health_check(client: TestClient):
    """Test health check endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"


def test_root_redirect(client: TestClient):
    """Test root redirects to docs."""
    response = client.get("/", follow_redirects=False)
    assert response.status_code == 307  # Redirect


# Product Endpoints Tests
def test_get_products_empty(client: TestClient):
    """Test getting products when database is empty."""
    response = client.get("/api/products")
    assert response.status_code == 200
    assert response.json() == []


def test_get_products(client: TestClient, sample_product):
    """Test getting all products."""
    response = client.get("/api/products")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["product_name"] == "Test Product"


def test_create_product(client: TestClient):
    """Test creating a new product."""
    product_data = {
        "product_name": "New Product",
        "brand": "New Brand",
        "category": "Food",
        "subcategory": "Snacks"
    }
    response = client.post("/api/products", json=product_data)
    assert response.status_code == 201
    data = response.json()
    assert data["product_name"] == "New Product"
    assert "id" in data


def test_create_product_missing_name(client: TestClient):
    """Test creating product without required name field."""
    product_data = {
        "brand": "Test Brand"
    }
    response = client.post("/api/products", json=product_data)
    assert response.status_code == 422  # Validation error


def test_get_product_by_id(client: TestClient, sample_product):
    """Test getting a specific product by ID."""
    response = client.get(f"/api/products/{sample_product.id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == sample_product.id
    assert data["product_name"] == "Test Product"


def test_get_product_not_found(client: TestClient):
    """Test getting a non-existent product."""
    response = client.get("/api/products/99999")
    assert response.status_code == 404


def test_update_product(client: TestClient, sample_product):
    """Test updating a product."""
    update_data = {
        "product_name": "Updated Product",
        "brand": "Updated Brand"
    }
    response = client.put(f"/api/products/{sample_product.id}", json=update_data)
    assert response.status_code == 200
    data = response.json()
    assert data["product_name"] == "Updated Product"


def test_delete_product(client: TestClient, sample_product):
    """Test deleting a product."""
    response = client.delete(f"/api/products/{sample_product.id}")
    assert response.status_code == 200
    
    # Verify it's deleted
    response = client.get(f"/api/products/{sample_product.id}")
    assert response.status_code == 404


# Inventory Endpoints Tests
def test_get_inventory(client: TestClient, sample_inventory_item):
    """Test getting all inventory items."""
    response = client.get("/api/inventory")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1


def test_get_inventory_with_filters(client: TestClient, sample_inventory_item):
    """Test getting inventory with location filter."""
    response = client.get("/api/inventory?location=pantry")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    
    response = client.get("/api/inventory?location=fridge")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 0


def test_get_inventory_pagination(client: TestClient, sample_inventory_item):
    """Test inventory pagination."""
    response = client.get("/api/inventory?skip=0&limit=10")
    assert response.status_code == 200
    data = response.json()
    assert len(data) <= 10


def test_create_inventory_item(client: TestClient, sample_product):
    """Test creating a new inventory item."""
    from datetime import date, timedelta
    
    item_data = {
        "product_id": sample_product.id,
        "quantity": 5.0,
        "unit": "count",
        "purchase_date": date.today().isoformat(),
        "expiration_date": (date.today() + timedelta(days=60)).isoformat(),
        "storage_location": "pantry",
        "status": "in_stock"
    }
    response = client.post("/api/inventory", json=item_data)
    assert response.status_code == 201
    data = response.json()
    assert data["quantity"] == 5.0
    assert "id" in data


def test_update_inventory_item(client: TestClient, sample_inventory_item):
    """Test updating an inventory item."""
    update_data = {
        "quantity": 1.0,
        "status": "low"
    }
    response = client.put(
        f"/api/inventory/{sample_inventory_item.id}",
        json=update_data
    )
    assert response.status_code == 200
    data = response.json()
    assert data["quantity"] == 1.0
    assert data["status"] == "low"


def test_consume_item(client: TestClient, sample_inventory_item):
    """Test consuming an inventory item."""
    response = client.post(
        f"/api/inventory/{sample_inventory_item.id}/consume"
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "consumed"


def test_delete_inventory_item(client: TestClient, sample_inventory_item):
    """Test deleting an inventory item."""
    response = client.delete(f"/api/inventory/{sample_inventory_item.id}")
    assert response.status_code == 200


# Expiration Endpoints Tests
def test_get_expiring_items(client: TestClient, sample_inventory_item):
    """Test getting items expiring soon."""
    response = client.get("/api/expiring?days=30")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 0  # Depends on test data


def test_get_expired_items(client: TestClient):
    """Test getting expired items."""
    response = client.get("/api/expired")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


# Statistics Endpoints Tests
def test_get_statistics(client: TestClient, sample_inventory_item):
    """Test getting overall statistics."""
    response = client.get("/api/statistics")
    assert response.status_code == 200
    data = response.json()
    assert "total_items" in data
    assert "in_stock" in data


def test_get_statistics_by_category(client: TestClient, sample_inventory_item):
    """Test getting statistics by category."""
    response = client.get("/api/statistics/by-category")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, dict)


def test_get_statistics_by_location(client: TestClient, sample_inventory_item):
    """Test getting statistics by location."""
    response = client.get("/api/statistics/by-location")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, dict)


# Search Tests
def test_search_products(client: TestClient, sample_product):
    """Test product search."""
    response = client.get("/api/products/search?q=Test")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1


def test_search_products_no_results(client: TestClient):
    """Test product search with no results."""
    response = client.get("/api/products/search?q=NonExistentProduct")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 0
```

### Step 2: Create Run Scripts

**Purpose**: Easy startup scripts for development

#### `scripts/run_api.sh`
```bash
#!/bin/bash
# Start FastAPI server

cd "$(dirname "$0")/.."
source venv/bin/activate

echo "🚀 Starting Smart Pantry API..."
uvicorn api.main:app --reload --port 8000 --log-level info
```

#### `scripts/run_dashboard.sh`
```bash
#!/bin/bash
# Start Streamlit dashboard

cd "$(dirname "$0")/.."
source venv/bin/activate

echo "🎨 Starting Smart Pantry Dashboard..."
streamlit run dashboard/app.py
```

#### `scripts/run_all.sh`
```bash
#!/bin/bash
# Start both API and dashboard in background

cd "$(dirname "$0")/.."

echo "🚀 Starting Smart Pantry System..."

# Start API in background
./scripts/run_api.sh &
API_PID=$!
echo "API started (PID: $API_PID)"

# Wait for API to be ready
sleep 3

# Start Dashboard
./scripts/run_dashboard.sh &
DASH_PID=$!
echo "Dashboard started (PID: $DASH_PID)"

echo ""
echo "✅ Smart Pantry System Running!"
echo "   API: http://localhost:8000/docs"
echo "   Dashboard: http://localhost:8501"
echo ""
echo "Press Ctrl+C to stop both services"

# Wait for user interrupt
trap "kill $API_PID $DASH_PID; exit" INT
wait
```

Make scripts executable:
```bash
chmod +x scripts/run_*.sh
```

### Step 3: Update Requirements

Ensure `requirements.txt` has all dependencies:
```txt
# Testing
httpx>=0.25.0
pytest-asyncio>=0.21.0
```

### Step 4: Run Test Suite

```bash
# Run all tests including new API tests
pytest tests/ -v --cov=src --cov=api --cov-report=term-missing

# Run only API tests
pytest tests/test_api.py -v

# Run with coverage report
pytest tests/ --cov=api --cov-report=html
```

### Step 5: Create Environment Check Script

**Purpose**: Validate environment setup

#### `scripts/check_environment.py`
```python
#!/usr/bin/env python3
"""
Environment validation script.
Checks all dependencies and configurations.
"""

import sys
import os
from pathlib import Path

def check_python_version():
    """Check Python version is 3.8+."""
    version = sys.version_info
    if version.major < 3 or (version.major == 3 and version.minor < 8):
        print("❌ Python 3.8+ required")
        return False
    print(f"✅ Python {version.major}.{version.minor}.{version.micro}")
    return True

def check_dependencies():
    """Check required packages are installed."""
    required = [
        "fastapi",
        "uvicorn",
        "streamlit",
        "plotly",
        "sqlalchemy",
        "pydantic",
        "pytest",
        "requests"
    ]
    
    missing = []
    for package in required:
        try:
            __import__(package)
            print(f"✅ {package}")
        except ImportError:
            print(f"❌ {package}")
            missing.append(package)
    
    return len(missing) == 0

def check_database():
    """Check database file exists."""
    db_path = Path("pantry.db")
    if db_path.exists():
        print(f"✅ Database: {db_path}")
        return True
    else:
        print(f"⚠️  Database not found (will be created)")
        return True

def check_env_file():
    """Check .env file exists."""
    env_path = Path(".env")
    if env_path.exists():
        print(f"✅ Environment: {env_path}")
        return True
    else:
        print(f"⚠️  .env file not found (optional)")
        return True

def main():
    """Run all checks."""
    print("🔍 Checking Smart Pantry Environment\n")
    
    checks = [
        ("Python Version", check_python_version),
        ("Dependencies", check_dependencies),
        ("Database", check_database),
        ("Environment", check_env_file),
    ]
    
    all_passed = True
    for name, check_func in checks:
        print(f"\n📋 {name}:")
        if not check_func():
            all_passed = False
    
    print("\n" + "="*50)
    if all_passed:
        print("✅ Environment is ready!")
        print("\nNext steps:")
        print("  1. Start API: ./scripts/run_api.sh")
        print("  2. Start Dashboard: ./scripts/run_dashboard.sh")
        print("  3. Or both: ./scripts/run_all.sh")
        return 0
    else:
        print("❌ Environment setup incomplete")
        print("\nInstall missing dependencies:")
        print("  pip install -r requirements.txt")
        return 1

if __name__ == "__main__":
    sys.exit(main())
```

### Step 6: Update Documentation

Update `README.md` with new sections:
- API documentation
- Dashboard usage
- Running the system
- Development setup
- Testing instructions

## 🧪 Testing Checklist

### Unit Tests
- ✅ All new API endpoint tests pass
- ✅ Existing backend tests still pass
- ✅ No test failures or warnings
- ✅ Coverage >= 80% for new code

### Integration Tests
- ✅ API connects to database correctly
- ✅ Dashboard connects to API correctly
- ✅ Full workflow works (add → view → delete)
- ✅ Error handling works end-to-end

### Manual Testing
- ✅ Start API successfully
- ✅ Start Dashboard successfully
- ✅ Navigate all dashboard pages
- ✅ Perform CRUD operations via dashboard
- ✅ Check API docs (/docs) are complete
- ✅ Test error scenarios (stop API, invalid input)

## 📝 Best Practices

### Testing
- ✅ Use fixtures for test data
- ✅ Test happy path and error cases
- ✅ Clean up test data after each test
- ✅ Use descriptive test names
- ✅ One assertion focus per test
- ✅ Mock external dependencies

### Scripts
- ✅ Make scripts executable
- ✅ Add error handling
- ✅ Provide helpful output
- ✅ Document usage in comments

## ✅ Definition of Done

This task is complete when:

1. ✅ All API tests created and passing
2. ✅ Test coverage >= 80% for new code
3. ✅ Run scripts created and tested
4. ✅ Environment check script works
5. ✅ All existing tests still pass
6. ✅ Manual testing checklist complete
7. ✅ No linter errors
8. ✅ Documentation updated

## 🔄 Next Steps

After completing this task:
1. Run full test suite: `pytest tests/ -v`
2. Check coverage: `pytest tests/ --cov`
3. Test scripts: `./scripts/run_all.sh`
4. Proceed to `task_4_documentation.md`

---

**Estimated Time**: 20 minutes  
**Difficulty**: Easy (mostly boilerplate tests)  
**Dependencies**: Tasks 1 & 2 complete

