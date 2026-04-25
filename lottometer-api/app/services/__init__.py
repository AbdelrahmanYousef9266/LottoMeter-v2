"""Service registry."""

from app.services import auth_service
from app.services import store_service
from app.services import slot_service
from app.services import book_service
from app.services import pin_rate_limiter
from app.services import shift_service


__all__ = [
    "auth_service",
    "store_service",
    "slot_service",
    "book_service",
    "pin_rate_limiter",
    "shift_service",
]