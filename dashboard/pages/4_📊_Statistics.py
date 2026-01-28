"""Statistics and Analytics Page."""

import streamlit as st
import plotly.express as px
import plotly.graph_objects as go
import pandas as pd
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from utils.api_client import get_api_client, require_auth

st.set_page_config(page_title="Statistics", page_icon="📊", layout="wide")

# Require authentication
require_auth()

st.title("📊 Pantry Statistics")
st.markdown("Analytics and insights about your pantry inventory")
st.markdown("---")

api = get_api_client()

try:
    # Get statistics
    stats = api.get_statistics()
    
    # Overview metrics
    st.subheader("📈 Overview")
    col1, col2, col3, col4, col5 = st.columns(5)
    
    with col1:
        st.metric("Total Items", stats.get('total_items', 0))
    with col2:
        st.metric("Products", stats.get('total_products', 0))
    with col3:
        st.metric("In Stock", stats.get('in_stock', 0))
    with col4:
        st.metric("Expiring Soon", stats.get('expiring_soon', 0))
    with col5:
        st.metric("Expired", stats.get('expired', 0))
    
    st.markdown("---")
    
    # Charts
    col1, col2 = st.columns(2)
    
    # Category Distribution (Pie Chart)
    with col1:
        st.subheader("📦 By Category")
        by_category = stats.get('by_category', {})
        
        if by_category:
            df_category = pd.DataFrame([
                {"Category": k, "Count": v}
                for k, v in by_category.items()
            ])
            
            fig = px.pie(
                df_category,
                values='Count',
                names='Category',
                title='Inventory by Category',
                hole=0.3
            )
            st.plotly_chart(fig, use_container_width=True)
        else:
            st.info("No category data available")
    
    # Location Distribution (Bar Chart)
    with col2:
        st.subheader("📍 By Location")
        by_location = stats.get('by_location', {})
        
        if by_location:
            df_location = pd.DataFrame([
                {"Location": k.capitalize(), "Count": v}
                for k, v in by_location.items()
            ])
            
            fig = px.bar(
                df_location,
                x='Location',
                y='Count',
                title='Inventory by Storage Location',
                color='Location',
                text='Count'
            )
            fig.update_traces(textposition='outside')
            st.plotly_chart(fig, use_container_width=True)
        else:
            st.info("No location data available")
    
    st.markdown("---")
    
    # Status Distribution (Horizontal Bar)
    st.subheader("📋 By Status")
    by_status = stats.get('by_status', {})
    
    if by_status:
        df_status = pd.DataFrame([
            {"Status": k.replace('_', ' ').title(), "Count": v}
            for k, v in by_status.items()
        ])
        
        colors = {
            'In Stock': '#51cf66',
            'Low': '#ffd43b',
            'Expired': '#ff6b6b',
            'Consumed': '#868e96'
        }
        
        fig = go.Figure(data=[go.Bar(
            y=df_status['Status'],
            x=df_status['Count'],
            orientation='h',
            marker=dict(color=[colors.get(s, '#1f77b4') for s in df_status['Status']]),
            text=df_status['Count'],
            textposition='outside'
        )])
        
        fig.update_layout(
            title='Items by Status',
            xaxis_title='Count',
            yaxis_title='Status',
            showlegend=False
        )
        st.plotly_chart(fig, use_container_width=True)
    else:
        st.info("No status data available")
    
    st.markdown("---")
    
    # Detailed breakdown table
    st.subheader("📝 Detailed Breakdown")
    
    tab1, tab2, tab3 = st.tabs(["By Category", "By Location", "By Status"])
    
    with tab1:
        if by_category:
            df = pd.DataFrame([
                {"Category": k, "Items": v}
                for k, v in sorted(by_category.items(), key=lambda x: x[1], reverse=True)
            ])
            st.dataframe(df, use_container_width=True, hide_index=True)
        else:
            st.info("No data")
    
    with tab2:
        if by_location:
            df = pd.DataFrame([
                {"Location": k.capitalize(), "Items": v}
                for k, v in sorted(by_location.items(), key=lambda x: x[1], reverse=True)
            ])
            st.dataframe(df, use_container_width=True, hide_index=True)
        else:
            st.info("No data")
    
    with tab3:
        if by_status:
            df = pd.DataFrame([
                {"Status": k.replace('_', ' ').title(), "Items": v}
                for k, v in sorted(by_status.items(), key=lambda x: x[1], reverse=True)
            ])
            st.dataframe(df, use_container_width=True, hide_index=True)
        else:
            st.info("No data")

except Exception as e:
    st.error(f"Failed to load statistics: {e}")
    st.exception(e)

