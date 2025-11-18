"""
API Client for Smart Pantry Dashboard.

Provides HTTP client wrapper for all FastAPI endpoints with error handling.
"""

import requests
import streamlit as st
from typing import List, Dict, Optional, Any
import logging

logger = logging.getLogger(__name__)


class APIClient:
    """HTTP client for Smart Pantry API."""
    
    def __init__(self, base_url: str = "http://localhost:8000"):
        """
        Initialize API client.
        
        Args:
            base_url: Base URL of the FastAPI server
        """
        self.base_url = base_url
        self.timeout = 10
    
    def _request(
        self,
        method: str,
        endpoint: str,
        params: Optional[Dict] = None,
        json: Optional[Dict] = None,
        timeout: Optional[int] = None
    ) -> Any:
        """
        Make HTTP request with error handling.
        
        Args:
            method: HTTP method (GET, POST, PUT, DELETE)
            endpoint: API endpoint path
            params: Query parameters
            json: Request body
            timeout: Request timeout in seconds (uses default if None)
            
        Returns:
            Response data
            
        Raises:
            requests.RequestException: On API error
        """
        url = f"{self.base_url}{endpoint}"
        request_timeout = timeout if timeout is not None else self.timeout
        
        try:
            response = requests.request(
                method=method,
                url=url,
                params=params,
                json=json,
                timeout=request_timeout
            )
            response.raise_for_status()
            return response.json()
        
        except requests.RequestException as e:
            logger.error(f"API request failed: {e}")
            raise
    
    # Health
    def health_check(self) -> Dict:
        """Check API health."""
        return self._request("GET", "/health")
    
    # Products
    def get_products(self, skip: int = 0, limit: int = 100) -> List[Dict]:
        """Get all products."""
        return self._request("GET", "/api/products", params={"skip": skip, "limit": limit})
    
    def get_product(self, product_id: int) -> Dict:
        """Get single product."""
        return self._request("GET", f"/api/products/{product_id}")
    
    def create_product(self, data: Dict) -> Dict:
        """Create new product."""
        return self._request("POST", "/api/products", json=data)
    
    def update_product(self, product_id: int, data: Dict) -> Dict:
        """Update product."""
        return self._request("PUT", f"/api/products/{product_id}", json=data)
    
    def delete_product(self, product_id: int) -> Dict:
        """Delete product."""
        return self._request("DELETE", f"/api/products/{product_id}")
    
    def search_products(self, query: str, category: Optional[str] = None, brand: Optional[str] = None) -> List[Dict]:
        """Search products."""
        params = {"q": query}
        if category:
            params["category"] = category
        if brand:
            params["brand"] = brand
        return self._request("GET", "/api/products/search", params=params)
    
    # Inventory
    def get_inventory(
        self,
        skip: int = 0,
        limit: int = 100,
        location: Optional[str] = None,
        status: Optional[str] = None
    ) -> List[Dict]:
        """Get inventory items."""
        params = {"skip": skip, "limit": limit}
        if location:
            params["location"] = location
        if status:
            params["status"] = status
        return self._request("GET", "/api/inventory", params=params)
    
    def get_inventory_item(self, item_id: int) -> Dict:
        """Get single inventory item."""
        return self._request("GET", f"/api/inventory/{item_id}")
    
    def create_inventory_item(self, data: Dict) -> Dict:
        """Create new inventory item."""
        return self._request("POST", "/api/inventory", json=data)
    
    def update_inventory_item(self, item_id: int, data: Dict) -> Dict:
        """Update inventory item."""
        return self._request("PUT", f"/api/inventory/{item_id}", json=data)
    
    def delete_inventory_item(self, item_id: int) -> Dict:
        """Delete inventory item."""
        return self._request("DELETE", f"/api/inventory/{item_id}")
    
    def consume_item(self, item_id: int, quantity: Optional[float] = None) -> Dict:
        """Consume inventory item."""
        json_data = {"quantity": quantity} if quantity else {}
        return self._request("POST", f"/api/inventory/{item_id}/consume", json=json_data)
    
    # Expiration
    def get_expiring_items(self, days: int = 7) -> List[Dict]:
        """Get items expiring within days."""
        return self._request("GET", "/api/expiring", params={"days": days})
    
    def get_expired_items(self) -> List[Dict]:
        """Get expired items."""
        return self._request("GET", "/api/expired")
    
    # Statistics
    def get_statistics(self) -> Dict:
        """Get overall statistics."""
        return self._request("GET", "/api/statistics")
    
    def get_statistics_by_category(self) -> Dict:
        """Get statistics by category."""
        return self._request("GET", "/api/statistics/by-category")
    
    def get_statistics_by_location(self) -> Dict:
        """Get statistics by location."""
        return self._request("GET", "/api/statistics/by-location")
    
    # Recipe Generation
    def generate_single_recipe(
        self,
        required_ingredients: Optional[List[str]] = None,
        excluded_ingredients: Optional[List[str]] = None,
        cuisine: Optional[str] = None,
        difficulty: Optional[str] = None,
        dietary_restrictions: Optional[List[str]] = None,
        avoid_names: Optional[List[str]] = None,
        allow_missing_ingredients: bool = False
    ) -> Dict:
        """
        Generate a single recipe (for incremental display).
        
        Uses extended timeout (60 seconds) since AI generation can take 30+ seconds.
        """
        json_data = {"allow_missing_ingredients": allow_missing_ingredients}
        if required_ingredients:
            json_data["required_ingredients"] = required_ingredients
        if excluded_ingredients:
            json_data["excluded_ingredients"] = excluded_ingredients
        if cuisine:
            json_data["cuisine"] = cuisine
        if difficulty:
            json_data["difficulty"] = difficulty
        if dietary_restrictions:
            json_data["dietary_restrictions"] = dietary_restrictions
        if avoid_names:
            json_data["avoid_names"] = avoid_names
        
        return self._request(
            "POST",
            "/api/recipes/generate-one",
            json=json_data,
            timeout=60  # 1 minute for single recipe
        )
    
    def generate_recipes(
        self,
        required_ingredients: Optional[List[str]] = None,
        excluded_ingredients: Optional[List[str]] = None,
        max_recipes: int = 5,
        cuisine: Optional[str] = None,
        difficulty: Optional[str] = None,
        dietary_restrictions: Optional[List[str]] = None,
        allow_missing_ingredients: bool = False
    ) -> List[Dict]:
        """
        Generate AI-powered recipes.
        
        Uses extended timeout (5 minutes) since AI generation can take 30+ seconds per recipe.
        """
        json_data = {
            "max_recipes": max_recipes,
            "allow_missing_ingredients": allow_missing_ingredients
        }
        if required_ingredients:
            json_data["required_ingredients"] = required_ingredients
        if excluded_ingredients:
            json_data["excluded_ingredients"] = excluded_ingredients
        if cuisine:
            json_data["cuisine"] = cuisine
        if difficulty:
            json_data["difficulty"] = difficulty
        if dietary_restrictions:
            json_data["dietary_restrictions"] = dietary_restrictions
        
        # Use extended timeout: 30 seconds per recipe + 60 seconds buffer
        # For 5 recipes: ~150 seconds + 60 = 210 seconds (3.5 minutes)
        # Set to 5 minutes (300 seconds) to be safe
        timeout = max(300, max_recipes * 30 + 60)
        
        return self._request("POST", "/api/recipes/generate", json=json_data, timeout=timeout)
    
    # Image Processing & Source Directory
    def get_source_directory(self) -> Dict:
        """Get the configured source images directory."""
        return self._request("GET", "/api/config/source-directory")
    
    def set_source_directory(self, directory: str) -> Dict:
        """Set the source images directory."""
        return self._request("POST", "/api/config/source-directory", json={"directory": directory})
    
    def process_image(
        self,
        file_data: bytes,
        filename: str,
        storage_location: str = "pantry",
        timeout: int = 120
    ) -> Dict:
        """
        Process a single image file through OCR and AI analysis.
        
        Args:
            file_data: Image file data (bytes)
            filename: Name of the file
            storage_location: Where to store the item (pantry/fridge/freezer)
            timeout: Request timeout in seconds (default 120 for image processing)
        """
        import io
        files = {'file': (filename, io.BytesIO(file_data), 'image/jpeg')}
        data = {'storage_location': storage_location}
        url = f"{self.base_url}/api/inventory/process-image"
        request_timeout = timeout if timeout is not None else self.timeout
        
        try:
            import requests
            response = requests.post(
                url,
                files=files,
                data=data,
                timeout=request_timeout
            )
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            logger.error(f"API request failed: {e}")
            raise
    
    def refresh_inventory(
        self,
        source_directory: Optional[str] = None,
        storage_location: str = "pantry",
        min_confidence: float = 0.6,
        timeout: int = 600
    ) -> Dict:
        """
        Refresh inventory by processing all images in source directory.
        
        Args:
            source_directory: Optional source directory path (uses default if None)
            storage_location: Where to store items (pantry/fridge/freezer)
            min_confidence: Minimum AI confidence threshold (0.0-1.0)
            timeout: Request timeout in seconds (default 600 for batch processing)
        """
        json_data = {
            "storage_location": storage_location,
            "min_confidence": min_confidence
        }
        if source_directory:
            json_data["source_directory"] = source_directory
        
        return self._request(
            "POST",
            "/api/inventory/refresh",
            json=json_data,
            timeout=timeout
        )
    
    # Saved Recipes (Recipe Box)
    def save_recipe(self, recipe_data: Dict) -> Dict:
        """Save a recipe to the recipe box."""
        return self._request("POST", "/api/recipes/save", json=recipe_data)
    
    def get_saved_recipes(
        self,
        cuisine: Optional[str] = None,
        difficulty: Optional[str] = None,
        limit: int = 100
    ) -> List[Dict]:
        """Get all saved recipes."""
        params = {"limit": limit}
        if cuisine:
            params["cuisine"] = cuisine
        if difficulty:
            params["difficulty"] = difficulty
        return self._request("GET", "/api/recipes/saved", params=params)
    
    def get_saved_recipe(self, recipe_id: int) -> Dict:
        """Get a specific saved recipe."""
        return self._request("GET", f"/api/recipes/saved/{recipe_id}")
    
    def update_saved_recipe(self, recipe_id: int, recipe_data: Dict) -> Dict:
        """Update a saved recipe."""
        return self._request("PUT", f"/api/recipes/saved/{recipe_id}", json=recipe_data)
    
    def delete_saved_recipe(self, recipe_id: int) -> Dict:
        """Delete a saved recipe."""
        return self._request("DELETE", f"/api/recipes/saved/{recipe_id}")


@st.cache_resource(ttl=3600)  # Cache for 1 hour, but will refresh on server restart
def get_api_client() -> APIClient:
    """
    Get cached API client instance.
    
    Returns:
        Singleton APIClient instance
    """
    return APIClient()

