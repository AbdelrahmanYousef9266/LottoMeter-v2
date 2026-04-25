"""Flask app factory."""

import os
from flask import Flask, jsonify

from app.config import config_by_name
from app.extensions import db, migrate, jwt, cors
from app.errors import register_error_handlers
from app.token_blocklist import is_blocked


def create_app(config_name: str = None) -> Flask:
    """Build and return a configured Flask app."""

    if config_name is None:
        config_name = os.getenv("FLASK_ENV", "development")

    app = Flask(__name__)
    app.config.from_object(config_by_name[config_name])

    # Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    cors.init_app(app)

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