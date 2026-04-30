"""BusinessDay service — auto-management of the store's daily work container."""

from datetime import datetime, timezone, date
from decimal import Decimal
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models.business_day import BusinessDay
from app.models.employee_shift import EmployeeShift
from app.errors import NotFoundError, BusinessRuleError


# ---------- Helpers ----------

def _get_store_business_date(store_id: int) -> date:
    # Future: pull store timezone from Store.timezone and convert with pytz/zoneinfo.
    # For overnight stores, if UTC time is before 4 AM, return yesterday's date.
    return datetime.now(timezone.utc).date()


def _get_business_day(store_id: int, business_day_id: int) -> BusinessDay:
    """Internal fetch — always enforces store_id for multi-tenancy."""
    day = BusinessDay.query.filter_by(id=business_day_id, store_id=store_id).first()
    if day is None:
        raise NotFoundError("Business day not found.", code="BUSINESS_DAY_NOT_FOUND")
    return day


# ---------- Public API ----------

def get_or_create_business_day(store_id: int) -> BusinessDay:
    """Return today's BusinessDay for this store, creating it if it doesn't exist.

    Handles race conditions: if a concurrent request inserts the same row between
    our SELECT and INSERT, the unique constraint fires an IntegrityError. We catch
    it, rollback, and re-fetch the row that the other request created.
    """
    today = _get_store_business_date(store_id)

    day = BusinessDay.query.filter_by(store_id=store_id, business_date=today).first()
    if day:
        return day

    day = BusinessDay(
        store_id=store_id,
        business_date=today,
        opened_at=datetime.now(timezone.utc),
        status="open",
    )
    db.session.add(day)
    try:
        db.session.flush()
    except IntegrityError:
        db.session.rollback()
        day = BusinessDay.query.filter_by(store_id=store_id, business_date=today).first()
    return day


def get_business_day(store_id: int, business_day_id: int) -> BusinessDay:
    """Fetch a specific BusinessDay, enforcing store ownership."""
    return _get_business_day(store_id, business_day_id)


def list_business_days(store_id: int) -> list[BusinessDay]:
    """All BusinessDays for this store, newest first."""
    return (
        BusinessDay.query
        .filter_by(store_id=store_id)
        .order_by(BusinessDay.business_date.desc())
        .all()
    )


def close_business_day(
    store_id: int,
    business_day_id: int,
    admin_user_id: int,
) -> BusinessDay:
    """Admin-only: close the BusinessDay and aggregate shift totals.

    Enforces:
    - BR-BD-03: only admins may call this (enforced at the route layer)
    - BR-BD-04: all EmployeeShifts must be closed before the day can close
    """
    day = _get_business_day(store_id, business_day_id)

    if day.status != "open":
        raise BusinessRuleError(
            "Business day is already closed.",
            code="BUSINESS_DAY_ALREADY_CLOSED",
        )

    open_count = EmployeeShift.query.filter_by(
        business_day_id=business_day_id,
        store_id=store_id,
        status="open",
        voided=False,
    ).count()
    if open_count > 0:
        raise BusinessRuleError(
            f"{open_count} employee shift(s) still open. Close them before closing the business day.",
            code="OPEN_SHIFTS_REMAIN",
        )

    shifts = EmployeeShift.query.filter_by(
        business_day_id=business_day_id,
        store_id=store_id,
        voided=False,
    ).all()

    day.total_sales    = sum((s.tickets_total or Decimal("0") for s in shifts), Decimal("0"))
    day.total_variance = sum((s.difference   or Decimal("0") for s in shifts), Decimal("0"))
    day.status         = "closed"
    day.closed_at      = datetime.now(timezone.utc)

    db.session.commit()
    return day
