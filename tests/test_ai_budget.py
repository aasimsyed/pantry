"""Tests for the per-user AI spending cap and subscription tier resolution."""

from datetime import datetime, timedelta, timezone
from unittest.mock import Mock

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from src.ai_analyzer import AIConfig, OpenAIBackend, token_cost_usd

# Modules that load src.config are imported lazily: other tests patch env before its singleton is built


@pytest.fixture
def ai_budget():
    from src import ai_budget

    return ai_budget


@pytest.fixture
def subscription_service():
    from src import subscription_service

    subscription_service._cache.clear()
    return subscription_service


@pytest.fixture
def settings():
    from src.config import settings

    return settings


@pytest.fixture
def db():
    from src.database import AIUsage, User

    engine = create_engine("sqlite:///:memory:")
    User.metadata.create_all(engine, tables=[User.__table__, AIUsage.__table__])
    session = sessionmaker(bind=engine)()
    session.add(User(id=1, email="a@example.com", password_hash="x"))
    session.commit()
    yield session
    session.close()


@pytest.fixture
def user(db):
    from src.database import User

    return db.get(User, 1)


def _ai_usage():
    from src.database import AIUsage

    return AIUsage


def _iso(delta: timedelta) -> str:
    return (datetime.now(timezone.utc) + delta).isoformat().replace("+00:00", "Z")


class TestTokenCost:
    def test_known_model(self):
        assert token_cost_usd("gpt-6-luna", 1_000_000, 1_000_000) == pytest.approx(0.60)

    def test_unknown_model_uses_most_expensive_rate(self):
        assert token_cost_usd("mystery-model", 1_000_000, 0) == pytest.approx(10.00)

    def test_backend_accumulates_usage(self):
        backend = OpenAIBackend(AIConfig(openai_api_key="test"))
        backend.record_usage("gpt-6.1-sol", 1000, 2000)
        backend.record_usage("gpt-6.1-sol", 1000, 2000)
        assert backend.cost_usd == pytest.approx(2 * (1000 * 2 + 2000 * 10) / 1_000_000)


class TestRecordSpend:
    def test_upserts_daily_row(self, db, ai_budget):
        ai_budget.record_spend(db, 1, 0.01)
        ai_budget.record_spend(db, 1, 0.02)
        usage = db.get(_ai_usage(), (1, ai_budget._today()))
        db.refresh(usage)
        assert usage.cost_usd == pytest.approx(0.03)
        assert usage.request_count == 2

    def test_ignores_zero_cost(self, db, ai_budget):
        ai_budget.record_spend(db, 1, 0.0)
        assert db.get(_ai_usage(), (1, ai_budget._today())) is None

    def test_track_spend_records_delta_on_failure(self, db, ai_budget):
        analyzer = Mock(cost_usd=0.5)
        with pytest.raises(RuntimeError):
            with ai_budget.track_spend(db, 1, analyzer):
                analyzer.cost_usd = 0.75
                raise RuntimeError("model call failed")
        assert db.get(_ai_usage(), (1, ai_budget._today())).cost_usd == pytest.approx(0.25)


class TestEnsureWithinBudget:
    @pytest.mark.parametrize("premium", [True, False])
    def test_allows_under_limit(self, db, user, monkeypatch, premium, ai_budget):
        monkeypatch.setattr(ai_budget, "is_premium", lambda *_: premium)
        ai_budget.record_spend(db, 1, 0.001)
        ai_budget.ensure_within_budget(db, user)

    def test_free_over_limit_is_payment_required(self, db, user, monkeypatch, ai_budget, settings):
        monkeypatch.setattr(ai_budget, "is_premium", lambda *_: False)
        ai_budget.record_spend(db, 1, settings.ai_free_daily_cost_limit)
        with pytest.raises(HTTPException) as exc:
            ai_budget.ensure_within_budget(db, user)
        assert exc.value.status_code == 402

    def test_premium_over_limit_is_rate_limited_until_midnight(self, db, user, monkeypatch, ai_budget, settings):
        monkeypatch.setattr(ai_budget, "is_premium", lambda *_: True)
        ai_budget.record_spend(db, 1, settings.ai_daily_cost_limit)
        with pytest.raises(HTTPException) as exc:
            ai_budget.ensure_within_budget(db, user)
        assert exc.value.status_code == 429
        assert 0 < int(exc.value.headers["Retry-After"]) <= 86400


class TestSubscriberIsPremium:
    @pytest.mark.parametrize(
        ("subscriber", "expected"),
        [
            ({"entitlements": {"premium": {"expires_date": _iso(timedelta(days=3))}}}, True),
            ({"entitlements": {"premium": {"expires_date": _iso(-timedelta(days=1))}}}, False),
            ({"entitlements": {"premium": {"expires_date": None}}}, True),
            ({"entitlements": {}, "original_application_version": "120"}, True),
            ({"entitlements": {}, "original_application_version": "130"}, False),
            ({"entitlements": {}, "original_application_version": "1.0"}, False),
            ({"entitlements": {}, "original_application_version": None}, False),
        ],
        ids=["active", "expired", "lifetime", "paid-build", "freemium-build", "sandbox", "no-receipt"],
    )
    def test_rules(self, subscriber, expected, subscription_service):
        assert subscription_service.subscriber_is_premium(subscriber, 130) is expected


class TestIsPremium:
    def test_everyone_premium_until_freemium_launch(self, user, monkeypatch, subscription_service, settings):
        fetch = Mock()
        monkeypatch.setattr(settings, "freemium_first_build", None)
        monkeypatch.setattr(subscription_service, "_fetch_subscriber", fetch)
        assert subscription_service.is_premium(user) is True
        fetch.assert_not_called()

    def test_admin_always_premium(self, user, monkeypatch, subscription_service, settings):
        monkeypatch.setattr(settings, "freemium_first_build", 130)
        user.role = "admin"
        assert subscription_service.is_premium(user) is True

    def test_lookup_is_cached_and_refreshable(self, user, monkeypatch, subscription_service, settings):
        fetch = Mock(return_value={"entitlements": {}})
        monkeypatch.setattr(settings, "freemium_first_build", 130)
        monkeypatch.setattr(subscription_service, "_fetch_subscriber", fetch)
        assert subscription_service.is_premium(user) is False
        assert subscription_service.is_premium(user) is False
        assert fetch.call_count == 1
        subscription_service.is_premium(user, refresh=True)
        assert fetch.call_count == 2

    def test_fails_open_when_revenuecat_unreachable(self, user, monkeypatch, subscription_service, settings):
        monkeypatch.setattr(settings, "freemium_first_build", 130)
        monkeypatch.setattr(subscription_service, "_fetch_subscriber", Mock(side_effect=OSError("down")))
        assert subscription_service.is_premium(user) is True
