# LottoMeter API — Security Reference

## 1. Roles and Permissions

Every authenticated request carries a JWT with three claims: `sub` (user_id), `store_id`, and `role`.

| Role | Description | Decorator |
|------|-------------|-----------|
| `employee` | Store staff — can open/close/void their own shifts and scan books | `@jwt_required()` |
| `admin` | Store owner/manager — full store management including users | `@admin_required` |
| `superadmin` | LottoMeter internal staff — cross-store access | `@superadmin_required` |

**Decorator behaviour:**
- `@jwt_required()` — valid, non-expired, non-revoked JWT; any role
- `@admin_required` — valid JWT **and** role is `admin` or `superadmin`; raises `403 ADMIN_REQUIRED` otherwise
- `@superadmin_required` — valid JWT **and** role is `superadmin`; raises `403 SUPERADMIN_REQUIRED` otherwise

**Unauthenticated (public) endpoints:**
- `POST /api/contact`
- `POST /api/apply`
- `POST /api/waitlist`
- `POST /api/auth/setup`
- `POST /api/auth/login`

---

## 2. Data Isolation

All store data is scoped to `store_id`. The `store_id` originates from the JWT claim, never from the request body.

**Enforcement pattern** (every authenticated data route):
```python
store_id = current_store_id()   # reads from JWT — cannot be spoofed
records = Model.query.filter_by(store_id=store_id, ...).all()
```

This means a user with a valid JWT for Store A cannot read or write any data belonging to Store B, even if they know Store B's `store_id`.

**Models with `store_id` scoping:**
`users`, `books`, `slots`, `employee_shifts`, `business_days`, `subscriptions`, `audit_logs`

**Superadmin exception:** Superadmin routes (`/api/superadmin/*`) are exempt by design — they are the cross-store management layer. All superadmin actions are audit-logged.

---

## 3. Authentication Details

- Passwords are hashed with **bcrypt** (salted, work factor from library default)
- JWTs use `HS256` with the `JWT_SECRET_KEY` env var; access tokens expire in **8 hours** (configurable via `JWT_ACCESS_TOKEN_EXPIRES_HOURS`)
- Logout adds the token's `jti` to an in-memory blocklist; all subsequent requests with that token are rejected
- Subscription check on login: after password verification, if the store's subscription is expired/suspended/cancelled, login is refused with `SUBSCRIPTION_EXPIRED` (superadmin accounts bypass this check)

---

## 4. Audit Log Events

All events are written fire-and-forget via `log_action()` — failures are silently swallowed so they never break the request path.

| Event | Triggered by | Stored fields |
|-------|-------------|---------------|
| `login` | Successful login | `user_id`, `store_id`, `ip_address`, `user_agent` |
| `login_failed` | Failed login attempt | `store_id`, `ip_address`, `user_agent`, `new_value` (reason) |
| `store_created` | Superadmin creates a store | `user_id`, `store_id`, `new_value` (store_code, admin username) |
| `store_suspended` | Superadmin suspends a store | `user_id`, `store_id` |
| `user_created` | Admin creates a user | `user_id`, `store_id`, `entity_id` (new user), `new_value` (username, role) |
| `user_deleted` | Admin soft-deletes a user | `user_id`, `store_id`, `entity_id` (deleted user) |
| `shift_opened` | Any user opens a shift | `user_id`, `store_id`, `entity_id` (shift) |
| `shift_closed` | Any user closes a shift | `user_id`, `store_id`, `entity_id` (shift) |
| `shift_voided` | Admin voids a shift | `user_id`, `store_id`, `entity_id` (shift), `new_value` (reason) |
| `book_assigned` | Book scanned into a slot | `user_id`, `store_id`, `entity_id` (book), `new_value` (slot_id, barcode) |
| `book_returned` | Book returned from a slot | `user_id`, `store_id`, `entity_id` (book), `new_value` (position) |

**Query endpoint:** `GET /api/superadmin/audit-logs` (superadmin only)
Supports filters: `?store_id=`, `?action=`, `?date_from=`, `?date_to=`. Returns up to 500 most recent entries.

---

## 5. Rate Limits

Implemented with **Flask-Limiter** (in-memory store). Key is the client IP address; behind Render's proxy the real IP is extracted from `X-Forwarded-For`.

| Endpoint | Limit |
|----------|-------|
| `POST /api/auth/login` | 5 per minute |
| `POST /api/contact` | 5 per minute |
| `POST /api/waitlist` | 5 per minute |
| `POST /api/apply` | 3 per hour |

All other endpoints have no rate limit (authenticated endpoints rely on JWT expiry and store isolation).

Exceeded limits return `429 TOO_MANY_REQUESTS` as JSON (caught by the `HTTPException` global handler).

**Note for production:** The in-memory store resets on every dyno restart. Switch to a Redis-backed store (`RATELIMIT_STORAGE_URI=redis://...`) if you run multiple dynos or need persistent rate-limit counters.

---

## 6. Spam Protection (Public Forms)

In addition to rate limiting, all three public POST endpoints (`/contact`, `/apply`, `/waitlist`) implement a **honeypot check**: if the request JSON contains a `website` field (a hidden field that real users never fill), the request is silently accepted with a 200 response but nothing is written to the database.

---

## 7. Error Handling

All errors are returned as JSON in the standard shape:
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description",
    "details": {}
  }
}
```

Unhandled 500 errors also include an `error_id` (UUID) in the response, and the full traceback is logged to `app.logger` (visible in Render logs / Sentry).

---

## 8. Production Checklist

Before going live, verify each item:

- [ ] `SECRET_KEY` set to a cryptographically random value (e.g. `python -c "import secrets; print(secrets.token_hex(32))"`)
- [ ] `JWT_SECRET_KEY` set to a different cryptographically random value
- [ ] `DATABASE_URL` points to the production PostgreSQL database
- [ ] `FLASK_ENV=production` set in the deployment environment
- [ ] `SENTRY_DSN` set for error tracking in production
- [ ] `DASHBOARD_URL` set to the production dashboard origin (for CORS)
- [ ] All database migrations applied: `flask db upgrade`
- [ ] Superadmin account created via `scripts/create_superadmin.py`
- [ ] Dev routes (`/api/dev/*`) are inaccessible — they are gated behind `app.debug` which is `False` in `ProductionConfig`
- [ ] `VITE_SUPERADMIN_STORE_CODE` set in dashboard deployment environment
- [ ] Rate limiter storage upgraded to Redis if running more than one web worker

---

## 9. Backup Policy

**Recommended minimum for production:**

| Asset | Frequency | Retention | Method |
|-------|-----------|-----------|--------|
| PostgreSQL database | Daily | 30 days | Render automated backups (Pro plan) or `pg_dump` via cron |
| `.env` secrets | On change | Indefinitely | Store in a secrets manager (e.g. 1Password, Doppler, AWS Secrets Manager) — never commit to git |
| Audit logs | Continuous | 1 year minimum | Retained in the database; export to cold storage monthly if needed |

**Recovery test:** Restore the latest backup to a staging database at least once per quarter to confirm the backup is valid.

---

## 10. Future Security Improvements

| Priority | Item |
|----------|------|
| High | Switch rate-limiter storage from in-memory to Redis for multi-worker deployments |
| High | Add `Retry-After` header to Flask-Limiter 429 responses |
| High | Rotate JWT secret key rotation procedure (invalidates all active sessions — communicate to users) |
| Medium | Add HTTPS-only (`Strict-Transport-Security`) and other security headers (via `flask-talisman`) |
| Medium | Implement refresh tokens with shorter access token TTL (e.g. 1 hour access / 30 day refresh) |
| Medium | Add 2FA / TOTP for admin and superadmin accounts |
| Medium | Move audit log writes to an async queue so a DB hiccup can't slow down the request path |
| Low | Add `Content-Security-Policy` to the dashboard build |
| Low | Store rate-limit counters per user (post-login) rather than per IP to handle shared NAT accurately |
| Low | Periodic automated scan for leaked secrets (e.g. `truffleHog` in CI) |
