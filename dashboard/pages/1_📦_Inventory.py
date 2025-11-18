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

# Image Processing Section
with st.expander("📸 Process Images", expanded=False):
    col1, col2 = st.columns(2)
    
    with col1:
        st.subheader("📁 Source Directory")
        try:
            source_info = api.get_source_directory()
            current_dir = source_info.get('source_directory', 'Not set')
            exists = source_info.get('exists', False)
            
            if exists:
                st.success(f"✅ {current_dir}")
            else:
                st.warning(f"⚠️ {current_dir} (does not exist)")
            
            new_dir = st.text_input(
                "Change source directory:",
                value=current_dir,
                placeholder="~/Pictures/Pantry"
            )
            
            if st.button("💾 Save Directory", key="save_dir"):
                try:
                    api.set_source_directory(new_dir)
                    st.success("✅ Source directory updated!")
                    st.rerun()
                except Exception as e:
                    st.error(f"❌ Failed to update directory: {e}")
        except Exception as e:
            st.error(f"Failed to load source directory: {e}")
    
    with col2:
        st.subheader("🔄 Refresh Inventory")
        st.caption("Process all new images from source directory")
        
        refresh_location = st.selectbox(
            "Storage Location",
            ["pantry", "fridge", "freezer"],
            key="refresh_location"
        )
        
        refresh_confidence = st.slider(
            "Min Confidence",
            min_value=0.0,
            max_value=1.0,
            value=0.6,
            step=0.1,
            key="refresh_confidence",
            help="Minimum AI confidence threshold (0.0-1.0)"
        )
        
        if st.button("🔄 Refresh Inventory", type="primary", use_container_width=True, key="refresh_btn"):
            try:
                with st.spinner("Processing images... This may take a while."):
                    result = api.refresh_inventory(
                        storage_location=refresh_location,
                        min_confidence=refresh_confidence
                    )
                    
                    results = result.get('results', {})
                    st.success(f"✅ Refresh complete!")
                    st.info(f"""
                    **Results:**
                    - ✅ Processed: {results.get('processed', 0)}
                    - ⏭️ Skipped: {results.get('skipped', 0)}
                    - ❌ Failed: {results.get('failed', 0)}
                    - 📦 Items Created: {results.get('items_created', 0)}
                    """)
                    
                    if results.get('errors'):
                        with st.expander("⚠️ Errors", expanded=False):
                            for error in results['errors'][:10]:  # Show first 10 errors
                                st.error(f"{error.get('image', 'Unknown')}: {error.get('error', 'Unknown error')}")
                    
                    st.rerun()
            except Exception as e:
                st.error(f"❌ Failed to refresh inventory: {e}")

st.markdown("---")

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
    
    st.markdown("---")
    
    # Upload Single Image
    st.header("📷 Process Single Image")
    st.caption("Upload an image to process through OCR and AI")
    
    uploaded_file = st.file_uploader(
        "Choose an image file",
        type=['jpg', 'jpeg', 'png'],
        help="Upload a product image to automatically extract information"
    )
    
    if uploaded_file:
        image_location = st.selectbox(
            "Storage Location",
            ["pantry", "fridge", "freezer"],
            key="image_location"
        )
        
        if st.button("🔍 Process Image", type="primary", use_container_width=True, key="process_image_btn"):
            try:
                with st.spinner("Processing image... Running OCR and AI analysis..."):
                    result = api.process_image(
                        file_data=uploaded_file.getvalue(),
                        filename=uploaded_file.name,
                        storage_location=image_location
                    )
                    
                    if result.get('success'):
                        item = result.get('item', {})
                        confidence = result.get('confidence', {})
                        
                        st.success(f"✅ Successfully processed: {item.get('product_name', 'Unknown')}")
                        st.info(f"""
                        **Confidence Scores:**
                        - OCR: {confidence.get('ocr', 0):.0%}
                        - AI: {confidence.get('ai', 0):.0%}
                        - Combined: {confidence.get('combined', 0):.0%}
                        """)
                        
                        st.rerun()
                    else:
                        st.error("Failed to process image")
                        
            except Exception as e:
                st.error(f"❌ Failed to process image: {e}")

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

