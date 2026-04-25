"""Whole-book-sale routes — /api/shifts/{id}/whole-book-sale."""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from marshmallow import ValidationError as MarshmallowValidationError

from app.schemas.extra_sales_schema import (
    WholeBookSaleSchema,
    serialize_extra_sale,
)
from app.services import extra_sales_service
from app.errors import ValidationError
from app.auth_helpers import current_store_id, current_user_id
from app.models.user import User


extra_sales_bp = Blueprint("extra_sales", __name__, url_prefix="/api/shifts")


@extra_sales_bp.route("/<int:subshift_id>/whole-book-sale", methods=["POST"])
@jwt_required()
def whole_book_sale(subshift_id):
    """PIN-protected: record a whole-book sale on the given open sub-shift."""
    try:
        data = WholeBookSaleSchema().load(request.get_json() or {})
    except MarshmallowValidationError as err:
        raise ValidationError("Invalid request body.", details=err.messages)

    sale = extra_sales_service.create_whole_book_sale(
        store_id=current_store_id(),
        user_id=current_user_id(),
        subshift_id=subshift_id,
        barcode=data["barcode"],
        ticket_price=data["ticket_price"],
        pin=data["pin"],
        note=data.get("note"),
    )

    user = User.query.filter_by(user_id=sale.created_by_user_id).first()
    return jsonify({
        "extra_sale": serialize_extra_sale(
            sale, created_by_username=user.username if user else None
        ),
    }), 201