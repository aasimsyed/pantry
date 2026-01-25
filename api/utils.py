"""Shared helpers for API routes."""

from typing import Dict

from src.database import InventoryItem

_SCHEMA_ERROR_MSG = (
    "Database schema not initialized or out of date. "
    "Run ./scripts/run-migrations-cloudsql.sh (see CLOUD_RUN_DEPLOYMENT.md)."
)


def detail_for_db_error(e: Exception, fallback: str) -> str:
    """User-friendly message for DB schema errors."""
    s = (str(e) or "").lower()
    if "does not exist" in s or "inventory_items" in s or "undefinedcolumn" in s or "relation" in s:
        return _SCHEMA_ERROR_MSG
    return fallback


def enrich_inventory_item(item: InventoryItem) -> Dict:
    """Enrich inventory item with product info from relationship."""
    return {
        "id": item.id,
        "product_id": item.product_id,
        "quantity": item.quantity,
        "unit": item.unit,
        "purchase_date": item.purchase_date,
        "expiration_date": item.expiration_date,
        "storage_location": item.storage_location,
        "image_path": item.image_path,
        "notes": item.notes,
        "status": item.status,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
        "days_until_expiration": item.days_until_expiration,
        "is_expired": item.is_expired,
        "product_name": item.product.product_name if item.product else None,
        "brand": item.product.brand if item.product else None,
        "category": item.product.category if item.product else None,
    }
