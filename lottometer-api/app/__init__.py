"""Flask app factory."""

import os
from flask import Flask, jsonify

from app.config import config_by_name
from app.extensions import db, migrate, jwt, cors
from app.errors import register_error_handlers


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