"""Authentication endpoints: register, login, refresh, logout, me."""

import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Form, HTTPException, Request, status
from sqlalchemy.orm import Session

from api.dependencies import get_current_user, get_db
from api.limiter import limiter
from api.models import (
    MessageResponse,
    RefreshTokenResponse,
    TokenResponse,
    UserResponse,
)
from src.auth_service import (
    authenticate_user,
    create_access_token,
    create_refresh_token,
    create_user,
    get_valid_refresh_token,
    hash_refresh_token,
    revoke_refresh_token,
    store_refresh_token,
    verify_token,
)
from src.database import User
from src.security_logger import get_client_ip, get_user_agent, log_security_event

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.delete("/account", response_model=MessageResponse)
@limiter.limit("5/hour")
def delete_account(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    """Delete user account and all associated data.
    
    This action is irreversible. Deletes:
    - User account
    - All pantries
    - All inventory items
    - All saved and recent recipes
    - User settings
    - Refresh tokens
    
    Rate limited to prevent abuse.
    """
    client_ip = get_client_ip(request)
    user_agent = get_user_agent(request)
    user_email = current_user.email
    user_id = current_user.id
    
    try:
        # Log security event
        log_security_event(
            "account_deletion",
            user_id=user_id,
            email=user_email,
            ip_address=client_ip,
            user_agent=user_agent,
            success=True,
            details={"reason": "user_requested"},
        )
        
        # Delete user (CASCADE will automatically delete all related records:
        # pantries, inventory items, recipes, refresh tokens, settings, etc.)
        db.delete(current_user)
        db.commit()
        
        logger.info(
            "Account deleted successfully: user_id=%s email=%s ip=%s",
            user_id,
            user_email,
            client_ip,
        )
        
        return MessageResponse(
            message="Account deleted successfully. All your data has been permanently removed."
        )
        
    except Exception as e:
        db.rollback()
        logger.error(
            "Account deletion failed: user_id=%s email=%s error=%s",
            user_id,
            user_email,
            str(e),
        )
        log_security_event(
            "account_deletion",
            user_id=user_id,
            email=user_email,
            ip_address=client_ip,
            user_agent=user_agent,
            success=False,
            details={"error": str(e)},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete account. Please try again or contact support.",
        ) from e


@router.post(
    "/register",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("10/minute")
def register(
    request: Request,
    email: str = Form(...),
    password: str = Form(..., min_length=8),
    full_name: Optional[str] = Form(None),
    db: Session = Depends(get_db),
) -> MessageResponse:
    """Register a new user account."""
    ip_address = get_client_ip(request)
    user_agent = get_user_agent(request)
    try:
        user = create_user(db, email, password, full_name)
        log_security_event(
            db=db,
            event_type="registration_success",
            user_id=user.id,
            ip_address=ip_address,
            details={"email": email, "full_name": full_name},
            severity="info",
            user_agent=user_agent,
        )
        return MessageResponse(
            message="User registered successfully",
            details={"user_id": user.id, "email": user.email},
        )
    except HTTPException as e:
        log_security_event(
            db=db,
            event_type="registration_failed",
            user_id=None,
            ip_address=ip_address,
            details={"email": email, "error": str(e.detail)},
            severity="warning",
            user_agent=user_agent,
        )
        raise
    except Exception as e:
        logger.error("Registration error: %s", e, exc_info=True)
        log_security_event(
            db=db,
            event_type="registration_error",
            user_id=None,
            ip_address=ip_address,
            details={"email": email, "error": str(e)},
            severity="error",
            user_agent=user_agent,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Registration failed: {str(e)}",
        ) from e


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
def login(
    request: Request,
    email: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db),
) -> TokenResponse:
    """Login and get access/refresh tokens."""
    ip_address = get_client_ip(request)
    user_agent = get_user_agent(request)
    log_security_event(
        db=db,
        event_type="login_attempt",
        user_id=None,
        ip_address=ip_address,
        details={"email": email},
        severity="info",
        user_agent=user_agent,
    )
    user = authenticate_user(db, email, password)
    if not user:
        log_security_event(
            db=db,
            event_type="login_failed",
            user_id=None,
            ip_address=ip_address,
            details={"email": email, "reason": "invalid_credentials"},
            severity="warning",
            user_agent=user_agent,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    user.last_login = datetime.utcnow()
    db.commit()
    access_token = create_access_token(
        data={"sub": str(user.id), "email": user.email, "role": user.role},
    )
    refresh_token = create_refresh_token(data={"sub": str(user.id)})
    store_refresh_token(db, user.id, refresh_token)
    log_security_event(
        db=db,
        event_type="login_success",
        user_id=user.id,
        ip_address=ip_address,
        details={"email": email, "role": user.role},
        severity="info",
        user_agent=user_agent,
    )
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        user=user.to_dict(),
    )


@router.post("/refresh", response_model=RefreshTokenResponse)
@limiter.limit("30/minute")
def refresh_token_endpoint(
    request: Request,
    refresh_token: str = Form(...),
    db: Session = Depends(get_db),
) -> RefreshTokenResponse:
    """Refresh access token using refresh token."""
    payload = verify_token(refresh_token, token_type="refresh")
    user_id = int(payload.get("sub"))
    token_hash = hash_refresh_token(refresh_token)
    token_record = get_valid_refresh_token(db, token_hash)
    if not token_record:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )
    access_token = create_access_token(
        data={"sub": str(user.id), "email": user.email, "role": user.role},
    )
    return RefreshTokenResponse(access_token=access_token, token_type="bearer")


@router.post("/logout", response_model=MessageResponse)
@limiter.limit("10/minute")
def logout(
    request: Request,
    refresh_token: str = Form(...),
    db: Session = Depends(get_db),
) -> MessageResponse:
    """Logout and revoke refresh token."""
    token_hash = hash_refresh_token(refresh_token)
    if revoke_refresh_token(db, token_hash):
        return MessageResponse(message="Logged out successfully")
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Invalid refresh token",
    )


@router.get("/me", response_model=UserResponse)
@limiter.limit("60/minute")
def get_current_user_info(
    request: Request,
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    """Get current authenticated user information."""
    try:
        return UserResponse.model_validate(current_user)
    except Exception as e:
        logger.error("Error getting current user info: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve user information: {str(e)}",
        ) from e
