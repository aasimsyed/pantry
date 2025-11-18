# Smart Pantry/Refrigerator Inventory System
## LLM Implementation Guide

> **Purpose of this README**: This document is designed to be read by an LLM (Large Language Model) to understand the complete project architecture and generate production-ready code for any component. If you are an LLM reading this, you have all the context needed to implement any part of this system.

---

## 🎯 Project Overview

### What This System Does
This application automatically inventories food items from photographs. Users take pictures of products in their pantry/refrigerator, and the system:
1. Extracts text from product labels using OCR
2. Identifies products using AI vision models
3. Enriches data via barcode lookup APIs
4. Stores everything in a structured database
5. Tracks expiration dates and consumption
6. Generates shopping lists and alerts

### Core Problem Being Solved
Manual pantry inventory is tedious and error-prone. People forget what they have, buy duplicates, and let food expire. This system automates the entire inventory process through computer vision and AI.

---

## 🏗️ System Architecture

### High-Level Data Flow
```
JPEG Images → Image Preprocessing → OCR Extraction → AI Analysis → Data Enrichment → Database Storage
                                                                            ↓
                                                                    User Interfaces
                                                             (CLI / REST API / Web Dashboard)
```

### Component Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                     USER INTERFACES                          │
│  CLI Tool  │  REST API (FastAPI)  │  Web Dashboard (Streamlit)│
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                  APPLICATION ORCHESTRATOR                    │
│              (InventoryProcessor Pipeline)                   │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────┬──────────────────┬──────────────────────┐
│  Image Processing │   AI Services    │   Database Layer     │
│                   │                  │                      │
│  • Preprocessor   │  • OCR Service   │  • SQLAlchemy ORM    │
│  • Validation     │  • Vision AI     │  • CRUD Operations   │
│  • Enhancement    │  • Barcode API   │  • Query Service     │
└──────────────────┴──────────────────┴──────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    EXTERNAL SERVICES                         │
│  Google Cloud Vision  │  OpenAI/Claude  │  Open Food Facts  │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 Technology Stack

### Core Technologies
- **Language**: Python 3.10+
- **Image Processing**: Pillow (PIL), OpenCV
- **OCR**: 
  - Primary: Tesseract 5.x (free, local)
  - Fallback: Google Cloud Vision API (paid, cloud)
- **AI Vision**: OpenAI GPT-4 Vision or Anthropic Claude (with vision capabilities)
- **Barcode Lookup**: Open Food Facts API (free)
- **Database**: SQLAlchemy ORM with SQLite (dev) or PostgreSQL (production)
- **API Framework**: FastAPI (optional, for web API)
- **Web Interface**: Streamlit (optional, for dashboard)
- **CLI**: Click or argparse
- **Async Processing**: asyncio, aiohttp
- **Configuration**: pydantic-settings, python-dotenv

### Why These Choices?
- **Tesseract First**: Free and surprisingly accurate (85-90%) with proper image preprocessing. Only escalate to paid APIs for difficult images.
- **Two-Stage Processing**: OCR for text extraction (specialized), LLM for understanding context (generalized). This separation of concerns optimizes both accuracy and cost.
- **SQLAlchemy**: Database-agnostic ORM that works with SQLite for personal use and scales to PostgreSQL for production.
- **FastAPI**: Modern, fast, with automatic API documentation. Optional if only CLI is needed.

---

## 📊 Database Schema

### Entity Relationship Overview
```
products (1) ←──── (many) inventory_items
                           ↓
                    processing_log
```

### Table: `products`
Stores unique product definitions (the "master" product catalog).

| Column | Type | Description |
|--------|------|-------------|
| id | Integer (PK) | Auto-incrementing primary key |
| product_name | String(200) | Full product name, indexed |
| brand | String(100) | Brand name |
| category | String(50) | Main category (dairy, produce, etc.) |
| subcategory | String(50) | More specific category |
| barcode | String(20) | UPC/EAN, unique, nullable |
| default_storage_location | String(20) | pantry/refrigerator/freezer |
| typical_shelf_life_days | Integer | Average shelf life |
| created_at | DateTime | Record creation timestamp |
| updated_at | DateTime | Last modification timestamp |

**Indexes**: product_name, category, barcode

### Table: `inventory_items`
Stores actual items in the pantry/fridge (instances of products).

| Column | Type | Description |
|--------|------|-------------|
| id | Integer (PK) | Auto-incrementing primary key |
| product_id | Integer (FK) | References products.id |
| quantity | Float | Amount (e.g., 2, 0.5, 1) |
| unit | String(20) | oz, ml, count, lbs, etc. |
| purchase_date | Date | When item was acquired |
| expiration_date | Date | Best-by or expiration date |
| storage_location | String(20) | Current location |
| image_path | String(255) | Path to source image |
| notes | Text | User notes |
| status | String(20) | in_stock/low/expired/consumed |
| created_at | DateTime | Record creation timestamp |
| updated_at | DateTime | Last modification timestamp |

**Indexes**: product_id, expiration_date, status, storage_location

### Table: `processing_log`
Audit trail for all image processing operations.

| Column | Type | Description |
|--------|------|-------------|
| id | Integer (PK) | Auto-incrementing primary key |
| image_path | String(255) | Source image path |
| processing_date | DateTime | When processing occurred |
| ocr_confidence | Float | OCR confidence score (0-1) |
| ai_confidence | Float | AI analysis confidence (0-1) |
| status | String(20) | success/failed/manual_review |
| error_message | Text | Error details if failed |
| raw_ocr_data | JSON | Complete OCR response |
| raw_ai_data | JSON | Complete AI response |

---

## 🔄 Processing Pipeline

### Step-by-Step Workflow

#### 1. Image Preprocessing
```python
# Input: Raw JPEG from camera/phone
# Process:
#   - Validate file format
#   - Resize if too large (max 4000px)
#   - Enhance contrast/brightness
#   - Denoise
#   - Convert to grayscale (for OCR)
# Output: Preprocessed image optimized for text extraction
```

#### 2. OCR Text Extraction
```python
# Strategy: Try local first, escalate if needed
# 
# Step 1: Run Tesseract OCR
#   - Fast, free, local
#   - Confidence threshold: 0.85
#
# Step 2: If confidence < 0.85:
#   - Call Google Cloud Vision API
#   - More expensive but more accurate
#
# Output: {
#   'raw_text': str,
#   'confidence': float,
#   'bounding_boxes': list,
#   'detected_languages': list
# }
```

#### 3. AI Vision Analysis
```python
# Input: Original image + OCR text
# Process:
#   - Send to GPT-4 Vision or Claude
#   - Ask AI to identify product and extract structured data
#   - AI uses both image content and OCR text
#
# Output: {
#   "product_name": str,
#   "brand": str,
#   "category": str,
#   "quantity": str,
#   "expiration_date": str,
#   "barcode": str or null,
#   "confidence": float
# }
```

#### 4. Barcode Enrichment (if barcode detected)
```python
# Input: Barcode number
# Process:
#   - Query Open Food Facts API
#   - Get verified product data
#   - Merge with AI-extracted data
#
# Priority: API data > AI data > OCR data
# (Most reliable to least reliable)
```

#### 5. Database Operations
```python
# Deduplication Logic:
# 1. Check if product exists (by barcode or name similarity)
# 2. If exists:
#      - Update existing inventory_item quantity
#      - Update expiration_date if newer
# 3. If new:
#      - Create product record (if not exists)
#      - Create inventory_item record
#
# This prevents duplicate entries for same product
```

#### 6. Confidence Gating
```python
# Decision tree for automated processing:
#
# if combined_confidence >= 0.85:
#     Auto-process and add to database
# elif combined_confidence >= 0.60:
#     Add to manual review queue
#     Flag for user verification
# else:
#     Mark as failed
#     Log for debugging
```

---

## 🎨 AI Prompting Strategy

### System Prompt for Vision AI
When calling GPT-4 Vision or Claude, use this system prompt:

```
You are a food product identification assistant analyzing images of food/beverage products.

Your task: Extract structured product information from the image.

Return ONLY a JSON object with this exact structure:
{
  "product_name": "Full product name as shown on label",
  "brand": "Brand name",
  "category": "One of: dairy, produce, meat, poultry, seafood, beverages, snacks, condiments, canned_goods, frozen, bakery, grains, other",
  "subcategory": "More specific classification",
  "quantity": "Amount with unit (e.g., '500ml', '16 oz', '1 lb', '12 count')",
  "expiration_date": "YYYY-MM-DD format if visible, otherwise null",
  "ingredients": ["List", "of", "main", "ingredients"] or null,
  "barcode": "Barcode number if clearly visible, otherwise null",
  "storage_location": "One of: pantry, refrigerator, freezer",
  "confidence": 0.0-1.0
}

Rules:
1. If image doesn't contain a food product, return: {"error": "No food product detected", "confidence": 0.0}
2. Use the provided OCR text to validate/supplement what you see in the image
3. For expiration dates, look for: "Best By", "Use By", "EXP", "BB", or date stamps
4. Be conservative with confidence scores - only use 0.9+ for crystal clear labels
5. If text is ambiguous, prefer null over guessing
6. Storage location should be typical storage for that product type
```

### Example API Call Structure
```python
import anthropic

client = anthropic.Anthropic(api_key="...")

message = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    messages=[
        {
            "role": "user",
            "content": [
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": "image/jpeg",
                        "data": base64_image_data,
                    },
                },
                {
                    "type": "text",
                    "text": f"OCR extracted this text: {ocr_text}\n\nAnalyze this product image and return structured JSON data."
                }
            ],
        }
    ],
)

# Parse response
product_data = json.loads(message.content[0].text)
```

---

## 🔐 Configuration & Environment

### Required Environment Variables
```bash
# API Keys (at least one vision AI required)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_CLOUD_VISION_KEY=path/to/credentials.json  # Optional

# Database (for production)
DATABASE_URL=postgresql://user:pass@localhost/pantry_inventory

# Processing Settings
OCR_CONFIDENCE_THRESHOLD=0.85
AI_CONFIDENCE_THRESHOLD=0.75
MANUAL_REVIEW_THRESHOLD=0.60
BATCH_SIZE=10
PARALLEL_WORKERS=4

# Paths
IMAGES_DIRECTORY=./images
PROCESSED_DIRECTORY=./processed
DATABASE_PATH=./inventory.db  # For SQLite
```

### Configuration File Structure
Use pydantic-settings for type-safe configuration:

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # API Keys
    openai_api_key: str | None = None
    anthropic_api_key: str | None = None
    google_cloud_vision_key: str | None = None
    
    # OCR Settings
    ocr_primary_service: str = "tesseract"
    ocr_confidence_threshold: float = 0.85
    
    # AI Settings
    ai_model: str = "claude-sonnet-4-20250514"
    ai_confidence_threshold: float = 0.75
    manual_review_threshold: float = 0.60
    
    # Database
    database_url: str = "sqlite:///./inventory.db"
    
    # Processing
    batch_size: int = 10
    parallel_workers: int = 4
    
    class Config:
        env_file = ".env"
```

---

## 🧩 Module Responsibilities

### Module: `image_processor.py`
**Purpose**: Handle all image preprocessing and validation.

**Key Classes**:
- `ImagePreprocessor`: Resize, enhance, denoise images
- `ImageValidator`: Check file format, size, corruption

**Key Methods**:
```python
def preprocess_image(image_path: str) -> str:
    """Preprocess image for OCR. Returns path to processed image."""
    
def batch_preprocess(directory: str) -> list[str]:
    """Process all images in directory."""
```

### Module: `ocr_service.py`
**Purpose**: Extract text from images using OCR engines.

**Key Classes**:
- `OCRService`: Unified interface for multiple OCR backends
- `TesseractOCR`: Local Tesseract wrapper
- `GoogleVisionOCR`: Cloud Vision API wrapper

**Key Methods**:
```python
def extract_text(image_path: str) -> dict:
    """Extract text with confidence scores and bounding boxes."""
    
def intelligent_extract(image_path: str) -> dict:
    """Try Tesseract first, fall back to Google Vision if needed."""
```

**Cost Optimization**: 
- Always try Tesseract first (free)
- Only call Google Vision if Tesseract confidence < 0.85
- Cache results to avoid re-processing same images

### Module: `ai_analyzer.py`
**Purpose**: Use vision-capable LLMs to identify and understand products.

**Key Classes**:
- `ProductAnalyzer`: Analyzes images using GPT-4V or Claude
- `DataValidator`: Validates and merges data from multiple sources

**Key Methods**:
```python
async def analyze_product_image(
    image_path: str,
    ocr_text: str | None = None
) -> dict:
    """Analyze product image with AI vision model."""
    
def merge_data_sources(
    ai_data: dict,
    ocr_data: dict,
    barcode_data: dict | None
) -> dict:
    """Merge data with priority: barcode > AI > OCR."""
```

### Module: `barcode_service.py`
**Purpose**: Lookup product information from barcode databases.

**Key Classes**:
- `BarcodeLookupService`: Query Open Food Facts and other APIs

**Key Methods**:
```python
async def lookup_by_barcode(barcode: str) -> dict | None:
    """Query barcode databases for product info."""
    
def enrich_product_data(product_dict: dict) -> dict:
    """Add verified data from barcode lookup."""
```

### Module: `database.py`
**Purpose**: All database operations using SQLAlchemy ORM.

**Key Classes**:
- `Product`, `InventoryItem`, `ProcessingLog`: SQLAlchemy models
- `InventoryDatabase`: Service layer for CRUD operations

**Key Methods**:
```python
def add_or_update_item(product_data: dict, item_data: dict) -> int:
    """Smart insert: check for duplicates, update if exists."""
    
def get_expiring_soon(days: int = 7) -> list[dict]:
    """Get items expiring within N days."""
    
def search_products(query: str) -> list[dict]:
    """Full-text search across products."""
```

### Module: `pipeline.py`
**Purpose**: Orchestrate the entire processing workflow.

**Key Classes**:
- `InventoryProcessor`: Main pipeline coordinator

**Key Methods**:
```python
async def process_directory(directory_path: str) -> dict:
    """Process all images in directory and return report."""
    
async def process_single_image(image_path: str) -> dict:
    """Process one image through complete pipeline."""
```

**Pipeline Flow**:
```python
1. Validate image
2. Preprocess
3. Extract text (OCR)
4. Analyze with AI
5. Lookup barcode (if detected)
6. Merge data sources
7. Check for duplicates
8. Insert/update database
9. Log processing results
```

### Module: `cli.py`
**Purpose**: Command-line interface for all operations.

**Commands**:
```bash
pantry scan /path/to/images          # Process images
pantry list --expiring-soon          # Show inventory
pantry search "milk"                 # Search products
pantry update ITEM_ID --quantity 2   # Update item
pantry report --type shopping-list   # Generate reports
```

---

## 📝 Code Generation Guidelines for LLMs

### When Generating Code, Always Include:

1. **Type Hints**
```python
def process_image(image_path: str, options: dict[str, Any]) -> dict[str, Any]:
    """Process image and return results."""
```

2. **Comprehensive Docstrings**
```python
def analyze_product(image_path: str) -> dict:
    """
    Analyze product image using AI vision model.
    
    Args:
        image_path: Path to JPEG image file
        
    Returns:
        dict: Product data with keys:
            - product_name: str
            - brand: str
            - category: str
            - confidence: float
            
    Raises:
        ValueError: If image_path is invalid
        APIError: If vision API call fails
        
    Example:
        >>> result = analyze_product("images/milk.jpg")
        >>> print(result['product_name'])
        'Whole Milk'
    """
```

3. **Error Handling**
```python
try:
    result = external_api_call()
except RequestException as e:
    logger.error(f"API call failed: {e}")
    raise APIError("Failed to process image") from e
```

4. **Logging**
```python
import logging

logger = logging.getLogger(__name__)

def process():
    logger.info("Starting processing")
    logger.debug(f"Processing with params: {params}")
    logger.error(f"Failed to process: {error}")
```

5. **Unit Test Stubs**
```python
# tests/test_ocr_service.py
import pytest
from ocr_service import OCRService

@pytest.fixture
def ocr_service():
    return OCRService()

def test_extract_text_success(ocr_service):
    result = ocr_service.extract_text("tests/fixtures/clear_label.jpg")
    assert result['confidence'] > 0.85
    assert 'raw_text' in result
```

6. **Configuration Management**
```python
# Use dependency injection for configuration
class OCRService:
    def __init__(self, config: Settings):
        self.config = config
        self.confidence_threshold = config.ocr_confidence_threshold
```

---

## 🚀 Implementation Priority

### Phase 1: Core Foundation (Week 1)
1. Set up project structure
2. Implement database models (`database.py`)
3. Create configuration system (`config.py`)
4. Basic CLI structure (`cli.py`)

### Phase 2: Image Processing (Week 1-2)
1. Image preprocessor (`image_processor.py`)
2. Tesseract OCR integration (`ocr_service.py`)
3. Google Vision API wrapper (optional)
4. Test with sample images

### Phase 3: AI Integration (Week 2)
1. Vision AI analyzer (`ai_analyzer.py`)
2. Barcode lookup service (`barcode_service.py`)
3. Data merging and validation logic

### Phase 4: Pipeline (Week 2-3)
1. Main processing pipeline (`pipeline.py`)
2. Deduplication logic
3. Confidence-based routing
4. Batch processing with progress tracking

### Phase 5: User Interface (Week 3-4)
Choose one or both:
- **Option A**: Enhanced CLI with rich output
- **Option B**: REST API with FastAPI
- **Option C**: Streamlit web dashboard

### Phase 6: Production Readiness (Week 4)
1. Comprehensive error handling
2. Unit and integration tests
3. Documentation
4. Docker containerization
5. Deployment scripts

---

## 🧪 Testing Strategy

### Test Data Requirements
Create a test dataset with:
- 5 images of clear, well-lit product labels (expect high confidence)
- 3 images of blurry/angled labels (expect medium confidence)
- 2 images of products with barcodes visible
- 2 images of non-food items (expect rejection)
- 1 image of already-inventoried product (test deduplication)

### Test Categories

1. **Unit Tests**: Test each class/function in isolation
```python
def test_image_preprocessor():
    preprocessor = ImagePreprocessor()
    result = preprocessor.preprocess("test.jpg")
    assert os.path.exists(result)
    assert result.endswith("_preprocessed.jpg")
```

2. **Integration Tests**: Test component interactions
```python
def test_full_pipeline():
    processor = InventoryProcessor()
    report = processor.process_directory("tests/fixtures/")
    assert report['successful'] > 0
    assert report['failed'] == 0
```

3. **API Mocking**: Mock external services in tests
```python
@patch('ocr_service.google_vision_api_call')
def test_ocr_with_mock(mock_api):
    mock_api.return_value = {'text': 'Milk', 'confidence': 0.95}
    service = OCRService()
    result = service.extract_text("test.jpg")
    assert result['confidence'] == 0.95
```

---

## 💰 Cost Estimation

### API Costs (per 1000 images processed)

**Scenario 1: Optimal (Use Tesseract First)**
- Tesseract (80% of images): $0
- Google Vision (20% of images): $0.30
- GPT-4 Vision or Claude: $5-10
- **Total: ~$5.30-$10.30 per 1000 images**

**Scenario 2: All Cloud APIs**
- Google Vision: $1.50
- GPT-4 Vision or Claude: $5-10
- **Total: ~$6.50-$11.50 per 1000 images**

**Monthly Cost for Typical User**
- ~50 items/month: **$0.25-0.50/month**
- ~200 items/month: **$1-2/month**

---

## 🎓 Key Design Decisions Explained

### Why Two-Stage Processing (OCR + AI Vision)?
- **Specialization**: OCR engines are optimized for text extraction
- **Cost**: OCR is cheaper than sending every image to GPT-4V
- **Accuracy**: Combining both gives better results than either alone
- **Fallback**: If AI fails, you still have raw text from OCR

### Why Tesseract Before Cloud Vision?
- **Cost**: Tesseract is free, Cloud Vision costs money
- **Performance**: Tesseract is surprisingly good (85-90% accuracy)
- **Privacy**: Local processing keeps data on-device
- **Strategy**: Only use paid APIs when free ones aren't good enough

### Why SQLAlchemy ORM?
- **Portability**: Same code works with SQLite and PostgreSQL
- **Type Safety**: Pydantic-style models with validation
- **Productivity**: No raw SQL to write/maintain
- **Migrations**: Easy schema evolution with Alembic

### Why Async Processing?
- **I/O Bound**: Waiting for API responses is the bottleneck
- **Parallelism**: Process multiple images concurrently
- **Responsiveness**: Don't block while waiting for external services

---

## 📚 Resources for Implementation

### Essential Documentation
- **Tesseract**: https://github.com/tesseract-ocr/tesseract
- **Pillow**: https://pillow.readthedocs.io/
- **OpenCV**: https://docs.opencv.org/
- **SQLAlchemy**: https://docs.sqlalchemy.org/
- **FastAPI**: https://fastapi.tiangolo.com/
- **OpenAI Vision**: https://platform.openai.com/docs/guides/vision
- **Anthropic Claude**: https://docs.anthropic.com/
- **Open Food Facts**: https://world.openfoodfacts.org/data

### Sample Code Patterns
All prompts in the companion document "Pantry Inventory System - LLM Implementation Prompts" can be used to generate production code for each module.

---

## 🤝 How to Use This README (LLM Instructions)

If you are an LLM being asked to implement part of this system:

1. **Read the relevant sections** for the component you're implementing
2. **Follow the code generation guidelines** (type hints, docstrings, error handling)
3. **Use the module responsibilities** to understand what each file should do
4. **Reference the database schema** when writing database code
5. **Use the AI prompting strategy** when implementing AI vision features
6. **Follow the pipeline flow** when implementing the orchestrator
7. **Include tests** following the testing strategy section
8. **Ask clarifying questions** if any requirements are ambiguous

### Example: "Implement the OCR Service"
You should:
1. Read "Module: `ocr_service.py`" section
2. Understand it needs Tesseract + Google Vision
3. Use the cost optimization strategy (Tesseract first)
4. Follow the key methods signature
5. Include type hints, docstrings, error handling
6. Add unit tests with mocked API calls
7. Return complete, production-ready code

---

## 📄 License & Contributing
This is a reference implementation. Adapt as needed for your use case.

**Next Steps**: Use the companion prompt document to generate each module, or ask an LLM to implement specific components using this README as context.