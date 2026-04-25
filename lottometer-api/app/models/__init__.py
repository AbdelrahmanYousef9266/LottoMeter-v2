"""Model registry — import all models so SQLAlchemy + Alembic can see them."""

from app.models.store import Store


__all__ = ["Store"]