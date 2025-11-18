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
from datetime import datetime
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
    
    Example:
        >>> from src.database import init_database
        >>> init_database()
    """
    engine = create_database_engine()
    Base.metadata.create_all(bind=engine)
    print(f"✅ Database initialized: {get_database_url()}")


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
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "days_until_expiration": self.days_until_expiration,
            "is_expired": self.is_expired,
        }
    
    @property
    def days_until_expiration(self) -> Optional[int]:
        """Calculate days until expiration.
        
        Returns:
            Days until expiration, None if no expiration date
        """
        if not self.expiration_date:
            return None
        
        delta = self.expiration_date - datetime.utcnow()
        return delta.days
    
    @property
    def is_expired(self) -> bool:
        """Check if item is expired.
        
        Returns:
            True if expired, False otherwise
        """
        if not self.expiration_date:
            return False
        
        return datetime.utcnow() > self.expiration_date
    
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

