"""Authentication endpoints: register, login, refresh, logout, me."""

import logging
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Body, Depends, Form, HTTPException, Request, status
from sqlalchemy.orm import Session

from api.config import config
from api.dependencies import get_current_user, get_db
from api.limiter import limiter
from api.models import (
    ForgotPasswordResponse,
    GetRecoveryQuestionsResponse,
    MessageResponse,
    RecoveryQuestionItem,
    RefreshTokenResponse,
    SetRecoveryQuestionsRequest,
    TokenResponse,
    UserResponse,
    VerifyResetRecoveryRequest,
    VerifyResetRecoveryResponse,
    VerifyResetTotpResponse,
)
from src.auth_service import (
    authenticate_user,
    create_password_reset_token,
    create_refresh_token,
    create_access_token,
    create_user,
    generate_totp_secret,
    get_password_hash,
    get_totp_uri,
    get_user_by_email,
    get_recovery_questions_for_user,
    get_recovery_questions_list,
    get_valid_refresh_token,
    hash_refresh_token,
    revoke_refresh_token,
    set_recovery_answers,
    store_refresh_token,
    verify_password_reset_token,
    verify_recovery_answers,
    verify_token,
    verify_totp,
    validate_password_strength,
)
from src.database import PasswordResetRequest, User
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


@router.get("/recovery-questions", response_model=GetRecoveryQuestionsResponse)
@limiter.limit("30/hour")
def get_recovery_questions(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GetRecoveryQuestionsResponse:
    """Get all predefined recovery questions and the ids of questions the user has set."""
    all_questions = [
        RecoveryQuestionItem(id=q["id"], text=q["text"])
        for q in get_recovery_questions_list()
    ]
    user_questions = get_recovery_questions_for_user(db, current_user.id)
    user_question_ids = [q["id"] for q in user_questions]
    return GetRecoveryQuestionsResponse(all_questions=all_questions, user_question_ids=user_question_ids)


@router.post("/recovery-questions", response_model=MessageResponse)
@limiter.limit("10/hour")
def set_recovery_questions(
    request: Request,
    body: SetRecoveryQuestionsRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    """Set or update recovery questions/answers (2–3 pairs). Requires authentication."""
    answers_tuples = [(a.question_id, a.answer) for a in body.answers]
    set_recovery_answers(db, current_user.id, answers_tuples)
    return MessageResponse(message="Recovery questions updated.")


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
@limiter.limit(f"{config.rate_limit_forgot_password_per_hour}/hour")
def forgot_password(
    request: Request,
    email: str = Form(...),
    new_setup: bool = Form(False),
    db: Session = Depends(get_db),
) -> ForgotPasswordResponse:
    """Start TOTP-based password reset. Returns QR/URI if user has no Authenticator yet or new_setup=True. Also returns recovery_questions if user has set them."""
    client_ip = get_client_ip(request)
    user_agent = get_user_agent(request)
    has_existing_totp = False
    totp_uri: Optional[str] = None
    qr_image_base64: Optional[str] = None
    has_recovery_questions = False
    recovery_questions: Optional[list] = None

    try:
        user = get_user_by_email(db, email)
        if not user:
            log_security_event(
                db=db,
                event_type="password_reset_invalid_email",
                user_id=None,
                ip_address=client_ip,
                user_agent=user_agent,
                severity="warning",
                details={"email": email},
            )
            return ForgotPasswordResponse(
                has_existing_totp=False,
                totp_uri=None,
                qr_image_base64=None,
                has_recovery_questions=False,
                recovery_questions=None,
            )

        db.query(PasswordResetRequest).filter(PasswordResetRequest.email == email).delete()
        db.commit()

        expires_at = datetime.utcnow() + timedelta(minutes=15)
        if user.totp_secret and not new_setup:
            secret = user.totp_secret
            has_existing_totp = True
        else:
            secret = generate_totp_secret()
            totp_uri = get_totp_uri(secret, user.email)
            try:
                import base64
                import io
                import qrcode
                buf = io.BytesIO()
                qrcode.make(totp_uri).save(buf, format="PNG")
                qr_image_base64 = base64.b64encode(buf.getvalue()).decode("ascii")
            except Exception as qr_err:
                logger.warning("QR generation failed: %s", qr_err)
            user.totp_secret = secret

        req = PasswordResetRequest(email=email, totp_secret=secret, expires_at=expires_at)
        db.add(req)
        db.commit()

        recovery_questions_list = get_recovery_questions_for_user(db, user.id)
        has_recovery_questions = len(recovery_questions_list) >= 2
        if has_recovery_questions:
            recovery_questions = recovery_questions_list

        log_security_event(
            db=db,
            event_type="password_reset_requested",
            user_id=user.id,
            ip_address=client_ip,
            user_agent=user_agent,
            details={"email": user.email, "totp_flow": True},
        )
        return ForgotPasswordResponse(
            has_existing_totp=has_existing_totp,
            totp_uri=totp_uri,
            qr_image_base64=qr_image_base64,
            has_recovery_questions=has_recovery_questions,
            recovery_questions=recovery_questions,
        )
    except Exception as e:
        db.rollback()
        logger.error("Error in forgot-password: %s", e, exc_info=True)
        return ForgotPasswordResponse(
            has_existing_totp=False,
            totp_uri=None,
            qr_image_base64=None,
            has_recovery_questions=False,
            recovery_questions=None,
        )


@router.post("/verify-reset-totp", response_model=VerifyResetTotpResponse)
@limiter.limit("10/hour")
def verify_reset_totp(
    request: Request,
    email: str = Form(...),
    code: str = Form(...),
    db: Session = Depends(get_db),
) -> VerifyResetTotpResponse:
    """Verify TOTP code and return a short-lived reset token for POST /api/auth/reset-password."""
    req = (
        db.query(PasswordResetRequest)
        .filter(PasswordResetRequest.email == email, PasswordResetRequest.expires_at > datetime.utcnow())
        .order_by(PasswordResetRequest.created_at.desc())
        .first()
    )
    if not req or not verify_totp(req.totp_secret, code.strip()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired code. Request a new password reset and try again.",
        )
    reset_token = create_password_reset_token(email)
    db.delete(req)
    db.commit()
    return VerifyResetTotpResponse(reset_token=reset_token)


@router.post("/verify-reset-recovery", response_model=VerifyResetRecoveryResponse)
@limiter.limit("10/hour")
def verify_reset_recovery(
    request: Request,
    body: VerifyResetRecoveryRequest = Body(...),
    db: Session = Depends(get_db),
) -> VerifyResetRecoveryResponse:
    """Verify recovery-question answers and return a short-lived reset token for POST /api/auth/reset-password."""
    answers_tuples = [(a.question_id, a.answer) for a in body.answers]
    reset_token = verify_recovery_answers(db, body.email, answers_tuples)
    if not reset_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect answers or no recovery questions set. Try again or use the Authenticator app.",
        )
    return VerifyResetRecoveryResponse(reset_token=reset_token)


@router.post("/reset-password", response_model=MessageResponse)
@limiter.limit("5/hour")
def reset_password(
    request: Request,
    token: str = Form(...),
    new_password: str = Form(...),
    db: Session = Depends(get_db),
) -> MessageResponse:
    """Reset password using the reset token from verify-reset-totp (TOTP flow)."""
    client_ip = get_client_ip(request)
    user_agent = get_user_agent(request)

    try:
        email = verify_password_reset_token(token)
        if not email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired reset token",
            )
        is_valid, error_message = validate_password_strength(new_password)
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_message,
            )
        user = get_user_by_email(db, email)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )
        user.password_hash = get_password_hash(new_password)
        db.commit()
        
        log_security_event(
            db=db,
            event_type="password_reset_completed",
            user_id=user.id,
            ip_address=client_ip,
            user_agent=user_agent,
            details={"email": user.email, "success": True, "message": "Password successfully reset"}
        )
        
        logger.info(f"Password successfully reset for user {user.email}")
        return MessageResponse(message="Password successfully reset. You can now log in with your new password.")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error resetting password: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reset password. Please try again."
        ) from e
