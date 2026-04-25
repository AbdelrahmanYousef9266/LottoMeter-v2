"""Shift service — open, list, get, close."""

from decimal import Decimal
from datetime import datetime, timezone
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models.shift_details import ShiftDetails
from app.models.book import Book
from app.models.slot import Slot
from app.models.user import User
from app.errors import (
    NotFoundError,
    ConflictError,
    BusinessRuleError,
)


# ---------- Helpers ----------

def _get_user_map(user_ids: set[int]) -> dict[int, User]:
    if not user_ids:
        return {}
    return {
        u.user_id: u
        for u in User.query.filter(User.user_id.in_(user_ids)).all()
    }


def _get_open_main_shift(store_id: int) -> ShiftDetails | None:
    return (
        ShiftDetails.query
        .filter_by(
            store_id=store_id,
            main_shift_id=None,
            is_shift_open=True,
            voided=False,
        )
        .first()
    )


def _get_subshifts_for(main_shift_id: int) -> list[ShiftDetails]:
    return (
        ShiftDetails.query
        .filter_by(main_shift_id=main_shift_id)
        .order_by(ShiftDetails.shift_number)
        .all()
    )


def _get_current_open_subshift(main_shift_id: int) -> ShiftDetails | None:
    return (
        ShiftDetails.query
        .filter_by(main_shift_id=main_shift_id, is_shift_open=True)
        .order_by(ShiftDetails.shift_number.desc())
        .first()
    )


def get_pending_scans_for_subshift(store_id: int, subshift_id: int) -> list[Book]:
    """For Sub-shift 1: all active books are pending until they have an open scan.

    Until ShiftBooks exists (Step 3), every active book is pending.
    """
    return (
        Book.query
        .filter_by(store_id=store_id, is_active=True, is_sold=False)
        .order_by(Book.book_id)
        .all()
    )


# ---------- Open ----------

def open_main_shift(store_id: int, user_id: int) -> tuple[ShiftDetails, ShiftDetails]:
    """Open a new main shift and auto-create Sub-shift 1."""
    if _get_open_main_shift(store_id) is not None:
        raise ConflictError(
            "A main shift is already open for this store.",
            code="SHIFT_ALREADY_OPEN",
        )

    main = ShiftDetails(
        store_id=store_id,
        opened_by_user_id=user_id,
        is_shift_open=True,
        main_shift_id=None,
        shift_number=1,  # main shifts get 1; sub-shift numbers are independent
    )
    db.session.add(main)
    try:
        db.session.flush()
    except IntegrityError:
        db.session.rollback()
        raise ConflictError(
            "A main shift is already open for this store.",
            code="SHIFT_ALREADY_OPEN",
        )

    sub = ShiftDetails(
        store_id=store_id,
        opened_by_user_id=user_id,
        is_shift_open=True,
        main_shift_id=main.shift_id,
        shift_number=1,
    )
    db.session.add(sub)
    db.session.commit()
    return main, sub


# ---------- List / Get ----------

def list_main_shifts(
    store_id: int,
    status: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[ShiftDetails], int]:
    q = ShiftDetails.query.filter_by(store_id=store_id, main_shift_id=None)
    if status == "open":
        q = q.filter(ShiftDetails.is_shift_open.is_(True), ShiftDetails.voided.is_(False))
    elif status == "closed":
        q = q.filter(ShiftDetails.is_shift_open.is_(False), ShiftDetails.voided.is_(False))
    elif status == "voided":
        q = q.filter(ShiftDetails.voided.is_(True))

    total = q.count()
    shifts = (
        q.order_by(ShiftDetails.shift_start_time.desc())
        .limit(limit)
        .offset(offset)
        .all()
    )
    return shifts, total


def get_main_shift(store_id: int, shift_id: int) -> ShiftDetails:
    main = (
        ShiftDetails.query
        .filter_by(shift_id=shift_id, store_id=store_id, main_shift_id=None)
        .first()
    )
    if main is None:
        raise NotFoundError("Main shift not found.", code="SHIFT_NOT_FOUND")
    return main


# ---------- Close (Step 1: only handles single-subshift case) ----------

def close_main_shift(
    store_id: int,
    main_shift_id: int,
    user_id: int,
    cash_in_hand: str,
    gross_sales: str,
    cash_out: str,
) -> ShiftDetails:
    """Close the final sub-shift AND the main shift.

    Step 1 limitation: assumes there is only one open sub-shift. Multi-subshift
    close is handled by the handover endpoint (Step 2).
    """
    main = get_main_shift(store_id, main_shift_id)

    if not main.is_shift_open:
        raise BusinessRuleError(
            "Main shift is already closed.",
            code="SHIFT_ALREADY_CLOSED",
        )

    sub = _get_current_open_subshift(main_shift_id)
    if sub is None:
        raise BusinessRuleError(
            "No open sub-shift found for this main shift.",
            code="NO_OPEN_SUBSHIFT",
        )

    # TODO Step 3: verify every active book has a close scan in this sub-shift
    # For now we skip that check.

    # Compute totals
    cash_in_hand_d = Decimal(cash_in_hand)
    gross_sales_d = Decimal(gross_sales)
    cash_out_d = Decimal(cash_out)
    # tickets_total = scanned-book values + whole-book sales + return partials
    # All zero until Step 3.
    tickets_total = Decimal("0.00")
    expected_cash = gross_sales_d + tickets_total - cash_out_d
    difference = cash_in_hand_d - expected_cash

    if difference == 0:
        status = "correct"
    elif difference > 0:
        status = "over"
    else:
        status = "short"

    now = datetime.now(timezone.utc)

    # Close sub-shift
    sub.cash_in_hand = cash_in_hand_d
    sub.gross_sales = gross_sales_d
    sub.cash_out = cash_out_d
    sub.tickets_total = tickets_total
    sub.expected_cash = expected_cash
    sub.difference = difference
    sub.shift_status = status
    sub.is_shift_open = False
    sub.shift_end_time = now
    sub.closed_by_user_id = user_id

    # Close main shift — totals = sum of non-voided sub-shifts
    all_subs = _get_subshifts_for(main_shift_id)
    valid_subs = [s for s in all_subs if not s.voided]
    main.tickets_total = sum(
        (s.tickets_total or Decimal("0.00")) for s in valid_subs
    )
    main.gross_sales = sum(
        (s.gross_sales or Decimal("0.00")) for s in valid_subs
    )
    main.cash_in_hand = sum(
        (s.cash_in_hand or Decimal("0.00")) for s in valid_subs
    )
    main.cash_out = sum(
        (s.cash_out or Decimal("0.00")) for s in valid_subs
    )
    main.expected_cash = main.gross_sales + main.tickets_total - main.cash_out
    main.difference = main.cash_in_hand - main.expected_cash
    if main.difference == 0:
        main.shift_status = "correct"
    elif main.difference > 0:
        main.shift_status = "over"
    else:
        main.shift_status = "short"
    main.is_shift_open = False
    main.shift_end_time = now
    main.closed_by_user_id = user_id

    db.session.commit()
    return main