"""Mobile sync status check and acknowledgement — /api/sync/*"""

from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required

from app.auth_helpers import current_store_id
from app.extensions import db
from app.models.store import Store

sync_status_bp = Blueprint("sync_status", __name__, url_prefix="/api/sync")


@sync_status_bp.get("/status")
@jwt_required()
def check_status():
    """Return server-side flags the mobile should act on after each sync run."""
    store = Store.query.get(current_store_id())
    return jsonify({
        "force_full_resync": bool(store.force_full_resync) if store else False,
    }), 200


@sync_status_bp.post("/ack")
@jwt_required()
def acknowledge():
    """Mobile calls this after completing a full resync to clear the flag."""
    store = Store.query.get(current_store_id())
    if store and store.force_full_resync:
        store.force_full_resync = False
        db.session.commit()
    return jsonify({"ok": True}), 200
