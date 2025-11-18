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
    cors_origins: List[str] = [
        "http://localhost:8501",  # Streamlit default
        "http://localhost:3000",  # React default
    ]
    
    # Database Configuration
    database_url: str = "sqlite:///pantry.db"
    
    # Server Configuration
    host: str = "0.0.0.0"
    port: int = 8000
    reload: bool = True
    log_level: str = "info"
    
    model_config = {
        "env_file": ".env",
        "env_prefix": "API_",
        "case_sensitive": False,
        "extra": "ignore",  # Ignore extra fields from .env
    }


# Global config instance
config = APIConfig()

