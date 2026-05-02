"""Auth service — setup, login, logout business logic."""

import bcrypt
from flask_jwt_extended import create_access_token

from app.extensions import db
from app.models.store import Store
from app.models.user import User
from app.errors import ConflictError, InvalidCredentials, BusinessRuleError


def _hash_password(plain: str) -> str:
    """Hash a password with bcrypt. Returns a UTF-8 string."""
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _check_password(plain: str, hashed: str) -> bool:
    """Verify a password against its bcrypt hash."""
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def _hash_pin(pin: str) -> str:
    """Hash a 4-digit store PIN with bcrypt."""
    return bcrypt.hashpw(pin.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def setup_first_store(data: dict) -> dict:
    """First-run setup. Creates store + first admin user + store PIN.

    Rejected if any store already exists (one-store-per-deployment in v2.0).
    """
    if Store.query.first() is not None:
        raise ConflictError(
            "A store has already been set up. Setup is only allowed once.",
            code="STORE_ALREADY_EXISTS",
        )

    # Create store
    store = Store(
        store_name=data["store_name"],
        store_code=data["store_code"],
        store_pin_hash=_hash_pin(data["store_pin"]),
    )
    db.session.add(store)
    db.session.flush()  # populates store.store_id without committing

    # Create first admin user
    user = User(
        username=data["admin_username"],
        password_hash=_hash_password(data["admin_password"]),
        role="admin",
        store_id=store.store_id,
    )
    db.session.add(user)

    from app.services.subscription_service import create_trial_subscription
    create_trial_subscription(store.store_id)

    db.session.commit()

    # Issue JWT
    token = create_access_token(
        identity=str(user.user_id),
        additional_claims={"role": user.role, "store_id": store.store_id},
    )

    return {
        "store": {
            "store_id": store.store_id,
            "store_name": store.store_name,
            "store_code": store.store_code,
        },
        "user": {
            "user_id": user.user_id,
            "username": user.username,
            "role": user.role,
        },
        "token": token,
    }


def login(data: dict) -> dict:
    """Authenticate by store_code + username + password. Returns JWT."""
    from flask import request as flask_request
    from app.services.audit_service import log_action

    ip = flask_request.headers.get("X-Forwarded-For", flask_request.remote_addr or "")
    ua = (flask_request.headers.get("User-Agent") or "")[:200]

    store = Store.query.filter_by(store_code=data["store_code"]).first()

    # Same error for unknown store and wrong password (don't leak existence)
    if store is None:
        log_action("login_failed", ip_address=ip, user_agent=ua,
                   new_value=f"unknown store_code={data.get('store_code')}")
        raise InvalidCredentials("Invalid credentials.")

    if store.suspended:
        raise BusinessRuleError("This store has been suspended. Please contact support.", code="STORE_SUSPENDED")

    user = User.query.filter_by(
        store_id=store.store_id, username=data["username"]
    ).first()

    if user is None or not _check_password(data["password"], user.password_hash):
        log_action("login_failed", store_id=store.store_id, ip_address=ip, user_agent=ua,
                   new_value=f"username={data.get('username')}")
        raise InvalidCredentials("Invalid credentials.")

    if user.role != "superadmin":
        from app.services.subscription_service import check_subscription_active
        if not check_subscription_active(store.store_id):
            raise BusinessRuleError(
                "Your subscription has expired. Visit lottometer.com to renew.",
                code="SUBSCRIPTION_EXPIRED",
            )

    token = create_access_token(
        identity=str(user.user_id),
        additional_claims={"role": user.role, "store_id": store.store_id},
    )

    log_action("login", user_id=user.user_id, store_id=store.store_id,
               entity_type="user", entity_id=user.user_id,
               ip_address=ip, user_agent=ua)

    return {
        "token": token,
        "user": {
            "user_id": user.user_id,
            "username": user.username,
            "role": user.role,
            "store_id": store.store_id,
        },
        "store": {
            "store_id": store.store_id,
            "store_name": store.store_name,
            "store_code": store.store_code,
            "scan_mode": store.scan_mode,
        },
    }

def verify_store_pin(store_id: int, user_id: int, pin: str) -> None:
    """Verify a store PIN, with rate limiting.

    Raises:
        RateLimitError if user is currently locked out
        InvalidPin if PIN is wrong (records failure)
        BusinessRuleError if store has no PIN configured
    """
    from app.services import pin_rate_limiter
    from app.models.store import Store
    from app.errors import BusinessRuleError, RateLimitError, InvalidPin

    # Check lockout first
    remaining = pin_rate_limiter.check_locked(user_id, store_id)
    if remaining > 0:
        raise RateLimitError(
            f"Too many failed PIN attempts. Try again in {remaining} seconds.",
            retry_after=remaining,
            code="PIN_LOCKOUT",
        )

    store = Store.query.filter_by(store_id=store_id).first()
    if store is None or store.store_pin_hash is None:
        raise BusinessRuleError(
            "Store PIN has not been configured.",
            code="PIN_NOT_CONFIGURED",
        )

    if not _check_password(pin, store.store_pin_hash):
        pin_rate_limiter.record_failure(user_id, store_id)
        raise InvalidPin("Invalid PIN.")

    # Success — clear any prior failures
    pin_rate_limiter.reset(user_id, store_id)