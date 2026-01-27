"""
Barcode lookup service using Open Food Facts and UPCitemdb APIs.

Provides product information lookup by UPC/EAN barcode codes.
Uses Open Food Facts as primary (unlimited, free) and UPCitemdb as fallback (100/day free).
"""

import logging
from typing import Optional, Dict, Any
from dataclasses import dataclass

import openfoodfacts
import requests

logger = logging.getLogger(__name__)


@dataclass
class BarcodeProduct:
    """Product information from barcode lookup."""
    barcode: str
    product_name: str
    brand: Optional[str] = None
    category: Optional[str] = None
    quantity: Optional[str] = None  # e.g., "500g", "1L"
    image_url: Optional[str] = None
    nutrition_grade: Optional[str] = None  # A, B, C, D, E
    ingredients: Optional[str] = None
    allergens: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for API response."""
        return {
            "barcode": self.barcode,
            "product_name": self.product_name,
            "brand": self.brand,
            "category": self.category,
            "quantity": self.quantity,
            "image_url": self.image_url,
            "nutrition_grade": self.nutrition_grade,
            "ingredients": self.ingredients,
            "allergens": self.allergens,
        }


class BarcodeService:
    """
    Service for looking up product information by barcode.
    
    Uses multiple APIs for best coverage:
    1. Open Food Facts (primary) - Free, unlimited, ~3M products
    2. UPCitemdb (fallback) - Free tier 100/day, ~500M products
    
    Example:
        >>> service = BarcodeService()
        >>> product = service.lookup("0041196010152")
        >>> print(product.product_name)  # "Cheerios"
    """
    
    # UPCitemdb free tier endpoint (no API key required, 100 requests/day)
    UPCITEMDB_URL = "https://api.upcitemdb.com/prod/trial/lookup"
    
    def __init__(self):
        """Initialize the barcode service."""
        # Configure Open Food Facts API client
        self.api = openfoodfacts.API(
            user_agent="SmartPantry/1.4.0 (contact@smartpantry.app)",
            country="world",  # Use world database for better product coverage
            flavor="off",  # Open Food Facts
        )
    
    def lookup(self, barcode: str) -> Optional[BarcodeProduct]:
        """
        Look up product information by barcode.
        
        Tries Open Food Facts first, then falls back to UPCitemdb.
        
        Args:
            barcode: UPC, EAN-13, or EAN-8 barcode string
            
        Returns:
            BarcodeProduct if found, None otherwise
        """
        # Clean the barcode (remove spaces, dashes)
        barcode = barcode.strip().replace("-", "").replace(" ", "")
        
        logger.info(f"Looking up barcode: {barcode}")
        
        # Try Open Food Facts first (unlimited, free)
        result = self._lookup_openfoodfacts(barcode)
        if result:
            return result
        
        # Fall back to UPCitemdb (100/day free tier)
        logger.info(f"Open Food Facts miss, trying UPCitemdb for: {barcode}")
        result = self._lookup_upcitemdb(barcode)
        if result:
            return result
        
        logger.info(f"Barcode not found in any database: {barcode}")
        return None
    
    def _lookup_upcitemdb(self, barcode: str) -> Optional[BarcodeProduct]:
        """
        Look up product in UPCitemdb (fallback).
        
        Free tier: 100 requests/day, no API key required.
        """
        try:
            response = requests.get(
                self.UPCITEMDB_URL,
                params={"upc": barcode},
                headers={
                    "Accept": "application/json",
                    "User-Agent": "SmartPantry/1.4.0",
                },
                timeout=10,
            )
            
            if response.status_code == 429:
                logger.warning("UPCitemdb rate limit reached (100/day)")
                return None
            
            if not response.ok:
                logger.debug(f"UPCitemdb returned {response.status_code}")
                return None
            
            data = response.json()
            
            # Check if we got results
            if data.get("code") != "OK" or not data.get("items"):
                logger.debug(f"UPCitemdb: no items found for {barcode}")
                return None
            
            item = data["items"][0]
            
            product_name = item.get("title", "").strip()
            if not product_name:
                return None
            
            brand = item.get("brand", "").strip() or None
            category = item.get("category", "").strip() or None
            
            # Get first image if available
            images = item.get("images", [])
            image_url = images[0] if images else None
            
            result = BarcodeProduct(
                barcode=barcode,
                product_name=product_name,
                brand=brand,
                category=category,
                quantity=item.get("size"),
                image_url=image_url,
                nutrition_grade=None,
                ingredients=item.get("description"),
                allergens=None,
            )
            
            logger.info(f"[UPCitemdb] Found product: {product_name} ({brand or 'No brand'})")
            return result
            
        except requests.RequestException as e:
            logger.warning(f"UPCitemdb request error: {e}")
            return None
        except Exception as e:
            logger.error(f"UPCitemdb error: {e}", exc_info=True)
            return None
    
    def _lookup_openfoodfacts(self, barcode: str) -> Optional[BarcodeProduct]:
        """
        Look up product in Open Food Facts (primary).
        
        Free, unlimited requests.
        """
        try:
            product_data = self.api.product.get(barcode)
            
            if not product_data:
                return None
            
            # Check status
            status = product_data.get("status")
            if status == 0 or status == "product not found":
                return None
            
            # Extract product information
            product = product_data.get("product", product_data)
            
            # Get the best product name
            product_name = None
            name_fields = [
                "product_name_en",
                "product_name",
                "product_name_en_imported",
                "generic_name_en",
                "generic_name",
                "abbreviated_product_name",
                "abbreviated_product_name_en",
            ]
            for field in name_fields:
                value = product.get(field)
                if value and isinstance(value, str) and value.strip():
                    product_name = value.strip()
                    break
            
            # Try brand as fallback name
            if not product_name:
                brand_val = product.get("brands", "")
                if brand_val:
                    product_name = brand_val.split(",")[0].strip()
            
            if not product_name:
                return None
            
            # Get brand
            brand = product.get("brands", "").split(",")[0].strip() or None
            
            # Get category
            categories = product.get("categories_hierarchy", []) or product.get("categories_tags", [])
            category = None
            if categories:
                last_category = categories[-1]
                if ":" in last_category:
                    category = last_category.split(":")[-1].replace("-", " ").title()
                else:
                    category = last_category.replace("-", " ").title()
            
            # Get other fields
            quantity = product.get("quantity") or product.get("product_quantity")
            image_url = (
                product.get("image_front_url") or 
                product.get("image_front_small_url") or 
                product.get("image_url")
            )
            nutrition_grade = (product.get("nutriscore_grade") or "").upper() or None
            if nutrition_grade and nutrition_grade not in ["A", "B", "C", "D", "E"]:
                nutrition_grade = None
            ingredients = product.get("ingredients_text_en") or product.get("ingredients_text")
            allergens = product.get("allergens_from_ingredients") or product.get("allergens")
            
            result = BarcodeProduct(
                barcode=barcode,
                product_name=product_name,
                brand=brand,
                category=category,
                quantity=quantity,
                image_url=image_url,
                nutrition_grade=nutrition_grade,
                ingredients=ingredients,
                allergens=allergens,
            )
            
            logger.info(f"[OpenFoodFacts] Found product: {product_name} ({brand or 'No brand'})")
            return result
            
        except Exception as e:
            logger.warning(f"Open Food Facts error: {e}")
            return None
    
    def search_by_name(self, query: str, limit: int = 10) -> list[BarcodeProduct]:
        """
        Search for products by name (for autocomplete/suggestions).
        
        Args:
            query: Search query string
            limit: Maximum number of results
            
        Returns:
            List of matching products
        """
        try:
            results = self.api.product.text_search(query, page_size=limit)
            products = []
            
            for item in results.get("products", [])[:limit]:
                product_name = (
                    item.get("product_name_en") or
                    item.get("product_name") or
                    "Unknown Product"
                )
                brand = item.get("brands", "").split(",")[0].strip() or None
                barcode = item.get("code", "")
                
                if product_name and barcode:
                    products.append(BarcodeProduct(
                        barcode=barcode,
                        product_name=product_name,
                        brand=brand,
                    ))
            
            return products
            
        except Exception as e:
            logger.error(f"Error searching products: {e}", exc_info=True)
            return []


# Singleton instance for reuse
_barcode_service: Optional[BarcodeService] = None


def get_barcode_service() -> BarcodeService:
    """Get or create the barcode service singleton."""
    global _barcode_service
    if _barcode_service is None:
        _barcode_service = BarcodeService()
    return _barcode_service
