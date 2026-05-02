"""User schemas — validation for admin user CRUD."""

from marshmallow import Schema, fields, validate, validates_schema, ValidationError


VALID_ROLES = ["admin", "employee"]


class CreateUserSchema(Schema):
    username = fields.String(
        required=True,
        validate=validate.Length(min=2, max=100),
    )
    password = fields.String(
        required=True,
        validate=validate.Length(min=8, max=128),
    )
    role = fields.String(
        required=True,
        validate=validate.OneOf(VALID_ROLES),
    )


class UpdateUserSchema(Schema):
    username = fields.String(
        required=False,
        validate=validate.Length(min=2, max=100),
    )
    role = fields.String(
        required=False,
        validate=validate.OneOf(VALID_ROLES),
    )
    new_password = fields.String(
        required=False,
        validate=validate.Length(min=8, max=128),
    )

    @validates_schema
    def at_least_one_field(self, data, **kwargs):
        if not any(k in data for k in ("username", "role", "new_password")):
            raise ValidationError(
                "At least one field (username, role, or new_password) is required."
            )


def serialize_user(user) -> dict:
    """Serialize a User model to the API shape."""
    return {
        "user_id": user.user_id,
        "username": user.username,
        "role": user.role,
        "created_at": user.created_at.isoformat() + "Z" if user.created_at else None,
    }