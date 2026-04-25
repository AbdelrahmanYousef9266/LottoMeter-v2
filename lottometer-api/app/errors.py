"""Error handling for LottoMeter API.

Provides:
- APIError base class — service layer raises subclasses of this
- Global error handlers — convert exceptions to standard JSON responses

Standard error shape (per API Contract §1):
{
    "error": {
        "code": "VALIDATION_ERROR",
        "message": "Human-readable message",
        "details": { ... optional ... }
    }
}
"""

from flask import jsonify
from werkzeug.exceptions import HTTPException


class APIError(Exception):
    """Base class for all API errors.

    Subclasses set the default status_code and code. Services raise these
    instead of returning error tuples — the global handler formats them.
    """

    status_code = 500
    code = "INTERNAL_ERROR"

    def __init__(self, message: str = None, details: dict = None, code: str = None):
        super().__init__(message or self.code)
        self.message = message or self.code
        self.details = details
        if code:
            self.code = code

    def to_dict(self) -> dict:
        body = {"code": self.code, "message": self.message}
        if self.details:
            body["details"] = self.details
        return {"error": body}


# ---------- 400 Bad Request ----------
class ValidationError(APIError):
    status_code = 400
    code = "VALIDATION_ERROR"


# ---------- 401 Unauthorized ----------
class AuthenticationError(APIError):
    status_code = 401
    code = "AUTHENTICATION_ERROR"


class InvalidCredentials(APIError):
    status_code = 401
    code = "INVALID_CREDENTIALS"


class InvalidPin(APIError):
    status_code = 401
    code = "INVALID_PIN"


# ---------- 403 Forbidden ----------
class AuthorizationError(APIError):
    status_code = 403
    code = "FORBIDDEN"


# ---------- 404 Not Found ----------
class NotFoundError(APIError):
    status_code = 404
    code = "NOT_FOUND"


# ---------- 409 Conflict ----------
class ConflictError(APIError):
    status_code = 409
    code = "CONFLICT"


# ---------- 422 Business Rule Violation ----------
class BusinessRuleError(APIError):
    status_code = 422
    code = "BUSINESS_RULE_VIOLATION"


# ---------- 429 Rate Limit ----------
class RateLimitError(APIError):
    status_code = 429
    code = "RATE_LIMITED"

    def __init__(self, message: str = None, retry_after: int = None, code: str = None):
        super().__init__(message=message, code=code)
        self.retry_after = retry_after


def register_error_handlers(app):
    """Wire all error handlers to the Flask app."""

    @app.errorhandler(APIError)
    def handle_api_error(err: APIError):
        response = jsonify(err.to_dict())
        response.status_code = err.status_code
        if isinstance(err, RateLimitError) and err.retry_after is not None:
            response.headers["Retry-After"] = str(err.retry_after)
        return response

    @app.errorhandler(HTTPException)
    def handle_http_error(err: HTTPException):
        body = {
            "error": {
                "code": err.name.upper().replace(" ", "_"),
                "message": err.description,
            }
        }
        return jsonify(body), err.code

    @app.errorhandler(Exception)
    def handle_unexpected_error(err: Exception):
        # Log the actual exception in real life — for now, generic message
        if app.debug:
            # Re-raise in debug so the Werkzeug debugger catches it
            raise err
        body = {
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "An unexpected error occurred.",
            }
        }
        return jsonify(body), 500