"""
Dependency Injection Module.

Provides FastAPI dependencies for database sessions and service instances.
Ensures proper resource management and cleanup.
"""

from typing import Generator
from sqlalchemy.orm import Session, sessionmaker
from fastapi import Depends

from src.database import create_database_engine
from src.db_service import PantryService


# Create session factory
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=create_database_engine()
)


def get_db() -> Generator[Session, None, None]:
    """
    Provide a database session for each request.
    
    The session is automatically closed after the request completes,
    even if an exception occurs.
    
    Yields:
        Session: SQLAlchemy database session
        
    Example:
        @app.get("/items")
        def get_items(db: Session = Depends(get_db)):
            return db.query(Item).all()
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_pantry_service(db: Session = Depends(get_db)) -> PantryService:
    """
    Provide a PantryService instance for each request.
    
    The service uses the database session from get_db dependency,
    which is automatically managed and cleaned up.
    
    Args:
        db: Database session from get_db dependency
        
    Returns:
        PantryService: Service instance for business logic operations
        
    Example:
        @app.get("/inventory")
        def get_inventory(service: PantryService = Depends(get_pantry_service)):
            return service.get_all_inventory()
    """
    return PantryService(db)

