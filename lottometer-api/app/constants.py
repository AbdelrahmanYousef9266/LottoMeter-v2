"""Business constants for LottoMeter.

These values are NOT configurable — they are fixed business rules.
"""

from decimal import Decimal


# Fixed lottery book lengths by ticket price.
# Source: SRS §5.1 Book Length by Ticket Price
LENGTH_BY_PRICE = {
    Decimal("1.00"):  150,
    Decimal("2.00"):  150,
    Decimal("3.00"):  100,
    Decimal("5.00"):   60,
    Decimal("10.00"):  30,
    Decimal("20.00"):  30,
}

# Allowed ticket prices (set of Decimal values).
ALLOWED_TICKET_PRICES = set(LENGTH_BY_PRICE.keys())


def last_position_for(ticket_price: Decimal) -> int:
    """Return the last (zero-indexed) position for a book at this price."""
    return LENGTH_BY_PRICE[ticket_price] - 1

# Allowed scan modes for Store.scan_mode
# Source: store setup workflow — admin chooses how barcodes are captured
VALID_SCAN_MODES = {
    "camera_single",       # tap to scan, scan one barcode, close camera
    "camera_continuous",   # tap once, camera stays open, scan many in a row
    "hardware_scanner",    # USB/Bluetooth scanner types into a focused input
}
DEFAULT_SCAN_MODE = "camera_single"