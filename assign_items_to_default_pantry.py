#!/usr/bin/env python3
"""
Script to assign all inventory items with NULL pantry_id to the default pantry.

This script:
1. Finds all inventory items with NULL pantry_id
2. Gets or creates the default "Home" pantry for each user
3. Updates all NULL items to be assigned to that pantry

Usage:
    python assign_items_to_default_pantry.py
"""

import logging
import sys
from src.database import get_db_session, InventoryItem, Pantry, User
from src.db_service import PantryService

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def assign_items_to_default_pantry():
    """Assign all NULL pantry_id items to default pantry."""
    session = get_db_session()
    service = PantryService(session)
    
    try:
        # Get all items with NULL pantry_id
        # Use raw SQL to avoid ORM issues if user_id column doesn't exist locally
        from sqlalchemy import text, inspect
        from src.database import create_database_engine
        
        engine = create_database_engine()
        inspector = inspect(engine)
        
        # Check if user_id column exists
        columns = [col['name'] for col in inspector.get_columns('inventory_items')]
        has_user_id = 'user_id' in columns
        
        if has_user_id:
            null_items = session.query(InventoryItem).filter(
                InventoryItem.pantry_id.is_(None),
                InventoryItem.user_id.isnot(None)
            ).all()
        else:
            # If no user_id column, get all items with NULL pantry_id
            # This is for local dev databases that might not have user_id yet
            logger.warning("user_id column not found - this script is designed for production database")
            null_items = session.query(InventoryItem).filter(
                InventoryItem.pantry_id.is_(None)
            ).all()
        
        if not null_items:
            logger.info("✅ No items with NULL pantry_id found")
            return
        
        logger.info(f"Found {len(null_items)} items with NULL pantry_id")
        
        # Group items by user_id
        items_by_user = {}
        for item in null_items:
            user_id = item.user_id if has_user_id else None
            if user_id is None:
                logger.warning(f"Item {item.id} has no user_id - skipping")
                continue
            if user_id not in items_by_user:
                items_by_user[user_id] = []
            items_by_user[user_id].append(item)
        
        logger.info(f"Items belong to {len(items_by_user)} user(s)")
        
        # Process each user's items
        total_assigned = 0
        for user_id, items in items_by_user.items():
            logger.info(f"\nProcessing user {user_id} ({len(items)} items)...")
            
            # Get or create default pantry for this user
            default_pantry = service.get_or_create_default_pantry(user_id)
            logger.info(f"Using default pantry: {default_pantry.name} (ID: {default_pantry.id})")
            
            # Update all items for this user
            for item in items:
                item.pantry_id = default_pantry.id
                total_assigned += 1
                logger.debug(f"  - Assigned item {item.id} ({item.product_name or 'Unknown'}) to pantry {default_pantry.id}")
            
            session.commit()
            logger.info(f"✅ Assigned {len(items)} items to default pantry for user {user_id}")
        
        logger.info(f"\n✅ Successfully assigned {total_assigned} items to default pantries")
        
    except Exception as e:
        session.rollback()
        logger.error(f"❌ Error assigning items: {e}", exc_info=True)
        sys.exit(1)
    finally:
        session.close()


if __name__ == "__main__":
    logger.info("Starting assignment of NULL pantry_id items to default pantries...")
    assign_items_to_default_pantry()
    logger.info("✅ Script completed")

