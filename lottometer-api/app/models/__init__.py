"""Model registry — import all models so SQLAlchemy + Alembic can see them."""

from app.models.store import Store
from app.models.user import User
from app.models.slot import Slot
from app.models.book import Book
from app.models.book_assignment_history import BookAssignmentHistory


__all__ = ["Store", "User", "Slot", "Book", "BookAssignmentHistory"]