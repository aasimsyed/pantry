"""Inventory Management Page."""

import streamlit as st
from datetime import date
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))
from utils.api_client import get_api_client

st.set_page_config(page_title="Inventory", page_icon="📦", layout="wide")

st.title("📦 Inventory Management")
st.markdown("View and manage all pantry items")
st.markdown("---")

api = get_api_client()

# Sidebar - Add New Item Form
with st.sidebar:
    st.header("➕ Add New Item")
    
    with st.form("add_item_form"):
        st.subheader("Product Details")
        product_name = st.text_input("Product Name*", placeholder="e.g., Olive Oil")
        brand = st.text_input("Brand", placeholder="e.g., Bertolli")
        
        col1, col2 = st.columns(2)
        with col1:
            quantity = st.number_input("Quantity*", min_value=0.1, value=1.0, step=0.1)
            unit = st.selectbox("Unit*", ["count", "oz", "ml", "lb", "kg", "g"])
        with col2:
            storage_location = st.selectbox("Location*", ["pantry", "fridge", "freezer"])
            status = st.selectbox("Status", ["in_stock", "low"])
        
        expiration_date = st.date_input("Expiration Date", value=None)
        purchase_date = st.date_input("Purchase Date", value=date.today())
        notes = st.text_area("Notes", placeholder="Additional information...")
        
        submitted = st.form_submit_button("Add Item", type="primary", use_container_width=True)
        
        if submitted:
            if not product_name:
                st.error("Product name is required!")
            else:
                try:
                    # Create product first
                    product_data = {
                        "product_name": product_name,
                        "brand": brand or None
                    }
                    
                    # Search if product exists
                    try:
                        existing = api.search_products(product_name)
                        if existing:
                            product = existing[0]
                            product_id = product['id']
                            st.info(f"Using existing product: {product['product_name']}")
                        else:
                            product = api.create_product(product_data)
                            product_id = product['id']
                            st.success("Product created!")
                    except:
                        product = api.create_product(product_data)
                        product_id = product['id']
                    
                    # Create inventory item
                    item_data = {
                        "product_id": product_id,
                        "quantity": quantity,
                        "unit": unit,
                        "storage_location": storage_location,
                        "status": status,
                        "purchase_date": purchase_date.isoformat() if purchase_date else None,
                        "expiration_date": expiration_date.isoformat() if expiration_date else None,
                        "notes": notes or None
                    }
                    
                    api.create_inventory_item(item_data)
                    st.success(f"✅ Added {product_name} to inventory!")
                    st.rerun()
                
                except Exception as e:
                    st.error(f"Failed to add item: {e}")

# Filters
col1, col2, col3 = st.columns(3)
with col1:
    search_query = st.text_input("🔍 Search", placeholder="Search by name...")
with col2:
    location_filter = st.selectbox("📍 Location", ["All", "pantry", "fridge", "freezer"])
with col3:
    status_filter = st.selectbox("Status", ["All", "in_stock", "low", "expired", "consumed"])

# Get inventory
try:
    location = None if location_filter == "All" else location_filter
    status = None if status_filter == "All" else status_filter
    
    items = api.get_inventory(limit=1000, location=location, status=status)
    
    # Apply search filter
    if search_query:
        items = [i for i in items if search_query.lower() in i.get('product_name', '').lower()]
    
    st.markdown(f"**Found {len(items)} items**")
    st.markdown("---")
    
    if items:
        for item in items:
            with st.container():
                col1, col2, col3, col4, col5 = st.columns([3, 2, 2, 2, 1])
                
                with col1:
                    st.markdown(f"**{item.get('product_name', 'Unknown')}**")
                    if item.get('brand'):
                        st.caption(f"Brand: {item['brand']}")
                
                with col2:
                    qty = item.get('quantity', 0)
                    unit = item.get('unit', '')
                    st.write(f"**{qty} {unit}**")
                
                with col3:
                    loc = item.get('storage_location', 'Unknown')
                    st.write(f"📍 {loc.capitalize()}")
                
                with col4:
                    exp_date = item.get('expiration_date')
                    if exp_date:
                        st.write(f"📅 Exp: {exp_date}")
                    else:
                        st.write("📅 No expiration")
                
                with col5:
                    if st.button("🗑️", key=f"delete_{item['id']}", help="Delete item"):
                        try:
                            api.delete_inventory_item(item['id'])
                            st.success("Deleted!")
                            st.rerun()
                        except Exception as e:
                            st.error(f"Error: {e}")
                
                st.markdown("---")
    else:
        st.info("No items found. Add your first item using the sidebar!")

except Exception as e:
    st.error(f"Failed to load inventory: {e}")

