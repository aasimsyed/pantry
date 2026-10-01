"""Premium status from RevenueCat, including grandfathered paid-app buyers."""

import logging
import time
from datetime import datetime, timezone
from typing import Any

import httpx

from src.config import settings
from src.database import User

logger = logging.getLogger(__name__)

REVENUECAT_SUBSCRIBER_URL = "https://api.revenuecat.com/v1/subscribers/{}"

# user_id -> (expires_at monotonic seconds, is_premium)
_cache: dict[int, tuple[float, bool]] = {}


def _is_active(entitlement: dict[str, Any]) -> bool:
    expires = entitlement.get("expires_date")
    if expires is None:
        return True
    return datetime.fromisoformat(expires.replace("Z", "+00:00")) > datetime.now(timezone.utc)


def subscriber_is_premium(subscriber: dict[str, Any], freemium_first_build: int) -> bool:
    """Active entitlement, or first installed a paid build (iOS build number below the cutoff)."""
    entitlement = subscriber.get("entitlements", {}).get(settings.revenuecat_entitlement_id)
    if entitlement and _is_active(entitlement):
        return True
    original_build = subscriber.get("original_application_version") or ""
    return original_build.isdigit() and int(original_build) < freemium_first_build


def _fetch_subscriber(user_id: int) -> dict[str, Any]:
    response = httpx.get(
        REVENUECAT_SUBSCRIBER_URL.format(user_id),
        headers={"Authorization": f"Bearer {settings.revenuecat_api_key}"},
        timeout=5,
    )
    response.raise_for_status()
    return response.json()["subscriber"]


def is_premium(user: User, refresh: bool = False) -> bool:
    """Whether the user gets the premium AI allowance."""
    if settings.freemium_first_build is None or user.role == "admin":
        return True
    now = time.monotonic()
    cached = _cache.get(user.id)
    if cached and not refresh and cached[0] > now:
        return cached[1]
    try:
        premium = subscriber_is_premium(_fetch_subscriber(user.id), settings.freemium_first_build)
    except Exception as e:
        # Fail open so a RevenueCat outage never locks out paying users; the premium cap still bounds spend
        logger.warning("RevenueCat lookup failed for user %s: %s", user.id, e)
        return True
    _cache[user.id] = (now + settings.revenuecat_cache_ttl, premium)
    return premium
