"""Auth-related Marshmallow schemas."""

from marshmallow import Schema, fields, validate


class SetupRequestSchema(Schema):
    """Validates POST /api/auth/setup request body."""

    store_name = fields.Str(
        required=True, validate=validate.Length(min=1, max=150)
    )
    store_code = fields.Str(
        required=True, validate=validate.Length(min=1, max=50)
    )
    admin_username = fields.Str(
        required=True, validate=validate.Length(min=1, max=100)
    )
    admin_password = fields.Str(
        required=True, validate=validate.Length(min=8, max=128)
    )
    store_pin = fields.Str(
        required=True, validate=validate.Regexp(r"^\d{4}$", error="PIN must be exactly 4 digits.")
    )
    scan_mode = fields.Str(
        required=False,
        validate=validate.OneOf(["camera_single", "camera_continuous", "hardware_scanner"]),
    )

class LoginRequestSchema(Schema):
    """Validates POST /api/auth/login request body."""

    store_code = fields.Str(required=True, validate=validate.Length(min=1, max=50))
    username   = fields.Str(required=True, validate=validate.Length(min=1, max=100))
    password   = fields.Str(required=True, validate=validate.Length(min=1, max=128))