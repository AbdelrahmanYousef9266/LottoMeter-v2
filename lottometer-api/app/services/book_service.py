"""Book service — assign-to-slot, reassign, unassign workflows."""

from decimal import Decimal
from datetime import datetime, timezone

from app.extensions import db
from app.models.slot import Slot
from app.models.book import Book
from app.models.book_assignment_history import BookAssignmentHistory
from app.constants import LENGTH_BY_PRICE, ALLOWED_TICKET_PRICES
from app.errors import (
    NotFoundError,
    ValidationError,
    ConflictError,
    BusinessRuleError,
)


# ---------- Barcode parsing ----------

def parse_barcode(barcode: str) -> tuple[str, int]:
    """Split a barcode into (static_code, position).

    static_code = barcode minus the last 3 digits.
    position    = last 3 digits as integer.
    """
    if len(barcode) < 4:
        raise ValidationError(
            "Barcode is too short — must be at least 4 characters.",
            code="INVALID_BARCODE",
        )
    static_code = barcode[:-3]
    pos_str = barcode[-3:]
    if not pos_str.isdigit():
        raise ValidationError(
            "Barcode position (last 3 digits) must be numeric.",
            code="INVALID_BARCODE",
        )
    return static_code, int(pos_str)


# ---------- Lookups ----------

def list_books(store_id: int, is_active=None, is_sold=None, returned=None) -> list[Book]:
    q = Book.query.filter_by(store_id=store_id)
    if is_active is not None:
        q = q.filter(Book.is_active == is_active)
    if is_sold is not None:
        q = q.filter(Book.is_sold == is_sold)
    if returned is True:
        q = q.filter(Book.returned_at.isnot(None))
    elif returned is False:
        q = q.filter(Book.returned_at.is_(None))
    return q.order_by(Book.book_id).all()


def get_book(store_id: int, book_id: int) -> Book:
    book = Book.query.filter_by(book_id=book_id, store_id=store_id).first()
    if book is None:
        raise NotFoundError("Book not found.", code="BOOK_NOT_FOUND")
    return book


# ---------- Slot assignment (scan-to-assign) ----------

def assign_book_to_slot(
    store_id: int,
    slot_id: int,
    user_id: int,
    barcode: str,
    book_name: str | None,
    ticket_price_override: str | None,
    confirm_reassign: bool,
) -> tuple[Book, Slot]:
    """Assign a book to a slot via scanned barcode.

    Logic per SRS §5.5:
    1. Parse barcode → static_code + start_position
    2. Find target slot (must exist, not soft-deleted, in this store)
    3. Determine ticket_price (override or slot default)
    4. Validate start_position < LENGTH_BY_PRICE[ticket_price]
    5. If a book with this static_code already exists active elsewhere:
       - Require confirm_reassign=True, else 409
       - Unassign from old slot (log history)
    6. If book exists but inactive: reactivate
    7. If book doesn't exist: create new
    8. Set slot, ticket_price, start_position, is_active
    9. Log BookAssignmentHistory row
    """
    slot = (
        Slot.query
        .filter_by(slot_id=slot_id, store_id=store_id)
        .first()
    )
    if slot is None:
        raise NotFoundError("Slot not found.", code="SLOT_NOT_FOUND")
    if slot.deleted_at is not None:
        raise BusinessRuleError(
            "Slot has been soft-deleted.",
            code="SLOT_SOFT_DELETED",
        )

    # Determine ticket_price for this assignment
    price = (
        Decimal(ticket_price_override)
        if ticket_price_override
        else slot.ticket_price
    )
    if price not in ALLOWED_TICKET_PRICES:
        raise ValidationError(
            "Invalid ticket_price.",
            code="INVALID_PRICE",
        )

    static_code, start_position = parse_barcode(barcode)

    # Validate position
    book_length = LENGTH_BY_PRICE[price]
    if not (0 <= start_position < book_length):
        raise ValidationError(
            f"Position {start_position} is out of range for ${price} books "
            f"(must be 0..{book_length - 1}).",
            code="INVALID_POSITION",
        )

    # Look for an existing book by static_code in this store
    existing = (
        Book.query
        .filter_by(store_id=store_id, static_code=static_code)
        .first()
    )

    target_book: Book

    if existing is not None and existing.is_active:
        # Reassignment scenario
        if existing.slot_id == slot_id:
            # Same slot rescan — treat as update of position/price
            existing.barcode = barcode
            existing.start_position = start_position
            existing.ticket_price = price
            target_book = existing
        else:
            if not confirm_reassign:
                raise ConflictError(
                    "Book is already active in another slot. "
                    "Re-send with confirm_reassign=true to move it.",
                    code="REASSIGN_CONFIRMATION_REQUIRED",
                )
            # Close history on old slot
            old_history = (
                BookAssignmentHistory.query
                .filter_by(book_id=existing.book_id, unassigned_at=None)
                .order_by(BookAssignmentHistory.assigned_at.desc())
                .first()
            )
            if old_history is not None:
                old_history.unassigned_at = datetime.now(timezone.utc)
                old_history.unassigned_by_user_id = user_id
                old_history.unassign_reason = "reassigned"

            existing.barcode = barcode
            existing.static_code = static_code
            existing.start_position = start_position
            existing.ticket_price = price
            existing.slot_id = slot_id
            existing.is_active = True
            existing.book_name = book_name if book_name is not None else existing.book_name
            target_book = existing

    elif existing is not None and not existing.is_active:
        # Book row exists from a previous assignment — reactivate
        if existing.is_sold:
            raise BusinessRuleError(
                "This book has been fully sold and cannot be reused.",
                code="BOOK_ALREADY_SOLD",
            )
        if existing.returned_at is not None:
            raise BusinessRuleError(
                "This book was returned to vendor and cannot be reused.",
                code="BOOK_RETURNED",
            )
        existing.barcode = barcode
        existing.static_code = static_code
        existing.start_position = start_position
        existing.ticket_price = price
        existing.slot_id = slot_id
        existing.is_active = True
        existing.book_name = book_name if book_name is not None else existing.book_name
        target_book = existing

    else:
        # Brand new book
        target_book = Book(
            store_id=store_id,
            book_name=book_name,
            barcode=barcode,
            static_code=static_code,
            start_position=start_position,
            ticket_price=price,
            slot_id=slot_id,
            is_active=True,
            is_sold=False,
        )
        db.session.add(target_book)
        db.session.flush()  # populates book_id

    # Log assignment history (always — new and reassignments alike)
    history = BookAssignmentHistory(
        book_id=target_book.book_id,
        slot_id=slot_id,
        ticket_price=price,
        assigned_by_user_id=user_id,
        store_id=store_id,
    )
    db.session.add(history)

    db.session.commit()
    return target_book, slot


def find_next_empty_slot(store_id: int) -> Slot | None:
    """Find the next non-deleted slot with no active book."""
    slots = (
        Slot.query
        .filter_by(store_id=store_id, deleted_at=None)
        .order_by(Slot.slot_id)
        .all()
    )
    for s in slots:
        active_book = (
            Book.query
            .filter_by(store_id=store_id, slot_id=s.slot_id, is_active=True)
            .first()
        )
        if active_book is None:
            return s
    return None


def get_assignment_history(book: Book) -> list[BookAssignmentHistory]:
    return (
        BookAssignmentHistory.query
        .filter_by(book_id=book.book_id)
        .order_by(BookAssignmentHistory.assigned_at.desc())
        .all()
    )


# ---------- Unassign ----------

def unassign_book(store_id: int, book_id: int, user_id: int) -> Book:
    """Admin-only: unassign a book from its slot. Preserves Book row."""
    book = get_book(store_id, book_id)

    if not book.is_active:
        raise BusinessRuleError(
            "Book is not currently active in any slot.",
            code="BOOK_ALREADY_INACTIVE",
        )

    # TODO: Once ShiftBooks exists, block if book has open scan in current open sub-shift
    # (FR-BOOK-07). For now we allow.

    book.slot_id = None
    book.is_active = False

    history = (
        BookAssignmentHistory.query
        .filter_by(book_id=book_id, unassigned_at=None)
        .order_by(BookAssignmentHistory.assigned_at.desc())
        .first()
    )
    if history is not None:
        history.unassigned_at = datetime.now(timezone.utc)
        history.unassigned_by_user_id = user_id
        history.unassign_reason = "unassigned"

    db.session.commit()
    return book

def return_to_vendor(
    store_id: int,
    book_id: int,
    user_id: int,
    barcode: str,
    pin: str,
) -> tuple[Book, int, bool]:
    """Return a book to the lottery vendor (PIN-authorized).

    Returns: (book, position, close_scan_recorded)

    Per SRS §5.15:
    - Verify PIN (rate-limited)
    - Verify barcode's static_code matches the book
    - Validate position
    - If a sub-shift is open and book has an open scan in it, create a close
      ShiftBooks row with scan_source='returned_to_vendor' (preserves revenue)
    - Unassign + mark returned + log history
    """
    from app.services import auth_service
    from app.models.shift_details import ShiftDetails
    from app.models.shift_books import ShiftBooks

    auth_service.verify_store_pin(store_id, user_id, pin)

    book = get_book(store_id, book_id)
    static_code, position = parse_barcode(barcode)

    if book.static_code != static_code:
        raise ValidationError(
            "Scanned barcode does not match this book.",
            code="BARCODE_MISMATCH",
        )
    if not book.is_active:
        raise BusinessRuleError("Book is not currently active.", code="BOOK_NOT_ACTIVE")
    if book.is_sold:
        raise BusinessRuleError("Book is already marked sold.", code="BOOK_ALREADY_SOLD")

    book_length = LENGTH_BY_PRICE[book.ticket_price]
    if not (0 <= position < book_length):
        raise ValidationError(
            f"Position {position} is out of range (0..{book_length - 1}).",
            code="INVALID_POSITION",
        )

    close_scan_recorded = False

    # If there is an open sub-shift with an open scan for this book, record close
    open_main = (
        ShiftDetails.query
        .filter_by(
            store_id=store_id,
            main_shift_id=None,
            is_shift_open=True,
            voided=False,
        )
        .first()
    )
    if open_main is not None:
        open_sub = (
            ShiftDetails.query
            .filter_by(main_shift_id=open_main.shift_id, is_shift_open=True)
            .order_by(ShiftDetails.shift_number.desc())
            .first()
        )
        if open_sub is not None:
            open_scan = (
                ShiftBooks.query
                .filter_by(
                    shift_id=open_sub.shift_id, static_code=book.static_code, scan_type="open"
                )
                .first()
            )
            if open_scan is not None:
                if position < open_scan.start_at_scan:
                    raise ValidationError(
                        f"Return position ({position}) cannot be less than the open "
                        f"scan position ({open_scan.start_at_scan}).",
                        code="POSITION_BEFORE_OPEN",
                    )

                # Overwrite if a close already exists; else insert
                existing_close = (
                    ShiftBooks.query
                    .filter_by(
                        shift_id=open_sub.shift_id, static_code=book.static_code, scan_type="close"
                    )
                    .first()
                )
                if existing_close is not None:
                    existing_close.barcode = barcode
                    existing_close.start_at_scan = position
                    existing_close.is_last_ticket = False
                    existing_close.scan_source = "returned_to_vendor"
                    existing_close.slot_id = book.slot_id
                    existing_close.scanned_at = datetime.now(timezone.utc)
                    existing_close.scanned_by_user_id = user_id
                else:
                    close_row = ShiftBooks(
                        shift_id=open_sub.shift_id,
                        static_code=book.static_code,
                        scan_type="close",
                        barcode=barcode,
                        start_at_scan=position,
                        is_last_ticket=False,
                        scan_source="returned_to_vendor",
                        slot_id=book.slot_id,
                        store_id=store_id,
                        scanned_by_user_id=user_id,
                    )
                    db.session.add(close_row)
                close_scan_recorded = True

    # Unassign + mark returned
    book.slot_id = None
    book.is_active = False
    book.returned_at = datetime.now(timezone.utc)
    book.returned_by_user_id = user_id

    history = (
        BookAssignmentHistory.query
        .filter_by(book_id=book_id, unassigned_at=None)
        .order_by(BookAssignmentHistory.assigned_at.desc())
        .first()
    )
    if history is not None:
        history.unassigned_at = datetime.now(timezone.utc)
        history.unassigned_by_user_id = user_id
        history.unassign_reason = "returned_to_vendor"

    db.session.commit()
    return book, position, close_scan_recorded