"""Marshmallow schemas for public-facing form endpoints."""

from marshmallow import Schema, fields, validate

# Accepts international formats: +1 (555) 000-0000, 07911123456, etc.
_PHONE_RE = r"^\+?[\d\s\-\(\)]{7,20}$"
_PHONE_MSG = "Phone must be 7-20 characters containing only digits, spaces, +, -, ( and )."


class PublicContactSchema(Schema):
    """Validates POST /api/contact and POST /api/apply."""

    full_name = fields.Str(
        required=True,
        validate=validate.Length(min=1, max=150),
    )
    email = fields.Email(required=True)
    business_name = fields.Str(
        load_default=None, allow_none=True,
        validate=validate.Length(max=150),
    )
    phone = fields.Str(
        load_default=None, allow_none=True,
        validate=validate.Regexp(_PHONE_RE, error=_PHONE_MSG),
    )
    city = fields.Str(
        load_default=None, allow_none=True,
        validate=validate.Length(max=100),
    )
    num_employees = fields.Str(
        load_default=None, allow_none=True,
        validate=validate.Length(max=50),
    )
    how_heard = fields.Str(
        load_default=None, allow_none=True,
        validate=validate.Length(max=200),
    )
    message = fields.Str(
        load_default=None, allow_none=True,
        validate=validate.Length(max=2000),
    )


class PublicWaitlistSchema(Schema):
    """Validates POST /api/waitlist."""

    name = fields.Str(
        required=True,
        validate=validate.Length(min=1, max=150),
    )
    email = fields.Email(required=True)
    store_name = fields.Str(
        load_default=None, allow_none=True,
        validate=validate.Length(max=150),
    )
    phone = fields.Str(
        load_default=None, allow_none=True,
        validate=validate.Regexp(_PHONE_RE, error=_PHONE_MSG),
    )
