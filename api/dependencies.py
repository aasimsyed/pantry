"""
Dependency Injection Module.

Provides FastAPI dependencies for database sessions and service instances.
Ensures proper resource management and cleanup.
"""

from typing import Generator, Optional
from sqlalchemy.orm import Session, sessionmaker
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from src.database import create_database_engine, User
from src.db_service import PantryService
from src.auth_service import verify_token, get_user_by_id


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


# ============================================================================
# Authentication Dependencies
# ============================================================================

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """
    Get current authenticated user from JWT token.
    
    Validates the JWT access token and returns the associated user.
    
    Args:
        credentials: HTTP Bearer token credentials
        db: Database session
        
    Returns:
        User: Authenticated user object
        
    Raises:
        HTTPException: If token is invalid or user not found
    """
    token = credentials.credentials
    payload = verify_token(token, token_type="access")
    user_id = int(payload.get("sub"))
    
    user = get_user_by_id(db, user_id)
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive"
        )
    return user


async def get_current_admin_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Require admin role for endpoint access.
    
    Args:
        current_user: Current authenticated user from get_current_user
        
    Returns:
        User: Admin user object
        
    Raises:
        HTTPException: If user is not an admin
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user


async def get_optional_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False)),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """
    Get current user if authenticated, otherwise return None.
    
    Useful for endpoints that work for both authenticated and anonymous users.
    
    Args:
        credentials: Optional HTTP Bearer token credentials
        db: Database session
        
    Returns:
        User if authenticated, None otherwise
    """
    if not credentials:
        return None
    
    try:
        token = credentials.credentials
        payload = verify_token(token, token_type="access")
        user_id = int(payload.get("sub"))
        user = get_user_by_id(db, user_id)
        if user and user.is_active:
            return user
    except Exception:
        pass
    
    return None

