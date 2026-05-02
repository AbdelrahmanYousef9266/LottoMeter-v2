"""Flask app factory."""

import os
import sentry_sdk
from flask import Flask, jsonify
from sentry_sdk.integrations.flask import FlaskIntegration

from app.config import config_by_name
from app.extensions import db, migrate, jwt, cors, limiter
from app.errors import register_error_handlers
from app.token_blocklist import is_blocked


def create_app(config_name: str = None) -> Flask:
    """Build and return a configured Flask app."""

    sentry_dsn = os.getenv("SENTRY_DSN")
    if sentry_dsn:
        sentry_sdk.init(
            dsn=sentry_dsn,
            integrations=[FlaskIntegration()],
            traces_sample_rate=0.1,
            send_default_pii=False,
            environment=os.getenv("FLASK_ENV", "development"),
            release=os.getenv("RENDER_GIT_COMMIT", "unknown")[:7] if os.getenv("RENDER_GIT_COMMIT") else None,
        )

    if config_name is None:
        config_name = os.getenv("FLASK_ENV", "development")

    app = Flask(__name__)
    app.config.from_object(config_by_name[config_name])

    if config_name == "production":
        _DEV_DEFAULTS = {"dev-secret-change-me", "jwt-dev-secret-change-me"}
        if app.config.get("SECRET_KEY") in _DEV_DEFAULTS:
            raise RuntimeError("SECRET_KEY must be set to a secure random value in production.")
        if app.config.get("JWT_SECRET_KEY") in _DEV_DEFAULTS:
            raise RuntimeError("JWT_SECRET_KEY must be set to a secure random value in production.")

    # Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    limiter.init_app(app)

    _dashboard_url = os.getenv("DASHBOARD_URL", "").strip()
    _origins = [
        "http://localhost:3000",
        "http://localhost:3001",
        "exp://localhost:8081",
        "http://localhost:19000",
        "http://localhost:19006",
    ]
    if _dashboard_url:
        _origins.append(_dashboard_url)

    cors.init_app(
        app,
        resources={r"/api/*": {"origins": _origins}},
        supports_credentials=True,
    )

    # JWT blocklist callback — checks every request's token against blocklist
    @jwt.token_in_blocklist_loader
    def check_if_token_revoked(_jwt_header, jwt_payload):
        return is_blocked(jwt_payload["jti"])

    # Import models so SQLAlchemy/Alembic can discover them
    from app import models  # noqa: F401

    # Register error handlers
    register_error_handlers(app)

    # Register blueprints
    from app.routes import register_blueprints
    register_blueprints(app)

    # Health-check endpoints
    @app.route("/")
    def index():
        return jsonify({
            "service": "LottoMeter API",
            "version": "2.0.0",
            "status": "running",
        })

    @app.route("/api/health")
    def health():
        return jsonify({"status": "healthy"})

    return app