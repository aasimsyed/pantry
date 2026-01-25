"""Admin endpoints (audit logs)."""

import logging
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from api.dependencies import get_current_admin_user, get_db
from src.database import SecurityEvent, User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["Admin"])


@router.get("/audit-logs")
def get_audit_logs(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum records to return"),
    event_type: Optional[str] = Query(None, description="Filter by event type"),
    severity: Optional[str] = Query(None, description="Filter by severity"),
    user_id: Optional[int] = Query(None, description="Filter by user ID"),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
) -> List[Dict]:
    """Get security audit logs (admin only)."""
    try:
        query = db.query(SecurityEvent)
        if event_type:
            query = query.filter(SecurityEvent.event_type == event_type)
        if severity:
            query = query.filter(SecurityEvent.severity == severity)
        if user_id:
            query = query.filter(SecurityEvent.user_id == user_id)
        query = query.order_by(SecurityEvent.created_at.desc())
        events = query.offset(skip).limit(limit).all()
        return [e.to_dict() for e in events]
    except Exception as e:
        logger.error("Error retrieving audit logs: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve audit logs: {str(e)}",
        ) from e
