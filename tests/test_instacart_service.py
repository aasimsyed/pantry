"""
Tests for Instacart service integration.
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from datetime import datetime, timedelta

import httpx

from src.instacart_service import (
    InstacartService,
    InstacartAPIError,
    InstacartConfigError,
    instacart_service,
)


class TestInstacartService:
    """Tests for InstacartService class."""
    
    @pytest.fixture
    def mock_settings(self):
        """Create mock settings for testing."""
        settings = MagicMock()
        settings.instacart_api_key = "test-api-key"
        settings.instacart_api_url = "https://connect.instacart.com"
        settings.instacart_timeout = 30
        settings.instacart_link_expires_days = 30
        settings.instacart_enabled = True
        return settings
    
    @pytest.fixture
    def service(self, mock_settings):
        """Create a test InstacartService instance."""
        with patch('src.instacart_service.settings', mock_settings):
            return InstacartService()
    
    def test_init_with_api_key(self, service):
        """Test service initialization with API key."""
        assert service.api_key == "test-api-key"
        assert service.enabled is True
        assert service.is_available() is True
    
    def test_init_without_api_key(self, mock_settings):
        """Test service initialization without API key."""
        mock_settings.instacart_api_key = None
        with patch('src.instacart_service.settings', mock_settings):
            service = InstacartService()
            assert service.is_available() is False
    
    def test_check_enabled_disabled(self, mock_settings):
        """Test _check_enabled raises when disabled."""
        mock_settings.instacart_enabled = False
        with patch('src.instacart_service.settings', mock_settings):
            service = InstacartService()
            with pytest.raises(InstacartConfigError, match="disabled"):
                service._check_enabled()
    
    def test_check_enabled_no_api_key(self, mock_settings):
        """Test _check_enabled raises when no API key."""
        mock_settings.instacart_api_key = None
        with patch('src.instacart_service.settings', mock_settings):
            service = InstacartService()
            with pytest.raises(InstacartConfigError, match="not configured"):
                service._check_enabled()
    
    def test_get_headers(self, service):
        """Test header generation."""
        headers = service._get_headers()
        assert headers["Authorization"] == "Bearer test-api-key"
        assert headers["Content-Type"] == "application/json"
        assert headers["Accept"] == "application/json"
    
    def test_format_ingredient_basic(self, service):
        """Test basic ingredient formatting."""
        ingredient = {"name": "eggs"}
        formatted = service._format_ingredient(ingredient)
        assert formatted["name"] == "eggs"
        assert "measurements" not in formatted
    
    def test_format_ingredient_with_quantity(self, service):
        """Test ingredient formatting with quantity and unit."""
        ingredient = {"name": "milk", "quantity": 2, "unit": "cup"}
        formatted = service._format_ingredient(ingredient)
        assert formatted["name"] == "milk"
        assert formatted["measurements"][0]["quantity"] == 2.0
        assert formatted["measurements"][0]["unit"] == "cup"
    
    def test_format_ingredient_with_display_text(self, service):
        """Test ingredient formatting with display text."""
        ingredient = {"name": "flour", "display_text": "All-purpose flour"}
        formatted = service._format_ingredient(ingredient)
        assert formatted["display_text"] == "All-purpose flour"
    
    def test_format_line_item_basic(self, service):
        """Test basic line item formatting."""
        item = {"name": "bread"}
        formatted = service._format_line_item(item)
        assert formatted["name"] == "bread"
    
    def test_format_line_item_with_quantity(self, service):
        """Test line item formatting with quantity."""
        item = {"name": "apples", "quantity": 6, "unit": "each"}
        formatted = service._format_line_item(item)
        assert formatted["quantity"] == 6.0
        assert formatted["unit"] == "each"
    
    @pytest.mark.asyncio
    async def test_create_recipe_link_success(self, service):
        """Test successful recipe link creation."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "products_link_url": "https://instacart.com/recipe/123"
        }
        
        with patch('httpx.AsyncClient') as mock_client:
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(
                return_value=mock_response
            )
            
            result = await service.create_recipe_link(
                title="Test Recipe",
                ingredients=[{"name": "eggs", "quantity": 2}],
                servings=4,
            )
            
            assert result["products_link_url"] == "https://instacart.com/recipe/123"
            assert "expires_at" in result
    
    @pytest.mark.asyncio
    async def test_create_recipe_link_api_error(self, service):
        """Test recipe link creation with API error."""
        mock_response = MagicMock()
        mock_response.status_code = 400
        mock_response.content = b'{"message": "Invalid request"}'
        mock_response.json.return_value = {"message": "Invalid request"}
        
        with patch('httpx.AsyncClient') as mock_client:
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(
                return_value=mock_response
            )
            
            with pytest.raises(InstacartAPIError):
                await service.create_recipe_link(
                    title="Test Recipe",
                    ingredients=[{"name": "eggs"}],
                )
    
    @pytest.mark.asyncio
    async def test_create_recipe_link_timeout(self, service):
        """Test recipe link creation with timeout."""
        with patch('httpx.AsyncClient') as mock_client:
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(
                side_effect=httpx.TimeoutException("timeout")
            )
            
            with pytest.raises(InstacartAPIError, match="timed out"):
                await service.create_recipe_link(
                    title="Test Recipe",
                    ingredients=[{"name": "eggs"}],
                )
    
    @pytest.mark.asyncio
    async def test_create_shopping_list_link_success(self, service):
        """Test successful shopping list link creation."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "products_link_url": "https://instacart.com/list/456"
        }
        
        with patch('httpx.AsyncClient') as mock_client:
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(
                return_value=mock_response
            )
            
            result = await service.create_shopping_list_link(
                title="Test Shopping List",
                items=[
                    {"name": "milk", "quantity": 1},
                    {"name": "bread", "quantity": 2},
                ],
            )
            
            assert result["products_link_url"] == "https://instacart.com/list/456"
            assert "expires_at" in result
    
    @pytest.mark.asyncio
    async def test_create_shopping_list_link_disabled(self, mock_settings):
        """Test shopping list link creation when service is disabled."""
        mock_settings.instacart_enabled = False
        with patch('src.instacart_service.settings', mock_settings):
            service = InstacartService()
            
            with pytest.raises(InstacartConfigError, match="disabled"):
                await service.create_shopping_list_link(
                    title="Test List",
                    items=[{"name": "eggs"}],
                )
    
    def test_is_available_enabled_with_key(self, service):
        """Test is_available returns True when enabled with key."""
        assert service.is_available() is True
    
    def test_is_available_disabled(self, mock_settings):
        """Test is_available returns False when disabled."""
        mock_settings.instacart_enabled = False
        with patch('src.instacart_service.settings', mock_settings):
            service = InstacartService()
            assert service.is_available() is False
    
    def test_is_available_no_key(self, mock_settings):
        """Test is_available returns False without API key."""
        mock_settings.instacart_api_key = None
        with patch('src.instacart_service.settings', mock_settings):
            service = InstacartService()
            assert service.is_available() is False


class TestInstacartExceptions:
    """Tests for Instacart exception classes."""
    
    def test_instacart_api_error(self):
        """Test InstacartAPIError attributes."""
        error = InstacartAPIError(
            message="Test error",
            status_code=400,
            response_data={"key": "value"},
        )
        assert str(error) == "Test error"
        assert error.status_code == 400
        assert error.response_data == {"key": "value"}
    
    def test_instacart_config_error(self):
        """Test InstacartConfigError."""
        error = InstacartConfigError("Config error")
        assert str(error) == "Config error"
