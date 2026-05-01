"""Route blueprints."""
from app.routes.auth import auth_bp
from app.routes.store import store_bp
from app.routes.slot import slot_bp
from app.routes.book import book_bp
from app.routes.business_day import business_day_bp
from app.routes.employee_shift import employee_shift_bp
from app.routes.scan import scan_bp
from app.routes.extra_sales import extra_sales_bp
from app.routes.report import report_bp
from app.routes.user import user_bp
from app.routes.dev import dev_bp
from app.routes.public import public_bp
from app.routes.superadmin import superadmin_bp


def register_blueprints(app):
    """Wire all blueprints to the Flask app."""
    app.register_blueprint(auth_bp)
    app.register_blueprint(store_bp)
    app.register_blueprint(slot_bp)
    app.register_blueprint(book_bp)
    app.register_blueprint(business_day_bp)
    app.register_blueprint(employee_shift_bp)
    app.register_blueprint(scan_bp)
    app.register_blueprint(extra_sales_bp)
    app.register_blueprint(report_bp)
    app.register_blueprint(user_bp)
    app.register_blueprint(public_bp)
    app.register_blueprint(superadmin_bp)
    if app.debug:
        app.register_blueprint(dev_bp)