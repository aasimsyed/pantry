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
        json: Optional[Dict] = None
    ) -> Any:
        """
        Make HTTP request with error handling.
        
        Args:
            method: HTTP method (GET, POST, PUT, DELETE)
            endpoint: API endpoint path
            params: Query parameters
            json: Request body
            
        Returns:
            Response data
            
        Raises:
            requests.RequestException: On API error
        """
        url = f"{self.base_url}{endpoint}"
        
        try:
            response = requests.request(
                method=method,
                url=url,
                params=params,
                json=json,
                timeout=self.timeout
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


@st.cache_resource
def get_api_client() -> APIClient:
    """
    Get cached API client instance.
    
    Returns:
        Singleton APIClient instance
    """
    return APIClient()

