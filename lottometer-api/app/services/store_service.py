"""Store service — settings, PIN management."""

import re
import bcrypt

from app.extensions import db
from app.models.store import Store
from app.errors import NotFoundError, InvalidPin, ValidationError, AuthorizationError

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _hash_pin(pin: str) -> str:
    return bcrypt.hashpw(pin.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _check_pin(pin: str, hashed: str) -> bool:
    return bcrypt.checkpw(pin.encode("utf-8"), hashed.encode("utf-8"))


def set_store_pin(store_id: int, pin: str, confirm_pin: str) -> dict:
    """Admin-only: set (or reset) the store PIN. No current-PIN required."""
    if pin != confirm_pin:
        raise ValidationError("PINs do not match.", code="PIN_MISMATCH")
    store = Store.query.filter_by(store_id=store_id).first()
    if store is None:
        raise NotFoundError("Store not found.", code="STORE_NOT_FOUND")
    store.store_pin_hash = _hash_pin(pin)
    db.session.commit()
    return {"message": "Store PIN set successfully."}


def verify_store_pin(store_id: int, pin: str) -> None:
    """Raise InvalidPin (401) if pin does not match the stored hash."""
    store = Store.query.filter_by(store_id=store_id).first()
    if store is None:
        raise NotFoundError("Store not found.", code="STORE_NOT_FOUND")
    if not store.store_pin_hash or not _check_pin(pin, store.store_pin_hash):
        raise InvalidPin("Incorrect store PIN.")


def change_pin(store_id: int, current_pin: str, new_pin: str) -> dict:
    """Admin-only: change the store's 4-digit PIN.

    Verifies current_pin against the stored hash before updating.
    """
    store = Store.query.filter_by(store_id=store_id).first()
    if store is None:
        raise NotFoundError("Store not found.", code="STORE_NOT_FOUND")

    if store.store_pin_hash is None or not _check_pin(current_pin, store.store_pin_hash):
        raise InvalidPin("Current PIN is incorrect.")

    store.store_pin_hash = _hash_pin(new_pin)
    db.session.commit()

    return {"message": "Store PIN updated successfully."}

def update_profile(store_id: int, data: dict) -> dict:
    """Admin-only: update store profile fields.

    Accepts: store_name, owner_name, email, phone, address, city, state, zip_code.
    Explicitly never updates store_code.
    """
    store = Store.query.filter_by(store_id=store_id).first()
    if store is None:
        raise NotFoundError("Store not found.", code="STORE_NOT_FOUND")

    email = data.get("email")
    if email and not _EMAIL_RE.match(email):
        raise ValidationError("Invalid email address.", code="INVALID_EMAIL")

    ALLOWED = ("store_name", "owner_name", "email", "phone", "address", "city", "state", "zip_code")
    for field in ALLOWED:
        if field in data:
            setattr(store, field, data[field] or None)

    db.session.commit()

    return {
        "store_id":   store.store_id,
        "store_code": store.store_code,
        "store_name": store.store_name,
        "owner_name": store.owner_name,
        "email":      store.email,
        "phone":      store.phone,
        "address":    store.address,
        "city":       store.city,
        "state":      store.state,
        "zip_code":   store.zip_code,
    }


def change_scan_mode(store_id: int, scan_mode: str) -> dict:
    """Admin-only: change the store's scan mode preference.

    Validation of allowed values is done at the schema layer.
    """
    from app.constants import VALID_SCAN_MODES

    if scan_mode not in VALID_SCAN_MODES:
        # Defense in depth — schema should catch this first
        from app.errors import ValidationError
        raise ValidationError(
            f"Invalid scan_mode: {scan_mode}",
            code="INVALID_SCAN_MODE",
        )

    store = Store.query.filter_by(store_id=store_id).first()
    if store is None:
        raise NotFoundError("Store not found.", code="STORE_NOT_FOUND")

    store.scan_mode = scan_mode
    db.session.commit()

    return {
        "message": "Scan mode updated successfully.",
        "scan_mode": store.scan_mode,
    }