# Next Task: AI Analyzer Implementation

## Objective
Create an AI-powered module that extracts structured product information from OCR text using Claude or GPT-4.

---

## Requirements

### 1. Core Functionality

#### `AIAnalyzer` Class
Main class that processes OCR results and extracts structured data.

**Methods**:
```python
def analyze_product(ocr_result: dict) -> ProductData:
    """
    Extract structured product information from OCR text.
    
    Args:
        ocr_result: Output from OCRService.extract_text()
        
    Returns:
        ProductData object with extracted information
    """

def analyze_batch(ocr_results: List[dict]) -> List[ProductData]:
    """
    Process multiple OCR results in batch.
    
    Args:
        ocr_results: List of OCR results
        
    Returns:
        List of ProductData objects
    """
```

---

### 2. Data Models

#### `ProductData` (Pydantic Model)
```python
@dataclass
class ProductData:
    # Core identification
    product_name: str
    brand: Optional[str]
    category: str
    subcategory: Optional[str]
    
    # Dates
    expiration_date: Optional[datetime]
    manufactured_date: Optional[datetime]
    best_before_date: Optional[datetime]
    
    # Attributes
    key_attributes: List[str]
    dietary_tags: List[str]  # vegan, organic, gluten-free, etc.
    allergens: List[str]     # milk, nuts, soy, etc.
    
    # Nutrition (optional, if detected)
    serving_size: Optional[str]
    calories: Optional[int]
    nutritional_info: Optional[dict]
    
    # Metadata
    confidence: float  # 0.0-1.0
    raw_ocr_text: str
    processing_time: float
    model_used: str
    
    # Storage hints
    storage_location: Optional[str]  # pantry, fridge, freezer
    quantity_estimate: Optional[int]
```

---

### 3. AI Model Configuration

#### Support Multiple Models
- **Primary**: Claude 3.5 Sonnet (best for structured extraction)
- **Fallback**: GPT-4 Turbo
- **Local**: Option for future local models

#### Configuration
```python
@dataclass
class AIConfig:
    # Model selection
    provider: str = "anthropic"  # or "openai"
    model: str = "claude-3-5-sonnet-20241022"
    
    # API settings
    api_key: Optional[str] = None
    temperature: float = 0.0  # Deterministic for structured data
    max_tokens: int = 2000
    timeout: int = 30
    
    # Quality settings
    min_confidence: float = 0.7
    retry_on_low_confidence: bool = True
    max_retries: int = 3
    
    # Prompt settings
    use_few_shot: bool = True  # Include examples in prompt
    include_categories: bool = True  # Suggest known categories
```

---

### 4. Features to Implement

#### A. Intelligent Extraction
- Extract product names (handle variations, OCR errors)
- Identify brands (even with OCR typos)
- Detect expiration dates (multiple formats: MM/DD/YYYY, YYYY-MM, etc.)
- Parse dietary tags (vegan, organic, gluten-free, kosher, etc.)
- Identify allergens (nuts, dairy, soy, etc.)
- Categorize products (grains, condiments, snacks, etc.)

#### B. Error Handling
- Handle poor OCR quality
- Deal with partial/incomplete text
- Manage ambiguous products
- Validate extracted data
- Provide confidence scores

#### C. Smart Categorization
Pre-defined categories:
```python
CATEGORIES = {
    "Grains & Pasta": ["rice", "quinoa", "pasta", "noodles", "oats"],
    "Canned Goods": ["beans", "tomatoes", "soup", "vegetables"],
    "Condiments & Sauces": ["ketchup", "mustard", "soy sauce", "vinegar"],
    "Oils & Vinegars": ["olive oil", "sesame oil", "balsamic"],
    "Snacks": ["chips", "crackers", "nuts", "dried fruit"],
    "Baking": ["flour", "sugar", "baking powder", "vanilla"],
    "Spices & Seasonings": ["salt", "pepper", "cumin", "paprika"],
    "Beverages": ["tea", "coffee", "juice"],
    "Breakfast": ["cereal", "oatmeal", "pancake mix"],
    "International": ["miso", "curry paste", "tahini"],
}
```

#### D. Date Parsing
Support multiple date formats:
- `MM/DD/YYYY`, `MM/DD/YY`
- `YYYY-MM-DD`, `YYYY-MM`
- `DD MMM YYYY`, `MMM YYYY`
- `BEST BY:`, `EXP:`, `USE BY:`
- Handle OCR errors in dates

#### E. Prompt Engineering
Create effective prompts:
- Clear instructions
- Few-shot examples
- JSON schema specification
- Error handling instructions
- Category suggestions

---

### 5. Caching & Performance

#### Results Caching
- Cache AI responses by OCR text hash
- Avoid re-analyzing same text
- Configurable cache TTL

#### Batch Processing
- Process multiple items in parallel (where possible)
- Rate limiting for API calls
- Progress tracking
- Cost tracking

---

### 6. Configuration

#### Environment Variables
```bash
# AI Provider
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# AI Settings
AI_PROVIDER=anthropic
AI_MODEL=claude-3-5-sonnet-20241022
AI_TEMPERATURE=0.0
AI_MAX_TOKENS=2000
AI_MIN_CONFIDENCE=0.7

# Cost limits
AI_MAX_COST_PER_REQUEST=0.05
AI_DAILY_COST_LIMIT=1.00
```

---

### 7. Error Handling & Logging

#### Comprehensive Logging
- Log all API calls
- Track costs per request
- Monitor confidence scores
- Record extraction errors
- Performance metrics

#### Error Recovery
- Retry on transient failures
- Fallback to alternative model
- Handle rate limits
- Validate JSON output
- Graceful degradation

---

### 8. Testing Strategy

#### Unit Tests
- Test data model validation
- Test prompt generation
- Test response parsing
- Test error handling
- Mock API responses

#### Integration Tests
- Process real OCR results
- Verify extraction accuracy
- Test with poor OCR quality
- Measure confidence scores
- Test batch processing

#### Test Cases
1. Clear product label (high confidence)
2. Poor OCR quality (low confidence)
3. Minimal text (e.g., just brand name)
4. Nutrition label (structured data)
5. Multiple languages
6. Ambiguous products

---

### 9. Success Criteria

✅ Successfully extract:
- Product names (>90% accuracy)
- Brands (>85% accuracy)
- Categories (>90% accuracy)
- Expiration dates (>80% accuracy)
- Dietary tags (>85% accuracy)

✅ Performance:
- <3 seconds per item
- >0.8 average confidence
- <$0.01 per item cost

✅ Quality:
- Handle OCR errors gracefully
- Validate all extracted data
- Provide confidence scores
- Generate useful metadata

---

### 10. Implementation Order

1. ✅ Setup & Configuration
   - Install dependencies
   - Configure API keys
   - Test AI connection

2. ✅ Data Models
   - Create ProductData model
   - Create AIConfig model
   - Validation logic

3. ✅ Prompt Engineering
   - Design extraction prompt
   - Add few-shot examples
   - Test with samples

4. ✅ AIAnalyzer Class
   - Basic extraction
   - Response parsing
   - Error handling

5. ✅ Batch Processing
   - Parallel processing
   - Progress tracking
   - Cost tracking

6. ✅ Caching Layer
   - Response caching
   - Cache management

7. ✅ Testing
   - Unit tests
   - Integration tests
   - Real data testing

8. ✅ Documentation
   - Usage examples
   - API documentation

---

### 11. Dependencies

```txt
# AI Providers
anthropic>=0.7.0
openai>=1.3.0

# Data Validation
pydantic>=2.5.0
pydantic-settings>=2.1.0

# Date Parsing
python-dateutil>=2.8.0

# Caching (already have)
diskcache>=5.6.0

# Async (for batch)
aiohttp>=3.9.0
```

---

### 12. Cost Management

#### Estimated Costs (64 items)

**Claude 3.5 Sonnet**:
- Input: ~150 tokens/item × 64 = 9,600 tokens
- Output: ~200 tokens/item × 64 = 12,800 tokens
- Cost: $0.03 + $0.19 = **$0.22 total**

**Per-item**: ~$0.003 (very affordable!)

#### Cost Tracking
- Log costs for each request
- Track daily/monthly spending
- Set spending limits
- Alert when approaching limits

---

### 13. Sample Prompt

```python
EXTRACTION_PROMPT = """Extract product information from this OCR text. The text may have OCR errors.

OCR Text:
{ocr_text}

Extract these fields and return ONLY valid JSON:

{{
  "product_name": "Full product name (correct any OCR errors)",
  "brand": "Brand name or null",
  "category": "One of: Grains & Pasta, Canned Goods, Condiments & Sauces, Oils & Vinegars, Snacks, Baking, Spices & Seasonings, Beverages, Breakfast, International, Other",
  "subcategory": "More specific category or null",
  "expiration_date": "YYYY-MM-DD or null (look for EXP, BEST BY, USE BY)",
  "key_attributes": ["List of key features like '25% Less Sodium', 'Organic', etc"],
  "dietary_tags": ["Tags like 'vegan', 'organic', 'gluten-free', 'kosher'"],
  "allergens": ["Common allergens if mentioned: 'milk', 'nuts', 'soy', 'wheat'"],
  "confidence": 0.0-1.0 (how confident are you in this extraction?)
}}

Guidelines:
- Fix obvious OCR errors (e.g., "0RGANIC" → "ORGANIC")
- Be conservative with confidence scores
- Return null for unclear fields
- Categories must match the list above
- Dates can be partial (e.g., "2021-12" for December 2021)

Return ONLY the JSON, no other text."""
```

---

### 14. Example Usage

```python
from src.ai_analyzer import AIAnalyzer, AIConfig
from src.ocr_service import create_ocr_service

# Setup
ai_config = AIConfig.from_env()
analyzer = AIAnalyzer(ai_config)
ocr_service = create_ocr_service()

# Process one image
ocr_result = ocr_service.extract_text("pantry_item.jpg")
product = analyzer.analyze_product(ocr_result)

print(f"Product: {product.product_name}")
print(f"Brand: {product.brand}")
print(f"Category: {product.category}")
print(f"Expires: {product.expiration_date}")
print(f"Tags: {', '.join(product.dietary_tags)}")
print(f"Confidence: {product.confidence:.0%}")

# Process batch
from pathlib import Path

images = list(Path("~/Pictures/Pantry").glob("*.jpeg"))
for image in images:
    ocr_result = ocr_service.extract_text(str(image))
    product = analyzer.analyze_product(ocr_result)
    # Save to database...
```

---

## Next Steps

1. **Setup** (10 minutes)
   - Get Anthropic API key
   - Set environment variable
   - Install dependencies
   - Run test script

2. **Implementation** (2-3 hours)
   - Data models
   - Prompt engineering
   - AIAnalyzer class
   - Testing

3. **Testing** (30 minutes)
   - Test with sample items
   - Verify accuracy
   - Check costs

4. **Production** (30 minutes)
   - Process all 64 items
   - Review results
   - Save to database

---

## Resources

- **Claude API Docs**: https://docs.anthropic.com/
- **Prompt Engineering Guide**: https://docs.anthropic.com/claude/docs/prompt-engineering
- **Best Practices**: https://docs.anthropic.com/claude/docs/guide-to-anthropics-prompt-engineering-resources

---

**Ready to build the smartest pantry analyzer ever!** 🧠🥫

