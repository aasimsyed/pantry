"""
API Configuration Module.

Handles configuration management for the FastAPI application,
loading settings from environment variables with sensible defaults.
"""

from typing import List
from pydantic_settings import BaseSettings


class APIConfig(BaseSettings):
    """Configuration for the Smart Pantry API."""
    
    # API Metadata
    api_title: str = "Smart Pantry API"
    api_version: str = "1.0.0"
    api_description: str = """
    REST API for Smart Pantry Management System.
    
    Features:
    - Product catalog management
    - Inventory tracking
    - Expiration monitoring
    - Statistics and analytics
    - AI-powered recipe generation
    """
    
    # CORS Configuration
    # Note: Mobile apps (React Native) don't use CORS, but web frontends do
    # Add your Vercel domain after deployment (e.g., "https://smart-pantry-frontend.vercel.app")
    cors_origins: List[str] = [
        "http://localhost:8501",  # Streamlit default
        "http://localhost:3000",  # React default
        "http://localhost:5173",  # Vite dev server default
        # Production frontend URLs - Vercel deployments
        "https://smartpantryai.vercel.app",  # Vercel production URL
        # Add your custom domain here when configured
        # "https://pantry.yourdomain.com",
    ]
    
    # Database Configuration
    database_url: str = "sqlite:///pantry.db"
    
    # Server Configuration
    host: str = "0.0.0.0"
    port: int = 8000
    reload: bool = True
    log_level: str = "info"
    
    # Rate Limiting Configuration
    rate_limit_enabled: bool = True
    rate_limit_per_minute: int = 100
    rate_limit_auth_per_minute: int = 5
    rate_limit_upload_per_minute: int = 10
    rate_limit_recipe_per_hour: int = 20
    
    model_config = {
        "env_file": ".env",
        "env_prefix": "API_",
        "case_sensitive": False,
        "extra": "ignore",  # Ignore extra fields from .env
    }


# Global config instance
config = APIConfig()

