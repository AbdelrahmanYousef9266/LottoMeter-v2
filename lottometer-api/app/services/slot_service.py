"""Slot service — CRUD with soft-delete and store scoping."""

from decimal import Decimal
from datetime import datetime, timezone
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models.slot import Slot
from app.errors import NotFoundError, ConflictError, BusinessRuleError


def list_slots(store_id: int) -> list[Slot]:
    """Return all non-deleted slots for the store."""
    return (
        Slot.query
        .filter_by(store_id=store_id, deleted_at=None)
        .order_by(Slot.slot_id)
        .all()
    )


def get_slot(store_id: int, slot_id: int) -> Slot:
    """Return a non-deleted slot by id within the store, or 404."""
    slot = (
        Slot.query
        .filter_by(slot_id=slot_id, store_id=store_id, deleted_at=None)
        .first()
    )
    if slot is None:
        raise NotFoundError("Slot not found.", code="SLOT_NOT_FOUND")
    return slot


def create_slot(store_id: int, slot_name: str, ticket_price: str) -> Slot:
    """Create a new slot."""
    slot = Slot(
        store_id=store_id,
        slot_name=slot_name,
        ticket_price=Decimal(ticket_price),
    )
    db.session.add(slot)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        raise ConflictError(
            f"A slot named '{slot_name}' already exists in this store.",
            code="SLOT_NAME_TAKEN",
        )
    return slot

def _slot_has_active_book(store_id: int, slot_id: int) -> bool:
    from app.models.book import Book
    return (
        Book.query
        .filter_by(store_id=store_id, slot_id=slot_id, is_active=True)
        .first()
        is not None
    )



def update_slot(
    store_id: int,
    slot_id: int,
    slot_name: str | None = None,
    ticket_price: str | None = None,
) -> Slot:
    """Update slot. slot_name editable anytime; ticket_price only when slot is empty."""
    slot = get_slot(store_id, slot_id)

    if slot_name is not None:
        slot.slot_name = slot_name

    if ticket_price is not None:
        if _slot_has_active_book(store_id, slot_id):
            raise BusinessRuleError(
                "Cannot change ticket_price while a book is active in this slot.",
                code="SLOT_OCCUPIED",
            )
        slot.ticket_price = Decimal(ticket_price)

    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        raise ConflictError(
            f"A slot named '{slot_name}' already exists in this store.",
            code="SLOT_NAME_TAKEN",
        )
    return slot


def soft_delete_slot(store_id: int, slot_id: int) -> None:
    """Soft-delete a slot. Only allowed when slot is empty."""
    slot = get_slot(store_id, slot_id)

    if _slot_has_active_book(store_id, slot_id):
        raise BusinessRuleError(
            "Cannot delete a slot that has an active book in it.",
            code="SLOT_OCCUPIED",
        )

    slot.deleted_at = datetime.now(timezone.utc)
    db.session.commit()