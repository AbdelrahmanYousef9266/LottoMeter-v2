"""Model registry — import all models so SQLAlchemy + Alembic can see them."""

from app.models.store import Store
from app.models.user import User
from app.models.slot import Slot
from app.models.book import Book
from app.models.book_assignment_history import BookAssignmentHistory
from app.models.business_day import BusinessDay
from app.models.employee_shift import EmployeeShift
from app.models.shift_books import ShiftBooks
from app.models.shift_extra_sales import ShiftExtraSales
from app.models.contact_submission import ContactSubmission


__all__ = [
    "Store",
    "User",
    "Slot",
    "Book",
    "BookAssignmentHistory",
    "BusinessDay",
    "EmployeeShift",
    "ShiftBooks",
    "ShiftExtraSales",
    "ContactSubmission",
]