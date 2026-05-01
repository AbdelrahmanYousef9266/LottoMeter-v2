from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required

from app.auth_helpers import current_store_id
from app.services.subscription_service import get_subscription_status

subscription_bp = Blueprint("subscription", __name__, url_prefix="/api")


@subscription_bp.get("/subscription")
@jwt_required()
def get_subscription():
    return jsonify(get_subscription_status(current_store_id())), 200
