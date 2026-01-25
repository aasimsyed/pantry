"""Health and root endpoints."""

from fastapi import APIRouter
from fastapi.responses import RedirectResponse

from api.config import config
from api.models import HealthResponse

router = APIRouter(tags=["Health"])


@router.get("/", include_in_schema=False)
def root() -> RedirectResponse:
    """Redirect root to API documentation."""
    return RedirectResponse(url="/docs")


@router.get("/health", response_model=HealthResponse)
def health_check() -> HealthResponse:
    """Check API health status."""
    return HealthResponse(
        status="healthy",
        service="Smart Pantry API",
        version=config.api_version,
    )
