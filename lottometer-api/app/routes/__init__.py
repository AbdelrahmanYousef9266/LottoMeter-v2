"""Route blueprints."""

from app.routes.auth import auth_bp
from app.routes.store import store_bp
from app.routes.slot import slot_bp


def register_blueprints(app):
    """Wire all blueprints to the Flask app."""
    app.register_blueprint(auth_bp)
    app.register_blueprint(store_bp)
    app.register_blueprint(slot_bp)