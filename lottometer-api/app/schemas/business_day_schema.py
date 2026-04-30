"""BusinessDay Marshmallow schema — serialization only (no input validation needed)."""

from marshmallow import Schema, fields


class BusinessDaySchema(Schema):
    id            = fields.Int()
    store_id      = fields.Int()
    business_date = fields.Date(format="iso")
    opened_at     = fields.DateTime(format="iso")
    closed_at     = fields.DateTime(format="iso", dump_default=None, allow_none=True)
    status        = fields.Str()
    total_sales   = fields.Decimal(as_string=True, dump_default=None, allow_none=True)
    total_variance = fields.Decimal(as_string=True, dump_default=None, allow_none=True)
