"""Revenue and subscription analytics for superadmin.

MRR history is derived from current subscription state (created_at / cancelled_at)
rather than period-by-period snapshots — no snapshot table exists. The figures are
an approximation: accurate for subscriptions that are still active or were cancelled
after the target month, but will undercount if a subscription was reactivated after
a cancellation.

Cache: 60-second in-memory dict (no Redis in this environment).
"""
from calendar import monthrange
from datetime import datetime, timedelta, timezone

from flask import Blueprint, jsonify
from sqlalchemy import func, or_, and_

from app.auth_helpers import superadmin_required
from app.extensions import db
from app.models.store import Store
from app.models.subscription import Subscription

revenue_bp = Blueprint("revenue", __name__, url_prefix="/api/superadmin/revenue")

_cache: dict = {}
_CACHE_TTL = 60  # seconds


def _cache_get(key):
    entry = _cache.get(key)
    if entry and (datetime.now(timezone.utc).timestamp() - entry["ts"]) < _CACHE_TTL:
        return entry["data"]
    return None


def _cache_set(key, data):
    _cache[key] = {"ts": datetime.now(timezone.utc).timestamp(), "data": data}


def _month_bounds(year, month):
    """Return (first_datetime, last_datetime) inclusive for a year/month (naive UTC)."""
    first = datetime(year, month, 1)
    last_day = monthrange(year, month)[1]
    last = datetime(year, month, last_day, 23, 59, 59)
    return first, last


@revenue_bp.route("/overview", methods=["GET"])
@superadmin_required
def revenue_overview():
    cached = _cache_get("overview")
    if cached:
        return jsonify(cached)

    # DB datetimes are naive UTC; work in naive UTC throughout
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    today = now.date()

    # ── Subscription counts by status ──────────────────────────────────────────
    status_counts = dict(
        db.session.query(Subscription.status, func.count())
        .group_by(Subscription.status)
        .all()
    )
    total = sum(status_counts.values())

    # ── MRR current ───────────────────────────────────────────────────────────
    mrr_current = float(
        db.session.query(func.sum(Subscription.plan_price))
        .filter(Subscription.status == "active")
        .scalar()
        or 0
    )

    # ── MRR trial_pending ─────────────────────────────────────────────────────
    mrr_trial_pending = float(
        db.session.query(func.sum(Subscription.plan_price))
        .filter(Subscription.status == "trial")
        .scalar()
        or 0
    )

    # ── MRR previous month (approximation) ────────────────────────────────────
    # A subscription contributed last month if it existed then AND hasn't been
    # cancelled before the start of this month.
    if today.month == 1:
        prev_year, prev_month = today.year - 1, 12
    else:
        prev_year, prev_month = today.year, today.month - 1

    _, prev_last = _month_bounds(prev_year, prev_month)
    first_of_current, _ = _month_bounds(today.year, today.month)

    mrr_previous = float(
        db.session.query(func.sum(Subscription.plan_price))
        .filter(
            Subscription.created_at <= prev_last,
            or_(
                Subscription.cancelled_at.is_(None),
                Subscription.cancelled_at >= first_of_current,
            ),
        )
        .scalar()
        or 0
    )

    growth_pct = None
    if mrr_previous > 0:
        growth_pct = round((mrr_current - mrr_previous) / mrr_previous * 100, 1)

    # ── Trials expiring ───────────────────────────────────────────────────────
    in_7d = now + timedelta(days=7)
    in_30d = now + timedelta(days=30)

    trials_7d_rows = (
        db.session.query(Subscription, Store)
        .join(Store, Subscription.store_id == Store.store_id)
        .filter(
            Subscription.status == "trial",
            Subscription.trial_ends_at.isnot(None),
            Subscription.trial_ends_at >= now,
            Subscription.trial_ends_at <= in_7d,
        )
        .order_by(Subscription.trial_ends_at.asc())
        .all()
    )
    trials_7d = [
        {
            "store_id": s.store_id,
            "store_code": st.store_code,
            "store_name": st.store_name,
            "trial_ends_at": s.trial_ends_at.isoformat() + "Z",
            "plan": s.plan,
            "plan_price": float(s.plan_price or 0),
        }
        for s, st in trials_7d_rows
    ]

    trials_30d_count = int(
        db.session.query(func.count(Subscription.id))
        .filter(
            Subscription.status == "trial",
            Subscription.trial_ends_at.isnot(None),
            Subscription.trial_ends_at >= now,
            Subscription.trial_ends_at <= in_30d,
        )
        .scalar()
        or 0
    )

    # ── Recent signups (last 10 by subscription created_at) ───────────────────
    recent_rows = (
        db.session.query(Subscription, Store)
        .join(Store, Subscription.store_id == Store.store_id)
        .order_by(Subscription.created_at.desc())
        .limit(10)
        .all()
    )
    recent_signups = [
        {
            "store_id": s.store_id,
            "store_code": st.store_code,
            "store_name": st.store_name,
            "plan": s.plan,
            "status": s.status,
            "plan_price": float(s.plan_price or 0),
            "created_at": s.created_at.isoformat() + "Z",
        }
        for s, st in recent_rows
    ]

    # ── Churn ─────────────────────────────────────────────────────────────────
    if today.month == 1:
        first_of_prev_month = datetime(today.year - 1, 12, 1)
    else:
        first_of_prev_month = datetime(today.year, today.month - 1, 1)

    churn_this = int(
        db.session.query(func.count(Subscription.id))
        .filter(
            Subscription.cancelled_at.isnot(None),
            Subscription.cancelled_at >= first_of_current,
            Subscription.cancelled_at <= now,
        )
        .scalar()
        or 0
    )

    churn_last = int(
        db.session.query(func.count(Subscription.id))
        .filter(
            Subscription.cancelled_at.isnot(None),
            Subscription.cancelled_at >= first_of_prev_month,
            Subscription.cancelled_at < first_of_current,
        )
        .scalar()
        or 0
    )

    reasons_rows = (
        db.session.query(Subscription.cancelled_reason, func.count())
        .filter(
            Subscription.cancelled_at.isnot(None),
            Subscription.cancelled_at >= first_of_prev_month,
        )
        .group_by(Subscription.cancelled_reason)
        .all()
    )
    churn_reasons = [
        {"reason": r or "Unspecified", "count": c} for r, c in reasons_rows
    ]

    # ── MRR history (last 12 months, approximated) ────────────────────────────
    # For month M: sum plan_price of subscriptions created on or before last_day(M)
    # that were not cancelled before last_day(M).
    # Oldest month first so the chart renders left-to-right chronologically.
    mrr_history = []
    for months_ago in range(11, -1, -1):
        target_month = today.month - months_ago
        target_year = today.year
        while target_month <= 0:
            target_month += 12
            target_year -= 1

        _, month_last = _month_bounds(target_year, target_month)

        hist_mrr = (
            db.session.query(func.sum(Subscription.plan_price))
            .filter(
                Subscription.created_at <= month_last,
                or_(
                    Subscription.cancelled_at.is_(None),
                    Subscription.cancelled_at > month_last,
                ),
            )
            .scalar()
        )
        mrr_history.append(
            {"month": f"{target_year}-{target_month:02d}", "mrr": float(hist_mrr or 0)}
        )

    payload = {
        "mrr": {
            "current": mrr_current,
            "trial_pending": mrr_trial_pending,
            "previous_month": mrr_previous,
            "growth_pct": growth_pct,
        },
        "subscriptions": {
            "active": status_counts.get("active", 0),
            "trial": status_counts.get("trial", 0),
            "expired": status_counts.get("expired", 0),
            "suspended": status_counts.get("suspended", 0),
            "cancelled": status_counts.get("cancelled", 0),
            "total": total,
        },
        "trials": {
            "expiring_within_7_days": trials_7d,
            "expiring_within_30_days_count": trials_30d_count,
        },
        "recent_signups": recent_signups,
        "churn": {
            "this_month_count": churn_this,
            "last_month_count": churn_last,
            "reasons": churn_reasons,
        },
        "mrr_history": mrr_history,
    }

    _cache_set("overview", payload)
    return jsonify(payload)
