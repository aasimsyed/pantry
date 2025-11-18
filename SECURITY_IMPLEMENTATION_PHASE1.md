# Security Implementation: Phase 1 (Quick Start)
## Authentication & Basic API Protection

This guide provides step-by-step instructions to implement Phase 1 security features.

---

## 🎯 Phase 1 Goals

- User authentication with JWT
- Password hashing and storage
- Protected API endpoints
- Basic rate limiting
- Security headers

---

## Step 1: Install Dependencies

```bash
pip install python-jose[cryptography] passlib[bcrypt] slowapi email-validator
```

Add to `requirements.txt`:
```txt
python-jose[cryptography]>=3.3.0
passlib[bcrypt]>=1.7.4
slowapi>=0.1.9
email-validator>=2.1.0
```

---

## Step 2: Update Database Schema

Add User and related tables to `src/database.py`:

```python
# Add to imports
from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, Integer, String, ForeignKey, Index

# Add User model
class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    role = Column(String(50), default="user")  # user, admin
    email_verified = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    last_login = Column(DateTime, nullable=True)
    
    # Relationships
    inventory_items = relationship("InventoryItem", back_populates="user")
    refresh_tokens = relationship("RefreshToken", back_populates="user", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<User(id={self.id}, email={self.email}, role={self.role})>"

# Add RefreshToken model
class RefreshToken(Base):
    __tablename__ = "refresh_tokens"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash = Column(String(255), nullable=False, unique=True, index=True)
    expires_at = Column(DateTime, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    revoked = Column(Boolean, default=False, nullable=False)
    
    # Relationships
    user = relationship("User", back_populates="refresh_tokens")
    
    def __repr__(self):
        return f"<RefreshToken(id={self.id}, user_id={self.user_id}, expires_at={self.expires_at})>"

# Update InventoryItem to include user_id
# Add to InventoryItem model:
# user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
# user = relationship("User", back_populates="inventory_items")
```

---

## Step 3: Create Authentication Service

Create `src/auth_service.py`:

```python
"""
Authentication and authorization service.

Handles password hashing, JWT token generation, and user authentication.
"""

import logging
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from src.database import User, RefreshToken
import os
import hashlib

logger = logging.getLogger(__name__)

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT Configuration
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "15"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("JWT_REFRESH_TOKEN_EXPIRE_DAYS", "30"))


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a password."""
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "type": "access"})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def create_refresh_token(data: dict) -> str:
    """Create a JWT refresh token."""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def verify_token(token: str, token_type: str = "access") -> dict:
    """Verify and decode a JWT token."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != token_type:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type"
            )
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )


def hash_refresh_token(token: str) -> str:
    """Hash a refresh token for storage."""
    return hashlib.sha256(token.encode()).hexdigest()


def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
    """Authenticate a user with email and password."""
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
    """Get a user by email."""
    return db.query(User).filter(User.email == email).first()


def create_user(db: Session, email: str, password: str, full_name: Optional[str] = None) -> User:
    """Create a new user."""
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
        role="user"
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    logger.info(f"User created: {user.email}")
    return user


def store_refresh_token(db: Session, user_id: int, token: str) -> RefreshToken:
    """Store a refresh token in the database."""
    token_hash = hash_refresh_token(token)
    expires_at = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    
    refresh_token = RefreshToken(
        user_id=user_id,
        token_hash=token_hash,
        expires_at=expires_at
    )
    db.add(refresh_token)
    db.commit()
    db.refresh(refresh_token)
    return refresh_token


def revoke_refresh_token(db: Session, token_hash: str) -> bool:
    """Revoke a refresh token."""
    token = db.query(RefreshToken).filter(
        RefreshToken.token_hash == token_hash,
        RefreshToken.revoked == False
    ).first()
    if token:
        token.revoked = True
        db.commit()
        return True
    return False


def revoke_all_user_tokens(db: Session, user_id: int) -> int:
    """Revoke all refresh tokens for a user."""
    count = db.query(RefreshToken).filter(
        RefreshToken.user_id == user_id,
        RefreshToken.revoked == False
    ).update({"revoked": True})
    db.commit()
    return count
```

---

## Step 4: Create Authentication Endpoints

Add to `api/main.py`:

```python
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from src.auth_service import (
    authenticate_user, create_user, create_access_token, create_refresh_token,
    verify_token, store_refresh_token, revoke_refresh_token, revoke_all_user_tokens,
    hash_refresh_token
)
from src.database import User, RefreshToken

security = HTTPBearer()

# Authentication endpoints
@app.post("/api/auth/register", tags=["Authentication"])
def register(
    email: str = Form(...),
    password: str = Form(...),
    full_name: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    """Register a new user."""
    try:
        user = create_user(db, email, password, full_name)
        return {
            "message": "User registered successfully",
            "user_id": user.id,
            "email": user.email
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Registration error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed"
        )


@app.post("/api/auth/login", tags=["Authentication"])
def login(
    email: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db)
):
    """Login and get access/refresh tokens."""
    user = authenticate_user(db, email, password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    # Update last login
    user.last_login = datetime.utcnow()
    db.commit()
    
    # Create tokens
    access_token = create_access_token(data={"sub": str(user.id), "email": user.email, "role": user.role})
    refresh_token = create_refresh_token(data={"sub": str(user.id)})
    
    # Store refresh token
    store_refresh_token(db, user.id, refresh_token)
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role
        }
    }


@app.post("/api/auth/refresh", tags=["Authentication"])
def refresh_token(
    refresh_token: str = Form(...),
    db: Session = Depends(get_db)
):
    """Refresh access token using refresh token."""
    # Verify refresh token
    payload = verify_token(refresh_token, token_type="refresh")
    user_id = int(payload.get("sub"))
    
    # Check if token is revoked
    token_hash = hash_refresh_token(refresh_token)
    token_record = db.query(RefreshToken).filter(
        RefreshToken.token_hash == token_hash,
        RefreshToken.revoked == False,
        RefreshToken.expires_at > datetime.utcnow()
    ).first()
    
    if not token_record:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token"
        )
    
    # Get user
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive"
        )
    
    # Create new access token
    access_token = create_access_token(data={"sub": str(user.id), "email": user.email, "role": user.role})
    
    return {
        "access_token": access_token,
        "token_type": "bearer"
    }


@app.post("/api/auth/logout", tags=["Authentication"])
def logout(
    refresh_token: str = Form(...),
    db: Session = Depends(get_db)
):
    """Logout and revoke refresh token."""
    token_hash = hash_refresh_token(refresh_token)
    if revoke_refresh_token(db, token_hash):
        return {"message": "Logged out successfully"}
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Invalid refresh token"
    )


# Dependency to get current user
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """Get current authenticated user from JWT token."""
    token = credentials.credentials
    payload = verify_token(token, token_type="access")
    user_id = int(payload.get("sub"))
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive"
        )
    return user


# Dependency to require admin role
async def get_current_admin_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """Require admin role."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user
```

---

## Step 5: Protect Existing Endpoints

Update endpoints to require authentication:

```python
# Example: Protect inventory endpoints
@app.get("/api/inventory", response_model=List[InventoryItemResponse], tags=["Inventory"])
def get_inventory(
    current_user: User = Depends(get_current_user),  # Add this
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    service: PantryService = Depends(get_pantry_service)
) -> List[InventoryItem]:
    """Get inventory items (user's own items only)."""
    # Filter by user_id
    items = service.get_user_inventory(current_user.id, skip, limit)
    return [enrich_inventory_item(item) for item in items]
```

---

## Step 6: Add Rate Limiting

Add to `api/main.py`:

```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Apply rate limiting
@app.post("/api/auth/login")
@limiter.limit("5/minute")  # 5 login attempts per minute
def login(...):
    # ...

@app.post("/api/inventory/process-image")
@limiter.limit("10/minute")  # 10 image uploads per minute
def process_single_image(...):
    # ...
```

---

## Step 7: Add Security Headers

Add middleware to `api/main.py`:

```python
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    return response
```

---

## Step 8: Update Environment Variables

Add to `.env`:
```bash
SECRET_KEY=your-very-secret-key-generate-with-openssl-rand-hex-32
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=15
JWT_REFRESH_TOKEN_EXPIRE_DAYS=30
```

Generate secret key:
```bash
openssl rand -hex 32
```

---

## Step 9: Database Migration

Run migration to add new tables:
```bash
python -c "from src.database import init_database; init_database()"
```

---

## Step 10: Update Mobile App

Update `mobile/src/api/client.ts` to include authentication:

```typescript
// Add token storage
import * as SecureStore from 'expo-secure-store';

class APIClient {
  private async getAccessToken(): Promise<string | null> {
    return await SecureStore.getItemAsync('access_token');
  }
  
  private async setAccessToken(token: string): Promise<void> {
    await SecureStore.setItemAsync('access_token', token);
  }
  
  // Add Authorization header to all requests
  private async request<T>(...): Promise<T> {
    const token = await this.getAccessToken();
    const headers = {
      ...config?.headers,
      ...(token && { Authorization: `Bearer ${token}` }),
    };
    // ...
  }
  
  // Add auth methods
  async login(email: string, password: string): Promise<AuthResponse> {
    const formData = new FormData();
    formData.append('email', email);
    formData.append('password', password);
    
    const response = await this.client.post('/api/auth/login', formData);
    await this.setAccessToken(response.data.access_token);
    return response.data;
  }
}
```

---

## Testing

1. **Register a user:**
```bash
curl -X POST https://pantry.up.railway.app/api/auth/register \
  -F "email=test@example.com" \
  -F "password=SecurePass123!" \
  -F "full_name=Test User"
```

2. **Login:**
```bash
curl -X POST https://pantry.up.railway.app/api/auth/login \
  -F "email=test@example.com" \
  -F "password=SecurePass123!"
```

3. **Use access token:**
```bash
curl -X GET https://pantry.up.railway.app/api/inventory \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## Next Steps

After Phase 1 is complete:
- Implement email verification
- Add password reset flow
- Implement MFA (Phase 2)
- Add advanced monitoring

