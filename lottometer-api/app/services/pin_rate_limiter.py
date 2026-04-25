"""PIN rate limiter — 5 failed attempts in 10 minutes per (user, store).

In-memory implementation for v2.0 dev. Replace with Redis for production
multi-instance deployments. Per API Contract §10 PIN Rate Limiting.
"""

import time
from collections import defaultdict


_WINDOW_SECONDS = 10 * 60  # 10 minutes
_MAX_FAILURES = 5

# {(user_id, store_id): [timestamps_of_recent_failures]}
_failures: dict[tuple[int, int], list[float]] = defaultdict(list)


def _prune(key: tuple[int, int], now: float) -> list[float]:
    """Drop failures older than the rolling window."""
    cutoff = now - _WINDOW_SECONDS
    _failures[key] = [t for t in _failures[key] if t > cutoff]
    return _failures[key]


def check_locked(user_id: int, store_id: int) -> int:
    """Return seconds remaining on lockout, or 0 if not locked.

    Lockout = 5 or more failures in the last 10 minutes.
    Lockout extends 10 minutes from the most recent failure.
    """
    key = (user_id, store_id)
    now = time.time()
    fails = _prune(key, now)
    if len(fails) >= _MAX_FAILURES:
        retry_at = max(fails) + _WINDOW_SECONDS
        remaining = int(retry_at - now)
        return max(remaining, 1)
    return 0


def record_failure(user_id: int, store_id: int) -> None:
    """Record a failed PIN attempt."""
    key = (user_id, store_id)
    _failures[key].append(time.time())


def reset(user_id: int, store_id: int) -> None:
    """Clear failures (called after a successful PIN check)."""
    key = (user_id, store_id)
    if key in _failures:
        del _failures[key]