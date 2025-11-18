# Task 2: Streamlit Dashboard Implementation

## 🎯 Objective

Create a modern, user-friendly Streamlit dashboard that consumes the FastAPI endpoints and provides an intuitive interface for managing pantry inventory.

## 📋 Requirements

### Must Have
- ✅ Multi-page application (Home, Inventory, Expiring, Recipes, Statistics)
- ✅ Real-time data from FastAPI endpoints
- ✅ Add/Edit/Delete functionality for inventory items
- ✅ Interactive charts and visualizations
- ✅ Search and filtering
- ✅ Responsive layout
- ✅ Error handling with user-friendly messages
- ✅ Loading states for API calls

### Should Have
- ✅ Session state management
- ✅ Form validation
- ✅ Data caching for performance
- ✅ Export functionality (CSV/JSON)
- ✅ Batch operations
- ✅ Keyboard shortcuts

### Nice to Have
- Dark mode toggle
- Customizable dashboard layout
- Notifications/alerts
- Undo functionality

## 🏗️ Implementation Steps

### Step 1: Create Directory Structure

```bash
dashboard/
├── __init__.py
├── app.py                      # Main app (Home page)
├── pages/
│   ├── 1_📦_Inventory.py      # Inventory management
│   ├── 2_⚠️_Expiring.py       # Expiring items alerts
│   ├── 3_🍳_Recipes.py        # Recipe suggestions
│   └── 4_📊_Statistics.py     # Analytics dashboard
├── components/
│   ├── __init__.py
│   ├── charts.py              # Reusable chart components
│   ├── cards.py               # UI card components
│   └── forms.py               # Form components
└── utils/
    ├── __init__.py
    ├── api_client.py          # HTTP client for FastAPI
    ├── formatters.py          # Data formatting utilities
    └── state.py               # Session state management
```

### Step 2: Implement `dashboard/utils/api_client.py`

**Purpose**: Centralized HTTP client for all API calls

**Requirements**:
- Wrapper functions for all API endpoints
- Error handling and retries
- Response caching
- Loading indicators
- Type hints for responses

**Implementation Details**:
```python
import requests
import streamlit as st
from typing import List, Dict, Optional, Any
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class APIClient:
    """Client for Smart Pantry API."""
    
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.timeout = 10
    
    def _request(
        self,
        method: str,
        endpoint: str,
        params: Optional[Dict] = None,
        json: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        Make HTTP request with error handling.
        
        Args:
            method: HTTP method (GET, POST, PUT, DELETE)
            endpoint: API endpoint path
            params: Query parameters
            json: Request body (for POST/PUT)
            
        Returns:
            Response data as dictionary
            
        Raises:
            requests.RequestException: On API error
        """
        url = f"{self.base_url}{endpoint}"
        
        try:
            response = requests.request(
                method=method,
                url=url,
                params=params,
                json=json,
                timeout=self.timeout
            )
            response.raise_for_status()
            return response.json()
        
        except requests.RequestException as e:
            logger.error(f"API request failed: {e}")
            raise
    
    # Inventory methods
    def get_inventory(
        self,
        skip: int = 0,
        limit: int = 100,
        location: Optional[str] = None,
        status: Optional[str] = None
    ) -> List[Dict]:
        """Get inventory items with optional filtering."""
        params = {"skip": skip, "limit": limit}
        if location:
            params["location"] = location
        if status:
            params["status"] = status
        
        return self._request("GET", "/api/inventory", params=params)
    
    def get_inventory_item(self, item_id: int) -> Dict:
        """Get single inventory item by ID."""
        return self._request("GET", f"/api/inventory/{item_id}")
    
    def create_inventory_item(self, data: Dict) -> Dict:
        """Create new inventory item."""
        return self._request("POST", "/api/inventory", json=data)
    
    def update_inventory_item(self, item_id: int, data: Dict) -> Dict:
        """Update existing inventory item."""
        return self._request("PUT", f"/api/inventory/{item_id}", json=data)
    
    def delete_inventory_item(self, item_id: int) -> Dict:
        """Delete inventory item."""
        return self._request("DELETE", f"/api/inventory/{item_id}")
    
    def consume_item(self, item_id: int, quantity: Optional[float] = None) -> Dict:
        """Mark item as consumed or decrement quantity."""
        return self._request(
            "POST",
            f"/api/inventory/{item_id}/consume",
            json={"quantity": quantity} if quantity else {}
        )
    
    # Product methods
    def get_products(self, skip: int = 0, limit: int = 100) -> List[Dict]:
        """Get all products."""
        return self._request("GET", "/api/products", params={"skip": skip, "limit": limit})
    
    def search_products(self, query: str) -> List[Dict]:
        """Search products by name, brand, or category."""
        return self._request("GET", "/api/products/search", params={"q": query})
    
    # Expiration methods
    def get_expiring_items(self, days: int = 7) -> List[Dict]:
        """Get items expiring within specified days."""
        return self._request("GET", "/api/expiring", params={"days": days})
    
    def get_expired_items(self) -> List[Dict]:
        """Get all expired items."""
        return self._request("GET", "/api/expired")
    
    # Statistics methods
    def get_statistics(self) -> Dict:
        """Get overall pantry statistics."""
        return self._request("GET", "/api/statistics")
    
    def get_statistics_by_category(self) -> Dict:
        """Get statistics grouped by category."""
        return self._request("GET", "/api/statistics/by-category")
    
    def get_statistics_by_location(self) -> Dict:
        """Get statistics grouped by storage location."""
        return self._request("GET", "/api/statistics/by-location")
    
    # Health check
    def health_check(self) -> Dict:
        """Check API health."""
        return self._request("GET", "/health")


# Singleton instance
@st.cache_resource
def get_api_client() -> APIClient:
    """Get cached API client instance."""
    return APIClient()
```

### Step 3: Implement `dashboard/utils/formatters.py`

**Purpose**: Data formatting utilities for display

**Requirements**:
- Date/datetime formatting
- Number formatting (quantities, percentages)
- Status badges
- Duration calculations (days until expiration)
- Color coding

**Example Functions**:
```python
from datetime import datetime, date
from typing import Optional

def format_date(dt: Optional[date]) -> str:
    """Format date for display."""
    if not dt:
        return "N/A"
    return dt.strftime("%b %d, %Y")

def format_datetime(dt: Optional[datetime]) -> str:
    """Format datetime for display."""
    if not dt:
        return "N/A"
    return dt.strftime("%b %d, %Y %I:%M %p")

def format_quantity(quantity: float, unit: str) -> str:
    """Format quantity with unit."""
    return f"{quantity:.1f} {unit}"

def get_status_color(status: str) -> str:
    """Get color for status badge."""
    colors = {
        "in_stock": "green",
        "low": "orange",
        "expired": "red",
        "consumed": "gray"
    }
    return colors.get(status, "blue")

def get_expiration_color(days_until: Optional[int]) -> str:
    """Get color based on days until expiration."""
    if days_until is None:
        return "gray"
    if days_until < 0:
        return "red"
    if days_until <= 3:
        return "red"
    if days_until <= 7:
        return "orange"
    return "green"

def days_until_expiration(expiration_date: Optional[date]) -> Optional[int]:
    """Calculate days until expiration."""
    if not expiration_date:
        return None
    delta = expiration_date - date.today()
    return delta.days
```

### Step 4: Implement `dashboard/components/charts.py`

**Purpose**: Reusable chart components using Plotly

**Requirements**:
- Inventory by category (pie chart)
- Inventory by location (bar chart)
- Expiration timeline (gantt/timeline chart)
- Category trends (line chart)
- Storage distribution (treemap)

**Example Charts**:
```python
import plotly.express as px
import plotly.graph_objects as go
from typing import List, Dict
import pandas as pd

def create_category_pie_chart(items: List[Dict]) -> go.Figure:
    """Create pie chart of inventory by category."""
    df = pd.DataFrame(items)
    if df.empty:
        return go.Figure()
    
    category_counts = df['category'].value_counts()
    
    fig = px.pie(
        values=category_counts.values,
        names=category_counts.index,
        title="Inventory by Category",
        hole=0.3
    )
    return fig

def create_location_bar_chart(items: List[Dict]) -> go.Figure:
    """Create bar chart of inventory by storage location."""
    df = pd.DataFrame(items)
    if df.empty:
        return go.Figure()
    
    location_counts = df['storage_location'].value_counts()
    
    fig = px.bar(
        x=location_counts.index,
        y=location_counts.values,
        labels={'x': 'Location', 'y': 'Item Count'},
        title="Inventory by Storage Location"
    )
    return fig

# Add more chart functions...
```

### Step 5: Implement `dashboard/components/cards.py`

**Purpose**: Reusable card components for displaying items

**Example Components**:
```python
import streamlit as st
from typing import Dict, Optional
from ..utils.formatters import format_date, get_status_color, days_until_expiration

def inventory_item_card(item: Dict) -> None:
    """Display inventory item as a card."""
    with st.container():
        col1, col2, col3 = st.columns([3, 2, 1])
        
        with col1:
            st.subheader(item['product_name'])
            if item.get('brand'):
                st.caption(f"Brand: {item['brand']}")
        
        with col2:
            st.metric("Quantity", f"{item['quantity']} {item['unit']}")
            st.caption(f"Location: {item['storage_location']}")
        
        with col3:
            # Status badge
            status_color = get_status_color(item['status'])
            st.markdown(
                f"<span style='color: {status_color}'>●</span> {item['status']}",
                unsafe_allow_html=True
            )
            
            # Expiration
            if item.get('expiration_date'):
                days = days_until_expiration(item['expiration_date'])
                exp_color = get_expiration_color(days)
                st.caption(f"Expires: {format_date(item['expiration_date'])}")

def stat_card(label: str, value: str, delta: Optional[str] = None) -> None:
    """Display statistic as a card."""
    st.metric(label=label, value=value, delta=delta)
```

### Step 6: Implement `dashboard/app.py` (Home Page)

**Purpose**: Main entry point and home/overview page

**Requirements**:
- Welcome message
- Quick statistics overview
- Recent activity
- Quick actions (add item, view expiring)
- API health check
- Navigation instructions

**Layout**:
```python
import streamlit as st
from utils.api_client import get_api_client
from utils.formatters import format_date
from components.cards import stat_card

# Page config
st.set_page_config(
    page_title="Smart Pantry Dashboard",
    page_icon="🏠",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS
st.markdown("""
<style>
    .main-header {
        font-size: 3rem;
        font-weight: bold;
        color: #1f77b4;
    }
    .stat-card {
        padding: 1rem;
        border-radius: 0.5rem;
        background-color: #f0f2f6;
    }
</style>
""", unsafe_allow_html=True)

# Header
st.markdown('<p class="main-header">🏠 Smart Pantry Dashboard</p>', unsafe_allow_html=True)
st.markdown("---")

# Get API client
api = get_api_client()

# Health check
try:
    health = api.health_check()
    if health['status'] == 'healthy':
        st.success("✅ Connected to API")
except Exception as e:
    st.error(f"❌ API Connection Failed: {e}")
    st.stop()

# Quick statistics
st.subheader("📊 Overview")
try:
    stats = api.get_statistics()
    
    col1, col2, col3, col4 = st.columns(4)
    with col1:
        stat_card("Total Items", str(stats.get('total_items', 0)))
    with col2:
        stat_card("In Stock", str(stats.get('in_stock', 0)))
    with col3:
        stat_card("Expiring Soon", str(stats.get('expiring_soon', 0)))
    with col4:
        stat_card("Expired", str(stats.get('expired', 0)))

except Exception as e:
    st.error(f"Failed to load statistics: {e}")

st.markdown("---")

# Quick actions
st.subheader("🚀 Quick Actions")
col1, col2, col3 = st.columns(3)
with col1:
    if st.button("➕ Add New Item", use_container_width=True):
        st.switch_page("pages/1_📦_Inventory.py")
with col2:
    if st.button("⚠️ View Expiring Items", use_container_width=True):
        st.switch_page("pages/2_⚠️_Expiring.py")
with col3:
    if st.button("🍳 Generate Recipes", use_container_width=True):
        st.switch_page("pages/3_🍳_Recipes.py")

# Navigation guide
st.markdown("---")
st.subheader("📖 Navigation")
st.markdown("""
- **📦 Inventory**: View and manage all pantry items
- **⚠️ Expiring**: Track items expiring soon
- **🍳 Recipes**: Get recipe suggestions based on available items
- **📊 Statistics**: View analytics and insights
""")
```

### Step 7: Implement `dashboard/pages/1_📦_Inventory.py`

**Purpose**: Full inventory management page

**Features**:
- List all items (with pagination)
- Search and filter
- Add new item (form)
- Edit existing item (modal/form)
- Delete item (with confirmation)
- Bulk actions (future)
- Export to CSV/JSON

**Layout**: Table view with actions, sidebar for filters/add form

### Step 8: Implement `dashboard/pages/2_⚠️_Expiring.py`

**Purpose**: Expiration tracking and alerts

**Features**:
- List items expiring soon (configurable days)
- Visual timeline
- Color-coded urgency
- Quick actions (consume, extend expiration)
- Already expired items section
- Sorting options

### Step 9: Implement `dashboard/pages/3_🍳_Recipes.py`

**Purpose**: AI-powered recipe suggestions

**Features**:
- Generate recipes based on available items
- Filter by cuisine, difficulty, dietary restrictions
- Display recipe details (ingredients, instructions)
- Mark ingredients as used
- Save favorite recipes (future)

### Step 10: Implement `dashboard/pages/4_📊_Statistics.py`

**Purpose**: Analytics and insights dashboard

**Features**:
- Interactive charts (category, location, trends)
- Date range selector
- Export charts as images
- Summary statistics
- Consumption patterns (future)

## 🧪 Testing Requirements

### Manual Testing

1. **Start FastAPI server** (Terminal 1):
   ```bash
   uvicorn api.main:app --reload --port 8000
   ```

2. **Start Streamlit dashboard** (Terminal 2):
   ```bash
   streamlit run dashboard/app.py
   ```

3. **Test each page**:
   - Navigate to each page via sidebar
   - Test all interactions (buttons, forms, filters)
   - Verify data loads correctly
   - Test error scenarios (stop API, invalid data)

### Validation Checklist

- ✅ Dashboard loads without errors
- ✅ All pages accessible via sidebar
- ✅ Data displays correctly from API
- ✅ Forms work (validation, submission)
- ✅ Charts render properly
- ✅ Search/filter functionality works
- ✅ Error messages are user-friendly
- ✅ Loading states show during API calls
- ✅ Responsive layout (resize browser)
- ✅ No console errors in Streamlit terminal

## 📝 Best Practices to Follow

### UI/UX
- ✅ Clear, intuitive navigation
- ✅ Consistent styling throughout
- ✅ Loading indicators for slow operations
- ✅ Success/error messages for actions
- ✅ Confirmation dialogs for destructive actions
- ✅ Helpful empty states ("No items found")

### Code Quality
- ✅ Reusable components (DRY principle)
- ✅ Type hints throughout
- ✅ Docstrings for functions
- ✅ Error handling with try/except
- ✅ Use session state appropriately
- ✅ Cache API calls when possible

### Performance
- ✅ Cache API client (`@st.cache_resource`)
- ✅ Cache data calls (`@st.cache_data`)
- ✅ Pagination for large lists
- ✅ Lazy loading for images/charts
- ✅ Efficient re-renders (minimize `st.rerun()`)

## 📦 Dependencies to Add

Already in requirements from Phase 1:
```txt
streamlit>=1.28.0
plotly>=5.18.0
requests>=2.31.0
```

## ✅ Definition of Done

This task is complete when:

1. ✅ All pages created and functional
2. ✅ Dashboard starts without errors: `streamlit run dashboard/app.py`
3. ✅ All pages load and display data
4. ✅ Forms work (add, edit inventory items)
5. ✅ Charts render correctly
6. ✅ Search/filter functionality works
7. ✅ Error handling provides user-friendly messages
8. ✅ Responsive layout verified
9. ✅ No linter errors in new code
10. ✅ All features from requirements implemented

## 🔄 Next Steps

After completing this task:
1. Test full user workflow (add item → view → expire → delete)
2. Take screenshots for documentation
3. Proceed to `task_3_integration_testing.md`

---

**Estimated Time**: 1 hour  
**Difficulty**: Medium (UI complexity)  
**Dependencies**: Task 1 (FastAPI must be running)

