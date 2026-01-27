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
    Pantry,
    ProcessingLog,
    Product,
    RecentRecipe,
    SavedRecipe,
    UserSettings,
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
        user_id: Optional[int] = None,
        pantry_id: Optional[int] = None,
        **kwargs
    ) -> InventoryItem:
        """Add inventory item.
        
        Args:
            product_id: Product ID
            quantity: Quantity
            unit: Unit of measurement
            storage_location: Where stored
            expiration_date: Expiration date
            user_id: User ID (optional, for backward compatibility)
            pantry_id: Pantry ID (optional)
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
            user_id=user_id,
            pantry_id=pantry_id,
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
        user_id: Optional[int] = None,
        pantry_id: Optional[int] = None,
        include_consumed: bool = False
    ) -> List[InventoryItem]:
        """Get all inventory items with optional filtering.
        
        Args:
            user_id: Filter by user ID
            pantry_id: Filter by pantry ID
            include_consumed: Include consumed items
            
        Returns:
            List of inventory items
        """
        q = self.session.query(InventoryItem)
        
        if user_id is not None:
            q = q.filter(InventoryItem.user_id == user_id)
        
        if pantry_id is not None:
            # Only show items that belong to this specific pantry
            # Items with NULL pantry_id are not shown (they need to be assigned to a pantry)
            q = q.filter(InventoryItem.pantry_id == pantry_id)
        
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
    
    def update_inventory_item(
        self,
        item_id: int,
        **kwargs
    ) -> Optional[InventoryItem]:
        """Update inventory item with any provided fields.
        
        Args:
            item_id: Item ID
            **kwargs: Fields to update (quantity, unit, storage_location, status, etc.)
            
        Returns:
            Updated item or None
        """
        from datetime import datetime as dt, date as date_type
        
        item = self.get_inventory_item(item_id)
        if not item:
            return None
        
        # Update provided fields
        if 'quantity' in kwargs:
            item.quantity = kwargs['quantity']
        if 'unit' in kwargs:
            item.unit = kwargs['unit']
        if 'storage_location' in kwargs:
            item.storage_location = kwargs['storage_location']
        if 'status' in kwargs:
            item.status = kwargs['status']
        if 'purchase_date' in kwargs:
            if kwargs['purchase_date']:
                if isinstance(kwargs['purchase_date'], str):
                    # Handle date string (YYYY-MM-DD format)
                    try:
                        # Try parsing as date first
                        from datetime import date as date_type
                        date_obj = date_type.fromisoformat(kwargs['purchase_date'])
                        item.purchase_date = dt.combine(date_obj, dt.min.time())
                    except (ValueError, AttributeError):
                        # Fallback to datetime parsing
                        item.purchase_date = dt.fromisoformat(kwargs['purchase_date'].replace('Z', '+00:00'))
                elif isinstance(kwargs['purchase_date'], date_type):
                    item.purchase_date = dt.combine(kwargs['purchase_date'], dt.min.time())
                else:
                    item.purchase_date = kwargs['purchase_date']
            else:
                item.purchase_date = None
        if 'expiration_date' in kwargs:
            if kwargs['expiration_date']:
                if isinstance(kwargs['expiration_date'], str):
                    # Handle date string (YYYY-MM-DD format)
                    try:
                        from datetime import date as date_type
                        date_obj = date_type.fromisoformat(kwargs['expiration_date'])
                        item.expiration_date = dt.combine(date_obj, dt.min.time())
                    except (ValueError, AttributeError):
                        # Fallback to datetime parsing
                        item.expiration_date = dt.fromisoformat(kwargs['expiration_date'].replace('Z', '+00:00'))
                elif isinstance(kwargs['expiration_date'], date_type):
                    item.expiration_date = dt.combine(kwargs['expiration_date'], dt.min.time())
                else:
                    item.expiration_date = kwargs['expiration_date']
            else:
                item.expiration_date = None
        if 'notes' in kwargs:
            item.notes = kwargs['notes']
        if 'image_path' in kwargs:
            item.image_path = kwargs['image_path']
        if 'product_id' in kwargs:
            item.product_id = kwargs['product_id']
        
        # Update status based on expiration
        item.update_status()
        
        self.session.commit()
        self.session.refresh(item)
        
        logger.info(f"Updated inventory item {item_id}")
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
        user_id: int,
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
        tags: Optional[List[str]] = None,
        ai_model: Optional[str] = None,
        flavor_pairings: Optional[List[Dict]] = None
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
            ai_model: AI model used to generate the recipe (optional)
            flavor_pairings: List of flavor pairing dictionaries (optional)
            
        Returns:
            Saved recipe object
            
        Raises:
            ValueError: If a recipe with the same name already exists for this user
        """
        import json
        
        # Check for duplicate recipe name for this user
        existing = self.session.query(SavedRecipe).filter(
            SavedRecipe.user_id == user_id,
            SavedRecipe.name == name
        ).first()
        
        if existing:
            raise ValueError(f"Recipe '{name}' is already saved in your recipe box")
        
        recipe = SavedRecipe(
            name=name,
            user_id=user_id,
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
            tags=json.dumps(tags or []) if tags else None,
            ai_model=ai_model,
            flavor_pairings=json.dumps(flavor_pairings) if flavor_pairings else None
        )
        
        self.session.add(recipe)
        self.session.commit()
        self.session.refresh(recipe)
        
        logger.info(f"Saved recipe: {name} (ID: {recipe.id})")
        return recipe
    
    def get_saved_recipes(
        self,
        user_id: int,
        cuisine: Optional[str] = None,
        difficulty: Optional[str] = None,
        limit: Optional[int] = None
    ) -> List[SavedRecipe]:
        """Get saved recipes with optional filtering.
        
        Args:
            user_id: User ID to filter recipes (required for data isolation)
            cuisine: Filter by cuisine type
            difficulty: Filter by difficulty
            limit: Maximum number of recipes to return
            
        Returns:
            List of saved recipes for the specified user
        """
        query = self.session.query(SavedRecipe).filter(
            SavedRecipe.user_id == user_id
        )
        
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
        
        # Allow empty string to clear notes (notes is not None means we're updating it)
        if notes is not None:
            recipe.notes = notes if notes else None  # Empty string becomes None
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
    
    # ========================================================================
    # Recent Recipe Operations
    # ========================================================================
    
    def save_recent_recipe(
        self,
        user_id: int,
        name: str,
        description: Optional[str] = None,
        cuisine: Optional[str] = None,
        difficulty: Optional[str] = None,
        prep_time: Optional[int] = None,
        cook_time: Optional[int] = None,
        servings: Optional[int] = None,
        ingredients: List[Dict] = None,
        instructions: List[str] = None,
        available_ingredients: Optional[List[str]] = None,
        missing_ingredients: Optional[List[str]] = None,
        flavor_pairings: Optional[List[str]] = None,
        ai_model: Optional[str] = None
    ) -> RecentRecipe:
        """Save a recently generated recipe to recent_recipes table.
        
        Args:
            user_id: User ID
            name: Recipe name
            description: Recipe description
            cuisine: Cuisine type
            difficulty: Difficulty level
            prep_time: Preparation time in minutes
            cook_time: Cooking time in minutes
            servings: Number of servings
            ingredients: List of ingredient dictionaries
            instructions: List of instruction strings
            available_ingredients: List of ingredients from pantry
            missing_ingredients: List of ingredients not in pantry
            flavor_pairings: List of flavor pairings
            ai_model: AI model used to generate recipe
            
        Returns:
            Saved RecentRecipe instance
        """
        import json
        from datetime import datetime, timedelta
        
        # Clean up old recent recipes (older than 7 days)
        cutoff_date = datetime.utcnow() - timedelta(days=7)
        self.session.query(RecentRecipe).filter(
            RecentRecipe.generated_at < cutoff_date
        ).delete()
        
        recipe = RecentRecipe(
            user_id=user_id,
            name=name,
            description=description,
            cuisine=cuisine,
            difficulty=difficulty,
            prep_time=prep_time,
            cook_time=cook_time,
            servings=servings,
            ingredients=json.dumps(ingredients or []),
            instructions=json.dumps(instructions or []),
            available_ingredients=json.dumps(available_ingredients) if available_ingredients else None,
            missing_ingredients=json.dumps(missing_ingredients) if missing_ingredients else None,
            flavor_pairings=json.dumps(flavor_pairings) if flavor_pairings else None,
            ai_model=ai_model
        )
        
        self.session.add(recipe)
        self.session.commit()
        self.session.refresh(recipe)
        
        logger.info(f"Saved recent recipe: {name} (ID: {recipe.id})")
        return recipe
    
    def get_recent_recipes(
        self,
        user_id: int,
        limit: Optional[int] = 20
    ) -> List[RecentRecipe]:
        """Get recent recipes for a user.
        
        Args:
            user_id: User ID
            limit: Maximum number of recipes to return (default: 20)
            
        Returns:
            List of recent recipes, ordered by most recent first
        """
        query = self.session.query(RecentRecipe).filter(
            RecentRecipe.user_id == user_id
        ).order_by(RecentRecipe.generated_at.desc())
        
        if limit:
            query = query.limit(limit)
        
        return query.all()
    
    def get_recent_recipe(self, recipe_id: int, user_id: int) -> Optional[RecentRecipe]:
        """Get a specific recent recipe by ID (with user verification).
        
        Args:
            recipe_id: Recipe ID
            user_id: User ID (for security - ensures user owns the recipe)
            
        Returns:
            Recent recipe or None if not found or not owned by user
        """
        return self.session.query(RecentRecipe).filter(
            RecentRecipe.id == recipe_id,
            RecentRecipe.user_id == user_id
        ).first()
    
    def delete_recent_recipe(self, recipe_id: int, user_id: int) -> bool:
        """Delete a recent recipe.
        
        Args:
            recipe_id: Recipe ID to delete
            user_id: User ID (for security)
            
        Returns:
            True if deleted, False if not found or not owned by user
        """
        recipe = self.get_recent_recipe(recipe_id, user_id)
        if not recipe:
            return False
        
        self.session.delete(recipe)
        self.session.commit()
        
        logger.info(f"Deleted recent recipe ID {recipe_id}")
        return True
    
    def delete_all_recent_recipes(self, user_id: int) -> int:
        """Delete all recent recipes for a user.
        
        Args:
            user_id: User ID
            
        Returns:
            Number of recipes deleted
        """
        count = self.session.query(RecentRecipe).filter(
            RecentRecipe.user_id == user_id
        ).delete()
        self.session.commit()
        
        logger.info(f"Deleted {count} recent recipes for user ID {user_id}")
        return count
    
    def save_recent_to_saved(
        self,
        recent_recipe_id: int,
        user_id: int,
        notes: Optional[str] = None,
        rating: Optional[int] = None,
        tags: Optional[List[str]] = None
    ) -> SavedRecipe:
        """Save a recent recipe to saved recipes (recipe box).
        
        Args:
            recent_recipe_id: Recent recipe ID
            user_id: User ID (for security)
            notes: Optional notes to add
            rating: Optional rating (1-5)
            tags: Optional tags
            
        Returns:
            Saved recipe instance
            
        Raises:
            ValueError: If recent recipe not found or duplicate name
        """
        import json
        
        recent = self.get_recent_recipe(recent_recipe_id, user_id)
        if not recent:
            raise ValueError(f"Recent recipe {recent_recipe_id} not found")
        
        # Check for duplicate name
        existing = self.session.query(SavedRecipe).filter(
            SavedRecipe.user_id == user_id,
            SavedRecipe.name == recent.name
        ).first()
        
        if existing:
            raise ValueError(f"Recipe '{recent.name}' is already saved in your recipe box")
        
        # Convert recent recipe to saved recipe
        saved = SavedRecipe(
            name=recent.name,
            user_id=user_id,
            description=recent.description,
            cuisine=recent.cuisine,
            difficulty=recent.difficulty,
            prep_time=recent.prep_time,
            cook_time=recent.cook_time,
            servings=recent.servings,
            ingredients=recent.ingredients,  # Already JSON
            instructions=recent.instructions,  # Already JSON
            notes=notes,
            rating=rating,
            tags=json.dumps(tags) if tags else None,
            ai_model=recent.ai_model,
            flavor_pairings=recent.flavor_pairings  # Copy flavor pairings (already JSON)
        )
        
        self.session.add(saved)
        self.session.commit()
        self.session.refresh(saved)
        
        # Optionally delete the recent recipe after saving
        self.session.delete(recent)
        self.session.commit()
        
        logger.info(f"Saved recent recipe {recent_recipe_id} to recipe box (ID: {saved.id})")
        return saved
    
    # ========================================================================
    # Pantry Operations
    # ========================================================================
    
    def create_pantry(
        self,
        user_id: int,
        name: str,
        description: Optional[str] = None,
        location: Optional[str] = None,
        is_default: bool = False
    ) -> Pantry:
        """Create a new pantry for a user.
        
        Args:
            user_id: User ID
            name: Pantry name
            description: Optional description
            location: Optional location/address
            is_default: Whether this should be the default pantry
            
        Returns:
            Created Pantry instance
        """
        # If this is set as default, unset other default pantries for this user
        if is_default:
            self.session.query(Pantry).filter(
                Pantry.user_id == user_id,
                Pantry.is_default == True
            ).update({"is_default": False})
        
        pantry = Pantry(
            user_id=user_id,
            name=name,
            description=description,
            location=location,
            is_default=is_default
        )
        self.session.add(pantry)
        self.session.commit()
        self.session.refresh(pantry)
        
        logger.info(f"Created pantry '{name}' for user {user_id}")
        return pantry
    
    def get_pantry(self, pantry_id: int, user_id: Optional[int] = None) -> Optional[Pantry]:
        """Get a pantry by ID.
        
        Args:
            pantry_id: Pantry ID
            user_id: Optional user ID to verify ownership
            
        Returns:
            Pantry instance or None
        """
        query = self.session.query(Pantry).filter(Pantry.id == pantry_id)
        
        if user_id:
            query = query.filter(Pantry.user_id == user_id)
        
        return query.first()
    
    def get_user_pantries(self, user_id: int) -> List[Pantry]:
        """Get all pantries for a user.
        
        Args:
            user_id: User ID
            
        Returns:
            List of Pantry instances
        """
        return self.session.query(Pantry).filter(
            Pantry.user_id == user_id
        ).order_by(Pantry.is_default.desc(), Pantry.created_at).all()
    
    def get_default_pantry(self, user_id: int) -> Optional[Pantry]:
        """Get the default pantry for a user.
        
        Args:
            user_id: User ID
            
        Returns:
            Default Pantry instance or None
        """
        return self.session.query(Pantry).filter(
            Pantry.user_id == user_id,
            Pantry.is_default == True
        ).first()
    
    def get_or_create_default_pantry(self, user_id: int) -> Pantry:
        """Get or create a default pantry for a user.
        
        If no default pantry exists, creates one named "Home".
        
        Args:
            user_id: User ID
            
        Returns:
            Default Pantry instance
        """
        pantry = self.get_default_pantry(user_id)
        
        if not pantry:
            # Check if user has any pantries
            pantries = self.get_user_pantries(user_id)
            if pantries:
                # Set the first pantry as default
                pantry = pantries[0]
                pantry.is_default = True
                self.session.commit()
                self.session.refresh(pantry)
            else:
                # Create a default pantry
                pantry = self.create_pantry(
                    user_id=user_id,
                    name="Home",
                    description="Default pantry",
                    is_default=True
                )
        
        return pantry
    
    def update_pantry(
        self,
        pantry_id: int,
        user_id: int,
        name: Optional[str] = None,
        description: Optional[str] = None,
        location: Optional[str] = None,
        is_default: Optional[bool] = None
    ) -> Optional[Pantry]:
        """Update a pantry.
        
        Args:
            pantry_id: Pantry ID
            user_id: User ID (for ownership verification)
            name: New name
            description: New description
            location: New location
            is_default: Whether to set as default
            
        Returns:
            Updated Pantry instance or None
        """
        pantry = self.get_pantry(pantry_id, user_id)
        if not pantry:
            return None
        
        if name is not None:
            pantry.name = name
        if description is not None:
            pantry.description = description
        if location is not None:
            pantry.location = location
        
        # Handle default flag
        if is_default is not None:
            if is_default and not pantry.is_default:
                # Unset other default pantries
                self.session.query(Pantry).filter(
                    Pantry.user_id == user_id,
                    Pantry.is_default == True,
                    Pantry.id != pantry_id
                ).update({"is_default": False})
                pantry.is_default = True
            elif not is_default:
                pantry.is_default = False
        
        self.session.commit()
        self.session.refresh(pantry)
        
        logger.info(f"Updated pantry ID {pantry_id}")
        return pantry
    
    def delete_pantry(self, pantry_id: int, user_id: int) -> bool:
        """Delete a pantry.
        
        Note: Inventory items in this pantry will have pantry_id set to NULL.
        
        Args:
            pantry_id: Pantry ID
            user_id: User ID (for ownership verification)
            
        Returns:
            True if deleted, False if not found
        """
        pantry = self.get_pantry(pantry_id, user_id)
        if not pantry:
            return False
        
        self.session.delete(pantry)
        self.session.commit()
        
        logger.info(f"Deleted pantry ID {pantry_id}")
        return True
    
    # ========================================================================
    # User Settings Operations
    # ========================================================================
    
    def get_user_settings(self, user_id: int) -> UserSettings:
        """Get user settings, creating default if doesn't exist.
        
        Args:
            user_id: User ID
            
        Returns:
            UserSettings object
        """
        settings = self.session.query(UserSettings).filter(
            UserSettings.user_id == user_id
        ).first()
        
        if not settings:
            # Create default settings
            settings = UserSettings(
                user_id=user_id,
                ai_provider=None,  # Use system default
                ai_model=None  # Use system default
            )
            self.session.add(settings)
            self.session.commit()
            self.session.refresh(settings)
        
        return settings
    
    def update_user_settings(
        self,
        user_id: int,
        ai_provider: Optional[str] = None,
        ai_model: Optional[str] = None
    ) -> UserSettings:
        """Update user settings.
        
        Args:
            user_id: User ID
            ai_provider: AI provider ("openai" or "anthropic")
            ai_model: AI model name (e.g., "gpt-4o", "claude-sonnet-4-20250514")
            
        Returns:
            Updated UserSettings object
        """
        from datetime import datetime
        settings = self.get_user_settings(user_id)
        
        if ai_provider is not None:
            settings.ai_provider = ai_provider
        if ai_model is not None:
            settings.ai_model = ai_model
        
        settings.updated_at = datetime.utcnow()
        self.session.add(settings)
        self.session.commit()
        self.session.refresh(settings)
        
        logger.info(f"Updated settings for user {user_id}: provider={ai_provider}, model={ai_model}")
        return settings


def initialize_database():
    """Initialize database with schema."""
    init_database()

