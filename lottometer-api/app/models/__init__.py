"""Model registry — import all models so SQLAlchemy + Alembic can see them."""

from app.models.store import Store
from app.models.user import User
from app.models.slot import Slot


__all__ = ["Store", "User", "Slot"]