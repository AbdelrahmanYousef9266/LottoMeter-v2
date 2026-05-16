"""
Impersonation routes — superadmin login-as-store feature.

Security model
──────────────
POST /api/superadmin/stores/<id>/impersonate issues a REAL JWT scoped to
the target store's oldest active admin user.  The token is valid for exactly
one hour and carries additional claims:

    is_impersonation=True
    impersonator_id=<superadmin user_id>
    impersonator_username=<superadmin username>

Because the token is a real JWT for a real user record, every existing
store-scoped endpoint (/api/shifts, /api/books, etc.) works unchanged —
the impersonating superadmin truly sees what the store owner sees.

The @blocks_impersonation decorator (in auth_helpers.py) is applied to the
small set of routes that make permanent, hard-to-reverse changes (user
create/delete, password change, PIN change).  Everything else is allowed so
the debug session is useful.

No server-side session state is kept.  If the superadmin closes the browser,
the impersonation token simply expires after one hour.  The client stores the
original superadmin JWT in lm_superadmin_token so it can be restored on exit.

POST /api/impersonation/end is called with the IMPERSONATION token (role=admin),
not the superadmin token, so it must NOT use @superadmin_required.  It verifies
is_impersonation=True and logs the end event.
"""

from datetime import datetime, timezone, timedelta

from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    jwt_required,
    create_access_token,
    get_jwt,
    get_jwt_identity,
)

from app.auth_helpers import superadmin_required, current_user_id
from app.errors import NotFoundError, ValidationError
from app.models.store import Store
from app.models.user import User
from app.services.audit_service import log_action

impersonation_bp = Blueprint("impersonation", __name__)

_DURATION = timedelta(hours=1)


@impersonation_bp.post("/api/superadmin/stores/<int:store_id>/impersonate")
@jwt_required()
@superadmin_required
def start_impersonation(store_id):
    store = Store.query.get(store_id)
    if not store:
        raise NotFoundError("Store not found.")
    if store.suspended:
        raise ValidationError("Cannot impersonate a suspended store.")

    # Oldest active admin — deterministic, avoids picking a random account.
    target = (
        User.query
        .filter_by(store_id=store_id, role="admin", deleted_at=None)
        .order_by(User.created_at.asc())
        .first()
    )
    if not target:
        raise NotFoundError("No active admin user found for this store.")

    sa_id = current_user_id()
    sa_user = User.query.get(sa_id)
    sa_username = sa_user.username if sa_user else "superadmin"

    expires_at = datetime.now(timezone.utc) + _DURATION

    token = create_access_token(
        identity=str(target.user_id),
        expires_delta=_DURATION,
        additional_claims={
            "store_id":              store_id,
            "role":                  "admin",
            "impersonator_id":       sa_id,
            "impersonator_username": sa_username,
            "is_impersonation":      True,
        },
    )

    log_action(
        "superadmin_impersonation_started",
        user_id=sa_id,
        store_id=store_id,
        entity_type="user",
        entity_id=target.user_id,
        new_value=f"impersonator={sa_username} target={target.username}",
        ip_address=request.remote_addr,
        user_agent=(request.headers.get("User-Agent") or "")[:200],
    )

    return jsonify({
        "token":      token,
        "expires_at": expires_at.isoformat() + "Z",
        "store": {
            "store_id":   store.store_id,
            "store_code": store.store_code,
            "store_name": store.store_name,
        },
        "target_user": {
            "user_id":  target.user_id,
            "username": target.username,
        },
    }), 200


@impersonation_bp.post("/api/impersonation/end")
@jwt_required()
def end_impersonation():
    """Log the impersonation end.  Called with the impersonation token."""
    claims = get_jwt()
    if not claims.get("is_impersonation"):
        return jsonify({"error": {"message": "No active impersonation session."}}), 400

    imp_id  = claims.get("impersonator_id")
    store_id = claims.get("store_id")
    actor_id = int(get_jwt_identity())

    log_action(
        "superadmin_impersonation_ended",
        user_id=imp_id or actor_id,
        store_id=store_id,
        entity_type="user",
        entity_id=actor_id,
        ip_address=request.remote_addr,
        user_agent=(request.headers.get("User-Agent") or "")[:200],
    )

    return jsonify({"ok": True}), 200
