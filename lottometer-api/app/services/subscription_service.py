"""Subscription service — trial management, status checks, Stripe sync."""

from datetime import datetime, timezone, timedelta

from app.extensions import db
from app.models.subscription import Subscription


def create_trial_subscription(store_id: int) -> Subscription:
    """Called when a new store is created. Gives 14-day free trial automatically."""
    trial_end = datetime.now(timezone.utc) + timedelta(days=14)
    sub = Subscription(
        store_id=store_id,
        plan="basic",
        status="trial",
        trial_ends_at=trial_end,
    )
    db.session.add(sub)
    return sub


def _aware(dt: datetime) -> datetime:
    """Return dt as a UTC-aware datetime, adding tzinfo if the DB gave us a naive value."""
    if dt is not None and dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def check_subscription_active(store_id: int) -> bool:
    """Returns True if the store can access the app. Called on every login."""
    sub = Subscription.query.filter_by(store_id=store_id).first()

    if not sub:
        return False

    now = datetime.now(timezone.utc)

    if sub.status == "active":
        if sub.current_period_end:
            return now < _aware(sub.current_period_end)
        return True

    if sub.status == "trial":
        if sub.trial_ends_at:
            if now > _aware(sub.trial_ends_at):
                sub.status = "expired"
                db.session.commit()
                return False
        return True

    return False  # expired, suspended, cancelled


def get_subscription_status(store_id: int) -> dict:
    """Returns subscription info for the mobile app and dashboard."""
    sub = Subscription.query.filter_by(store_id=store_id).first()

    if not sub:
        return {
            "status": "none",
            "plan": None,
            "message": "No subscription found.",
            "can_access": False,
        }

    now = datetime.now(timezone.utc)
    can_access = check_subscription_active(store_id)

    days_remaining = None
    if sub.status == "trial" and sub.trial_ends_at:
        days_remaining = max(0, (_aware(sub.trial_ends_at) - now).days)
    elif sub.status == "active" and sub.current_period_end:
        days_remaining = max(0, (_aware(sub.current_period_end) - now).days)

    return {
        "status": sub.status,
        "plan": sub.plan,
        "can_access": can_access,
        "days_remaining": days_remaining,
        "trial_ends_at": sub.trial_ends_at.isoformat() if sub.trial_ends_at else None,
        "current_period_end": sub.current_period_end.isoformat() if sub.current_period_end else None,
        "stripe_customer_id": sub.stripe_customer_id,
    }


def activate_subscription(
    store_id: int,
    stripe_customer_id: str,
    stripe_subscription_id: str,
    period_end: datetime,
) -> Subscription:
    """Called by Stripe webhook when payment succeeds."""
    sub = Subscription.query.filter_by(store_id=store_id).first()
    if not sub:
        sub = Subscription(store_id=store_id, plan="basic")
        db.session.add(sub)

    sub.status = "active"
    sub.stripe_customer_id = stripe_customer_id
    sub.stripe_subscription_id = stripe_subscription_id
    sub.current_period_start = datetime.now(timezone.utc)
    sub.current_period_end = period_end
    db.session.commit()
    return sub


def expire_subscription(store_id: int) -> Subscription:
    """Called by Stripe webhook when payment fails or subscription ends."""
    sub = Subscription.query.filter_by(store_id=store_id).first()
    if sub:
        sub.status = "expired"
        db.session.commit()
    return sub


def cancel_subscription(store_id: int, reason: str = None) -> Subscription:
    """Mark subscription to cancel at the end of the current period."""
    sub = Subscription.query.filter_by(store_id=store_id).first()
    if not sub:
        return None
    sub.cancel_at_period_end = True
    sub.cancelled_reason = reason or None
    db.session.commit()
    return sub


def reactivate_subscription(store_id: int) -> Subscription:
    """Remove a scheduled cancellation."""
    sub = Subscription.query.filter_by(store_id=store_id).first()
    if not sub:
        return None
    sub.cancel_at_period_end = False
    sub.cancelled_reason = None
    db.session.commit()
    return sub


def extend_trial(store_id: int, days: int) -> Subscription:
    """Extend or restore a trial by N days (superadmin use)."""
    sub = Subscription.query.filter_by(store_id=store_id).first()
    if not sub:
        return None
    now = datetime.now(timezone.utc)
    if sub.status == "trial" and sub.trial_ends_at:
        sub.trial_ends_at = _aware(sub.trial_ends_at) + timedelta(days=days)
    else:
        sub.status = "trial"
        sub.trial_ends_at = now + timedelta(days=days)
    db.session.commit()
    return sub


def get_all_subscriptions(include_cancelled: bool = False) -> list:
    """Return all subscriptions joined with their store, for the superadmin view."""
    from app.models.store import Store
    q = (
        db.session.query(Subscription, Store)
        .join(Store, Store.store_id == Subscription.store_id)
    )
    if not include_cancelled:
        q = q.filter(Subscription.status != "cancelled")
    return q.order_by(Subscription.created_at.desc()).all()
