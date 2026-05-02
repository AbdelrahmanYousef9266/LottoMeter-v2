"""Store settings service — CRUD for per-store configuration."""

from app.extensions import db
from app.models.store_settings import StoreSettings
from app.errors import ValidationError


_UPDATABLE = {
    "timezone", "currency", "business_hours_start", "business_hours_end",
    "max_employees", "auto_close_business_day", "notify_email",
    "notify_on_variance", "notify_on_shift_close",
}


def create_default_settings(store_id: int) -> StoreSettings:
    """Create default StoreSettings for a new store. Caller must commit."""
    settings = StoreSettings(store_id=store_id)
    db.session.add(settings)
    return settings


def get_settings(store_id: int) -> StoreSettings:
    """Return StoreSettings for a store, auto-creating defaults if missing."""
    settings = StoreSettings.query.filter_by(store_id=store_id).first()
    if not settings:
        settings = create_default_settings(store_id)
        db.session.commit()
    return settings


def update_settings(store_id: int, data: dict) -> StoreSettings:
    """Update allowed fields on StoreSettings. Returns the updated row."""
    settings = get_settings(store_id)

    if "timezone" in data:
        v = str(data["timezone"]).strip()
        if not v or len(v) > 50:
            raise ValidationError("timezone must be a non-empty string up to 50 characters.")
        settings.timezone = v

    if "currency" in data:
        v = str(data["currency"]).strip().upper()
        if not v or len(v) > 10:
            raise ValidationError("currency must be a non-empty string up to 10 characters.")
        settings.currency = v

    for field in ("business_hours_start", "business_hours_end"):
        if field in data:
            v = data[field]
            if v is None:
                setattr(settings, field, None)
            else:
                v = str(v).strip()
                if len(v) > 5:
                    raise ValidationError(f"{field} must be in HH:MM format.")
                setattr(settings, field, v or None)

    if "max_employees" in data:
        v = data["max_employees"]
        if not isinstance(v, int) or v < 1:
            raise ValidationError("max_employees must be a positive integer.")
        settings.max_employees = v

    if "notify_email" in data:
        v = data["notify_email"]
        if v is None:
            settings.notify_email = None
        else:
            v = str(v).strip()
            if len(v) > 150:
                raise ValidationError("notify_email must be at most 150 characters.")
            settings.notify_email = v or None

    for field in ("auto_close_business_day", "notify_on_variance", "notify_on_shift_close"):
        if field in data:
            v = data[field]
            if not isinstance(v, bool):
                raise ValidationError(f"{field} must be a boolean.")
            setattr(settings, field, v)

    db.session.commit()
    return settings


def serialize_settings(s: StoreSettings) -> dict:
    return {
        "id":                      s.id,
        "store_id":                s.store_id,
        "timezone":                s.timezone,
        "currency":                s.currency,
        "business_hours_start":    s.business_hours_start,
        "business_hours_end":      s.business_hours_end,
        "max_employees":           s.max_employees,
        "auto_close_business_day": s.auto_close_business_day,
        "notify_email":            s.notify_email,
        "notify_on_variance":      s.notify_on_variance,
        "notify_on_shift_close":   s.notify_on_shift_close,
    }
