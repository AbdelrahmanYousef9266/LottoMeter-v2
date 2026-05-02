"""Flask extensions — instantiated here, initialized in app factory."""

from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address


db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()
cors = CORS()

# No default limits — only explicitly decorated routes are rate-limited.
# storage_uri="memory://" for now; swap to Redis via RATELIMIT_STORAGE_URI env var.
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[],
    storage_uri="memory://",
)