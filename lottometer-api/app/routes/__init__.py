"""Route blueprints."""

from app.routes.auth import auth_bp
from app.routes.store import store_bp
from app.routes.slot import slot_bp
from app.routes.book import book_bp
from app.routes.shift import shift_bp
from app.routes.scan import scan_bp
from app.routes.extra_sales import extra_sales_bp
from app.routes.report import report_bp


def register_blueprints(app):
    """Wire all blueprints to the Flask app."""
    app.register_blueprint(auth_bp)
    app.register_blueprint(store_bp)
    app.register_blueprint(slot_bp)
    app.register_blueprint(book_bp)
    app.register_blueprint(shift_bp)
    app.register_blueprint(scan_bp)
    app.register_blueprint(extra_sales_bp)
    app.register_blueprint(report_bp)