"""Slot service — CRUD with soft-delete and store scoping."""

import re
from decimal import Decimal
from datetime import datetime, timezone
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models.slot import Slot
from app.errors import NotFoundError, ConflictError, BusinessRuleError

_SLOT_NAME_RE = re.compile(r'^\d{1,3}$')


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
    if not _SLOT_NAME_RE.match(slot_name):
        raise BusinessRuleError(
            "Slot name must be 1-3 digits only.",
            code="INVALID_SLOT_NAME",
        )
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
        if not _SLOT_NAME_RE.match(slot_name):
            raise BusinessRuleError(
                "Slot name must be 1-3 digits only.",
                code="INVALID_SLOT_NAME",
            )
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

def bulk_create_slots(
    store_id: int,
    tiers: list[dict],
    name_prefix: str = "",
) -> dict:
    """Create many slots in one transaction.

    tiers: list of {count, ticket_price} dicts.
    name_prefix: prefix for auto-generated names. Default "Slot ".

    Names continue from the highest existing slot number with the same prefix,
    so calling this twice yields non-conflicting names.

    Returns a summary dict with the count and the created slots.
    """
    import re

    # Total slots requested
    total_count = sum(int(t["count"]) for t in tiers)
    if total_count == 0:
        raise BusinessRuleError(
            "Bulk create requires at least one slot.",
            code="EMPTY_BULK_REQUEST",
        )
    if total_count > 500:
        raise BusinessRuleError(
            f"Cannot create more than 500 slots per request (requested {total_count}).",
            code="BULK_LIMIT_EXCEEDED",
        )

    # Find the highest existing slot number for this prefix in this store.
    # We look at both deleted and non-deleted slots so we don't reuse numbers.
    prefix_pattern = re.escape(name_prefix.rstrip()) + r"\s*(\d+)$"
    existing = (
        Slot.query
        .filter_by(store_id=store_id)
        .filter(Slot.slot_name.op("REGEXP")(prefix_pattern) if False else Slot.slot_name.like(f"{name_prefix}%"))
        .all()
    )
    highest = 0
    pattern = re.compile(prefix_pattern)
    for s in existing:
        m = pattern.match(s.slot_name)
        if m:
            n = int(m.group(1))
            if n > highest:
                highest = n

    # Build the list of slots to create
    created = []
    next_num = highest + 1
    for tier in tiers:
        count = int(tier["count"])
        price = Decimal(tier["ticket_price"])
        for _ in range(count):
            generated_name = f"{name_prefix}{next_num}"
            if not _SLOT_NAME_RE.match(generated_name):
                raise BusinessRuleError(
                    f"Generated slot name '{generated_name}' must be 1-3 digits only. "
                    "Reduce the count or delete unused slots first.",
                    code="INVALID_SLOT_NAME",
                )
            slot = Slot(
                store_id=store_id,
                slot_name=generated_name,
                ticket_price=price,
            )
            db.session.add(slot)
            created.append(slot)
            next_num += 1

    try:
        db.session.commit()
    except IntegrityError as err:
        db.session.rollback()
        raise ConflictError(
            "One or more slot names conflict with existing slots.",
            code="SLOT_NAME_TAKEN",
            details={"error": str(err.orig) if hasattr(err, "orig") else str(err)},
        )

    return {
        "created_count": len(created),
        "slots": created,
    }
    


def bulk_delete_slots(store_id: int, slot_ids: list[int]) -> dict:
    """Soft-delete many slots in one transaction.

    Returns a summary with deleted/skipped counts and per-slot results.
    Slots that are not found, already deleted, or have an active book are
    skipped (not deleted) — the API reports them so the UI can explain.
    """
    deleted = []
    skipped_not_found = []
    skipped_occupied = []

    # Fetch all candidate slots in one query
    slots = (
        Slot.query
        .filter(
            Slot.store_id == store_id,
            Slot.slot_id.in_(slot_ids),
            Slot.deleted_at.is_(None),
        )
        .all()
    )
    found_ids = {s.slot_id for s in slots}
    skipped_not_found = [sid for sid in slot_ids if sid not in found_ids]

    now = datetime.now(timezone.utc)
    for slot in slots:
        if _slot_has_active_book(store_id, slot.slot_id):
            skipped_occupied.append(slot.slot_id)
            continue
        slot.deleted_at = now
        deleted.append(slot.slot_id)

    db.session.commit()

    return {
        "deleted_count": len(deleted),
        "deleted_slot_ids": deleted,
        "skipped_not_found": skipped_not_found,
        "skipped_occupied": skipped_occupied,
    }
    