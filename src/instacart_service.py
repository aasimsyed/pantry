"""
Instacart API integration service.

Provides methods to create shopping links for recipes and inventory items
using the Instacart Developer Platform API.

API Documentation: https://docs.instacart.com/developer_platform_api/
"""

import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import httpx

from src.config import settings

logger = logging.getLogger(__name__)


class InstacartServiceError(Exception):
    """Base exception for Instacart service errors."""
    pass


class InstacartAPIError(InstacartServiceError):
    """Error from Instacart API."""
    def __init__(self, message: str, status_code: int = None, response_data: dict = None):
        super().__init__(message)
        self.status_code = status_code
        self.response_data = response_data


class InstacartConfigError(InstacartServiceError):
    """Instacart configuration error."""
    pass


class InstacartService:
    """
    Service for interacting with the Instacart Developer Platform API.
    
    Supports creating recipe pages and shopping lists that generate
    shareable links to Instacart Marketplace.
    """
    
    def __init__(self):
        """Initialize the Instacart service with configuration from settings."""
        self.api_key = settings.instacart_api_key
        self.base_url = settings.instacart_api_url
        self.timeout = settings.instacart_timeout
        self.link_expires_days = settings.instacart_link_expires_days
        self.enabled = settings.instacart_enabled
        
        if not self.api_key:
            logger.warning("Instacart API key not configured. Service will be disabled.")
    
    def _check_enabled(self) -> None:
        """Check if the service is enabled and configured."""
        if not self.enabled:
            raise InstacartConfigError("Instacart integration is disabled")
        if not self.api_key:
            raise InstacartConfigError("Instacart API key not configured")
    
    def _get_headers(self) -> Dict[str, str]:
        """Get headers for Instacart API requests."""
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
    
    def _format_ingredient(self, ingredient: Dict[str, Any]) -> Dict[str, Any]:
        """
        Format an ingredient for the Instacart API.
        
        Args:
            ingredient: Dict with 'name', optional 'quantity', 'unit', 'display_text'
            
        Returns:
            Formatted ingredient dict for Instacart API
        """
        formatted = {
            "name": ingredient.get("name", ""),
        }
        
        # Add display text if provided
        if ingredient.get("display_text"):
            formatted["display_text"] = ingredient["display_text"]
        
        # Add measurements if quantity/unit provided
        quantity = ingredient.get("quantity")
        unit = ingredient.get("unit")
        
        if quantity is not None or unit is not None:
            formatted["measurements"] = [{
                "quantity": float(quantity) if quantity else 1.0,
                "unit": unit or "each"
            }]
        
        return formatted
    
    def _format_line_item(self, item: Dict[str, Any]) -> Dict[str, Any]:
        """
        Format a line item for the shopping list API.
        
        Args:
            item: Dict with 'name', optional 'quantity', 'unit', 'display_text'
            
        Returns:
            Formatted line item dict for Instacart API
        """
        formatted = {
            "name": item.get("name", ""),
        }
        
        # Add display text if provided
        if item.get("display_text"):
            formatted["display_text"] = item["display_text"]
        
        # Add quantity and unit directly for shopping list API
        if item.get("quantity") is not None:
            formatted["quantity"] = float(item["quantity"])
        if item.get("unit"):
            formatted["unit"] = item["unit"]
        
        return formatted
    
    async def create_recipe_link(
        self,
        title: str,
        ingredients: List[Dict[str, Any]],
        instructions: Optional[List[str]] = None,
        servings: Optional[int] = None,
        cooking_time_minutes: Optional[int] = None,
        linkback_url: Optional[str] = None,
        author: Optional[str] = "Smart Pantry",
    ) -> Dict[str, Any]:
        """
        Create an Instacart recipe page and get a shopping link.
        
        Args:
            title: Recipe title
            ingredients: List of ingredient dicts with 'name', 'quantity', 'unit'
            instructions: Optional list of cooking instructions
            servings: Optional number of servings
            cooking_time_minutes: Optional cooking time in minutes
            linkback_url: Optional URL to link back to your app
            author: Optional author name (defaults to "Smart Pantry")
            
        Returns:
            Dict with 'products_link_url' and 'expires_at'
            
        Raises:
            InstacartConfigError: If service is not configured
            InstacartAPIError: If API request fails
        """
        self._check_enabled()
        
        # Build request payload
        payload = {
            "title": title,
            "author": author,
            "ingredients": [self._format_ingredient(ing) for ing in ingredients],
            "expires_in": self.link_expires_days,
        }
        
        # Add optional fields
        if instructions:
            payload["instructions"] = instructions
        if servings:
            payload["servings"] = servings
        if cooking_time_minutes:
            payload["cooking_time"] = cooking_time_minutes
        if linkback_url:
            payload["landing_page_configuration"] = {
                "partner_linkback_url": linkback_url,
                "enable_pantry_items": True,
            }
        
        # Make API request
        url = f"{self.base_url}/idp/v1/products/recipe"
        
        logger.info(f"Creating Instacart recipe link for: {title}")
        logger.debug(f"Instacart API request: {url}")
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    url,
                    json=payload,
                    headers=self._get_headers(),
                )
                
                if response.status_code == 200:
                    data = response.json()
                    expires_at = datetime.utcnow() + timedelta(days=self.link_expires_days)
                    
                    logger.info(f"Instacart recipe link created successfully: {data.get('products_link_url', '')[:50]}...")
                    
                    return {
                        "products_link_url": data["products_link_url"],
                        "expires_at": expires_at.isoformat(),
                    }
                else:
                    error_data = response.json() if response.content else {}
                    error_msg = error_data.get("message", f"API error: {response.status_code}")
                    
                    logger.error(f"Instacart API error: {response.status_code} - {error_msg}")
                    
                    raise InstacartAPIError(
                        message=error_msg,
                        status_code=response.status_code,
                        response_data=error_data,
                    )
                    
        except httpx.TimeoutException as e:
            logger.error(f"Instacart API timeout: {e}")
            raise InstacartAPIError("Request to Instacart timed out")
        except httpx.RequestError as e:
            logger.error(f"Instacart API request error: {e}")
            raise InstacartAPIError(f"Failed to connect to Instacart: {str(e)}")
    
    async def create_shopping_list_link(
        self,
        title: str,
        items: List[Dict[str, Any]],
        linkback_url: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Create an Instacart shopping list page and get a shopping link.
        
        Args:
            title: Shopping list title
            items: List of item dicts with 'name', 'quantity', 'unit'
            linkback_url: Optional URL to link back to your app
            
        Returns:
            Dict with 'products_link_url' and 'expires_at'
            
        Raises:
            InstacartConfigError: If service is not configured
            InstacartAPIError: If API request fails
        """
        self._check_enabled()
        
        # Build request payload
        payload = {
            "title": title,
            "link_type": "shopping_list",
            "line_items": [self._format_line_item(item) for item in items],
            "expires_in": self.link_expires_days,
        }
        
        # Add optional linkback URL
        if linkback_url:
            payload["landing_page_configuration"] = {
                "partner_linkback_url": linkback_url,
            }
        
        # Make API request
        url = f"{self.base_url}/idp/v1/products/products_link"
        
        logger.info(f"Creating Instacart shopping list link: {title}")
        logger.debug(f"Instacart API request: {url}")
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    url,
                    json=payload,
                    headers=self._get_headers(),
                )
                
                if response.status_code == 200:
                    data = response.json()
                    expires_at = datetime.utcnow() + timedelta(days=self.link_expires_days)
                    
                    logger.info(f"Instacart shopping list link created successfully: {data.get('products_link_url', '')[:50]}...")
                    
                    return {
                        "products_link_url": data["products_link_url"],
                        "expires_at": expires_at.isoformat(),
                    }
                else:
                    error_data = response.json() if response.content else {}
                    error_msg = error_data.get("message", f"API error: {response.status_code}")
                    
                    logger.error(f"Instacart API error: {response.status_code} - {error_msg}")
                    
                    raise InstacartAPIError(
                        message=error_msg,
                        status_code=response.status_code,
                        response_data=error_data,
                    )
                    
        except httpx.TimeoutException as e:
            logger.error(f"Instacart API timeout: {e}")
            raise InstacartAPIError("Request to Instacart timed out")
        except httpx.RequestError as e:
            logger.error(f"Instacart API request error: {e}")
            raise InstacartAPIError(f"Failed to connect to Instacart: {str(e)}")
    
    def is_available(self) -> bool:
        """
        Check if Instacart service is available and configured.
        
        Returns:
            True if service is enabled and API key is configured
        """
        return self.enabled and bool(self.api_key)


# Global service instance
instacart_service = InstacartService()
