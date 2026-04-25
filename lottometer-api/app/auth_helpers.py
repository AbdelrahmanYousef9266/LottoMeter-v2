"""Auth helpers — decorators and JWT claim extractors.

Use these throughout the app to enforce auth and extract the
authenticated user's identity and store scope.
"""

from functools import wraps
from flask_jwt_extended import (
    verify_jwt_in_request,
    get_jwt,
    get_jwt_identity,
)

from app.errors import AuthorizationError


# ---------- JWT claim extractors ----------

def current_user_id() -> int:
    """Return the authenticated user's user_id (int)."""
    return int(get_jwt_identity())


def current_store_id() -> int:
    """Return the authenticated user's store_id (int) from JWT claims."""
    return int(get_jwt()["store_id"])


def current_role() -> str:
    """Return the authenticated user's role from JWT claims."""
    return get_jwt()["role"]


# ---------- Role decorator ----------

def admin_required(fn):
    """Decorator: require both JWT and admin role.

    Returns 401 if no/invalid JWT, 403 if authenticated but not admin.
    """
    @wraps(fn)
    def wrapper(*args, **kwargs):
        verify_jwt_in_request()
        if get_jwt().get("role") != "admin":
            raise AuthorizationError(
                "Admin role required for this action.",
                code="ADMIN_REQUIRED",
            )
        return fn(*args, **kwargs)

    return wrapper