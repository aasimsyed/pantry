"""
Centralized configuration from environment.

Single source of truth for DATABASE_URL, SECRET_KEY, AI_*, OCR_*, API settings,
Sentry, etc. Load from .env; no env prefix.
"""

from pathlib import Path
from typing import List, Optional

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """App-wide settings from environment (.env)."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # -------------------------------------------------------------------------
    # Database
    # -------------------------------------------------------------------------
    database_url: Optional[str] = None
    db_type: str = "sqlite"
    db_path: str = "./pantry.db"
    db_host: str = "localhost"
    db_port: str = "5432"
    db_name: str = "pantry"
    db_user: str = "postgres"
    db_password: str = ""

    # -------------------------------------------------------------------------
    # Auth
    # -------------------------------------------------------------------------
    secret_key: str = "your-secret-key-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 15
    jwt_refresh_token_expire_days: int = 30

    # -------------------------------------------------------------------------
    # Email (SMTP)
    # -------------------------------------------------------------------------
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_username: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_from_email: Optional[str] = None
    smtp_from_name: str = "Smart Pantry"
    frontend_url: str = "http://localhost:8081"

    # -------------------------------------------------------------------------
    # Instacart Integration
    # -------------------------------------------------------------------------
    instacart_api_key: Optional[str] = None
    instacart_api_url: str = "https://connect.instacart.com"
    instacart_dev_api_url: str = "https://connect.dev.instacart.tools"
    instacart_timeout: int = 30
    instacart_link_expires_days: int = 30
    instacart_enabled: bool = True
    instacart_affiliate_partner_id: Optional[str] = None  # Impact partner ID for affiliate tracking

    # -------------------------------------------------------------------------
    # API (server, CORS, rate limit)
    # -------------------------------------------------------------------------
    api_title: str = "Smart Pantry API"
    api_version: str = "1.4.1"
    api_description: str = (
        "REST API for Smart Pantry Management System. "
        "Product catalog, inventory, expiration tracking, AI recipes."
    )
    host: str = "0.0.0.0"
    port: int = 8000
    reload: bool = True
    log_level: str = "info"
    cors_origins: List[str] = [
        "http://localhost:8501",
        "http://localhost:3000",
        "http://localhost:5173",
        "https://smartpantryai.vercel.app",
        "https://pantry-api-154407938924.us-south1.run.app",
    ]
    rate_limit_enabled: bool = True
    rate_limit_per_minute: int = 100
    rate_limit_auth_per_minute: int = 5
    rate_limit_upload_per_minute: int = 10
    rate_limit_recipe_per_hour: int = 20

    # -------------------------------------------------------------------------
    # Sentry
    # -------------------------------------------------------------------------
    sentry_dsn: str = ""
    sentry_environment: str = "production"

    # -------------------------------------------------------------------------
    # App-level
    # -------------------------------------------------------------------------
    source_images_dir: str = ""
    hide_error_details: bool = False

    # -------------------------------------------------------------------------
    # AI
    # -------------------------------------------------------------------------
    ai_provider: str = "openai"
    ai_model: str = "gpt-4-turbo-preview"
    openai_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    ai_temperature: float = 0.0
    ai_max_tokens: int = 2000
    ai_timeout: int = 30
    ai_min_confidence: float = 0.7
    ai_retry_on_low_confidence: bool = True
    ai_use_few_shot: bool = True
    ai_cache_enabled: bool = True
    ai_cache_dir: str = "./cache/ai"
    ai_cache_ttl: int = 86400 * 7
    ai_max_cost_per_request: float = 0.05
    ai_daily_cost_limit: float = 1.00

    # -------------------------------------------------------------------------
    # OCR
    # -------------------------------------------------------------------------
    google_application_credentials: Optional[str] = None
    google_vision_api_key: Optional[str] = None
    tesseract_cmd: str = "tesseract"
    ocr_confidence_threshold: float = 0.85
    ocr_cache_enabled: bool = True
    ocr_cache_dir: str = "./cache/ocr"
    ocr_cache_ttl: int = 86400
    ocr_max_retries: int = 3
    ocr_retry_delay: float = 1.0
    ocr_rate_limit_requests: int = 60
    ocr_rate_limit_period: int = 60
    ocr_preferred_backend: str = "google"
    ocr_tesseract_lang: Optional[str] = None

    @field_validator("cors_origins", mode="before")
    @classmethod
    def cors_origins_from_str(cls, v):
        if isinstance(v, str) and v.strip():
            return [x.strip() for x in v.split(",") if x.strip()]
        return v if isinstance(v, list) else []

    @field_validator("source_images_dir", mode="before")
    @classmethod
    def source_images_default(cls, v):
        if v is None or (isinstance(v, str) and not v.strip()):
            return str(Path.home() / "Pictures" / "Pantry")
        return v if isinstance(v, str) else str(v)

    def get_database_url(self) -> str:
        """Effective DATABASE_URL: from env or built from DB_*."""
        if self.database_url and self.database_url.strip():
            return self.database_url.strip()
        if self.db_type.lower() == "sqlite":
            return f"sqlite:///{self.db_path}"
        if self.db_type.lower() == "postgresql":
            return (
                f"postgresql://{self.db_user}:{self.db_password}"
                f"@{self.db_host}:{self.db_port}/{self.db_name}"
            )
        raise ValueError(f"Unsupported db_type: {self.db_type}")

    @property
    def sentry_dsn_stripped(self) -> str:
        return (self.sentry_dsn or "").strip()


# Singleton
settings = Settings()


def get_ai_config():
    """Build AIConfig from centralized settings (for create_ai_analyzer)."""
    from src.ai_analyzer import AIConfig

    return AIConfig(
        provider=settings.ai_provider,
        model=settings.ai_model,
        openai_api_key=settings.openai_api_key,
        anthropic_api_key=settings.anthropic_api_key,
        temperature=settings.ai_temperature,
        max_tokens=settings.ai_max_tokens,
        timeout=settings.ai_timeout,
        min_confidence=settings.ai_min_confidence,
        retry_on_low_confidence=settings.ai_retry_on_low_confidence,
        use_few_shot=settings.ai_use_few_shot,
        cache_enabled=settings.ai_cache_enabled,
        cache_dir=settings.ai_cache_dir,
        cache_ttl=settings.ai_cache_ttl,
        max_cost_per_request=settings.ai_max_cost_per_request,
        daily_cost_limit=settings.ai_daily_cost_limit,
    )


def get_ocr_config():
    """Build OCRConfig from centralized settings (for create_ocr_service)."""
    from src.ocr_service import OCRConfig

    return OCRConfig(
        google_credentials_path=settings.google_application_credentials or None,
        google_vision_api_key=settings.google_vision_api_key or None,
        tesseract_cmd=settings.tesseract_cmd,
        confidence_threshold=settings.ocr_confidence_threshold,
        cache_enabled=settings.ocr_cache_enabled,
        cache_dir=settings.ocr_cache_dir,
        cache_ttl=settings.ocr_cache_ttl,
        max_retries=settings.ocr_max_retries,
        retry_delay=settings.ocr_retry_delay,
        rate_limit_requests=settings.ocr_rate_limit_requests,
        rate_limit_period=settings.ocr_rate_limit_period,
        preferred_backend=settings.ocr_preferred_backend,
        tesseract_lang=settings.ocr_tesseract_lang,
    )
