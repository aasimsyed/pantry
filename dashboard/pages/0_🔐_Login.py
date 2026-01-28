"""Login Page for Smart Pantry Dashboard."""

import streamlit as st
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from utils.api_client import APIClient

st.set_page_config(page_title="Login", page_icon="🔐", layout="centered")

# Check if already authenticated - redirect to home if so
if st.session_state.get("access_token"):
    st.switch_page("app.py")

st.title("🔐 Smart Pantry Dashboard")
st.markdown("**Sign in to manage your pantry**")
st.markdown("---")

# Initialize session state for authentication
if "access_token" not in st.session_state:
    st.session_state.access_token = None
if "user" not in st.session_state:
    st.session_state.user = None

# Login form
with st.form("login_form"):
    email = st.text_input("Email", placeholder="your@email.com")
    password = st.text_input("Password", type="password")
    submit = st.form_submit_button("Sign In", use_container_width=True, type="primary")
    
    if submit:
        if not email or not password:
            st.error("Please enter both email and password")
        else:
            try:
                api = APIClient()
                token_response = api.login(email, password)
                
                # Store token and user info in session state
                st.session_state.access_token = token_response.get("access_token")
                st.session_state.user = token_response.get("user", {})
                
                # Redirect to home page after successful login
                st.switch_page("app.py")
                
            except Exception as e:
                error_msg = str(e)
                if "401" in error_msg or "Unauthorized" in error_msg or "Incorrect" in error_msg:
                    st.error("❌ Incorrect email or password")
                else:
                    st.error(f"❌ Login failed: {error_msg}")

# Footer
st.markdown("---")
st.caption("Need an account? Contact your administrator.")
