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
    """Decorator: require both JWT and admin (or superadmin) role."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        verify_jwt_in_request()
        if get_jwt().get("role") not in ("admin", "superadmin"):
            raise AuthorizationError(
                "Admin role required for this action.",
                code="ADMIN_REQUIRED",
            )
        return fn(*args, **kwargs)

    return wrapper


def superadmin_required(fn):
    """Decorator: require both JWT and superadmin role."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        verify_jwt_in_request()
        if get_jwt().get("role") != "superadmin":
            raise AuthorizationError(
                "Superadmin role required for this action.",
                code="SUPERADMIN_REQUIRED",
            )
        return fn(*args, **kwargs)

    return wrapper


def blocks_impersonation(fn):
    """Decorator: block destructive mutations during superadmin impersonation sessions.

    Apply to any route that makes permanent changes a debugging superadmin should
    not be able to make on behalf of the real store owner:
      - User creation / deletion
      - Password changes
      - Store PIN changes

    The impersonation JWT carries is_impersonation=True in its additional claims.
    All other store-scoped reads and non-destructive writes are allowed — the point
    of impersonation is to see what the owner sees, not to be fully read-only.
    """
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if get_jwt().get("is_impersonation"):
            from flask import jsonify as _jsonify
            return _jsonify({
                "error": {
                    "code":    "BLOCKED_DURING_IMPERSONATION",
                    "message": "This action is not allowed during an impersonation session.",
                }
            }), 403
        return fn(*args, **kwargs)

    return wrapper