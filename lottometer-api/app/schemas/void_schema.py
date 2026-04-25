"""Void Marshmallow schemas."""

from marshmallow import Schema, fields, validate


class VoidShiftSchema(Schema):
    """Validates void payload — reason required."""

    reason = fields.Str(
        required=True,
        validate=validate.Length(min=1, max=500),
    )