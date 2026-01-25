"""
Database models and connection handling for Smart Pantry System.

This module provides SQLAlchemy ORM models and database connection handling
for both SQLite (development) and PostgreSQL (production).

Architecture:
    - SQLAlchemy ORM models with relationships
    - Indexed fields for query performance
    - Data validation at model level
    - Helper methods for common operations
    - Support for SQLite and PostgreSQL
    - Automatic timestamps (created_at, updated_at)

Models:
    - Product: Master product catalog
    - InventoryItem: Physical items in pantry
    - ProcessingLog: Audit trail of OCR/AI processing

Best Practices:
    - Foreign key constraints
    - Cascading deletes where appropriate
    - Indexes on frequently queried fields
    - JSON support for metadata
    - Proper datetime handling
    - Transaction management

Example:
    >>> from src.database import get_db_session, Product, InventoryItem
    >>> session = get_db_session()
    >>> product = Product(product_name="Test Item", category="Snacks")
    >>> session.add(product)
    >>> session.commit()
"""

import os
from datetime import date, datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    create_engine,
    event,
    inspect,
    text,
)
from sqlalchemy.dialects.postgresql import JSON as PostgresJSON
from sqlalchemy.dialects.sqlite import JSON as SQLiteJSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import Session, relationship, sessionmaker

# Base class for all models
Base = declarative_base()


# ============================================================================
# Database Engine and Session Management
# ============================================================================

def get_database_url() -> str:
    """Get database URL from environment or default to SQLite.
    
    Environment Variables:
        DATABASE_URL: Full database URL (postgres://... or sqlite://...)
        DB_TYPE: Database type ('sqlite' or 'postgresql')
        DB_HOST: PostgreSQL host (default: localhost)
        DB_PORT: PostgreSQL port (default: 5432)
        DB_NAME: Database name
        DB_USER: Database user
        DB_PASSWORD: Database password
    
    Returns:
        Database URL string
        
    Examples:
        SQLite: sqlite:///./pantry.db
        PostgreSQL: postgresql://user:pass@localhost:5432/pantry
    """
    # Check for full DATABASE_URL first
    db_url = os.getenv("DATABASE_URL")
    if db_url:
        return db_url
    
    # Build URL from components
    db_type = os.getenv("DB_TYPE", "sqlite").lower()
    
    if db_type == "sqlite":
        db_path = os.getenv("DB_PATH", "./pantry.db")
        return f"sqlite:///{db_path}"
    
    elif db_type == "postgresql":
        host = os.getenv("DB_HOST", "localhost")
        port = os.getenv("DB_PORT", "5432")
        name = os.getenv("DB_NAME", "pantry")
        user = os.getenv("DB_USER", "postgres")
        password = os.getenv("DB_PASSWORD", "")
        
        return f"postgresql://{user}:{password}@{host}:{port}/{name}"
    
    else:
        raise ValueError(f"Unsupported database type: {db_type}")


def create_database_engine(echo: bool = False):
    """Create SQLAlchemy engine.
    
    Args:
        echo: Enable SQL query logging
        
    Returns:
        SQLAlchemy Engine instance
    """
    db_url = get_database_url()
    
    # SQLite-specific settings
    if db_url.startswith("sqlite"):
        engine = create_engine(
            db_url,
            echo=echo,
            connect_args={"check_same_thread": False}  # Allow multi-threading
        )
        
        # Enable foreign key constraints for SQLite
        @event.listens_for(engine, "connect")
        def set_sqlite_pragma(dbapi_conn, connection_record):
            cursor = dbapi_conn.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()
    
    # PostgreSQL settings
    else:
        engine = create_engine(
            db_url,
            echo=echo,
            pool_size=10,
            max_overflow=20
        )
    
    return engine


def get_session_factory():
    """Create sessionmaker factory.
    
    Returns:
        SQLAlchemy sessionmaker
    """
    engine = create_database_engine()
    return sessionmaker(bind=engine, autocommit=False, autoflush=False)


def get_db_session() -> Session:
    """Get database session.
    
    Returns:
        SQLAlchemy Session instance
        
    Example:
        >>> session = get_db_session()
        >>> try:
        ...     # Do database operations
        ...     session.commit()
        ... except:
        ...     session.rollback()
        ...     raise
        ... finally:
        ...     session.close()
    """
    SessionLocal = get_session_factory()
    return SessionLocal()


def init_database():
    """Initialize database - create all tables.
    
    This should be called once to create the database schema.
    Handles existing tables/indexes gracefully.
    Also runs migrations for schema updates.
    
    Example:
        >>> from src.database import init_database
        >>> init_database()
    """
    import logging
    logger = logging.getLogger(__name__)

    engine = create_database_engine()

    try:
        Base.metadata.create_all(bind=engine, checkfirst=True)
        logger.info(f"✅ Database initialized: {get_database_url()}")
        print(f"✅ Database initialized: {get_database_url()}")
    except Exception as e:
        err = str(e).lower()
        if "already exists" in err or "duplicate" in err or "duplicatetable" in err:
            logger.info("create_all hit existing tables/indexes, ensuring schema table-by-table...")
        else:
            logger.warning(f"create_all failed: {e}, trying table-by-table create...")
        try:
            for table in Base.metadata.sorted_tables:
                try:
                    table.create(engine, checkfirst=True)
                except Exception as te:
                    te_str = str(te).lower()
                    if "already exists" in te_str or "duplicate" in te_str:
                        pass
                    elif "does not exist" in te_str:
                        logger.debug(f"Deferred {table.name} (dependency)")
                    else:
                        logger.warning(f"Error creating {table.name}: {te}")
            logger.info(f"✅ Database schema is up to date: {get_database_url()}")
            print(f"✅ Database schema is up to date: {get_database_url()}")
        except Exception as e2:
            logger.error(f"❌ Database initialization failed: {e2}")
            raise

    # Run migrations for existing databases
    try:
        from src.migrations import (
            add_user_id_to_saved_recipes,
            add_pantries_table_and_pantry_id,
            ensure_inventory_items_columns,
            ensure_processing_log_columns,
            ensure_saved_recipes_columns,
            assign_null_items_to_default_pantry,
            add_user_settings_table,
            add_ai_model_to_saved_recipes,
            add_security_events_table
        )
        add_user_id_to_saved_recipes()
        add_pantries_table_and_pantry_id()
        ensure_inventory_items_columns()
        ensure_processing_log_columns()
        ensure_saved_recipes_columns()
        assign_null_items_to_default_pantry()
        add_user_settings_table()
        add_ai_model_to_saved_recipes()
        add_security_events_table()  # Critical: ensure security_events table exists
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.warning(f"Migration warning (non-fatal): {e}")


# ============================================================================
# Product Model - Master Product Catalog
# ============================================================================

class Product(Base):
    """Master product catalog.
    
    Stores unique products identified across the pantry. Multiple inventory
    items can reference the same product.
    
    Attributes:
        id: Primary key
        product_name: Full product name (indexed)
        brand: Brand name
        category: Main category (indexed)
        subcategory: Specific subcategory
        barcode: Product barcode (unique)
        default_storage_location: Default storage (pantry/fridge/freezer)
        typical_shelf_life_days: Typical shelf life in days
        created_at: Record creation timestamp
        updated_at: Last update timestamp
    
    Relationships:
        inventory_items: All inventory items for this product
    
    Indexes:
        - product_name (for search)
        - category (for filtering)
        - brand (for filtering)
        - barcode (unique, for lookup)
    """
    
    __tablename__ = "products"
    
    # Primary key
    id = Column(Integer, primary_key=True, autoincrement=True)
    
    # Product information
    product_name = Column(String(255), nullable=False, index=True)
    brand = Column(String(100), nullable=True, index=True)
    category = Column(String(100), nullable=False, index=True)
    subcategory = Column(String(100), nullable=True)
    
    # Additional metadata
    barcode = Column(String(50), unique=True, nullable=True)
    default_storage_location = Column(
        String(50),
        nullable=True,
        default="pantry"
    )
    typical_shelf_life_days = Column(Integer, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )
    
    # Relationships
    inventory_items = relationship(
        "InventoryItem",
        back_populates="product",
        cascade="all, delete-orphan"
    )
    
    # Indexes
    __table_args__ = (
        Index("ix_products_search", "product_name", "brand"),
        Index("ix_products_category_brand", "category", "brand"),
    )
    
    def __repr__(self) -> str:
        """String representation."""
        brand_str = f" ({self.brand})" if self.brand else ""
        return f"<Product(id={self.id}, name='{self.product_name}{brand_str}')>"
    
    def to_dict(self) -> dict:
        """Convert to dictionary.
        
        Returns:
            Dictionary representation of product
        """
        return {
            "id": self.id,
            "product_name": self.product_name,
            "brand": self.brand,
            "category": self.category,
            "subcategory": self.subcategory,
            "barcode": self.barcode,
            "default_storage_location": self.default_storage_location,
            "typical_shelf_life_days": self.typical_shelf_life_days,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "inventory_count": len(self.inventory_items) if self.inventory_items else 0,
        }
    
    @property
    def total_quantity(self) -> float:
        """Get total quantity across all inventory items.
        
        Returns:
            Sum of quantities for in_stock items
        """
        return sum(
            item.quantity
            for item in self.inventory_items
            if item.status == "in_stock"
        )
    
    @property
    def is_low_stock(self) -> bool:
        """Check if product is low stock.
        
        Returns:
            True if any inventory item has low status
        """
        return any(
            item.status == "low"
            for item in self.inventory_items
        )
    
    @property
    def has_expired_items(self) -> bool:
        """Check if product has expired items.
        
        Returns:
            True if any inventory item is expired
        """
        return any(
            item.status == "expired"
            for item in self.inventory_items
        )


# ============================================================================
# InventoryItem Model - Physical Items in Pantry
# ============================================================================

class InventoryItem(Base):
    """Physical inventory items.
    
    Represents actual items in the pantry, fridge, or freezer. Each item
    is linked to a product and tracks quantity, dates, and location.
    
    Attributes:
        id: Primary key
        product_id: Foreign key to products table
        quantity: Quantity amount
        unit: Unit of measurement (oz, ml, count, etc.)
        purchase_date: When item was purchased
        expiration_date: When item expires
        storage_location: Where item is stored
        image_path: Path to product image
        notes: Additional notes
        status: Current status (in_stock/low/expired/consumed)
        created_at: Record creation timestamp
        updated_at: Last update timestamp
    
    Relationships:
        product: Associated product
        processing_logs: Processing logs for this item
    
    Indexes:
        - product_id (for queries by product)
        - status (for filtering)
        - expiration_date (for expiration tracking)
        - storage_location (for location queries)
    """
    
    __tablename__ = "inventory_items"
    
    # Primary key
    id = Column(Integer, primary_key=True, autoincrement=True)
    
    # Foreign keys
    product_id = Column(
        Integer,
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,  # Allow NULL for backward compatibility
        index=True
    )
    pantry_id = Column(
        Integer,
        ForeignKey("pantries.id", ondelete="SET NULL"),
        nullable=True,  # Allow NULL for backward compatibility
        index=True
    )
    
    # Quantity information
    quantity = Column(Float, nullable=False, default=1.0)
    unit = Column(String(20), nullable=False, default="count")
    
    # Date tracking
    purchase_date = Column(DateTime, nullable=True)
    expiration_date = Column(DateTime, nullable=True, index=True)
    
    # Location and metadata
    storage_location = Column(
        String(50),
        nullable=False,
        default="pantry",
        index=True
    )
    image_path = Column(String(500), nullable=True)
    notes = Column(Text, nullable=True)
    
    # Status tracking
    status = Column(
        String(20),
        nullable=False,
        default="in_stock",
        index=True
    )
    
    # Timestamps
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )
    
    # Relationships
    product = relationship("Product", back_populates="inventory_items")
    user = relationship("User", back_populates="inventory_items")
    pantry = relationship("Pantry", back_populates="inventory_items")
    processing_logs = relationship(
        "ProcessingLog",
        back_populates="inventory_item",
        cascade="all, delete-orphan"
    )
    
    # Indexes
    __table_args__ = (
        Index("ix_inventory_status_location", "status", "storage_location"),
        Index("ix_inventory_expiration_status", "expiration_date", "status"),
    )
    
    def __repr__(self) -> str:
        """String representation."""
        return (
            f"<InventoryItem(id={self.id}, "
            f"product_id={self.product_id}, "
            f"quantity={self.quantity} {self.unit}, "
            f"status='{self.status}')>"
        )
    
    def to_dict(self) -> dict:
        """Convert to dictionary.
        
        Returns:
            Dictionary representation of inventory item
        """
        return {
            "id": self.id,
            "product_id": self.product_id,
            "product_name": self.product.product_name if self.product else None,
            "brand": self.product.brand if self.product else None,
            "quantity": self.quantity,
            "unit": self.unit,
            "purchase_date": self.purchase_date.isoformat() if self.purchase_date else None,
            "expiration_date": self.expiration_date.isoformat() if self.expiration_date else None,
            "storage_location": self.storage_location,
            "image_path": self.image_path,
            "notes": self.notes,
            "status": self.status,
            "user_id": self.user_id,
            "pantry_id": self.pantry_id,
            "pantry_name": self.pantry.name if self.pantry else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "days_until_expiration": self.days_until_expiration,
            "is_expired": self.is_expired,
        }
    
    def _expiration_date_normalized(self) -> Optional[date]:
        """Return expiration_date as date for comparison (handles both date and datetime)."""
        exp = self.expiration_date
        if exp is None:
            return None
        if isinstance(exp, datetime):
            return date(exp.year, exp.month, exp.day)
        return exp

    @property
    def days_until_expiration(self) -> Optional[int]:
        """Calculate days until expiration.

        Returns:
            Days until expiration, None if no expiration date
        """
        exp = self._expiration_date_normalized()
        if exp is None:
            return None
        delta = exp - datetime.utcnow().date()
        return delta.days

    @property
    def is_expired(self) -> bool:
        """Check if item is expired.

        Returns:
            True if expired, False otherwise
        """
        exp = self._expiration_date_normalized()
        if exp is None:
            return False
        return datetime.utcnow().date() > exp
    
    @property
    def is_expiring_soon(self, days: int = 7) -> bool:
        """Check if item is expiring soon.
        
        Args:
            days: Number of days threshold
            
        Returns:
            True if expiring within threshold
        """
        days_left = self.days_until_expiration
        if days_left is None:
            return False
        
        return 0 <= days_left <= days
    
    def update_status(self):
        """Update status based on current state.
        
        Updates status to 'expired' if past expiration date,
        'low' if quantity is low, or 'in_stock' otherwise.
        """
        if self.is_expired:
            self.status = "expired"
        elif self.quantity <= 0:
            self.status = "consumed"
        elif self.quantity < 1.0:  # Less than 1 unit
            self.status = "low"
        else:
            self.status = "in_stock"


# ============================================================================
# ProcessingLog Model - Audit Trail of OCR/AI Processing
# ============================================================================

class ProcessingLog(Base):
    """Processing log for audit trail.
    
    Tracks all OCR and AI processing operations, storing confidence scores,
    raw data, and error information for debugging and auditing.
    
    Attributes:
        id: Primary key
        inventory_item_id: Foreign key to inventory_items (optional)
        image_path: Path to processed image
        processing_date: When processing occurred
        ocr_confidence: OCR confidence score (0-1)
        ai_confidence: AI confidence score (0-1)
        status: Processing status (success/failed/manual_review)
        error_message: Error message if failed
        raw_ocr_data: Complete OCR output (JSON)
        raw_ai_data: Complete AI analysis output (JSON)
    
    Relationships:
        inventory_item: Associated inventory item (if created)
    
    Indexes:
        - processing_date (for time-based queries)
        - status (for filtering)
        - image_path (for lookup)
    """
    
    __tablename__ = "processing_log"
    
    # Primary key
    id = Column(Integer, primary_key=True, autoincrement=True)
    
    # Foreign keys (optional - log exists even if item creation fails)
    inventory_item_id = Column(
        Integer,
        ForeignKey("inventory_items.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    
    # Processing information
    image_path = Column(String(500), nullable=False, index=True)
    processing_date = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        index=True
    )
    
    # Confidence scores
    ocr_confidence = Column(Float, nullable=True)
    ai_confidence = Column(Float, nullable=True)
    
    # Status tracking
    status = Column(
        String(20),
        nullable=False,
        default="success",
        index=True
    )
    error_message = Column(Text, nullable=True)
    
    # Raw data (JSON)
    # Use appropriate JSON type based on database
    raw_ocr_data = Column(
        Text,  # Will store as text, parse as JSON in application
        nullable=True
    )
    raw_ai_data = Column(
        Text,  # Will store as text, parse as JSON in application
        nullable=True
    )
    
    # Relationships
    inventory_item = relationship("InventoryItem", back_populates="processing_logs")
    
    # Indexes
    __table_args__ = (
        Index("ix_processing_status_date", "status", "processing_date"),
    )
    
    def __repr__(self) -> str:
        """String representation."""
        return (
            f"<ProcessingLog(id={self.id}, "
            f"image='{self.image_path}', "
            f"status='{self.status}')>"
        )
    
    def to_dict(self) -> dict:
        """Convert to dictionary.
        
        Returns:
            Dictionary representation of processing log
        """
        import json
        
        return {
            "id": self.id,
            "inventory_item_id": self.inventory_item_id,
            "image_path": self.image_path,
            "processing_date": self.processing_date.isoformat() if self.processing_date else None,
            "ocr_confidence": self.ocr_confidence,
            "ai_confidence": self.ai_confidence,
            "status": self.status,
            "error_message": self.error_message,
            "raw_ocr_data": json.loads(self.raw_ocr_data) if self.raw_ocr_data else None,
            "raw_ai_data": json.loads(self.raw_ai_data) if self.raw_ai_data else None,
        }
    
    @property
    def is_successful(self) -> bool:
        """Check if processing was successful.
        
        Returns:
            True if status is 'success'
        """
        return self.status == "success"
    
    @property
    def needs_review(self) -> bool:
        """Check if processing needs manual review.
        
        Returns:
            True if status is 'manual_review' or confidence is low
        """
        if self.status == "manual_review":
            return True
        # Check confidence thresholds
        if self.ocr_confidence and self.ocr_confidence < 0.7:
            return True
        if self.ai_confidence and self.ai_confidence < 0.7:
            return True
        
        return False


# ============================================================================
# Recipe Model
# ============================================================================

class SavedRecipe(Base):
    """Saved recipes in recipe box.
    
    Stores user's favorite recipes generated from pantry items.
    Allows users to save and revisit recipes they like.
    
    Attributes:
        id: Primary key
        name: Recipe name
        description: Recipe description
        cuisine: Cuisine type
        difficulty: Difficulty level (easy/medium/hard)
        prep_time: Preparation time in minutes
        cook_time: Cooking time in minutes
        servings: Number of servings
        ingredients: JSON list of ingredients with amounts
        instructions: JSON list of step-by-step instructions
        notes: User's personal notes about the recipe
        rating: User rating (1-5 stars, nullable)
        tags: JSON list of tags (e.g., ["quick", "vegetarian"])
        created_at: When recipe was saved
        updated_at: Last update timestamp
    """
    
    __tablename__ = "saved_recipes"
    
    # Primary key
    id = Column(Integer, primary_key=True, autoincrement=True)
    
    # Foreign key to user
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    # Recipe information
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    cuisine = Column(String(100), nullable=True, index=True)
    difficulty = Column(String(50), nullable=True, index=True)
    prep_time = Column(Integer, nullable=True)  # minutes
    cook_time = Column(Integer, nullable=True)  # minutes
    servings = Column(Integer, nullable=True)
    
    # Recipe content (stored as JSON)
    ingredients = Column(Text, nullable=False)  # JSON: List of ingredient dicts
    instructions = Column(Text, nullable=False)  # JSON: List of instruction strings
    
    # User customization
    notes = Column(Text, nullable=True)
    rating = Column(Integer, nullable=True)  # 1-5 stars
    tags = Column(Text, nullable=True)  # JSON: List of tag strings
    
    # AI metadata
    ai_model = Column(String(100), nullable=True)  # AI model used to generate recipe (e.g., "gpt-4o", "claude-3-opus-20240229")
    
    # Timestamps
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )
    
    # Relationships
    user = relationship("User", back_populates="saved_recipes")
    
    # Indexes (user_id, name, cuisine, difficulty already indexed via index=True)
    __table_args__ = (
        Index("ix_saved_recipes_created_at", "created_at"),
    )
    
    def __repr__(self) -> str:
        """String representation."""
        return f"<SavedRecipe(id={self.id}, name='{self.name}')>"
    
    def to_dict(self) -> dict:
        """Convert to dictionary.
        
        Returns:
            Dictionary representation of saved recipe
        """
        import json
        
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "cuisine": self.cuisine,
            "difficulty": self.difficulty,
            "prep_time": self.prep_time,
            "cook_time": self.cook_time,
            "servings": self.servings,
            "ingredients": json.loads(self.ingredients) if self.ingredients else [],
            "instructions": json.loads(self.instructions) if self.instructions else [],
            "notes": self.notes,
            "rating": self.rating,
            "tags": json.loads(self.tags) if self.tags else [],
            "ai_model": self.ai_model,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
    
    @property
    def total_time(self) -> Optional[int]:
        """Calculate total time (prep + cook).
        
        Returns:
            Total time in minutes, or None if either time is missing
        """
        if self.prep_time is not None and self.cook_time is not None:
            return self.prep_time + self.cook_time
        return None
    
    @property
    def has_rating(self) -> bool:
        """Check if recipe has a rating.
        
        Returns:
            True if rating is set
        """
        return self.rating is not None and 1 <= self.rating <= 5


# ============================================================================
# Pantry Model - Multiple Pantries per User
# ============================================================================

class Pantry(Base):
    """Pantry/location for organizing inventory items.
    
    Allows users to have multiple pantries (e.g., home, office, vacation home).
    Each inventory item belongs to a specific pantry.
    
    Attributes:
        id: Primary key
        user_id: Foreign key to users table
        name: Pantry name (e.g., "Home", "Office", "Vacation Home")
        description: Optional description
        location: Optional location/address
        is_default: Whether this is the user's default pantry
        created_at: Record creation timestamp
        updated_at: Last update timestamp
    
    Relationships:
        user: Associated user
        inventory_items: Inventory items in this pantry
    
    Indexes:
        - user_id (for queries by user)
        - is_default (for finding default pantry)
    """
    
    __tablename__ = "pantries"
    
    # Primary key
    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    
    # Foreign key
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    # Pantry information
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    location = Column(String(255), nullable=True)  # e.g., "123 Main St, City, State"
    is_default = Column(Boolean, default=False, nullable=False, index=True)
    
    # Timestamps
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )
    
    # Relationships
    user = relationship("User", back_populates="pantries")
    inventory_items = relationship(
        "InventoryItem",
        back_populates="pantry",
        cascade="all, delete-orphan"
    )
    
    # Indexes
    __table_args__ = (
        Index("ix_pantries_user_default", "user_id", "is_default"),
    )
    
    def __repr__(self) -> str:
        """String representation."""
        return f"<Pantry(id={self.id}, name='{self.name}', user_id={self.user_id})>"
    
    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "name": self.name,
            "description": self.description,
            "location": self.location,
            "is_default": self.is_default,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


# ============================================================================
# User Model - Authentication & Authorization
# ============================================================================

class User(Base):
    """User account for authentication and authorization.
    
    Stores user credentials, roles, and account status.
    Each user can have multiple inventory items and saved recipes.
    
    Attributes:
        id: Primary key
        email: User email (unique, indexed)
        password_hash: Hashed password (bcrypt)
        full_name: User's full name
        role: User role (user/admin)
        email_verified: Whether email is verified
        is_active: Whether account is active
        created_at: Account creation timestamp
        updated_at: Last update timestamp
        last_login: Last login timestamp
    
    Relationships:
        inventory_items: User's inventory items
        refresh_tokens: User's refresh tokens
    """
    
    __tablename__ = "users"
    
    # Primary key
    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    
    # User information
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    role = Column(String(50), default="user", nullable=False)  # user, admin
    
    # Account status
    email_verified = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Timestamps
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )
    last_login = Column(DateTime, nullable=True)
    
    # Relationships
    inventory_items = relationship("InventoryItem", back_populates="user", cascade="all, delete-orphan")
    refresh_tokens = relationship("RefreshToken", back_populates="user", cascade="all, delete-orphan")
    saved_recipes = relationship("SavedRecipe", back_populates="user", cascade="all, delete-orphan")
    pantries = relationship("Pantry", back_populates="user", cascade="all, delete-orphan")
    
    # Indexes (email already indexed via index=True; avoid duplicate ix_users_email)
    __table_args__ = (
        Index("ix_users_role", "role"),
    )
    
    def __repr__(self) -> str:
        """String representation."""
        return f"<User(id={self.id}, email='{self.email}', role='{self.role}')>"
    
    def to_dict(self) -> dict:
        """Convert to dictionary (excludes sensitive data)."""
        return {
            "id": self.id,
            "email": self.email,
            "full_name": self.full_name,
            "role": self.role,
            "email_verified": self.email_verified,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "last_login": self.last_login.isoformat() if self.last_login else None,
        }
    
    @property
    def is_admin(self) -> bool:
        """Check if user is admin."""
        return self.role == "admin"


# ============================================================================
# UserSettings Model - User Preferences
# ============================================================================

class UserSettings(Base):
    """User preferences and settings.
    
    Stores user-specific settings like AI model preferences.
    
    Attributes:
        id: Primary key
        user_id: Foreign key to users table
        ai_provider: Preferred AI provider (openai, anthropic)
        ai_model: Preferred AI model name
        created_at: Record creation timestamp
        updated_at: Last update timestamp
    """
    
    __tablename__ = "user_settings"
    
    # Primary key
    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    
    # Foreign key
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,  # One settings record per user
        index=True
    )
    
    # AI preferences
    ai_provider = Column(String(50), nullable=True)  # "openai" or "anthropic"
    ai_model = Column(String(100), nullable=True)  # e.g., "gpt-4o", "claude-sonnet-4-20250514"
    
    # Timestamps
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )
    
    # Relationships
    user = relationship("User", backref="settings")
    
    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "ai_provider": self.ai_provider,
            "ai_model": self.ai_model,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


# ============================================================================
# RefreshToken Model - JWT Refresh Token Storage
# ============================================================================

class RefreshToken(Base):
    """Refresh token for JWT authentication.
    
    Stores hashed refresh tokens to enable token rotation and revocation.
    
    Attributes:
        id: Primary key
        user_id: Foreign key to users table
        token_hash: SHA-256 hash of refresh token
        expires_at: Token expiration timestamp
        created_at: Token creation timestamp
        revoked: Whether token is revoked
    
    Relationships:
        user: Associated user
    """
    
    __tablename__ = "refresh_tokens"
    
    # Primary key
    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    
    # Foreign keys
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    # Token information
    token_hash = Column(String(255), nullable=False, unique=True, index=True)
    expires_at = Column(DateTime, nullable=False, index=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    revoked = Column(Boolean, default=False, nullable=False)
    
    # Relationships
    user = relationship("User", back_populates="refresh_tokens")
    
    # Indexes
    __table_args__ = (
        Index("ix_refresh_tokens_user_expires", "user_id", "expires_at"),
        Index("ix_refresh_tokens_revoked", "revoked"),
    )
    
    def __repr__(self) -> str:
        """String representation."""
        return (
            f"<RefreshToken(id={self.id}, user_id={self.user_id}, "
            f"expires_at={self.expires_at}, revoked={self.revoked})>"
        )
    
    @property
    def is_expired(self) -> bool:
        """Check if token is expired."""
        return datetime.utcnow() > self.expires_at
    
    @property
    def is_valid(self) -> bool:
        """Check if token is valid (not revoked and not expired)."""
        return not self.revoked and not self.is_expired


# ============================================================================
# SecurityEvent Model - Security Audit Logging (Phase 2)
# ============================================================================

class SecurityEvent(Base):
    """Security event logging for audit and monitoring.
    
    Tracks security-related events such as login attempts, authentication failures,
    sensitive operations, and potential security threats.
    
    Attributes:
        id: Primary key
        event_type: Type of security event (indexed)
        user_id: Associated user (if applicable)
        ip_address: Client IP address
        user_agent: Client user agent string
        details: JSON details of the event
        severity: Event severity (info, warning, error, critical)
        created_at: Event timestamp (indexed)
    
    Relationships:
        user: Associated user (if applicable)
    """
    
    __tablename__ = "security_events"
    
    # Primary key
    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    
    # Event information
    event_type = Column(String(100), nullable=False, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    ip_address = Column(String(45), nullable=False)  # IPv6 max length
    user_agent = Column(String(500), nullable=True)
    details = Column(Text, nullable=True)  # JSON string
    severity = Column(String(20), default="info", nullable=False)  # info, warning, error, critical
    
    # Timestamp
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    
    # Indexes
    __table_args__ = (
        Index("ix_security_events_type_created", "event_type", "created_at"),
        Index("ix_security_events_user_created", "user_id", "created_at"),
        Index("ix_security_events_severity", "severity"),
    )
    
    def __repr__(self) -> str:
        """String representation."""
        return (
            f"<SecurityEvent(id={self.id}, type='{self.event_type}', "
            f"user_id={self.user_id}, severity='{self.severity}')>"
        )
    
    def to_dict(self) -> dict:
        """Convert to dictionary."""
        import json
        return {
            "id": self.id,
            "event_type": self.event_type,
            "user_id": self.user_id,
            "ip_address": self.ip_address,
            "user_agent": self.user_agent,
            "details": json.loads(self.details) if self.details else None,
            "severity": self.severity,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


# ============================================================================
# Helper Functions
# ============================================================================

def get_or_create_product(
    session: Session,
    product_name: str,
    brand: Optional[str] = None,
    category: str = "Other",
    **kwargs
) -> Product:
    """Get existing product or create new one.
    
    Args:
        session: Database session
        product_name: Product name
        brand: Brand name
        category: Category
        **kwargs: Additional product attributes
        
    Returns:
        Product instance (existing or new)
        
    Example:
        >>> product = get_or_create_product(
        ...     session,
        ...     "Organic Quinoa",
        ...     brand="Bob's Red Mill",
        ...     category="Grains & Pasta"
        ... )
    """
    # Try to find existing product
    query = session.query(Product).filter(
        Product.product_name == product_name
    )
    
    if brand:
        query = query.filter(Product.brand == brand)
    
    product = query.first()
    
    if product:
        return product
    
    # Create new product
    product = Product(
        product_name=product_name,
        brand=brand,
        category=category,
        **kwargs
    )
    session.add(product)
    session.flush()  # Get ID without committing
    
    return product

