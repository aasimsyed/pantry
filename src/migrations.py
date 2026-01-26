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


# Canonical list of inventory_items columns (model) that may be missing in older DBs.
# (id, product_id) are assumed present from initial CREATE TABLE.
_INVENTORY_ITEMS_COLUMNS = [
    ("user_id", "INTEGER", "INTEGER"),
    ("pantry_id", "INTEGER", "INTEGER"),
    ("quantity", "FLOAT NOT NULL DEFAULT 1.0", "FLOAT NOT NULL DEFAULT 1.0"),
    ("unit", "VARCHAR(20) NOT NULL DEFAULT 'count'", "VARCHAR(20) NOT NULL DEFAULT 'count'"),
    ("purchase_date", "DATETIME", "TIMESTAMP"),
    ("expiration_date", "DATETIME", "TIMESTAMP"),
    ("storage_location", "VARCHAR(50) NOT NULL DEFAULT 'pantry'", "VARCHAR(50) NOT NULL DEFAULT 'pantry'"),
    ("image_path", "VARCHAR(500)", "VARCHAR(500)"),
    ("notes", "TEXT", "TEXT"),
    ("status", "VARCHAR(20) NOT NULL DEFAULT 'in_stock'", "VARCHAR(20) NOT NULL DEFAULT 'in_stock'"),
    ("created_at", "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP", "TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP"),
    ("updated_at", "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP", "TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP"),
]


def ensure_inventory_items_columns():
    """
    Add any missing columns to inventory_items so it matches the model.
    
    Covers all columns the InventoryItem model expects. Run once; idempotent.
    Use when you get UndefinedColumn for inventory_items (e.g. image_path, status).
    """
    engine = create_database_engine()
    inspector = inspect(engine)
    db_url = get_database_url()
    is_sqlite = db_url.startswith("sqlite")

    if "inventory_items" not in inspector.get_table_names():
        logger.info("inventory_items table doesn't exist yet, skipping ensure_inventory_items_columns")
        return

    existing = [c["name"] for c in inspector.get_columns("inventory_items")]
    missing = [t for t in _INVENTORY_ITEMS_COLUMNS if t[0] not in existing]
    if not missing:
        logger.info("inventory_items already has all expected columns")
        return

    logger.info("Adding %d missing column(s) to inventory_items: %s", len(missing), [m[0] for m in missing])

    with engine.connect() as conn:
        trans = conn.begin()
        try:
            for name, sqlite_def, pg_def in missing:
                ddl = f"ALTER TABLE inventory_items ADD COLUMN {name} {pg_def if not is_sqlite else sqlite_def}"
                conn.execute(text(ddl))
                logger.info("  + %s", name)
            trans.commit()
            logger.info("✅ ensure_inventory_items_columns: added %s", [m[0] for m in missing])
        except Exception as e:
            trans.rollback()
            logger.error("Migration failed: %s", e, exc_info=True)
            raise


# Canonical list of processing_log columns (model) that may be missing in older DBs.
# id is assumed present from initial CREATE TABLE.
_PROCESSING_LOG_COLUMNS = [
    ("inventory_item_id", "INTEGER", "INTEGER"),
    ("image_path", "VARCHAR(500) NOT NULL DEFAULT ''", "VARCHAR(500) NOT NULL DEFAULT ''"),
    ("processing_date", "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP", "TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP"),
    ("ocr_confidence", "FLOAT", "FLOAT"),
    ("ai_confidence", "FLOAT", "FLOAT"),
    ("status", "VARCHAR(20) NOT NULL DEFAULT 'success'", "VARCHAR(20) NOT NULL DEFAULT 'success'"),
    ("error_message", "TEXT", "TEXT"),
    ("raw_ocr_data", "TEXT", "TEXT"),
    ("raw_ai_data", "TEXT", "TEXT"),
]


def ensure_processing_log_columns():
    """
    Add any missing columns to processing_log so it matches the model.
    
    Covers image_path, status, and all other ProcessingLog columns.
    Run once; idempotent. Fixes "column image_path of relation processing_log does not exist".
    """
    engine = create_database_engine()
    inspector = inspect(engine)
    db_url = get_database_url()
    is_sqlite = db_url.startswith("sqlite")

    if "processing_log" not in inspector.get_table_names():
        logger.info("processing_log table doesn't exist yet, skipping ensure_processing_log_columns")
        return

    existing = [c["name"] for c in inspector.get_columns("processing_log")]
    missing = [t for t in _PROCESSING_LOG_COLUMNS if t[0] not in existing]
    if not missing:
        logger.info("processing_log already has all expected columns")
        return

    logger.info("Adding %d missing column(s) to processing_log: %s", len(missing), [m[0] for m in missing])

    with engine.connect() as conn:
        trans = conn.begin()
        try:
            for name, sqlite_def, pg_def in missing:
                ddl = f"ALTER TABLE processing_log ADD COLUMN {name} {pg_def if not is_sqlite else sqlite_def}"
                conn.execute(text(ddl))
                logger.info("  + %s", name)
            trans.commit()
            logger.info("✅ ensure_processing_log_columns: added %s", [m[0] for m in missing])
        except Exception as e:
            trans.rollback()
            logger.error("Migration failed: %s", e, exc_info=True)
            raise


# Canonical list of saved_recipes columns (model) that may be missing in older DBs.
# id is assumed present from initial CREATE TABLE.
_SAVED_RECIPES_COLUMNS = [
    ("user_id", "INTEGER NOT NULL DEFAULT 0", "INTEGER NOT NULL DEFAULT 0"),
    ("name", "VARCHAR(255) NOT NULL DEFAULT ''", "VARCHAR(255) NOT NULL DEFAULT ''"),
    ("description", "TEXT", "TEXT"),
    ("cuisine", "VARCHAR(100)", "VARCHAR(100)"),
    ("difficulty", "VARCHAR(50)", "VARCHAR(50)"),
    ("prep_time", "INTEGER", "INTEGER"),
    ("cook_time", "INTEGER", "INTEGER"),
    ("servings", "INTEGER", "INTEGER"),
    ("ingredients", "TEXT NOT NULL DEFAULT '[]'", "TEXT NOT NULL DEFAULT '[]'"),
    ("instructions", "TEXT NOT NULL DEFAULT '[]'", "TEXT NOT NULL DEFAULT '[]'"),
    ("notes", "TEXT", "TEXT"),
    ("rating", "INTEGER", "INTEGER"),
    ("tags", "TEXT", "TEXT"),
    ("ai_model", "VARCHAR(100)", "VARCHAR(100)"),
    ("created_at", "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP", "TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP"),
    ("updated_at", "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP", "TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP"),
]


def ensure_saved_recipes_columns():
    """
    Add any missing columns to saved_recipes so it matches the model.

    Covers name, user_id, ai_model, and all other SavedRecipe columns.
    Run once; idempotent. Fixes "column saved_recipes.name does not exist".
    """
    engine = create_database_engine()
    inspector = inspect(engine)
    db_url = get_database_url()
    is_sqlite = db_url.startswith("sqlite")

    if "saved_recipes" not in inspector.get_table_names():
        logger.info("saved_recipes table doesn't exist yet, skipping ensure_saved_recipes_columns")
        return

    existing = [c["name"] for c in inspector.get_columns("saved_recipes")]
    missing = [t for t in _SAVED_RECIPES_COLUMNS if t[0] not in existing]
    if not missing:
        logger.info("saved_recipes already has all expected columns")
        return

    logger.info("Adding %d missing column(s) to saved_recipes: %s", len(missing), [m[0] for m in missing])

    with engine.connect() as conn:
        trans = conn.begin()
        try:
            for name, sqlite_def, pg_def in missing:
                ddl = f"ALTER TABLE saved_recipes ADD COLUMN {name} {pg_def if not is_sqlite else sqlite_def}"
                conn.execute(text(ddl))
                logger.info("  + %s", name)
            trans.commit()
            logger.info("✅ ensure_saved_recipes_columns: added %s", [m[0] for m in missing])
        except Exception as e:
            trans.rollback()
            logger.error("Migration failed: %s", e, exc_info=True)
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


def add_recent_recipes_table():
    """
    Create recent_recipes table if it doesn't exist.
    
    This migration creates the recent_recipes table for storing temporarily
    generated recipes that users can save later.
    """
    engine = create_database_engine()
    inspector = inspect(engine)
    
    # Check if recent_recipes table already exists
    if 'recent_recipes' in inspector.get_table_names():
        logger.info("✅ recent_recipes table already exists")
        return
    
    logger.info("Creating recent_recipes table...")
    
    # Use direct SQL to avoid SQLAlchemy index conflicts
    # This handles the case where indexes might exist from a previous partial migration
    try:
        with engine.connect() as conn:
            trans = conn.begin()
            try:
                # Create table first
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS recent_recipes (
                        id SERIAL PRIMARY KEY,
                        user_id INTEGER NOT NULL,
                        name VARCHAR(255) NOT NULL,
                        description TEXT,
                        cuisine VARCHAR(100),
                        difficulty VARCHAR(50),
                        prep_time INTEGER,
                        cook_time INTEGER,
                        servings INTEGER,
                        ingredients TEXT NOT NULL,
                        instructions TEXT NOT NULL,
                        available_ingredients TEXT,
                        missing_ingredients TEXT,
                        flavor_pairings TEXT,
                        ai_model VARCHAR(100),
                        generated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        CONSTRAINT fk_recent_recipes_user_id 
                            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                    )
                """))
                
                # Create indexes with IF NOT EXISTS (handles case where index exists but table didn't)
                conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS ix_recent_recipes_user_id 
                    ON recent_recipes(user_id)
                """))
                conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS ix_recent_recipes_generated_at 
                    ON recent_recipes(generated_at)
                """))
                
                trans.commit()
                logger.info("✅ recent_recipes table created via SQL")
                
                # Verify it was created
                if 'recent_recipes' in inspector.get_table_names():
                    logger.info("✅ recent_recipes table verified to exist")
                else:
                    logger.warning("⚠️ recent_recipes table creation reported success but table not found")
            except Exception as sql_error:
                trans.rollback()
                error_str = str(sql_error).lower()
                # If table already exists, that's fine
                if "already exists" in error_str or "duplicate" in error_str:
                    logger.info(f"recent_recipes table/index already exists (via SQL): {sql_error}")
                    # Verify table actually exists
                    if 'recent_recipes' in inspector.get_table_names():
                        logger.info("✅ recent_recipes table verified to exist")
                        return
                # Re-raise if it's a different error
                raise
    except Exception as e:
        logger.error(f"Failed to create recent_recipes table via SQL: {e}", exc_info=True)
        # Try SQLAlchemy as fallback (but this might have the same index issue)
        try:
            from src.database import RecentRecipe
            RecentRecipe.__table__.create(engine, checkfirst=True)
            logger.info("✅ recent_recipes table created via SQLAlchemy fallback")
        except Exception as sqlalchemy_error:
            error_str = str(sqlalchemy_error).lower()
            if "already exists" in error_str or "duplicate" in error_str:
                logger.info(f"recent_recipes table/index already exists (SQLAlchemy fallback): {sqlalchemy_error}")
                # Verify table actually exists
                if 'recent_recipes' in inspector.get_table_names():
                    logger.info("✅ recent_recipes table verified to exist")
                    return
            raise
        # Try SQL directly as fallback
        try:
            with engine.connect() as conn:
                trans = conn.begin()
                try:
                    conn.execute(text("""
                        CREATE TABLE IF NOT EXISTS recent_recipes (
                            id SERIAL PRIMARY KEY,
                            user_id INTEGER NOT NULL,
                            name VARCHAR(255) NOT NULL,
                            description TEXT,
                            cuisine VARCHAR(100),
                            difficulty VARCHAR(50),
                            prep_time INTEGER,
                            cook_time INTEGER,
                            servings INTEGER,
                            ingredients TEXT NOT NULL,
                            instructions TEXT NOT NULL,
                            available_ingredients TEXT,
                            missing_ingredients TEXT,
                            flavor_pairings TEXT,
                            ai_model VARCHAR(100),
                            generated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            CONSTRAINT fk_recent_recipes_user_id 
                                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                        )
                    """))
                    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_recent_recipes_user_id ON recent_recipes(user_id)"))
                    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_recent_recipes_generated_at ON recent_recipes(generated_at)"))
                    trans.commit()
                    logger.info("✅ recent_recipes table created via SQL")
                except Exception as sql_error:
                    trans.rollback()
                    if "already exists" not in str(sql_error).lower():
                        raise
                    logger.info("recent_recipes table already exists (via SQL check)")
        except Exception as fallback_error:
            logger.error(f"Fallback SQL creation also failed: {fallback_error}", exc_info=True)
            raise


def add_performance_indexes():
    """
    Add performance indexes for common query patterns.
    
    This migration adds composite indexes for frequently used query combinations
    to improve database performance.
    """
    engine = create_database_engine()
    inspector = inspect(engine)
    
    logger.info("Adding performance indexes...")
    
    indexes_to_add = [
        # Inventory items - common filter combinations
        ("inventory_items", "ix_inventory_user_pantry_status", ["user_id", "pantry_id", "status"]),
        ("inventory_items", "ix_inventory_user_status", ["user_id", "status"]),
        ("inventory_items", "ix_inventory_pantry_status", ["pantry_id", "status"]),
        
        # Saved recipes - filter by user and cuisine/difficulty
        ("saved_recipes", "ix_saved_recipes_user_cuisine", ["user_id", "cuisine"]),
        ("saved_recipes", "ix_saved_recipes_user_difficulty", ["user_id", "difficulty"]),
        ("saved_recipes", "ix_saved_recipes_user_created", ["user_id", "created_at"]),
        
        # Recent recipes - already has user_id and generated_at indexes, but add composite
        ("recent_recipes", "ix_recent_recipes_user_generated", ["user_id", "generated_at"]),
        
        # Products - search by name and category
        ("products", "ix_products_name_category", ["product_name", "category"]),
    ]
    
    for table_name, index_name, columns in indexes_to_add:
        try:
            # Check if table exists
            if table_name not in inspector.get_table_names():
                logger.info(f"Skipping index {index_name} - table {table_name} doesn't exist")
                continue
            
            # Check if index already exists
            existing_indexes = [idx["name"] for idx in inspector.get_indexes(table_name)]
            if index_name in existing_indexes:
                logger.info(f"Index {index_name} already exists on {table_name}")
                continue
            
            # Create index
            with engine.connect() as conn:
                columns_str = ", ".join(columns)
                conn.execute(text(f"CREATE INDEX IF NOT EXISTS {index_name} ON {table_name} ({columns_str})"))
                conn.commit()
            logger.info(f"✅ Created index {index_name} on {table_name}")
        except Exception as e:
            logger.warning(f"Failed to create index {index_name} on {table_name}: {e}")
    
    logger.info("✅ Performance indexes migration completed")


def run_migrations():
    """Run all pending migrations."""
    logger.info("Running database migrations...")
    add_user_id_to_saved_recipes()
    add_pantries_table_and_pantry_id()
    ensure_inventory_items_columns()
    ensure_processing_log_columns()
    ensure_saved_recipes_columns()
    assign_null_items_to_default_pantry()
    add_user_settings_table()
    add_ai_model_to_saved_recipes()
    add_security_events_table()  # Ensure security_events table exists
    add_recent_recipes_table()  # Create recent_recipes table
    add_performance_indexes()  # Add performance indexes
    logger.info("✅ All migrations completed")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run_migrations()


