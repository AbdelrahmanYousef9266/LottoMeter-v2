"""EmployeeShift Marshmallow schema — serialization only."""

from marshmallow import Schema, fields


class EmployeeShiftSchema(Schema):
    id              = fields.Int()
    uuid            = fields.Str(dump_default=None, allow_none=True)
    business_day_id = fields.Int()
    store_id        = fields.Int()
    employee_id     = fields.Int()
    shift_number    = fields.Int()
    opened_at       = fields.DateTime(format="iso")
    closed_at       = fields.DateTime(format="iso", dump_default=None, allow_none=True)
    status          = fields.Str()

    # Financial close fields
    cash_in_hand  = fields.Decimal(as_string=True, dump_default=None, allow_none=True)
    gross_sales   = fields.Decimal(as_string=True, dump_default=None, allow_none=True)
    cash_out      = fields.Decimal(as_string=True, dump_default=None, allow_none=True)
    cancels       = fields.Decimal(as_string=True, dump_default=None, allow_none=True)
    tickets_total = fields.Decimal(as_string=True, dump_default=None, allow_none=True)
    expected_cash = fields.Decimal(as_string=True, dump_default=None, allow_none=True)
    difference    = fields.Decimal(as_string=True, dump_default=None, allow_none=True)
    shift_status  = fields.Str(dump_default=None, allow_none=True)

    closed_by_user_id = fields.Int(dump_default=None, allow_none=True)

    # Void fields
    voided            = fields.Bool()
    voided_at         = fields.DateTime(format="iso", dump_default=None, allow_none=True)
    voided_by_user_id = fields.Int(dump_default=None, allow_none=True)
    void_reason       = fields.Str(dump_default=None, allow_none=True)
