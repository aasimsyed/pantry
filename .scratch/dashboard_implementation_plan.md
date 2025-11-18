# Dashboard Implementation Plan

## 🎯 Project Overview

Build a **Smart Pantry Dashboard** with a clean architecture:
- **FastAPI** backend providing REST API endpoints
- **Streamlit** frontend consuming the API
- **Existing backend** (`src/`) remains unchanged - zero refactoring needed

## 📋 Implementation Phases

### Phase 1: FastAPI Layer (Est: 30 min)
**File:** `.scratch/task_1_fastapi_layer.md`
- Create API directory structure
- Implement core endpoints (CRUD operations)
- Add Pydantic response models
- Set up dependency injection for database sessions
- Auto-generated API documentation (Swagger)

### Phase 2: Streamlit Dashboard (Est: 1 hour)
**File:** `.scratch/task_2_streamlit_dashboard.md`
- Create dashboard directory structure
- Build multi-page application:
  - Home/Overview page
  - Inventory management page
  - Expiring items alerts page
  - Recipe suggestions page
  - Statistics/Analytics page
- Create reusable UI components
- Implement API client utility
- Add charts and visualizations

### Phase 3: Integration & Testing (Est: 20 min)
**File:** `.scratch/task_3_integration_testing.md`
- Add API endpoint tests
- Test Streamlit pages
- Create run scripts
- Update documentation
- Deployment guide

### Phase 4: Documentation & Polish (Est: 10 min)
**File:** `.scratch/task_4_documentation.md`
- Update README.md
- Add usage examples
- Create troubleshooting guide
- Document API endpoints
- Add screenshots/demos

## 🏗️ Architecture Principles

### Design Patterns
- **Layered Architecture**: Clear separation of concerns
- **Dependency Injection**: FastAPI dependencies for database sessions
- **Repository Pattern**: Already implemented in `db_service.py`
- **API Gateway**: FastAPI as single entry point

### Code Quality Standards
- **SOLID Principles**: Single responsibility, clean interfaces
- **DRY**: Reuse existing backend logic, no duplication
- **KISS**: Simple, straightforward implementations
- **YAGNI**: Only build what's needed now
- **Type Hints**: Full typing for all functions
- **Error Handling**: Comprehensive try/catch with logging

### Best Practices
- ES6 syntax where applicable (imports/exports)
- Comprehensive docstrings
- Minimal changes to existing code
- Leverage existing `src/db_service.py` service layer
- No direct database access from API layer (use service)

## 📁 Target Directory Structure

```
pantry/
├── src/                        # ✅ Existing - NO CHANGES
│   ├── database.py             # ORM models
│   ├── db_service.py           # Business logic layer
│   ├── ai_analyzer.py          # AI service
│   ├── ocr_service.py          # OCR service
│   └── image_processor.py      # Image processing
│
├── api/                        # ⬅️ NEW Phase 1
│   ├── __init__.py
│   ├── main.py                 # FastAPI app & routes
│   ├── models.py               # Pydantic response models
│   ├── dependencies.py         # Dependency injection
│   └── config.py               # API configuration
│
├── dashboard/                  # ⬅️ NEW Phase 2
│   ├── __init__.py
│   ├── app.py                  # Main Streamlit app (Home)
│   ├── pages/                  # Streamlit pages
│   │   ├── 1_📦_Inventory.py
│   │   ├── 2_⚠️_Expiring.py
│   │   ├── 3_🍳_Recipes.py
│   │   └── 4_📊_Statistics.py
│   ├── components/             # Reusable UI components
│   │   ├── __init__.py
│   │   ├── charts.py
│   │   ├── cards.py
│   │   └── forms.py
│   └── utils/                  # Dashboard utilities
│       ├── __init__.py
│       ├── api_client.py       # HTTP client for API
│       └── formatters.py       # Data formatting
│
├── tests/                      # ⬅️ EXTENDED Phase 3
│   ├── test_api.py             # API endpoint tests
│   └── test_dashboard.py       # Dashboard tests (optional)
│
├── scripts/                    # ✅ Existing + NEW
│   ├── run_api.sh              # Start FastAPI server
│   └── run_dashboard.sh        # Start Streamlit app
│
├── .scratch/                   # Task documentation
│   ├── dashboard_implementation_plan.md  # This file
│   ├── task_1_fastapi_layer.md
│   ├── task_2_streamlit_dashboard.md
│   ├── task_3_integration_testing.md
│   └── task_4_documentation.md
│
├── requirements.txt            # Updated with new deps
└── README.md                   # Updated with dashboard info
```

## 🔧 Technology Stack

### Backend (FastAPI)
- **FastAPI**: Modern, fast web framework
- **Uvicorn**: ASGI server
- **Pydantic**: Data validation & serialization
- **SQLAlchemy**: ORM (already using)

### Frontend (Streamlit)
- **Streamlit**: Rapid web app development
- **Plotly**: Interactive charts
- **Requests**: HTTP client for API calls
- **Pandas**: Data manipulation (already using)

### Testing
- **pytest**: Testing framework (already using)
- **httpx**: Async HTTP client for API tests

## 📦 New Dependencies

Add to `requirements.txt`:
```
# API Layer
fastapi>=0.104.0
uvicorn[standard]>=0.24.0
python-multipart>=0.0.6

# Dashboard
streamlit>=1.28.0
plotly>=5.18.0
requests>=2.31.0

# Testing
httpx>=0.25.0
```

## 🎯 Success Criteria

### Phase 1 Complete When:
- ✅ FastAPI server starts without errors
- ✅ All CRUD endpoints respond correctly
- ✅ Swagger docs accessible at `/docs`
- ✅ Endpoints use existing `PantryService`
- ✅ Proper error handling and status codes

### Phase 2 Complete When:
- ✅ Streamlit app starts without errors
- ✅ All pages load and display data
- ✅ Charts render correctly
- ✅ Forms work (add/edit/delete)
- ✅ API client handles errors gracefully

### Phase 3 Complete When:
- ✅ All API tests pass
- ✅ Both services can run simultaneously
- ✅ No linter errors in new code
- ✅ Documentation updated

### Phase 4 Complete When:
- ✅ README has complete usage instructions
- ✅ API endpoints documented
- ✅ Troubleshooting guide created
- ✅ Ready for Git commit

## 🚀 Execution Order

1. Read `task_1_fastapi_layer.md`
2. Implement FastAPI layer
3. Test API endpoints manually
4. Read `task_2_streamlit_dashboard.md`
5. Implement Streamlit dashboard
6. Test dashboard manually
7. Read `task_3_integration_testing.md`
8. Add automated tests
9. Read `task_4_documentation.md`
10. Update all documentation
11. Final commit

## 📝 Notes

- **Minimal Changes**: Do not modify existing `src/` code
- **Type Safety**: Use type hints everywhere
- **Error Handling**: Comprehensive error handling
- **Logging**: Use Python logging module
- **Configuration**: Load from environment variables
- **Testing**: Test new code, don't break existing tests
- **Documentation**: Update as you build, not after

## 🎨 UI/UX Principles

- **Clean & Modern**: Professional appearance
- **Responsive**: Works on desktop (mobile later)
- **Intuitive**: Self-explanatory navigation
- **Fast**: Minimal API calls, use caching
- **Informative**: Clear feedback for actions
- **Error Friendly**: Helpful error messages

## 🔐 Security Considerations

- **Input Validation**: Validate all inputs (Pydantic)
- **SQL Injection**: Use ORM (already protected)
- **CORS**: Configure properly for production
- **Rate Limiting**: Add if needed (future)
- **Authentication**: Not needed yet (local use)

## 📊 Performance Targets

- **API Response Time**: < 100ms for simple queries
- **Dashboard Load Time**: < 2 seconds
- **Large Dataset**: Handle 1000+ items smoothly
- **Concurrent Users**: 1 (local use, scale later)

## 🎯 Future Enhancements (Not Now)

- Mobile app (React Native)
- Real-time updates (WebSockets)
- User authentication
- Multi-user support
- Cloud deployment
- Barcode scanning
- Shopping list export
- Meal planning

---

**Status**: 📝 Planning Complete - Ready to Implement
**Next Step**: Read and implement `task_1_fastapi_layer.md`

