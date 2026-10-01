"""Per-user daily AI spending cap."""

import logging
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import date, datetime, time, timedelta, timezone
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.dialects.postgresql import insert as postgres_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session

from src.ai_analyzer import AIAnalyzer
from src.config import settings
from src.database import AIUsage, User
from src.subscription_service import is_premium

logger = logging.getLogger(__name__)


def _today() -> date:
    return datetime.now(timezone.utc).date()


def usage_summary(db: Session, user: User, refresh: bool = False) -> dict[str, Any]:
    """Today's spend, limit and tier for a user."""
    premium = is_premium(user, refresh)
    today = _today()
    usage = db.get(AIUsage, (user.id, today))
    return {
        "tier": "premium" if premium else "free",
        "spent_usd": usage.cost_usd if usage else 0.0,
        "limit_usd": settings.ai_daily_cost_limit if premium else settings.ai_free_daily_cost_limit,
        "resets_at": datetime.combine(today + timedelta(days=1), time.min, tzinfo=timezone.utc),
    }


def ensure_within_budget(db: Session, user: User) -> None:
    """Raise 402 (free) or 429 (premium) once today's spend reaches the limit."""
    summary = usage_summary(db, user)
    if summary["spent_usd"] < summary["limit_usd"]:
        return
    if summary["tier"] == "free":
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="You've used today's free AI allowance. Upgrade to Premium for more, or try again tomorrow.",
        )
    retry_after = int((summary["resets_at"] - datetime.now(timezone.utc)).total_seconds())
    raise HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail="You've reached today's AI limit. It resets at midnight UTC.",
        headers={"Retry-After": str(max(retry_after, 1))},
    )


def record_spend(db: Session, user_id: int, cost_usd: float) -> None:
    """Atomically add cost to today's usage row."""
    if cost_usd <= 0:
        return
    insert = postgres_insert if db.get_bind().dialect.name == "postgresql" else sqlite_insert
    stmt = insert(AIUsage).values(user_id=user_id, day=_today(), cost_usd=cost_usd, request_count=1)
    stmt = stmt.on_conflict_do_update(
        index_elements=[AIUsage.user_id, AIUsage.day],
        set_={
            "cost_usd": AIUsage.cost_usd + stmt.excluded.cost_usd,
            "request_count": AIUsage.request_count + 1,
        },
    )
    try:
        db.execute(stmt)
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error("Failed to record AI spend for user %s: %s", user_id, e)


@contextmanager
def track_spend(db: Session, user_id: int, analyzer: AIAnalyzer) -> Iterator[None]:
    """Record what the analyzer spent inside the block, even on failure."""
    start = analyzer.cost_usd
    try:
        yield
    finally:
        record_spend(db, user_id, analyzer.cost_usd - start)
