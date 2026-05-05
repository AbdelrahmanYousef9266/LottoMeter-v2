# API Contract — LottoMeter v2.0

**Version:** 4.0
**Date:** May 2026
**Base URL:** `/api`
**Auth:** JWT in `Authorization: Bearer <token>` header (except where noted)
**Content-Type:** `application/json`
**Dates:** ISO 8601 UTC (`2026-04-24T14:00:00Z`)
**Money:** String-encoded decimals (`"12.50"`) to avoid float precision issues
**Positions:** Integers (barcode position, always 0 to length-1)

---

## Standard Error Shape

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable message",
    "details": { "field_name": ["reason"] }
  }
}
```

### Status Codes

| Code | Meaning |
|---|---|
| 200 | OK |
| 201 | Created |
| 204 | No Content |
| 400 | Validation error |
| 401 | Missing/invalid JWT or bad PIN |
| 403 | Authenticated but not authorized (wrong role) |
| 404 | Resource not found in this store |
| 409 | Conflict (duplicate, state conflict) |
| 422 | Business rule violation |
| 429 | Rate-limit lockout |
| 500 | Server error |

### Auth Scoping

Every request (except `setup`, `login`, and public endpoints):
1. JWT decoded — `user_id`, `role`, `store_id` extracted
2. All DB queries filtered by `store_id` from JWT — never from request body or URL
3. Cross-store access attempts return 404 (don't leak existence)
4. Admin-only endpoints reject non-admin JWTs with 403
5. Superadmin endpoints require `role == 'superadmin'`; non-superadmin JWTs return 403

---

## 1. Auth

### POST /api/auth/setup
First-run only. Creates store + first admin + store PIN. Rejected (409) if any store exists.

**Request**
```json
{
  "store_name": "Lucky Mart",
  "store_code": "LM001",
  "admin_username": "admin",
  "admin_password": "securepass123",
  "store_pin": "4271",
  "scan_mode": "camera_single"
}
```

**Response 201**
```json
{
  "store": { "store_id": 1, "store_name": "Lucky Mart", "store_code": "LM001", "scan_mode": "camera_single" },
  "user": { "user_id": 1, "username": "admin", "role": "admin" },
  "token": "eyJhbGci..."
}
```

### POST /api/auth/login
**Request**
```json
{ "store_code": "LM001", "username": "admin", "password": "securepass123" }
```

**Response 200**
```json
{
  "token": "eyJhbGci...",
  "user": { "user_id": 1, "username": "admin", "role": "admin", "store_id": 1 },
  "store": { "store_id": 1, "store_name": "Lucky Mart", "scan_mode": "camera_single" },
  "expires_at": "2026-04-24T22:00:00Z"
}
```

**Errors:** 401 `INVALID_CREDENTIALS`

### POST /api/auth/logout
Adds current JWT's `jti` to the server-side blocklist until its natural expiry.

**Response 204**

### GET /api/auth/me
**Response 200**
```json
{
  "user": { "user_id": 1, "username": "admin", "role": "admin", "store_id": 1 },
  "store": { "store_id": 1, "store_name": "Lucky Mart", "scan_mode": "camera_single" }
}
```

### PUT /api/auth/change-password
JWT required. Any authenticated user may change their own password.

**Request**
```json
{
  "current_password": "oldpass123",
  "new_password": "newpass456",
  "confirm_password": "newpass456"
}
```

**Response 200**
```json
{ "message": "Password changed successfully." }
```

**Errors:** 400 `WRONG_PASSWORD`, 400 `PASSWORD_MISMATCH`, 400 `PASSWORD_TOO_SHORT` (minimum 8 characters)

---

## 2. Store Profile

### GET /api/store/profile
Any authenticated user. Returns the store's public profile fields.

**Response 200**
```json
{
  "store": {
    "store_id": 1,
    "store_name": "Lucky Mart",
    "store_code": "LM001",
    "owner_name": "John Doe",
    "email": "john@lm001.com",
    "phone": "555-1234",
    "address": "123 Main St",
    "city": "Austin",
    "state": "TX",
    "zip_code": "78701"
  }
}
```

### PUT /api/store/profile
Admin-only. Update store contact/profile fields. `store_code` is never modified by this endpoint.

**Request** (any subset)
```json
{
  "store_name": "Lucky Mart Updated",
  "owner_name": "Jane Doe",
  "email": "jane@lm001.com",
  "phone": "555-9999",
  "address": "456 Oak Ave",
  "city": "Dallas",
  "state": "TX",
  "zip_code": "75201"
}
```

**Response 200** — updated store profile object (same shape as GET)

**Errors:** 400 `INVALID_EMAIL`

---

## 3. Store Settings

### PUT /api/store/settings/pin
Admin-only. Change the store's 4-digit PIN.

**Request**
```json
{ "current_pin": "4271", "new_pin": "8352" }
```

**Response 200**
```json
{ "message": "Store PIN updated successfully." }
```

**Errors:** 401 `INVALID_PIN`, 400 `INVALID_PIN_FORMAT`

### PUT /api/store/settings/scan-mode
Admin-only. Update the store's scan mode preference.

**Request**
```json
{ "scan_mode": "camera_continuous" }
```

**Response 200**
```json
{ "scan_mode": "camera_continuous", "message": "Scan mode updated." }
```

### GET /api/store/settings
Any authenticated user. Retrieve the store's operational settings.

**Response 200**
```json
{
  "settings": {
    "id": 1,
    "store_id": 1,
    "timezone": "America/New_York",
    "currency": "USD",
    "business_hours_start": "09:00",
    "business_hours_end": "23:00",
    "max_employees": 10,
    "auto_close_business_day": false,
    "notify_email": null,
    "notify_on_variance": true,
    "notify_on_shift_close": false,
    "report_email": null,
    "report_format": "html",
    "report_delay_hours": 1.0,
    "report_enabled": true
  }
}
```

### PUT /api/store/settings
Admin-only. Update any subset of the store settings. Fields not supplied are unchanged.

**Request** (any subset)
```json
{
  "timezone": "America/Chicago",
  "business_hours_start": "08:00",
  "business_hours_end": "22:00",
  "notify_email": "owner@store.com",
  "notify_on_variance": true,
  "notify_on_shift_close": false,
  "max_employees": 5,
  "auto_close_business_day": false,
  "report_email": "owner@store.com",
  "report_format": "html",
  "report_delay_hours": 0.5,
  "report_enabled": true
}
```

**Response 200** — updated settings object (same shape as GET)

**Errors:** 400 `INVALID_EMAIL` (report_email), 400 `INVALID_REPORT_FORMAT` (must be `html` or `text`), 400 `INVALID_REPORT_DELAY` (must be 0–24)

---

## 4. Users

Admin-only endpoints. All queries scoped to JWT's `store_id`.

### GET /api/users/active
Returns compact list of all non-deleted users for dropdowns.

**Response 200**
```json
{
  "users": [
    { "user_id": 1, "username": "admin", "role": "admin" },
    { "user_id": 3, "username": "alice", "role": "employee" }
  ]
}
```

### GET /api/users
Lists all users (active and soft-deleted).

**Response 200**
```json
{
  "users": [
    { "user_id": 1, "username": "admin", "role": "admin", "created_at": "...", "deleted_at": null }
  ]
}
```

### POST /api/users
**Request**
```json
{ "username": "alice", "password": "pass1234", "role": "employee" }
```

**Response 201** — user object

**Errors:** 409 `USERNAME_TAKEN`, 400 `INVALID_ROLE`

### GET /api/users/{id}
**Response 200** — single user object

### PUT /api/users/{id}
**Request** — any subset of `username`, `password`, `role`

**Response 200** — updated user object

**Errors:** 409 `USERNAME_TAKEN`, 403 `CANNOT_EDIT_SELF_ROLE`, 404 `USER_NOT_FOUND`

### DELETE /api/users/{id}
Soft-delete. Sets `deleted_at`.

**Response 204**

**Errors:** 403 `CANNOT_DELETE_SELF`, 404 `USER_NOT_FOUND`, 422 `USER_ALREADY_DELETED`

---

## 5. Slots

### GET /api/slots
**Response 200**
```json
{
  "slots": [
    {
      "slot_id": 1,
      "slot_name": "Slot A",
      "ticket_price": "5.00",
      "current_book": {
        "book_id": 12,
        "static_code": "1234567890",
        "start_position": 0,
        "book_name": null
      }
    }
  ]
}
```

### POST /api/slots
Admin-only.

**Request**
```json
{ "slot_name": "Slot A", "ticket_price": "5.00" }
```

**Response 201** — slot object

### GET /api/slots/{id}
**Response 200** — slot object with `current_book`

### PUT /api/slots/{id}
Admin-only.

**Errors:** 422 `SLOT_OCCUPIED` (for price change), 409 `SLOT_NAME_TAKEN`

### DELETE /api/slots/{id}
Admin-only. Soft delete.

**Errors:** 422 `SLOT_OCCUPIED`

### POST /api/slots/bulk
Admin-only. Create up to 500 slots in one transaction.

**Request**
```json
{ "slots": [{ "slot_name": "Slot A", "ticket_price": "5.00" }] }
```

**Response 201**
```json
{ "created": 1, "slots": [ "...slot objects..." ] }
```

### POST /api/slots/bulk-delete
Admin-only. Soft-delete multiple slots. Entire batch rolls back if any slot is occupied.

**Request**
```json
{ "slot_ids": [1, 2, 3] }
```

**Response 200**
```json
{ "deleted": 3 }
```

---

## 6. Books

### GET /api/books
**Query params:** `is_active`, `is_sold`, `returned` (bool filters)

**Response 200**
```json
{
  "books": [
    {
      "book_id": 12,
      "book_name": null,
      "barcode": "1234567890000",
      "static_code": "1234567890",
      "start_position": 0,
      "ticket_price": "5.00",
      "book_length": 60,
      "slot_id": 1,
      "slot_name": "Slot A",
      "is_active": true,
      "is_sold": false,
      "returned_at": null
    }
  ]
}
```

### GET /api/books/{id}
**Response 200** — book object with `assignment_history` array

### GET /api/books/summary
**Response 200**
```json
{ "active": 42, "sold": 10, "returned": 5, "total": 57 }
```

### GET /api/books/activity
Admin-only. Rolling time-windowed sold/returned counts with previous-period comparison.

**Query params:** `period` = `week` | `month` | `year` | `all`

**Response 200**
```json
{
  "period": "week",
  "from": "2026-04-22T10:00:00+00:00",
  "to": "2026-04-29T10:00:00+00:00",
  "sold": 15,
  "returned": 3,
  "previous_period": { "sold": 8, "returned": 0 }
}
```

### POST /api/slots/{slot_id}/assign-book
Admin-only. Assign a book to a slot (creates Book if new).

**Request**
```json
{
  "barcode": "1234567890005",
  "book_name": null,
  "ticket_price_override": null,
  "confirm_reassign": false
}
```

**Response 201**
```json
{
  "book": { "...book object..." },
  "slot": { "...slot object..." },
  "next_empty_slot": { "slot_id": 2, "slot_name": "Slot B", "ticket_price": "10.00" }
}
```

**Errors:** 400 `INVALID_POSITION`, 409 `REASSIGN_CONFIRMATION_REQUIRED`, 400 `INVALID_PRICE`

### POST /api/books/{book_id}/unassign
Admin-only.

**Response 200** — book object with `slot_id=null, is_active=false`

### POST /api/books/{book_id}/return-to-vendor
Any authenticated user. Requires store PIN.

**Request**
```json
{ "barcode": "5555555555034", "pin": "4271" }
```

**Response 200**
```json
{ "book": { "...with returned_at set..." }, "close_scan_recorded": true, "position": 34 }
```

---

## 7. Shifts

### POST /api/shifts
Opens a new EmployeeShift. Auto-creates today's BusinessDay if needed.

**Response 201**
```json
{
  "employee_shift": { "id": 1, "uuid": "...", "business_day_id": 1, "shift_number": 1, "status": "open", "..." },
  "carried_forward_count": 0,
  "pending_scans": [{ "book_id": 12, "static_code": "1234567890", "slot_id": 1 }]
}
```

**Errors:** 409 `SHIFT_ALREADY_OPEN`

### GET /api/shifts
List all shifts for the store, ordered most-recent first.

**Query params:** `business_day_id` (int filter)

**Response 200**
```json
{
  "shifts": [
    { "id": 2, "uuid": "...", "business_day_id": 1, "shift_number": 2, "status": "closed", "shift_status": "correct", "tickets_total": "450.00", "voided": false }
  ]
}
```

### GET /api/shifts/{id}
**Response 200** — full EmployeeShift object including `uuid`

### GET /api/shifts/{id}/summary
Live-preview totals for an open shift. Used by the mobile close-shift modal.

**Response 200**
```json
{
  "tickets_total": "440.00",
  "whole_book_total": "300.00",
  "books_total_active": 5,
  "books_with_close": 3,
  "books_pending_close": 2,
  "books_pending_open": 0,
  "is_initialized": true
}
```

### PUT /api/shifts/{id}/close
**Request**
```json
{ "cash_in_hand": "512.50", "gross_sales": "380.00", "cash_out": "20.00", "cancels": "5.00" }
```

- `cancels` — optional, defaults to `"0.00"`. Voided/cancelled ticket value; subtracted from `expected_cash`.

**Shift close formula:**
```
expected_cash = gross_sales + tickets_total - cash_out - cancels
difference    = cash_in_hand - expected_cash
shift_status  = 'correct' | 'over' | 'short'
```

**Response 200** — full shift + report object

**Errors:** 422 `BOOKS_NOT_CLOSED`, 422 `SHIFT_ALREADY_CLOSED`

### POST /api/shifts/{id}/void
Admin-only.

**Request**
```json
{ "reason": "Accidentally opened during inventory." }
```

**Response 200** — voided shift object

---

## 8. Business Days

### GET /api/business-days
**Response 200** — array of BusinessDay objects

### GET /api/business-days/today
Returns today's BusinessDay (auto-creates if needed).

**Response 200** — single BusinessDay object

### GET /api/business-days/{id}
**Response 200** — BusinessDay with its `shifts` array

### POST /api/business-days/{id}/close
Admin-only. Closes the day and computes aggregate totals. Triggers daily report email (if enabled in StoreSettings).

**Response 200** — updated BusinessDay with `total_sales` and `total_variance`

**Errors:** 422 `OPEN_SHIFTS_REMAIN`, 422 `DAY_ALREADY_CLOSED`

### GET /api/business-days/{id}/ticket-breakdown
Any authenticated user. Returns tickets sold per price tier across all shifts in this BusinessDay.

**Response 200**
```json
{
  "business_day_id": 1,
  "total_tickets": 85,
  "breakdown": [
    { "ticket_price": "5.00", "tickets_sold": 50, "subtotal": "250.00" },
    { "ticket_price": "10.00", "tickets_sold": 35, "subtotal": "350.00" }
  ]
}
```

---

## 9. Scanning

### POST /api/scan
Records a ticket scan during an open EmployeeShift.

**Request**
```json
{
  "shift_id": 1,
  "barcode": "1234567890149",
  "scan_type": "open",
  "force_sold": null
}
```

- `scan_type`: `open` or `close`
- `force_sold`: `true` | `false` | `null` (auto-detect)

**Response 200**
```json
{
  "book": { "book_id": 12, "static_code": "1234567890", "ticket_price": "5.00" },
  "scan": { "scan_type": "open", "start_at_scan": 0, "is_last_ticket": false, "scan_source": "scanned", "scanned_at": "..." },
  "running_totals": { "books_scanned_open": 4, "books_scanned_close": 0 },
  "pending_scans_remaining": 2,
  "is_initialized": false
}
```

**Errors:** 404 `BOOK_NOT_FOUND`, 422 `BOOK_NOT_ACTIVE`, 422 `BOOK_ALREADY_SOLD`, 400 `INVALID_POSITION`, 400 `POSITION_BEFORE_OPEN`, 409 `OPEN_RESCAN_BLOCKED`, 422 `FORCE_SOLD_REQUIRES_CLOSE`, 422 `FORCE_SOLD_REQUIRES_LAST_POSITION`, 422 `FORCE_SOLD_REQUIRES_MOVEMENT`

---

## 10. Whole-Book Sale

### POST /api/shifts/{shift_id}/whole-book-sale
Any authenticated user. Requires store PIN.

**Request**
```json
{ "barcode": "5555555555012", "ticket_price": "5.00", "pin": "4271", "note": null }
```

**Response 201** — extra_sale object

---

## 11. Reports

### GET /api/reports/shift/{id}
Employees may only fetch reports for their own shifts; admins have unrestricted access.

**Response 200** — full shift report with `ticket_breakdown`, `books`, `whole_book_sales`, `returned_books`, and `business_day` summary.

---

## 12. Subscription

### GET /api/subscription
Any authenticated user. Returns the subscription status for the caller's store.

**Response 200**
```json
{
  "plan": "basic",
  "status": "trial",
  "trial_ends_at": "2026-06-01T00:00:00Z",
  "current_period_start": null,
  "current_period_end": null,
  "stripe_customer_id": null,
  "stripe_subscription_id": null,
  "cancel_at_period_end": false,
  "cancelled_at": null
}
```

---

## 13. Public Endpoints (no auth)

Rate-limited. Honeypot field `website` silently accepted and discarded.

### POST /api/contact
Rate: 5 per minute. Saves a `contact` submission from the marketing site contact form.

**Request**
```json
{
  "full_name": "Jane Smith",
  "email": "jane@example.com",
  "business_name": "Lucky Corner Store",
  "phone": "555-1234",
  "city": "Austin",
  "num_employees": "1-5",
  "how_heard": "google",
  "message": "I'd like to learn more."
}
```

**Response 201**
```json
{ "message": "Submission received. We will be in touch soon!" }
```

### POST /api/apply
Rate: 3 per hour. Saves an `apply` submission from the marketing site apply page.

**Request** — same shape as contact plus optional `store_count` and `current_process`

**Response 201**
```json
{ "message": "Submission received. We will be in touch soon!" }
```

### POST /api/waitlist
Rate: 5 per minute. Saves a `waitlist` signup.

**Request**
```json
{ "name": "John Doe", "email": "john@example.com", "store_name": "JD Mart", "phone": "555-5678" }
```

**Response 201**
```json
{ "message": "You are on the list! We will notify you when we launch." }
```

---

## 14. Stripe Webhook (placeholder)

### POST /api/stripe/webhook
Stripe event handler. Currently a no-op placeholder while payments are disabled. Returns 200 immediately when `PAYMENTS_ENABLED = False`.

When payments are enabled, this endpoint will:
1. Verify webhook signature via `stripe.Webhook.construct_event()`
2. Handle `checkout.session.completed` → activate subscription
3. Handle `invoice.payment_failed` → expire subscription
4. Handle `customer.subscription.deleted` → cancel subscription

**Response 200**
```json
{ "message": "OK" }
```

---

## 15. Superadmin Endpoints

All require `role == 'superadmin'` in the JWT. Cross-store. Not scoped to a single store.

### GET /api/superadmin/stats
Platform-level dashboard counts.

**Response 200**
```json
{
  "total_stores": 12,
  "active_stores": 10,
  "total_users": 47,
  "new_submissions": 3,
  "shifts_today": 8
}
```

### GET /api/superadmin/stores
List all stores with stats. Supports `?q=` for name/code search.

**Response 200**
```json
{
  "stores": [
    {
      "store_id": 1, "store_name": "Lucky Mart", "store_code": "LM001",
      "suspended": false, "is_active": true, "owner_name": "John Doe",
      "email": "john@lm001.com", "phone": "555-1234",
      "address": "123 Main St", "city": "Austin", "state": "TX", "zip_code": "78701",
      "created_by": 1, "notes": null, "created_at": "...",
      "user_count": 3, "book_count": 45, "shift_count": 120
    }
  ]
}
```

### GET /api/superadmin/stores/{store_id}
Returns store detail with users list.

**Response 200**
```json
{ "store": { "...store fields...", "users": [...] } }
```

### POST /api/superadmin/stores
Create a new store with an admin user. Also provisions a trial Subscription and default StoreSettings.

**Request**
```json
{
  "store_name": "New Mart",
  "store_code": "NM001",
  "admin_username": "admin",
  "admin_password": "securepass",
  "owner_name": "Jane Smith",
  "email": "jane@newmart.com",
  "phone": "555-0000",
  "address": "456 Oak Ave",
  "city": "Dallas",
  "state": "TX",
  "zip_code": "75201",
  "notes": null
}
```

**Response 201**
```json
{ "store": { "...store object..." }, "admin": { "...user object..." } }
```

**Errors:** 409 `STORE_CODE_TAKEN`

### PUT /api/superadmin/stores/{store_id}
Update store name, store code, notes, or is_active flag.

**Request** (any subset)
```json
{ "store_name": "Renamed Mart", "notes": "Follow up in June.", "is_active": true }
```

**Response 200** — updated store object

### POST /api/superadmin/stores/{store_id}/suspend
Set `suspended = true`. Blocks all logins for the store.

**Response 200** — updated store object

### POST /api/superadmin/stores/{store_id}/activate
Set `suspended = false`. Restores login access.

**Response 200** — updated store object

### GET /api/superadmin/submissions
List all contact/apply/waitlist submissions. Supports `?type=` (contact|apply|waitlist) and `?status=` (new|reviewed|approved) filters.

**Response 200**
```json
{
  "submissions": [
    {
      "id": 1, "submission_type": "apply", "full_name": "Jane Smith",
      "business_name": "Corner Mart", "email": "jane@example.com",
      "phone": "555-1234", "city": "Austin", "state": "TX",
      "num_employees": "1-5", "store_count": 2, "how_heard": "google",
      "message": null, "current_process": "Manual paper logs",
      "status": "new", "notes": null,
      "reviewed_at": null, "created_at": "..."
    }
  ]
}
```

### PUT /api/superadmin/submissions/{sub_id}
Update notes or mark as reviewed.

**Request**
```json
{ "notes": "Contacted by phone.", "mark_reviewed": true }
```

**Response 200** — updated submission object

### POST /api/superadmin/submissions/{sub_id}/approve
Approve an apply/contact submission: creates a new Store + admin User + trial Subscription + default StoreSettings, then marks the submission `approved`.

**Request**
```json
{
  "store_name": "Corner Mart",
  "store_code": "CM001",
  "admin_username": "admin",
  "admin_password": "securepass",
  "owner_name": "Jane Smith",
  "email": "jane@example.com"
}
```

**Response 201**
```json
{
  "store": { "...store object..." },
  "admin": { "...user object..." },
  "submission": { "...updated submission..." }
}
```

**Errors:** 409 `STORE_CODE_TAKEN`, 400 `MISSING_REQUIRED_FIELDS`

### GET /api/superadmin/audit-logs
Retrieve audit log entries. Supports `?store_id=`, `?action=`, `?date_from=`, `?date_to=` filters. Returns up to 500 entries ordered by `created_at` desc.

**Response 200**
```json
{
  "audit_logs": [
    {
      "id": 42, "user_id": 1, "store_id": 3,
      "action": "store_suspended",
      "entity_type": "store", "entity_id": 3,
      "old_value": null, "new_value": null,
      "ip_address": "203.0.113.5",
      "user_agent": "Mozilla/5.0...",
      "created_at": "2026-05-01T14:22:00Z"
    }
  ]
}
```

### GET /api/superadmin/subscriptions
List all subscriptions across all stores. Supports `?include_cancelled=true`.

**Response 200**
```json
{
  "subscriptions": [
    {
      "id": 1, "store_id": 1, "store_name": "Lucky Mart", "store_code": "LM001",
      "plan": "basic", "status": "trial",
      "trial_ends_at": "2026-06-01T00:00:00Z",
      "plan_price": null, "cancel_at_period_end": false,
      "created_at": "..."
    }
  ]
}
```

### POST /api/superadmin/stores/{store_id}/cancel-subscription
Cancel the store's subscription immediately.

**Request**
```json
{ "reason": "Non-payment after 30-day notice." }
```

**Response 200** — updated subscription object

### POST /api/superadmin/stores/{store_id}/reactivate-subscription
Reactivate a cancelled or expired subscription (sets status back to `trial`).

**Response 200** — updated subscription object

### POST /api/superadmin/stores/{store_id}/extend-trial
Extend the store's trial period by N days.

**Request**
```json
{ "days": 14 }
```

**Response 200** — updated subscription object

**Errors:** 400 — `days` must be a positive integer

---

## 16. Sync Endpoints (ready but pending — Phase 5b backend)

Offline mode is complete on the mobile client. The following server-side sync endpoints are pending implementation. The mobile app queues offline records and will call these when they ship.

All sync operations will be idempotent: sending the same UUID twice is a no-op.

| Method | Endpoint | Description | Status |
|---|---|---|---|
| POST | /api/sync/business-days | Sync an offline-created BusinessDay | Pending |
| POST | /api/sync/shifts | Sync an offline-created EmployeeShift | Pending |
| POST | /api/sync/scans | Sync a batch of offline scan records | Pending |
| POST | /api/sync/close-shifts | Sync an offline shift close with financials | Pending |

Request/response shapes TBD. UUIDs on `EmployeeShift`, `BusinessDay`, and `ShiftBooks` are the idempotency keys (see ERD §Offline Sync UUID Fields).

---

## 17. Barcode Parsing Contract

Barcode format: `<static_code><3-digit-position>`

- `static_code` = barcode minus last 3 characters
- `position` = last 3 characters as integer (0 ≤ position ≤ 999)
- ITF-14 barcodes (14 digits starting with `0`) have the leading `0` stripped before parsing

Example: `1234567890149` with `ticket_price=1.00`
- static_code: `1234567890`
- position: 149
- length for $1 price: 150
- is_last_ticket: true

---

## 18. PIN Rate Limiting

Applies to: `POST /api/books/{id}/return-to-vendor`, `POST /api/shifts/{id}/whole-book-sale`

- Per `(user_id, store_id)` pair
- Max 5 failed attempts in 10-minute rolling window
- 6th failure: 429 `PIN_LOCKOUT` with `Retry-After` header
- Successful validation resets counter

---

## 19. Endpoint Quick Reference

| Method | Endpoint | Auth | Role |
|---|---|---|---|
| POST | /api/auth/setup | — | — |
| POST | /api/auth/login | — | — |
| POST | /api/auth/logout | JWT | any |
| GET | /api/auth/me | JWT | any |
| PUT | /api/auth/change-password | JWT | any |
| GET | /api/store/profile | JWT | any |
| PUT | /api/store/profile | JWT | admin |
| PUT | /api/store/settings/pin | JWT | admin |
| PUT | /api/store/settings/scan-mode | JWT | admin |
| GET | /api/store/settings | JWT | any |
| PUT | /api/store/settings | JWT | admin |
| GET | /api/users | JWT | admin |
| POST | /api/users | JWT | admin |
| GET | /api/users/{id} | JWT | admin |
| PUT | /api/users/{id} | JWT | admin |
| DELETE | /api/users/{id} | JWT | admin |
| GET | /api/users/active | JWT | admin |
| GET | /api/slots | JWT | any |
| POST | /api/slots | JWT | admin |
| GET | /api/slots/{id} | JWT | any |
| PUT | /api/slots/{id} | JWT | admin |
| DELETE | /api/slots/{id} | JWT | admin |
| POST | /api/slots/bulk | JWT | admin |
| POST | /api/slots/bulk-delete | JWT | admin |
| POST | /api/slots/{slot_id}/assign-book | JWT | admin |
| GET | /api/books | JWT | any |
| GET | /api/books/{id} | JWT | any |
| GET | /api/books/summary | JWT | any |
| GET | /api/books/activity | JWT | admin |
| POST | /api/books/{id}/unassign | JWT | admin |
| POST | /api/books/{id}/return-to-vendor | JWT | any (PIN) |
| POST | /api/shifts | JWT | any |
| GET | /api/shifts | JWT | any |
| GET | /api/shifts/{id} | JWT | any |
| GET | /api/shifts/{id}/summary | JWT | any |
| PUT | /api/shifts/{id}/close | JWT | any |
| POST | /api/shifts/{id}/void | JWT | admin |
| GET | /api/business-days | JWT | any |
| GET | /api/business-days/today | JWT | any |
| GET | /api/business-days/{id} | JWT | any |
| POST | /api/business-days/{id}/close | JWT | admin |
| GET | /api/business-days/{id}/ticket-breakdown | JWT | any |
| POST | /api/scan | JWT | any |
| POST | /api/shifts/{id}/whole-book-sale | JWT | any (PIN) |
| GET | /api/reports/shift/{id} | JWT | any |
| GET | /api/subscription | JWT | any |
| POST | /api/contact | — | public |
| POST | /api/apply | — | public |
| POST | /api/waitlist | — | public |
| POST | /api/stripe/webhook | — | Stripe sig |
| GET | /api/superadmin/stats | JWT | superadmin |
| GET | /api/superadmin/stores | JWT | superadmin |
| GET | /api/superadmin/stores/{id} | JWT | superadmin |
| POST | /api/superadmin/stores | JWT | superadmin |
| PUT | /api/superadmin/stores/{id} | JWT | superadmin |
| POST | /api/superadmin/stores/{id}/suspend | JWT | superadmin |
| POST | /api/superadmin/stores/{id}/activate | JWT | superadmin |
| GET | /api/superadmin/submissions | JWT | superadmin |
| PUT | /api/superadmin/submissions/{id} | JWT | superadmin |
| POST | /api/superadmin/submissions/{id}/approve | JWT | superadmin |
| GET | /api/superadmin/audit-logs | JWT | superadmin |
| GET | /api/superadmin/subscriptions | JWT | superadmin |
| POST | /api/superadmin/stores/{id}/cancel-subscription | JWT | superadmin |
| POST | /api/superadmin/stores/{id}/reactivate-subscription | JWT | superadmin |
| POST | /api/superadmin/stores/{id}/extend-trial | JWT | superadmin |
