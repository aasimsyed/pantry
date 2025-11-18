"""Expiring Items Page."""

import streamlit as st
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from utils.api_client import get_api_client

st.set_page_config(page_title="Expiring Items", page_icon="⚠️", layout="wide")

st.title("⚠️ Expiring Items")
st.markdown("Track items that are expiring soon")
st.markdown("---")

api = get_api_client()

# Days selector
days = st.slider("Look ahead (days)", min_value=1, max_value=30, value=7)

# Get expiring items
try:
    expiring = api.get_expiring_items(days=days)
    expired = api.get_expired_items()
    
    # Expiring Soon Section
    st.subheader(f"⚠️ Expiring Within {days} Days ({len(expiring)} items)")
    
    if expiring:
        for item in expiring:
            col1, col2, col3, col4 = st.columns([3, 2, 2, 1])
            
            with col1:
                st.markdown(f"**{item.get('product_name', 'Unknown')}**")
            
            with col2:
                qty = item.get('quantity', 0)
                unit = item.get('unit', '')
                st.write(f"{qty} {unit}")
            
            with col3:
                exp_date = item.get('expiration_date', 'N/A')
                days_left = item.get('days_until_expiration', 0)
                color = "🔴" if days_left <= 3 else "🟡" if days_left <= 7 else "🟢"
                st.write(f"{color} {exp_date} ({days_left} days)")
            
            with col4:
                if st.button("✓ Consume", key=f"consume_{item['id']}"):
                    try:
                        api.consume_item(item['id'])
                        st.success("Consumed!")
                        st.rerun()
                    except Exception as e:
                        st.error(f"Error: {e}")
        
    else:
        st.success(f"✅ No items expiring in the next {days} days!")
    
    st.markdown("---")
    
    # Expired Section
    st.subheader(f"❌ Already Expired ({len(expired)} items)")
    
    if expired:
        for item in expired:
            col1, col2, col3, col4 = st.columns([3, 2, 2, 1])
            
            with col1:
                st.markdown(f"**{item.get('product_name', 'Unknown')}**")
            
            with col2:
                qty = item.get('quantity', 0)
                unit = item.get('unit', '')
                st.write(f"{qty} {unit}")
            
            with col3:
                exp_date = item.get('expiration_date', 'N/A')
                days_past = abs(item.get('days_until_expiration', 0))
                st.write(f"🔴 {exp_date} ({days_past} days ago)")
            
            with col4:
                if st.button("🗑️ Remove", key=f"delete_{item['id']}"):
                    try:
                        api.delete_inventory_item(item['id'])
                        st.success("Removed!")
                        st.rerun()
                    except Exception as e:
                        st.error(f"Error: {e}")
    else:
        st.success("✅ No expired items!")

except Exception as e:
    st.error(f"Failed to load expiring items: {e}")

