"""Store service — settings, PIN management."""

import bcrypt

from app.extensions import db
from app.models.store import Store
from app.errors import NotFoundError, InvalidPin


def _hash_pin(pin: str) -> str:
    return bcrypt.hashpw(pin.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _check_pin(pin: str, hashed: str) -> bool:
    return bcrypt.checkpw(pin.encode("utf-8"), hashed.encode("utf-8"))


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