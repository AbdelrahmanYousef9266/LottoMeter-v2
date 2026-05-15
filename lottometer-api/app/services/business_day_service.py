"""BusinessDay service — auto-management of the store's daily work container."""

import uuid as uuid_lib
from datetime import datetime, timezone, date
from decimal import Decimal
from collections import defaultdict
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models.business_day import BusinessDay
from app.models.employee_shift import EmployeeShift
from app.models.shift_books import ShiftBooks
from app.models.shift_extra_sales import ShiftExtraSales
from app.models.book import Book
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
        uuid=str(uuid_lib.uuid4()),
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


def auto_close_stale_business_days(store_id: int) -> None:
    """Auto-close any business days that are still open but belong to a previous date."""
    today = _get_store_business_date(store_id)

    stale_days = BusinessDay.query.filter(
        BusinessDay.store_id == store_id,
        BusinessDay.status == 'open',
        BusinessDay.business_date < today,
    ).all()

    for day in stale_days:
        open_shifts = EmployeeShift.query.filter_by(
            business_day_id=day.id,
            store_id=store_id,
            status='open',
        ).all()

        for shift in open_shifts:
            shift.status = 'closed'
            shift.closed_at = datetime.now(timezone.utc)

        closed_shifts = EmployeeShift.query.filter_by(
            business_day_id=day.id,
            store_id=store_id,
            status='closed',
            voided=False,
        ).all()

        day.status = 'closed' if (closed_shifts and any(s.tickets_total for s in closed_shifts)) else 'auto_closed'
        day.closed_at = datetime.now(timezone.utc)
        day.total_sales = sum(float(s.tickets_total or 0) for s in closed_shifts)
        day.total_variance = sum(float(s.difference or 0) for s in closed_shifts)

    if stale_days:
        db.session.commit()
        import logging
        logging.getLogger(__name__).info(
            f'[auto-close] Closed {len(stale_days)} stale business days for store {store_id}'
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

    # Send daily report email — never let this break the close
    try:
        from app.services.email_service import send_daily_report_email
        from app.models.store_settings import StoreSettings
        from app.models.store import Store

        store = Store.query.get(store_id)
        settings = StoreSettings.query.filter_by(store_id=store_id).first()
        if store and settings:
            send_daily_report_email(store, day, shifts, settings)
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(
            f'[email] Report email failed for store {store_id}: {str(e)}'
        )

    return day


def get_ticket_breakdown_for_day(store_id: int, business_day_id: int) -> dict:
    """Aggregate tickets sold by price across all shifts in a business day.

    Combines scanned book sales (open/close scan pairs) and whole-book sales
    (ShiftExtraSales), grouped by ticket_price.
    """
    _get_business_day(store_id, business_day_id)

    shift_ids = [
        s.id for s in
        EmployeeShift.query
        .filter_by(business_day_id=business_day_id, store_id=store_id, voided=False)
        .with_entities(EmployeeShift.id)
        .all()
    ]
    if not shift_ids:
        return {"breakdown": [], "total_tickets": 0, "total_value": "0.00"}

    open_scans_q = ShiftBooks.query.filter(
        ShiftBooks.shift_id.in_(shift_ids),
        ShiftBooks.store_id == store_id,
        ShiftBooks.scan_type == "open",
    ).all()
    close_scans_q = ShiftBooks.query.filter(
        ShiftBooks.shift_id.in_(shift_ids),
        ShiftBooks.store_id == store_id,
        ShiftBooks.scan_type == "close",
    ).all()

    # Key: (shift_id, static_code) → scan row
    open_map = {(s.shift_id, s.static_code): s for s in open_scans_q}

    all_static_codes = {s.static_code for s in open_scans_q} | {s.static_code for s in close_scans_q}
    book_map = {}
    if all_static_codes:
        books = Book.query.filter(
            Book.store_id == store_id,
            Book.static_code.in_(all_static_codes),
        ).all()
        book_map = {b.static_code: b for b in books}

    scanned_totals: dict[Decimal, int] = defaultdict(int)
    for close in close_scans_q:
        open_scan = open_map.get((close.shift_id, close.static_code))
        if open_scan is None:
            continue
        book = book_map.get(close.static_code)
        if book is None or book.ticket_price is None:
            continue
        sold = close.start_at_scan - open_scan.start_at_scan
        if close.is_last_ticket:
            sold += 1
        if sold > 0:
            scanned_totals[book.ticket_price] += sold

    whole_totals: dict[Decimal, int] = defaultdict(int)
    extra_sales = ShiftExtraSales.query.filter(
        ShiftExtraSales.shift_id.in_(shift_ids),
        ShiftExtraSales.store_id == store_id,
    ).all()
    for e in extra_sales:
        whole_totals[e.ticket_price] += e.ticket_count

    # Merge both sources by price
    all_prices = set(scanned_totals) | set(whole_totals)
    breakdown = []
    total_tickets = 0
    total_value = Decimal("0.00")

    for price in sorted(all_prices):
        count = scanned_totals.get(price, 0) + whole_totals.get(price, 0)
        subtotal = (price * count).quantize(Decimal("0.01"))
        breakdown.append({
            "ticket_price": str(price.quantize(Decimal("0.01"))),
            "tickets_sold": count,
            "subtotal": str(subtotal),
        })
        total_tickets += count
        total_value += subtotal

    return {
        "breakdown": breakdown,
        "total_tickets": total_tickets,
        "total_value": str(total_value.quantize(Decimal("0.01"))),
    }
