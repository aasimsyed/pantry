"""
Database service layer for Smart Pantry System.

This module provides high-level database operations and business logic
for managing pantry inventory.

Features:
    - Product CRUD operations
    - Inventory management
    - Search and filtering
    - Expiration tracking
    - Statistics and analytics
    - Bulk import from reports

Best Practices:
    - Transaction management
    - Error handling
    - Logging
    - Data validation
    - Query optimization

Example:
    >>> from src.db_service import PantryService
    >>> service = PantryService()
    >>> product = service.add_product("Organic Quinoa", "Bob's Red Mill", "Grains")
    >>> item = service.add_inventory_item(product.id, quantity=2.0, unit="lb")
"""

import json
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from src.database import (
    InventoryItem,
    ProcessingLog,
    Product,
    SavedRecipe,
    get_db_session,
    get_or_create_product,
    init_database,
)

# Configure logging
logger = logging.getLogger(__name__)


class PantryService:
    """Service layer for pantry database operations."""
    
    def __init__(self, session: Optional[Session] = None):
        """Initialize service.
        
        Args:
            session: Database session (creates new if not provided)
        """
        self.session = session or get_db_session()
        self._owns_session = session is None
    
    def close(self):
        """Close database session if owned by service."""
        if self._owns_session and self.session:
            self.session.close()
    
    def __enter__(self):
        """Context manager entry."""
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit."""
        if exc_type:
            self.session.rollback()
        self.close()
    
    # ========================================================================
    # Product Operations
    # ========================================================================
    
    def add_product(
        self,
        product_name: str,
        brand: Optional[str] = None,
        category: str = "Other",
        **kwargs
    ) -> Product:
        """Add or get existing product.
        
        Args:
            product_name: Product name
            brand: Brand name
            category: Category
            **kwargs: Additional product attributes
            
        Returns:
            Product instance
        """
        product = get_or_create_product(
            self.session,
            product_name,
            brand,
            category,
            **kwargs
        )
        self.session.commit()
        logger.info(f"Product added/retrieved: {product.product_name}")
        return product
    
    def get_product(self, product_id: int) -> Optional[Product]:
        """Get product by ID.
        
        Args:
            product_id: Product ID
            
        Returns:
            Product or None
        """
        return self.session.query(Product).filter(Product.id == product_id).first()
    
    def search_products(
        self,
        query: str = "",
        category: Optional[str] = None,
        brand: Optional[str] = None,
        limit: int = 100
    ) -> List[Product]:
        """Search products.
        
        Args:
            query: Search query (matches name or brand)
            category: Filter by category
            brand: Filter by brand
            limit: Maximum results
            
        Returns:
            List of matching products
        """
        q = self.session.query(Product)
        
        if query:
            q = q.filter(
                or_(
                    Product.product_name.ilike(f"%{query}%"),
                    Product.brand.ilike(f"%{query}%")
                )
            )
        
        if category:
            q = q.filter(Product.category == category)
        
        if brand:
            q = q.filter(Product.brand == brand)
        
        return q.limit(limit).all()
    
    def get_all_categories(self) -> List[str]:
        """Get all unique categories.
        
        Returns:
            List of category names
        """
        results = self.session.query(Product.category).distinct().all()
        return [r[0] for r in results]
    
    def get_all_brands(self) -> List[str]:
        """Get all unique brands.
        
        Returns:
            List of brand names
        """
        results = self.session.query(Product.brand).distinct().filter(
            Product.brand.isnot(None)
        ).all()
        return [r[0] for r in results]
    
    # ========================================================================
    # Inventory Operations
    # ========================================================================
    
    def add_inventory_item(
        self,
        product_id: int,
        quantity: float = 1.0,
        unit: str = "count",
        storage_location: str = "pantry",
        expiration_date: Optional[datetime] = None,
        **kwargs
    ) -> InventoryItem:
        """Add inventory item.
        
        Args:
            product_id: Product ID
            quantity: Quantity
            unit: Unit of measurement
            storage_location: Where stored
            expiration_date: Expiration date
            **kwargs: Additional attributes
            
        Returns:
            InventoryItem instance
        """
        item = InventoryItem(
            product_id=product_id,
            quantity=quantity,
            unit=unit,
            storage_location=storage_location,
            expiration_date=expiration_date,
            **kwargs
        )
        item.update_status()
        
        self.session.add(item)
        self.session.commit()
        
        logger.info(f"Inventory item added: {item}")
        return item
    
    def get_inventory_item(self, item_id: int) -> Optional[InventoryItem]:
        """Get inventory item by ID.
        
        Args:
            item_id: Item ID
            
        Returns:
            InventoryItem or None
        """
        return self.session.query(InventoryItem).filter(
            InventoryItem.id == item_id
        ).first()
    
    def get_inventory_by_location(
        self,
        location: str = "pantry"
    ) -> List[InventoryItem]:
        """Get inventory items by storage location.
        
        Args:
            location: Storage location
            
        Returns:
            List of inventory items
        """
        return self.session.query(InventoryItem).filter(
            InventoryItem.storage_location == location,
            InventoryItem.status == "in_stock"
        ).all()
    
    def get_all_inventory(
        self,
        include_consumed: bool = False
    ) -> List[InventoryItem]:
        """Get all inventory items.
        
        Args:
            include_consumed: Include consumed items
            
        Returns:
            List of inventory items
        """
        q = self.session.query(InventoryItem)
        
        if not include_consumed:
            q = q.filter(InventoryItem.status != "consumed")
        
        return q.all()
    
    def update_inventory_quantity(
        self,
        item_id: int,
        new_quantity: float
    ) -> Optional[InventoryItem]:
        """Update inventory item quantity.
        
        Args:
            item_id: Item ID
            new_quantity: New quantity
            
        Returns:
            Updated item or None
        """
        item = self.get_inventory_item(item_id)
        if not item:
            return None
        
        item.quantity = new_quantity
        item.update_status()
        self.session.commit()
        
        logger.info(f"Updated quantity for item {item_id}: {new_quantity}")
        return item
    
    def consume_item(
        self,
        item_id: int,
        amount: Optional[float] = None
    ) -> Optional[InventoryItem]:
        """Consume inventory item.
        
        Args:
            item_id: Item ID
            amount: Amount to consume (None = all)
            
        Returns:
            Updated item or None
        """
        item = self.get_inventory_item(item_id)
        if not item:
            return None
        
        if amount is None:
            item.quantity = 0
        else:
            item.quantity = max(0, item.quantity - amount)
        
        item.update_status()
        self.session.commit()
        
        logger.info(f"Consumed item {item_id}")
        return item
    
    # ========================================================================
    # Expiration Tracking
    # ========================================================================
    
    def get_expiring_items(
        self,
        days: int = 7
    ) -> List[InventoryItem]:
        """Get items expiring within specified days.
        
        Args:
            days: Number of days threshold
            
        Returns:
            List of expiring items
        """
        threshold = datetime.utcnow() + timedelta(days=days)
        
        return self.session.query(InventoryItem).filter(
            InventoryItem.expiration_date.isnot(None),
            InventoryItem.expiration_date <= threshold,
            InventoryItem.expiration_date > datetime.utcnow(),
            InventoryItem.status == "in_stock"
        ).order_by(InventoryItem.expiration_date).all()
    
    def get_expired_items(self) -> List[InventoryItem]:
        """Get expired items.
        
        Returns:
            List of expired items
        """
        return self.session.query(InventoryItem).filter(
            InventoryItem.expiration_date.isnot(None),
            InventoryItem.expiration_date <= datetime.utcnow(),
            InventoryItem.status != "consumed"
        ).all()
    
    def update_expired_status(self) -> int:
        """Update status for all expired items.
        
        Returns:
            Number of items updated
        """
        expired = self.get_expired_items()
        count = 0
        
        for item in expired:
            if item.status != "expired":
                item.status = "expired"
                count += 1
        
        self.session.commit()
        logger.info(f"Updated {count} expired items")
        return count
    
    # ========================================================================
    # Processing Log Operations
    # ========================================================================
    
    def add_processing_log(
        self,
        image_path: str,
        ocr_confidence: Optional[float] = None,
        ai_confidence: Optional[float] = None,
        status: str = "success",
        raw_ocr_data: Optional[dict] = None,
        raw_ai_data: Optional[dict] = None,
        error_message: Optional[str] = None,
        inventory_item_id: Optional[int] = None
    ) -> ProcessingLog:
        """Add processing log entry.
        
        Args:
            image_path: Path to image
            ocr_confidence: OCR confidence score
            ai_confidence: AI confidence score
            status: Processing status
            raw_ocr_data: Raw OCR data
            raw_ai_data: Raw AI data
            error_message: Error message if failed
            inventory_item_id: Associated inventory item
            
        Returns:
            ProcessingLog instance
        """
        log = ProcessingLog(
            image_path=image_path,
            ocr_confidence=ocr_confidence,
            ai_confidence=ai_confidence,
            status=status,
            raw_ocr_data=json.dumps(raw_ocr_data) if raw_ocr_data else None,
            raw_ai_data=json.dumps(raw_ai_data) if raw_ai_data else None,
            error_message=error_message,
            inventory_item_id=inventory_item_id
        )
        
        self.session.add(log)
        self.session.commit()
        
        return log
    
    def get_processing_logs(
        self,
        status: Optional[str] = None,
        limit: int = 100
    ) -> List[ProcessingLog]:
        """Get processing logs.
        
        Args:
            status: Filter by status
            limit: Maximum results
            
        Returns:
            List of processing logs
        """
        q = self.session.query(ProcessingLog)
        
        if status:
            q = q.filter(ProcessingLog.status == status)
        
        return q.order_by(
            ProcessingLog.processing_date.desc()
        ).limit(limit).all()
    
    # ========================================================================
    # Statistics and Analytics
    # ========================================================================
    
    def get_statistics(self) -> Dict:
        """Get pantry statistics.
        
        Returns:
            Dictionary with statistics
        """
        total_products = self.session.query(Product).count()
        total_items = self.session.query(InventoryItem).filter(
            InventoryItem.status == "in_stock"
        ).count()
        
        expiring_soon = len(self.get_expiring_items(7))
        expired = len(self.get_expired_items())
        
        # Category breakdown
        category_counts = self.session.query(
            Product.category,
            func.count(InventoryItem.id)
        ).join(InventoryItem).filter(
            InventoryItem.status == "in_stock"
        ).group_by(Product.category).all()
        
        # Storage location breakdown
        location_counts = self.session.query(
            InventoryItem.storage_location,
            func.count(InventoryItem.id)
        ).filter(
            InventoryItem.status == "in_stock"
        ).group_by(InventoryItem.storage_location).all()
        
        return {
            "total_products": total_products,
            "total_items": total_items,
            "expiring_soon": expiring_soon,
            "expired": expired,
            "by_category": {cat: count for cat, count in category_counts},
            "by_location": {loc: count for loc, count in location_counts},
        }
    
    # ========================================================================
    # Bulk Import from Reports
    # ========================================================================
    
    def import_from_json_report(
        self,
        json_file: Path,
        storage_location: str = "pantry"
    ) -> Dict:
        """Import inventory from JSON report.
        
        Args:
            json_file: Path to pantry JSON report
            storage_location: Default storage location
            
        Returns:
            Dictionary with import statistics
        """
        with open(json_file, 'r') as f:
            data = json.load(f)
        
        products = data.get('products', [])
        
        stats = {
            "products_created": 0,
            "items_created": 0,
            "logs_created": 0,
            "errors": 0
        }
        
        for entry in products:
            try:
                product_data = entry['product']
                ocr_data = entry.get('ocr', {})
                image_file = entry.get('image_file', '')
                
                # Create or get product
                product = self.add_product(
                    product_name=product_data['product_name'],
                    brand=product_data.get('brand'),
                    category=product_data.get('category', 'Other'),
                    subcategory=product_data.get('subcategory')
                )
                
                if product.created_at == product.updated_at:  # New product
                    stats["products_created"] += 1
                
                # Parse expiration date
                exp_date = None
                if product_data.get('expiration_date'):
                    try:
                        exp_date = datetime.fromisoformat(
                            product_data['expiration_date']
                        )
                    except (ValueError, TypeError):
                        pass
                
                # Create inventory item
                item = self.add_inventory_item(
                    product_id=product.id,
                    quantity=1.0,
                    unit="count",
                    storage_location=storage_location,
                    expiration_date=exp_date,
                    image_path=image_file,
                    notes=f"Imported from {json_file.name}"
                )
                stats["items_created"] += 1
                
                # Create processing log
                self.add_processing_log(
                    image_path=image_file,
                    ocr_confidence=ocr_data.get('confidence'),
                    ai_confidence=product_data.get('confidence'),
                    status="success",
                    raw_ocr_data=ocr_data,
                    raw_ai_data=product_data,
                    inventory_item_id=item.id
                )
                stats["logs_created"] += 1
                
            except Exception as e:
                logger.error(f"Error importing {entry}: {e}")
                stats["errors"] += 1
                continue
        
        logger.info(f"Import complete: {stats}")
        return stats
    
    # ========================================================================
    # Recipe Box Operations
    # ========================================================================
    
    def save_recipe(
        self,
        name: str,
        description: Optional[str] = None,
        cuisine: Optional[str] = None,
        difficulty: Optional[str] = None,
        prep_time: Optional[int] = None,
        cook_time: Optional[int] = None,
        servings: Optional[int] = None,
        ingredients: List[Dict] = None,
        instructions: List[str] = None,
        notes: Optional[str] = None,
        rating: Optional[int] = None,
        tags: Optional[List[str]] = None
    ) -> SavedRecipe:
        """Save a recipe to the recipe box.
        
        Args:
            name: Recipe name
            description: Recipe description
            cuisine: Cuisine type
            difficulty: Difficulty level
            prep_time: Preparation time in minutes
            cook_time: Cooking time in minutes
            servings: Number of servings
            ingredients: List of ingredient dictionaries
            instructions: List of instruction strings
            notes: User notes
            rating: Rating (1-5 stars)
            tags: List of tags
            
        Returns:
            Saved recipe object
        """
        import json
        
        recipe = SavedRecipe(
            name=name,
            description=description,
            cuisine=cuisine,
            difficulty=difficulty,
            prep_time=prep_time,
            cook_time=cook_time,
            servings=servings,
            ingredients=json.dumps(ingredients or []),
            instructions=json.dumps(instructions or []),
            notes=notes,
            rating=rating,
            tags=json.dumps(tags or []) if tags else None
        )
        
        self.session.add(recipe)
        self.session.commit()
        self.session.refresh(recipe)
        
        logger.info(f"Saved recipe: {name} (ID: {recipe.id})")
        return recipe
    
    def get_saved_recipes(
        self,
        cuisine: Optional[str] = None,
        difficulty: Optional[str] = None,
        limit: Optional[int] = None
    ) -> List[SavedRecipe]:
        """Get saved recipes with optional filtering.
        
        Args:
            cuisine: Filter by cuisine type
            difficulty: Filter by difficulty
            limit: Maximum number of recipes to return
            
        Returns:
            List of saved recipes
        """
        query = self.session.query(SavedRecipe)
        
        if cuisine:
            query = query.filter(SavedRecipe.cuisine == cuisine)
        if difficulty:
            query = query.filter(SavedRecipe.difficulty == difficulty)
        
        query = query.order_by(SavedRecipe.created_at.desc())
        
        if limit:
            query = query.limit(limit)
        
        return query.all()
    
    def get_saved_recipe(self, recipe_id: int) -> Optional[SavedRecipe]:
        """Get a specific saved recipe by ID.
        
        Args:
            recipe_id: Recipe ID
            
        Returns:
            Saved recipe or None if not found
        """
        return self.session.query(SavedRecipe).filter(
            SavedRecipe.id == recipe_id
        ).first()
    
    def update_saved_recipe(
        self,
        recipe_id: int,
        notes: Optional[str] = None,
        rating: Optional[int] = None,
        tags: Optional[List[str]] = None
    ) -> Optional[SavedRecipe]:
        """Update a saved recipe (notes, rating, tags).
        
        Args:
            recipe_id: Recipe ID
            notes: Updated notes
            rating: Updated rating (1-5)
            tags: Updated tags
            
        Returns:
            Updated recipe or None if not found
        """
        import json
        
        recipe = self.get_saved_recipe(recipe_id)
        if not recipe:
            return None
        
        if notes is not None:
            recipe.notes = notes
        if rating is not None:
            recipe.rating = rating
        if tags is not None:
            recipe.tags = json.dumps(tags)
        
        self.session.commit()
        self.session.refresh(recipe)
        
        logger.info(f"Updated recipe ID {recipe_id}")
        return recipe
    
    def delete_saved_recipe(self, recipe_id: int) -> bool:
        """Delete a saved recipe.
        
        Args:
            recipe_id: Recipe ID to delete
            
        Returns:
            True if deleted, False if not found
        """
        recipe = self.get_saved_recipe(recipe_id)
        if not recipe:
            return False
        
        self.session.delete(recipe)
        self.session.commit()
        
        logger.info(f"Deleted recipe ID {recipe_id}")
        return True


def initialize_database():
    """Initialize database with schema."""
    init_database()

