"""
Authentication and authorization service.

Handles password hashing, JWT token generation, and user authentication.
Implements secure token management with refresh token rotation.

Best Practices:
    - Password hashing with bcrypt
    - JWT tokens with expiration
    - Refresh token rotation
    - Token revocation support
    - Secure token storage (hashed in database)
"""

import hashlib
import logging
from datetime import datetime, timedelta
from typing import Optional

from fastapi import HTTPException, status
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from src.config import settings
from src.database import RefreshToken, User

logger = logging.getLogger(__name__)

# Password hashing context
pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__ident="2b",
    bcrypt__rounds=12,
)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash.
    
    Args:
        plain_password: Plain text password
        hashed_password: Bcrypt hashed password
        
    Returns:
        True if password matches, False otherwise
    """
    import bcrypt
    
    if not plain_password or not hashed_password:
        return False
    
    # Truncate password to 72 bytes if needed (bcrypt limit)
    password_bytes = plain_password.encode('utf-8')
    if len(password_bytes) > 72:
        password_bytes = password_bytes[:72]
    
    # Ensure hashed_password is bytes
    if isinstance(hashed_password, str):
        hashed_bytes = hashed_password.encode('utf-8')
    else:
        hashed_bytes = hashed_password
    
    # Verify using bcrypt directly
    try:
        return bcrypt.checkpw(password_bytes, hashed_bytes)
    except Exception as e:
        logger.error(f"Password verification error: {e}")
        return False


def get_password_hash(password: str) -> str:
    """Hash a password using bcrypt.
    
    Args:
        password: Plain text password (will be truncated to 72 bytes if longer)
        
    Returns:
        Bcrypt hashed password
    """
    import bcrypt
    
    # Ensure password is a string and not None
    if password is None:
        raise ValueError("Password cannot be None")
    if not isinstance(password, str):
        password = str(password)
    
    # Bcrypt has a strict 72-byte limit - truncate BEFORE hashing
    # Convert to bytes to check actual length (bcrypt works with bytes)
    password_bytes = password.encode('utf-8')
    original_length = len(password_bytes)
    
    if original_length > 72:
        logger.warning(f"Password exceeds 72 bytes ({original_length}), truncating to 72")
        password_bytes = password_bytes[:72]
    
    if len(password_bytes) == 0:
        raise ValueError("Password cannot be empty")
    
    # Use bcrypt directly to avoid passlib encoding issues
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token.
    
    Args:
        data: Data to encode in token (should include 'sub' for user ID)
        expires_delta: Optional custom expiration time
        
    Returns:
        Encoded JWT token string
    """
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.jwt_access_token_expire_minutes)
    to_encode.update({"exp": expire, "type": "access"})
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=settings.jwt_algorithm)
    return encoded_jwt


def create_refresh_token(data: dict) -> str:
    """Create a JWT refresh token.
    
    Args:
        data: Data to encode in token (should include 'sub' for user ID)
        
    Returns:
        Encoded JWT refresh token string
    """
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=settings.jwt_refresh_token_expire_days)
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=settings.jwt_algorithm)
    return encoded_jwt


def verify_token(token: str, token_type: str = "access") -> dict:
    """Verify and decode a JWT token.
    
    Args:
        token: JWT token string
        token_type: Expected token type ('access' or 'refresh')
        
    Returns:
        Decoded token payload
        
    Raises:
        HTTPException: If token is invalid or wrong type
    """
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])
        if payload.get("type") != token_type:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type"
            )
        return payload
    except JWTError as e:
        logger.warning(f"Token verification failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )


def hash_refresh_token(token: str) -> str:
    """Hash a refresh token for storage in database.
    
    Args:
        token: Refresh token string
        
    Returns:
        SHA-256 hash of the token
    """
    return hashlib.sha256(token.encode()).hexdigest()


def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
    """Authenticate a user with email and password.
    
    Args:
        db: Database session
        email: User email
        password: Plain text password
        
    Returns:
        User object if authentication succeeds, None otherwise
        
    Raises:
        HTTPException: If user account is disabled
    """
    user = db.query(User).filter(User.email == email).first()
    if not user:
        return None
    if not verify_password(password, user.password_hash):
        return None
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled"
        )
    return user


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    """Get a user by email.
    
    Args:
        db: Database session
        email: User email
        
    Returns:
        User object if found, None otherwise
    """
    return db.query(User).filter(User.email == email).first()


def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
    """Get a user by ID.
    
    Args:
        db: Database session
        user_id: User ID
        
    Returns:
        User object if found, None otherwise
    """
    return db.query(User).filter(User.id == user_id).first()


def create_user(
    db: Session,
    email: str,
    password: str,
    full_name: Optional[str] = None,
    role: str = "user"
) -> User:
    """Create a new user.
    
    Args:
        db: Database session
        email: User email
        password: Plain text password
        full_name: Optional full name
        role: User role (default: 'user')
        
    Returns:
        Created User object
        
    Raises:
        HTTPException: If email already exists
    """
    # Check if user already exists
    if get_user_by_email(db, email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create user
    user = User(
        email=email,
        password_hash=get_password_hash(password),
        full_name=full_name,
        role=role
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    logger.info(f"User created: {user.email} (ID: {user.id})")
    return user


def store_refresh_token(db: Session, user_id: int, token: str) -> RefreshToken:
    """Store a refresh token in the database.
    
    Args:
        db: Database session
        user_id: User ID
        token: Refresh token string
        
    Returns:
        Created RefreshToken object
    """
    token_hash = hash_refresh_token(token)
    expires_at = datetime.utcnow() + timedelta(days=settings.jwt_refresh_token_expire_days)
    
    refresh_token = RefreshToken(
        user_id=user_id,
        token_hash=token_hash,
        expires_at=expires_at
    )
    db.add(refresh_token)
    db.commit()
    db.refresh(refresh_token)
    logger.debug(f"Refresh token stored for user {user_id}")
    return refresh_token


def revoke_refresh_token(db: Session, token_hash: str) -> bool:
    """Revoke a refresh token.
    
    Args:
        db: Database session
        token_hash: Hashed refresh token
        
    Returns:
        True if token was revoked, False if not found
    """
    token = db.query(RefreshToken).filter(
        RefreshToken.token_hash == token_hash,
        RefreshToken.revoked == False
    ).first()
    if token:
        token.revoked = True
        db.commit()
        logger.info(f"Refresh token revoked: {token.id}")
        return True
    return False


def revoke_all_user_tokens(db: Session, user_id: int) -> int:
    """Revoke all refresh tokens for a user.
    
    Args:
        db: Database session
        user_id: User ID
        
    Returns:
        Number of tokens revoked
    """
    count = db.query(RefreshToken).filter(
        RefreshToken.user_id == user_id,
        RefreshToken.revoked == False
    ).update({"revoked": True})
    db.commit()
    logger.info(f"Revoked {count} tokens for user {user_id}")
    return count


def get_valid_refresh_token(db: Session, token_hash: str) -> Optional[RefreshToken]:
    """Get a valid (non-revoked, non-expired) refresh token.
    
    Args:
        db: Database session
        token_hash: Hashed refresh token
        
    Returns:
        RefreshToken if valid, None otherwise
    """
    token = db.query(RefreshToken).filter(
        RefreshToken.token_hash == token_hash,
        RefreshToken.revoked == False,
        RefreshToken.expires_at > datetime.utcnow()
    ).first()
    return token

