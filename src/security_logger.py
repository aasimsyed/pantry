"""
Security Event Logging Module.

Provides centralized security event logging for audit trails and monitoring.
"""

import logging
import json
from typing import Optional, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session
from src.database import SecurityEvent

# Configure security logger
security_logger = logging.getLogger("security")
security_logger.setLevel(logging.INFO)


def log_security_event(
    db: Session,
    event_type: str,
    user_id: Optional[int],
    ip_address: str,
    details: Optional[Dict[str, Any]] = None,
    severity: str = "info",
    user_agent: Optional[str] = None
) -> SecurityEvent:
    """
    Log a security event to the database and application logger.
    
    Args:
        db: Database session
        event_type: Type of security event (e.g., "login_attempt", "login_success", 
                   "authentication_failure", "file_upload", "rate_limit_exceeded")
        user_id: Associated user ID (if applicable)
        ip_address: Client IP address
        details: Additional event details as dictionary
        severity: Event severity level (info, warning, error, critical)
        user_agent: Client user agent string
        
    Returns:
        Created SecurityEvent instance
        
    Example:
        >>> log_security_event(
        ...     db,
        ...     "login_attempt",
        ...     user_id=None,
        ...     ip_address="192.168.1.1",
        ...     details={"email": "user@example.com", "success": False},
        ...     severity="warning"
        ... )
    """
    # Create security event
    event = SecurityEvent(
        event_type=event_type,
        user_id=user_id,
        ip_address=ip_address,
        user_agent=user_agent,
        details=json.dumps(details) if details else None,
        severity=severity,
        created_at=datetime.utcnow()
    )
    
    try:
        db.add(event)
        db.commit()
        db.refresh(event)
    except Exception as e:
        # If security_events table doesn't exist yet, log to application logger only
        # Don't block the request if table creation is pending
        error_str = str(e).lower()
        if "security_events" in error_str and ("does not exist" in error_str or "undefinedtable" in error_str):
            security_logger.warning(f"security_events table not yet created, logging to application logger only: {event_type}")
            db.rollback()
        else:
            # Other errors should be raised
            db.rollback()
            raise
    
    # Also log to application logger
    log_level = getattr(logging, severity.upper(), logging.INFO)
    user_str = f"User {user_id}" if user_id else "Anonymous"
    details_str = f" - {json.dumps(details)}" if details else ""
    
    security_logger.log(
        log_level,
        f"Security Event: {event_type} - {user_str} - IP: {ip_address}{details_str}"
    )
    
    return event


def get_client_ip(request) -> str:
    """
    Extract client IP address from request.
    
    Handles proxies and forwarded headers.
    
    Args:
        request: FastAPI Request object
        
    Returns:
        Client IP address as string
    """
    # Check for forwarded IP (from proxy/load balancer)
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # Take the first IP (original client)
        return forwarded_for.split(",")[0].strip()
    
    # Check for real IP header
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()
    
    # Fallback to direct client
    if request.client:
        return request.client.host
    
    return "unknown"


def get_user_agent(request) -> Optional[str]:
    """
    Extract user agent from request.
    
    Args:
        request: FastAPI Request object
        
    Returns:
        User agent string or None
    """
    return request.headers.get("User-Agent")


