"""Scan Marshmallow schemas — validation + serialization."""

from marshmallow import Schema, fields, validate


class ScanRequestSchema(Schema):
    """Validates POST /api/scan request body."""

    shift_id = fields.Int(required=True)
    barcode = fields.Str(required=True, validate=validate.Length(min=4, max=100))
    scan_type = fields.Str(
        required=True,
        validate=validate.OneOf(["open", "close"]),
    )
    force_sold = fields.Boolean(required=False, allow_none=True, load_default=None)


def serialize_scan(scan) -> dict:
    return {
        "scan_type": scan.scan_type,
        "start_at_scan": scan.start_at_scan,
        "is_last_ticket": scan.is_last_ticket,
        "scan_source": scan.scan_source,
        "scanned_at": scan.scanned_at.isoformat() + "Z",
    }