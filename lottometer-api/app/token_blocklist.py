"""JWT token blocklist for logout.

In-memory implementation for v2.0 dev. Replace with Redis
or DB-backed storage for production multi-instance deployments.
"""

_blocklist: set[str] = set()


def add_to_blocklist(jti: str) -> None:
    """Add a JWT's `jti` to the blocklist."""
    _blocklist.add(jti)


def is_blocked(jti: str) -> bool:
    """Return True if the given jti is on the blocklist."""
    return jti in _blocklist