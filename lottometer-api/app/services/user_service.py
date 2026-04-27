"""User service — admin CRUD over users in the same store."""

from datetime import datetime

from app.extensions import db
from app.models.user import User
from app.errors import (
    ConflictError,
    NotFoundError,
    BusinessRuleError,
    ValidationError,
)
from app.services.auth_service import _hash_password


def list_users(store_id: int) -> list:
    """List all non-deleted users for a store, ordered by created_at."""
    return (
        User.query
        .filter_by(store_id=store_id, deleted_at=None)
        .order_by(User.created_at.asc())
        .all()
    )


def get_user(store_id: int, user_id: int) -> User:
    """Fetch one non-deleted user. Raises NotFoundError otherwise."""
    user = User.query.filter_by(
        store_id=store_id, user_id=user_id, deleted_at=None
    ).first()
    if user is None:
        raise NotFoundError("User not found.")
    return user


def create_user(store_id: int, data: dict) -> User:
    """Create a new user under a store. Raises ConflictError on username clash."""
    existing = User.query.filter_by(
        store_id=store_id,
        username=data["username"],
        deleted_at=None,
    ).first()
    if existing is not None:
        raise ConflictError(
            f"Username '{data['username']}' is already taken in this store.",
            code="USERNAME_TAKEN",
        )

    user = User(
        username=data["username"],
        password_hash=_hash_password(data["password"]),
        role=data["role"],
        store_id=store_id,
    )
    db.session.add(user)
    db.session.commit()
    return user


def update_user(
    store_id: int,
    target_user_id: int,
    actor_user_id: int,
    data: dict,
) -> User:
    """Update a user. Enforces last-admin and self-demotion rules.

    Args:
        store_id: store scope
        target_user_id: who is being edited
        actor_user_id: who is doing the editing (used for self-protection rules)
        data: validated payload (username / role / new_password)
    """
    user = get_user(store_id, target_user_id)

    # Username change → check uniqueness
    if "username" in data and data["username"] != user.username:
        clash = User.query.filter_by(
            store_id=store_id,
            username=data["username"],
            deleted_at=None,
        ).first()
        if clash is not None:
            raise ConflictError(
                f"Username '{data['username']}' is already taken in this store.",
                code="USERNAME_TAKEN",
            )
        user.username = data["username"]

    # Role change
    if "role" in data and data["role"] != user.role:
        # Block demoting the last admin
        if user.role == "admin" and data["role"] != "admin":
            other_admins = (
                User.query
                .filter(
                    User.store_id == store_id,
                    User.user_id != target_user_id,
                    User.role == "admin",
                    User.deleted_at.is_(None),
                )
                .count()
            )
            if other_admins == 0:
                raise BusinessRuleError(
                    "Cannot demote the last admin in this store.",
                    code="LAST_ADMIN",
                )
        user.role = data["role"]

    # Password reset
    if "new_password" in data:
        user.password_hash = _hash_password(data["new_password"])

    db.session.commit()
    return user


def delete_user(
    store_id: int,
    target_user_id: int,
    actor_user_id: int,
) -> None:
    """Soft-delete a user. Enforces self and last-admin protections."""
    if target_user_id == actor_user_id:
        raise BusinessRuleError(
            "You cannot delete your own account.",
            code="CANNOT_DELETE_SELF",
        )

    user = get_user(store_id, target_user_id)

    # Block deleting the last admin
    if user.role == "admin":
        other_admins = (
            User.query
            .filter(
                User.store_id == store_id,
                User.user_id != target_user_id,
                User.role == "admin",
                User.deleted_at.is_(None),
            )
            .count()
        )
        if other_admins == 0:
            raise BusinessRuleError(
                "Cannot delete the last admin in this store.",
                code="LAST_ADMIN",
            )

    user.deleted_at = datetime.utcnow()
    db.session.commit()