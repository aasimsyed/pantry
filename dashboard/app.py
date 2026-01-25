"""
Smart Pantry Dashboard - Home Page.

Main entry point for the Streamlit multi-page application.
"""

import streamlit as st
from utils.api_client import get_api_client

# Page configuration
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
        margin-bottom: 1rem;
    }
    .stat-card {
        padding: 1.5rem;
        border-radius: 0.5rem;
        background-color: #f0f2f6;
        text-align: center;
    }
    .stat-value {
        font-size: 2.5rem;
        font-weight: bold;
        color: #1f77b4;
    }
    .stat-label {
        font-size: 1rem;
        color: #666;
    }
</style>
""", unsafe_allow_html=True)

# Header
st.markdown('<p class="main-header">🏠 Smart Pantry Dashboard</p>', unsafe_allow_html=True)
st.markdown("**Manage your pantry inventory with AI-powered insights**")
st.markdown("---")

# Get API client
api = get_api_client()

# Health check
try:
    health = api.health_check()
    if health.get('status') == 'healthy':
        st.success(f"✅ Connected to {health.get('service', 'API')}")
    else:
        st.warning("⚠️ API Status Unknown")
except Exception as e:
    st.error(f"❌ API Connection Failed: {e}")
    st.info("💡 **Start the API server:** `uvicorn api.main:app --host 0.0.0.0 --port 8000`")
    st.stop()

# Quick Statistics
st.subheader("📊 Overview")

try:
    stats = api.get_statistics()
    
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        st.markdown(f"""
        <div class="stat-card">
            <div class="stat-value">{stats.get('total_items', 0)}</div>
            <div class="stat-label">Total Items</div>
        </div>
        """, unsafe_allow_html=True)
    
    with col2:
        st.markdown(f"""
        <div class="stat-card">
            <div class="stat-value">{stats.get('in_stock', 0)}</div>
            <div class="stat-label">In Stock</div>
        </div>
        """, unsafe_allow_html=True)
    
    with col3:
        expiring = stats.get('expiring_soon', 0)
        color = "#ff6b6b" if expiring > 0 else "#1f77b4"
        st.markdown(f"""
        <div class="stat-card">
            <div class="stat-value" style="color: {color};">{expiring}</div>
            <div class="stat-label">Expiring Soon</div>
        </div>
        """, unsafe_allow_html=True)
    
    with col4:
        expired = stats.get('expired', 0)
        color = "#ff6b6b" if expired > 0 else "#1f77b4"
        st.markdown(f"""
        <div class="stat-card">
            <div class="stat-value" style="color: {color};">{expired}</div>
            <div class="stat-label">Expired</div>
        </div>
        """, unsafe_allow_html=True)
    
except Exception as e:
    st.error(f"Failed to load statistics: {e}")

st.markdown("---")

# Quick Actions
st.subheader("🚀 Quick Actions")

col1, col2, col3, col4 = st.columns(4)

with col1:
    if st.button("➕ Add New Item", use_container_width=True, type="primary"):
        st.switch_page("pages/1_📦_Inventory.py")

with col2:
    if st.button("⚠️ View Expiring Items", use_container_width=True):
        st.switch_page("pages/2_⚠️_Expiring.py")

with col3:
    if st.button("🍳 Generate Recipes", use_container_width=True):
        st.switch_page("pages/3_🍳_Recipes.py")

with col4:
    if st.button("📚 Recipe Box", use_container_width=True):
        st.switch_page("pages/5_📚_Recipe_Box.py")

st.markdown("---")

# Recent Activity / What's in Your Pantry
st.subheader("📦 Recent Items")

try:
    items = api.get_inventory(limit=5)
    
    if items:
        for item in items:
            col1, col2, col3, col4 = st.columns([3, 2, 2, 1])
            
            with col1:
                st.write(f"**{item.get('product_name', 'Unknown Product')}**")
            
            with col2:
                quantity = item.get('quantity', 0)
                unit = item.get('unit', '')
                st.write(f"Qty: {quantity} {unit}")
            
            with col3:
                location = item.get('storage_location', 'Unknown')
                st.write(f"📍 {location}")
            
            with col4:
                status = item.get('status', 'unknown')
                status_emoji = {
                    'in_stock': '✅',
                    'low': '⚠️',
                    'expired': '❌',
                    'consumed': '✓'
                }.get(status, '❓')
                st.write(status_emoji)
        
        if st.button("View All Items"):
            st.switch_page("pages/1_📦_Inventory.py")
    else:
        st.info("No items in pantry yet. Add your first item!")
        if st.button("Add First Item"):
            st.switch_page("pages/1_📦_Inventory.py")

except Exception as e:
    st.error(f"Failed to load recent items: {e}")

st.markdown("---")

# Navigation Guide
st.subheader("📖 Navigation")
st.markdown("""
Use the sidebar to navigate between pages:

- **📦 Inventory**: View and manage all pantry items
- **⚠️ Expiring**: Track items expiring soon
- **🍳 Recipes**: Get recipe suggestions (future feature)
- **📊 Statistics**: View analytics and insights
""")

# Footer
st.markdown("---")
st.caption("Smart Pantry Management System v1.1.2")

