"""Store-related Marshmallow schemas."""

from marshmallow import Schema, fields, validate


class ChangePinSchema(Schema):
    """Validates PUT /api/store/settings/pin request body."""

    current_pin = fields.Str(
        required=True,
        validate=validate.Regexp(r"^\d{4}$", error="PIN must be exactly 4 digits."),
    )
    new_pin = fields.Str(
        required=True,
        validate=validate.Regexp(r"^\d{4}$", error="PIN must be exactly 4 digits."),
    )