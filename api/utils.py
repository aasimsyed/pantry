"""Shared helpers for API routes."""

import re
from typing import Dict, List, Optional, Tuple

from src.database import InventoryItem

# Category terms (e.g. "fish") map to keywords that identify pantry items of that type.
# Used so "I want to cook fish" matches tuna, salmon, etc. in inventory.
INGREDIENT_CATEGORY_KEYWORDS: Dict[str, List[str]] = {
    "fish": [
        "tuna", "salmon", "cod", "tilapia", "trout", "halibut", "mackerel",
        "sardine", "anchovy", "catfish", "swordfish", "branzino", "bass",
        "haddock", "flounder", "sole", "perch", "carp", "whitefish",
        "mahi", "snapper", "grouper", "barramundi", "pollock", "trout",
    ],
    "seafood": [
        "tuna", "salmon", "cod", "shrimp", "prawn", "crab", "lobster",
        "scallop", "mussel", "clam", "oyster", "squid", "calamari", "octopus",
        "tilapia", "mackerel", "sardine", "anchovy", "halibut", "snapper",
    ],
}


def _required_ingredient_sort_key(
    name: str, req_lower: str
) -> Tuple[int, int, int]:
    """Prefer exact name match, then whole-word match, then shortest."""
    pl = name.lower()
    exact = 0 if pl == req_lower else 1
    word_match = (
        0 if re.search(r"\b" + re.escape(req_lower) + r"\b", pl) else 1
    )
    return (exact, word_match, len(name))


def best_pantry_match_for_required(
    req_lower: str, available_lower_to_name: Dict[str, str]
) -> Optional[str]:
    """Pick the best pantry product name for a required ingredient.

    - Direct: 'broccoli' -> 'Frozen Broccoli' (exact/substring).
    - Category: 'fish' -> 'Canned Tuna' or 'Salmon Fillet' (pantry has types of fish).
    Prefers: exact key match, then whole-word match, then shortest matching name.
    """
    if not req_lower:
        return None
    if req_lower in available_lower_to_name:
        return available_lower_to_name[req_lower]
    # Substring / whole-word match (e.g. broccoli in Frozen Broccoli)
    candidates = [
        name for name in available_lower_to_name.values()
        if req_lower in name.lower()
    ]
    # Category match: e.g. "fish" -> pantry items containing tuna, salmon, cod, etc.
    if not candidates and req_lower in INGREDIENT_CATEGORY_KEYWORDS:
        keywords = INGREDIENT_CATEGORY_KEYWORDS[req_lower]
        candidates = [
            name for name in available_lower_to_name.values()
            if any(kw in name.lower() for kw in keywords)
        ]
    if not candidates:
        return None
    return min(
        candidates,
        key=lambda n: _required_ingredient_sort_key(n, req_lower),
    )

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
