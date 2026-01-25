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


def add_user_settings_table():
    """
    Add user_settings table for storing user preferences.
    """
    engine = create_database_engine()
    inspector = inspect(engine)
    db_url = get_database_url()

    if 'user_settings' in inspector.get_table_names():
        logger.info("user_settings table already exists, skipping")
        return

    with engine.connect() as conn:
        trans = conn.begin()
        try:
            if db_url.startswith('sqlite'):
                # SQLite
                conn.execute(text("""
                    CREATE TABLE user_settings (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER NOT NULL UNIQUE,
                        ai_provider VARCHAR(50),
                        ai_model VARCHAR(100),
                        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                    )
                """))
                conn.execute(text("CREATE INDEX ix_user_settings_user_id ON user_settings(user_id)"))
            else:
                # PostgreSQL
                conn.execute(text("""
                    CREATE TABLE user_settings (
                        id SERIAL PRIMARY KEY,
                        user_id INTEGER NOT NULL UNIQUE,
                        ai_provider VARCHAR(50),
                        ai_model VARCHAR(100),
                        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                    )
                """))
                conn.execute(text("CREATE INDEX ix_user_settings_user_id ON user_settings(user_id)"))
            
            trans.commit()
            logger.info("✅ Created user_settings table")
        except Exception as e:
            trans.rollback()
            logger.error(f"❌ Error creating user_settings table: {e}", exc_info=True)
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
            # Check if user_id column exists
            columns = [col['name'] for col in inspector.get_columns('inventory_items')]
            has_user_id = 'user_id' in columns
            
            if not has_user_id:
                logger.info("user_id column doesn't exist in inventory_items, skipping assignment")
                trans.commit()
                return
            
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


def add_ai_model_to_saved_recipes():
    """
    Add ai_model column to saved_recipes table to track which AI model generated each recipe.
    """
    engine = create_database_engine()
    inspector = inspect(engine)
    
    if 'saved_recipes' not in inspector.get_table_names():
        logger.info("saved_recipes table doesn't exist yet, will be created by init_database()")
        return
    
    columns = [col['name'] for col in inspector.get_columns('saved_recipes')]
    if 'ai_model' in columns:
        logger.info("ai_model column already exists in saved_recipes table")
        return
    
    logger.info("Adding ai_model column to saved_recipes table...")
    
    with engine.connect() as conn:
        trans = conn.begin()
        try:
            conn.execute(text("""
                ALTER TABLE saved_recipes 
                ADD COLUMN ai_model VARCHAR(100)
            """))
            trans.commit()
            logger.info("✅ Migration completed: ai_model added to saved_recipes")
        except Exception as e:
            trans.rollback()
            logger.error(f"Migration failed: {e}", exc_info=True)
            raise


def add_storage_location_to_inventory_items():
    """
    Add storage_location column to inventory_items if it doesn't exist.
    
    The app uses storage_location (pantry/fridge/freezer) for inventory items.
    Production DBs created before this column was added will lack it.
    """
    engine = create_database_engine()
    inspector = inspect(engine)
    db_url = get_database_url()

    if 'inventory_items' not in inspector.get_table_names():
        logger.info("inventory_items table doesn't exist yet, skipping storage_location migration")
        return

    columns = [col['name'] for col in inspector.get_columns('inventory_items')]
    if 'storage_location' in columns:
        logger.info("storage_location column already exists in inventory_items")
        return

    logger.info("Adding storage_location column to inventory_items...")

    with engine.connect() as conn:
        trans = conn.begin()
        try:
            if db_url.startswith('sqlite'):
                conn.execute(text("""
                    ALTER TABLE inventory_items
                    ADD COLUMN storage_location VARCHAR(50) NOT NULL DEFAULT 'pantry'
                """))
            else:
                conn.execute(text("""
                    ALTER TABLE inventory_items
                    ADD COLUMN storage_location VARCHAR(50) NOT NULL DEFAULT 'pantry'
                """))
            trans.commit()
            logger.info("✅ Migration completed: storage_location added to inventory_items")
        except Exception as e:
            trans.rollback()
            logger.error(f"Migration failed: {e}", exc_info=True)
            raise


def add_security_events_table():
    """
    Create security_events table if it doesn't exist.
    
    This migration ensures the security_events table exists for audit logging.
    """
    engine = create_database_engine()
    inspector = inspect(engine)
    
    # Check if security_events table already exists
    if 'security_events' in inspector.get_table_names():
        logger.info("security_events table already exists")
        return
    
    logger.info("Creating security_events table...")
    
    try:
        from src.database import SecurityEvent
        SecurityEvent.__table__.create(engine, checkfirst=True)
        logger.info("✅ security_events table created successfully")
    except Exception as e:
        logger.error(f"Failed to create security_events table: {e}", exc_info=True)
        # Try SQL directly as fallback
        try:
            with engine.connect() as conn:
                trans = conn.begin()
                try:
                    conn.execute(text("""
                        CREATE TABLE IF NOT EXISTS security_events (
                            id SERIAL PRIMARY KEY,
                            event_type VARCHAR(100) NOT NULL,
                            user_id INTEGER,
                            ip_address VARCHAR(45) NOT NULL,
                            user_agent VARCHAR(500),
                            details TEXT,
                            severity VARCHAR(20) NOT NULL DEFAULT 'info',
                            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            CONSTRAINT fk_security_events_user_id 
                                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
                        )
                    """))
                    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_security_events_event_type ON security_events(event_type)"))
                    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_security_events_user_id ON security_events(user_id)"))
                    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_security_events_created_at ON security_events(created_at)"))
                    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_security_events_severity ON security_events(severity)"))
                    trans.commit()
                    logger.info("✅ security_events table created via SQL")
                except Exception as sql_error:
                    trans.rollback()
                    if "already exists" not in str(sql_error).lower():
                        raise
                    logger.info("security_events table already exists (via SQL check)")
        except Exception as fallback_error:
            logger.error(f"Fallback SQL creation also failed: {fallback_error}", exc_info=True)
            raise


def run_migrations():
    """Run all pending migrations."""
    logger.info("Running database migrations...")
    add_user_id_to_saved_recipes()
    add_pantries_table_and_pantry_id()
    add_storage_location_to_inventory_items()
    assign_null_items_to_default_pantry()
    add_user_settings_table()
    add_ai_model_to_saved_recipes()
    add_security_events_table()  # Ensure security_events table exists
    logger.info("✅ All migrations completed")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run_migrations()


