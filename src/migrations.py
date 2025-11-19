"""
Database migration utilities.

Handles schema migrations for existing databases.
"""

import logging
from sqlalchemy import text, inspect
from src.database import create_database_engine, get_database_url

logger = logging.getLogger(__name__)


def add_user_id_to_saved_recipes():
    """
    Add user_id column to saved_recipes table if it doesn't exist.
    
    This migration handles the case where saved_recipes table was created
    before user authentication was added.
    """
    engine = create_database_engine()
    inspector = inspect(engine)
    
    # Check if saved_recipes table exists
    if 'saved_recipes' not in inspector.get_table_names():
        logger.info("saved_recipes table doesn't exist yet, will be created by init_database()")
        return
    
    # Check if user_id column already exists
    columns = [col['name'] for col in inspector.get_columns('saved_recipes')]
    if 'user_id' in columns:
        logger.info("user_id column already exists in saved_recipes table")
        return
    
    logger.info("Adding user_id column to saved_recipes table...")
    
    with engine.connect() as conn:
        # Start transaction
        trans = conn.begin()
        try:
            # For SQLite, we need to handle this differently
            db_url = get_database_url()
            if db_url.startswith('sqlite'):
                # SQLite doesn't support ALTER TABLE ADD COLUMN with NOT NULL directly
                # We'll add it as nullable first, then update existing rows
                conn.execute(text("""
                    ALTER TABLE saved_recipes 
                    ADD COLUMN user_id INTEGER
                """))
                
                # Update existing rows - set to NULL (they'll need to be reassigned)
                # Or you could set to a default user ID if you have one
                conn.execute(text("""
                    UPDATE saved_recipes 
                    SET user_id = NULL 
                    WHERE user_id IS NULL
                """))
                
                # For SQLite, we can't easily add NOT NULL constraint after the fact
                # The model will handle validation at the application level
                logger.info("Added user_id column to saved_recipes (nullable for existing rows)")
            else:
                # PostgreSQL supports adding NOT NULL columns with defaults
                # First, add column as nullable
                conn.execute(text("""
                    ALTER TABLE saved_recipes 
                    ADD COLUMN user_id INTEGER
                """))
                
                # Update existing rows to NULL (they'll need to be reassigned)
                conn.execute(text("""
                    UPDATE saved_recipes 
                    SET user_id = NULL 
                    WHERE user_id IS NULL
                """))
                
                # Add foreign key constraint
                conn.execute(text("""
                    ALTER TABLE saved_recipes 
                    ADD CONSTRAINT fk_saved_recipes_user_id 
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                """))
                
                # Add index
                conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS ix_saved_recipes_user_id 
                    ON saved_recipes(user_id)
                """))
                
                logger.info("Added user_id column, foreign key, and index to saved_recipes")
            
            trans.commit()
            logger.info("✅ Migration completed: user_id added to saved_recipes")
            
        except Exception as e:
            trans.rollback()
            logger.error(f"Migration failed: {e}", exc_info=True)
            raise


def add_pantries_table_and_pantry_id():
    """
    Add pantries table and pantry_id column to inventory_items.
    
    This migration enables multi-pantry support for users.
    """
    engine = create_database_engine()
    inspector = inspect(engine)
    db_url = get_database_url()
    
    with engine.connect() as conn:
        trans = conn.begin()
        try:
            # Check if pantries table exists
            if 'pantries' not in inspector.get_table_names():
                logger.info("Creating pantries table...")
                
                if db_url.startswith('sqlite'):
                    conn.execute(text("""
                        CREATE TABLE pantries (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            user_id INTEGER NOT NULL,
                            name VARCHAR(255) NOT NULL,
                            description TEXT,
                            location VARCHAR(255),
                            is_default BOOLEAN NOT NULL DEFAULT 0,
                            created_at DATETIME NOT NULL,
                            updated_at DATETIME NOT NULL,
                            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                        )
                    """))
                    conn.execute(text("""
                        CREATE INDEX ix_pantries_user_id ON pantries(user_id)
                    """))
                    conn.execute(text("""
                        CREATE INDEX ix_pantries_is_default ON pantries(is_default)
                    """))
                    conn.execute(text("""
                        CREATE INDEX ix_pantries_user_default ON pantries(user_id, is_default)
                    """))
                else:
                    # PostgreSQL
                    conn.execute(text("""
                        CREATE TABLE pantries (
                            id SERIAL PRIMARY KEY,
                            user_id INTEGER NOT NULL,
                            name VARCHAR(255) NOT NULL,
                            description TEXT,
                            location VARCHAR(255),
                            is_default BOOLEAN NOT NULL DEFAULT FALSE,
                            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            CONSTRAINT fk_pantries_user_id 
                                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                        )
                    """))
                    conn.execute(text("""
                        CREATE INDEX ix_pantries_user_id ON pantries(user_id)
                    """))
                    conn.execute(text("""
                        CREATE INDEX ix_pantries_is_default ON pantries(is_default)
                    """))
                    conn.execute(text("""
                        CREATE INDEX ix_pantries_user_default ON pantries(user_id, is_default)
                    """))
                
                logger.info("✅ Created pantries table")
            else:
                logger.info("pantries table already exists")
            
            # Check if pantry_id column exists in inventory_items
            if 'inventory_items' in inspector.get_table_names():
                columns = [col['name'] for col in inspector.get_columns('inventory_items')]
                if 'pantry_id' not in columns:
                    logger.info("Adding pantry_id column to inventory_items table...")
                    
                    if db_url.startswith('sqlite'):
                        conn.execute(text("""
                            ALTER TABLE inventory_items 
                            ADD COLUMN pantry_id INTEGER
                        """))
                        conn.execute(text("""
                            CREATE INDEX IF NOT EXISTS ix_inventory_items_pantry_id 
                            ON inventory_items(pantry_id)
                        """))
                    else:
                        # PostgreSQL
                        conn.execute(text("""
                            ALTER TABLE inventory_items 
                            ADD COLUMN pantry_id INTEGER
                        """))
                        conn.execute(text("""
                            ALTER TABLE inventory_items 
                            ADD CONSTRAINT fk_inventory_items_pantry_id 
                            FOREIGN KEY (pantry_id) REFERENCES pantries(id) ON DELETE SET NULL
                        """))
                        conn.execute(text("""
                            CREATE INDEX IF NOT EXISTS ix_inventory_items_pantry_id 
                            ON inventory_items(pantry_id)
                        """))
                    
                    logger.info("✅ Added pantry_id column to inventory_items")
                else:
                    logger.info("pantry_id column already exists in inventory_items")
            
            trans.commit()
            logger.info("✅ Migration completed: pantries table and pantry_id column")
            
        except Exception as e:
            trans.rollback()
            logger.error(f"Migration failed: {e}", exc_info=True)
            raise


def assign_null_items_to_default_pantry():
    """
    Assign all inventory items with NULL pantry_id to their user's default pantry.
    
    This migration fixes items that were created before the pantry feature
    was added, assigning them to the user's default pantry.
    """
    engine = create_database_engine()
    inspector = inspect(engine)
    db_url = get_database_url()
    
    if 'inventory_items' not in inspector.get_table_names():
        logger.info("inventory_items table doesn't exist, skipping assignment")
        return
    
    if 'pantries' not in inspector.get_table_names():
        logger.info("pantries table doesn't exist, skipping assignment")
        return
    
    with engine.connect() as conn:
        trans = conn.begin()
        try:
            # Get all users who have inventory items with NULL pantry_id
            result = conn.execute(text("""
                SELECT DISTINCT user_id 
                FROM inventory_items 
                WHERE pantry_id IS NULL AND user_id IS NOT NULL
            """))
            user_ids = [row[0] for row in result]
            
            if not user_ids:
                logger.info("No items with NULL pantry_id found")
                trans.commit()
                return
            
            logger.info(f"Found {len(user_ids)} users with NULL pantry_id items")
            
            # For each user, assign their NULL items to their default pantry
            for user_id in user_ids:
                # Get the user's default pantry
                pantry_result = conn.execute(text("""
                    SELECT id FROM pantries 
                    WHERE user_id = :user_id AND is_default = TRUE
                    LIMIT 1
                """), {"user_id": user_id})
                pantry_row = pantry_result.first()
                
                if not pantry_row:
                    # If no default pantry, get the first pantry or create one
                    pantry_result = conn.execute(text("""
                        SELECT id FROM pantries 
                        WHERE user_id = :user_id
                        ORDER BY created_at ASC
                        LIMIT 1
                    """), {"user_id": user_id})
                    pantry_row = pantry_result.first()
                    
                    if not pantry_row:
                        # Create a default pantry for this user
                        logger.info(f"Creating default pantry for user {user_id}")
                        if db_url.startswith('sqlite'):
                            conn.execute(text("""
                                INSERT INTO pantries (user_id, name, description, is_default, created_at, updated_at)
                                VALUES (:user_id, 'Home', 'Default pantry', 1, datetime('now'), datetime('now'))
                            """), {"user_id": user_id})
                            pantry_id_result = conn.execute(text("SELECT last_insert_rowid()"))
                        else:
                            conn.execute(text("""
                                INSERT INTO pantries (user_id, name, description, is_default, created_at, updated_at)
                                VALUES (:user_id, 'Home', 'Default pantry', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                                RETURNING id
                            """), {"user_id": user_id})
                            pantry_id_result = conn.execute(text("SELECT id FROM pantries WHERE user_id = :user_id AND name = 'Home'"), {"user_id": user_id})
                        
                        pantry_id = pantry_id_result.first()[0]
                    else:
                        pantry_id = pantry_row[0]
                else:
                    pantry_id = pantry_row[0]
                
                # Update all NULL items for this user to this pantry
                update_result = conn.execute(text("""
                    UPDATE inventory_items 
                    SET pantry_id = :pantry_id 
                    WHERE user_id = :user_id AND pantry_id IS NULL
                """), {"pantry_id": pantry_id, "user_id": user_id})
                
                count = update_result.rowcount
                logger.info(f"Assigned {count} items to pantry {pantry_id} for user {user_id}")
            
            trans.commit()
            logger.info("✅ Migration completed: assigned NULL items to default pantries")
            
        except Exception as e:
            trans.rollback()
            logger.error(f"Migration failed: {e}", exc_info=True)
            raise


def run_migrations():
    """Run all pending migrations."""
    logger.info("Running database migrations...")
    add_user_id_to_saved_recipes()
    add_pantries_table_and_pantry_id()
    assign_null_items_to_default_pantry()
    logger.info("✅ All migrations completed")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run_migrations()


