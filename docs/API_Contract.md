# API Contract — LottoMeter v2.0

**Version:** 3.0
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

Every request (except `setup` and `login`):
1. JWT decoded — `user_id`, `role`, `store_id` extracted
2. All DB queries filtered by `store_id` from JWT — never from request body or URL
3. Cross-store access attempts return 404 (don't leak existence)
4. Admin-only endpoints reject non-admin JWTs with 403

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

- `store_pin` must be exactly 4 digits. Hashed before storage.
- `scan_mode` optional — defaults to `"camera_single"`. Must be one of `"camera_single"`, `"camera_continuous"`, `"hardware_scanner"`.

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

**Errors:** 401 `INVALID_CREDENTIALS` for bad username/password OR unknown store_code (same error to avoid leaking).

### POST /api/auth/logout
Adds current JWT's `jti` to the server-side blocklist until its natural expiry.

**Response 204**

### GET /api/auth/me
Returns the authenticated user's profile and store info.

**Response 200**
```json
{
  "user": { "user_id": 1, "username": "admin", "role": "admin", "store_id": 1 },
  "store": { "store_id": 1, "store_name": "Lucky Mart", "scan_mode": "camera_single" }
}
```

---

## 2. Store Settings

### PUT /api/store/settings/pin
Admin-only. Change the store's 4-digit PIN.

**Request**
```json
{
  "current_pin": "4271",
  "new_pin": "8352"
}
```

- `current_pin` required — must match existing hash
- Both must be 4 digits

**Response 200**
```json
{ "message": "Store PIN updated successfully." }
```

**Errors:**
- 401 `INVALID_PIN` — current_pin mismatch
- 400 `INVALID_PIN_FORMAT` — not 4 digits

### PUT /api/store/settings/scan-mode
Admin-only. Update the store's scan mode preference.

**Request**
```json
{ "scan_mode": "camera_continuous" }
```

- `scan_mode` must be one of `"camera_single"`, `"camera_continuous"`, `"hardware_scanner"`

**Response 200**
```json
{ "scan_mode": "camera_continuous", "message": "Scan mode updated." }
```

**Errors:**
- 400 `INVALID_SCAN_MODE` — value not in allowed set

---

## 3. Users

Admin-only endpoints. All queries scoped to JWT's `store_id`.

### GET /api/users/active
Admin-only. Returns a compact list of all non-deleted users for use in dropdown filters.

**Response 200**
```json
{
  "users": [
    { "user_id": 1, "username": "admin",  "role": "admin" },
    { "user_id": 3, "username": "alice",  "role": "employee" }
  ]
}
```

### GET /api/users
Lists all users (active and soft-deleted).

**Response 200**
```json
{
  "users": [
    {
      "user_id": 1,
      "username": "admin",
      "role": "admin",
      "created_at": "2026-04-24T08:00:00Z",
      "deleted_at": null
    }
  ]
}
```

### POST /api/users
Create a new user.

**Request**
```json
{
  "username": "alice",
  "password": "pass1234",
  "role": "employee"
}
```

- `role` must be `"admin"` or `"employee"`

**Response 201**
```json
{ "user": { "user_id": 3, "username": "alice", "role": "employee", "created_at": "2026-04-24T09:00:00Z", "deleted_at": null } }
```

**Errors:**
- 409 `USERNAME_TAKEN` — username already exists in this store (among active users)
- 400 `INVALID_ROLE` — role not in allowed set

### GET /api/users/{id}
**Response 200** — single user object as above.

**Errors:** 404 `USER_NOT_FOUND`

### PUT /api/users/{id}
Edit a user's username, password, or role. Any subset of fields accepted.

**Request**
```json
{ "username": "alice2", "password": "newpass", "role": "admin" }
```

**Response 200** — updated user object.

**Errors:**
- 409 `USERNAME_TAKEN`
- 403 `CANNOT_EDIT_SELF_ROLE` — admin cannot change their own role
- 404 `USER_NOT_FOUND`

### DELETE /api/users/{id}
Soft-deletes a user. Sets `deleted_at`; login immediately blocked.

**Response 204**

**Errors:**
- 403 `CANNOT_DELETE_SELF` — admin cannot delete their own account
- 404 `USER_NOT_FOUND`
- 422 `USER_ALREADY_DELETED`

---

## 4. Slots

All slot endpoints require auth. Queries scoped to JWT's `store_id`.

### GET /api/slots
Returns all non-soft-deleted slots.

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
    },
    {
      "slot_id": 2,
      "slot_name": "Slot B",
      "ticket_price": "10.00",
      "current_book": null
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

- `ticket_price` must be one of `"1.00"`, `"2.00"`, `"3.00"`, `"5.00"`, `"10.00"`, `"20.00"`

**Response 201** — slot object as above.
**Errors:** 400 `INVALID_PRICE` if not in allowed set; 409 `SLOT_NAME_TAKEN` within store.

### GET /api/slots/{id}
**Response 200** — slot object with `current_book`.

### PUT /api/slots/{id}
Admin-only.

**Request** — either or both:
```json
{ "slot_name": "Front Left", "ticket_price": "10.00" }
```

- `slot_name` — editable anytime
- `ticket_price` — editable only when slot is empty (no active book)

**Response 200** — updated slot.
**Errors:**
- 422 `SLOT_OCCUPIED` — cannot change ticket_price while a book is in the slot
- 409 `SLOT_NAME_TAKEN`

### DELETE /api/slots/{id}
Admin-only. Soft delete — sets `deleted_at`.

**Response 204**
**Errors:** 422 `SLOT_OCCUPIED` — cannot delete slot with active book.

### POST /api/slots/bulk
Admin-only. Create multiple slots in a single transactional request (max 500).

**Request**
```json
{
  "slots": [
    { "slot_name": "Slot A", "ticket_price": "5.00" },
    { "slot_name": "Slot B", "ticket_price": "10.00" }
  ]
}
```

**Response 201**
```json
{ "created": 2, "slots": [ "...slot objects..." ] }
```

**Errors:**
- 400 `EXCEEDS_BULK_LIMIT` — more than 500 slots in request
- 409 `SLOT_NAME_TAKEN` — one or more names conflict (entire batch rolls back)
- 400 `INVALID_PRICE` — one or more prices not in valid set

### POST /api/slots/bulk-delete
Admin-only. Soft-delete multiple slots by id list. Only empty, non-deleted slots may be deleted. Transactional — if any slot is occupied or already deleted, the entire batch fails.

**Request**
```json
{ "slot_ids": [1, 2, 3] }
```

**Response 200**
```json
{ "deleted": 3 }
```

**Errors:**
- 422 `SLOT_OCCUPIED` — one or more slots have active books (entire batch rolls back)
- 404 `SLOT_NOT_FOUND` — one or more ids not found or already deleted

---

## 5. Books

### GET /api/books
Lists active and historically-relevant books. Scoped to store.

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

`book_length` is computed from `LENGTH_BY_PRICE[ticket_price]`.

### GET /api/books/{id}
**Response 200** — single book object with assignment history.

```json
{
  "book": { ... },
  "assignment_history": [
    {
      "assignment_id": 5,
      "slot_id": 1,
      "slot_name": "Slot A",
      "ticket_price": "5.00",
      "assigned_at": "2026-04-24T08:00:00Z",
      "unassigned_at": null,
      "assigned_by": { "user_id": 1, "username": "admin" },
      "unassign_reason": null
    }
  ]
}
```

### GET /api/books/summary

Aggregate counts of books in the store, grouped by status. Cheaper than fetching
the full book list to compute dashboard counts client-side.

**Auth:** Required (any role)
**Multi-tenancy:** Scoped to user's store via JWT `store_id` claim

**Response 200**
```json
{
  "active":   42,
  "sold":     10,
  "returned":  5,
  "total":    57
}
```

| Field | Definition |
|---|---|
| `active` | `is_active=true AND is_sold=false AND returned_at IS NULL` |
| `sold` | `is_sold=true` (any value of `returned_at`) |
| `returned` | `returned_at IS NOT NULL` |
| `total` | All book rows in the store |

**Errors:**
- 401 — not authenticated

---

### GET /api/books/activity

Rolling time-windowed counts of sold and returned books, with a previous-period snapshot for trend comparison (e.g. trend arrows in the dashboard).

**Auth:** Required (admin only)
**Multi-tenancy:** Scoped to user's store via JWT `store_id` claim

**Query params:**

| Param | Values | Required |
|---|---|---|
| `period` | `week` \| `month` \| `year` \| `all` | yes |

**Response 200 (period = "week" \| "month" \| "year")**
```json
{
  "period": "week",
  "from": "2026-04-22T10:00:00+00:00",
  "to":   "2026-04-29T10:00:00+00:00",
  "sold": 15,
  "returned": 3,
  "previous_period": {
    "sold": 8,
    "returned": 0
  }
}
```

**Response 200 (period = "all")**
```json
{
  "period": "all",
  "from": null,
  "to":   "2026-04-29T10:00:00+00:00",
  "sold": 120,
  "returned": 11,
  "previous_period": null
}
```

| Field | Definition |
|---|---|
| `from` | Window start (UTC ISO 8601). `null` when `period="all"` |
| `to` | Window end — always `now` (UTC ISO 8601) |
| `sold` | Books with `sold_at` in `[from, to]` |
| `returned` | Books with `returned_at` in `[from, to]` |
| `previous_period` | Same counts for the equal-length window immediately before `from`. `null` when `period="all"` |

Window lengths: `week` = 7 days, `month` = 30 days, `year` = 365 days.

**Errors:**
- 400 `INVALID_PERIOD` — `period` not one of the allowed values
- 401 — not authenticated
- 403 `ADMIN_REQUIRED` — authenticated but not admin

---

### POST /api/slots/{slot_id}/assign-book
Admin-only. Assigns a book to a slot. Creates the Book if new, reassigns if existing.

**Request**
```json
{
  "barcode": "1234567890005",
  "book_name": null,
  "ticket_price_override": null,
  "confirm_reassign": false
}
```

- `barcode` — required, scanned barcode
- `book_name` — optional
- `ticket_price_override` — optional; must be valid price if provided
- `confirm_reassign` — required `true` if this barcode's `static_code` is already active in another slot

**Server logic:**
1. Extract `static_code` = barcode without last 3 digits
2. Extract `start_position` = last 3 digits as integer
3. Validate `start_position < LENGTH_BY_PRICE[slot.ticket_price (or override)]`
4. If an active book with this `static_code` exists:
   - If `confirm_reassign` is not true → return 409 `REASSIGN_CONFIRMATION_REQUIRED`
   - Else → unassign from old slot (log unassigned_at, unassign_reason='reassigned'), then assign to this slot
5. If no active book: create new Book row
6. Inherit `ticket_price` from slot (or use override)
7. Set `is_active = true`, `slot_id`, `static_code`, `start_position`
8. Create BookAssignmentHistory row

**Response 201**
```json
{
  "book": { ... book object ... },
  "slot": { ... slot object ... },
  "next_empty_slot": {
    "slot_id": 2,
    "slot_name": "Slot B",
    "ticket_price": "10.00"
  }
}
```

`next_empty_slot` is null if all slots are filled — UI shows "All slots filled."

**Errors:**
- 400 `INVALID_POSITION` — start_position out of range for slot price
- 409 `REASSIGN_CONFIRMATION_REQUIRED` — static_code already active elsewhere
- 400 `INVALID_PRICE` — ticket_price_override not valid
- 422 `SLOT_SOFT_DELETED` — target slot is deleted

### POST /api/books/{book_id}/unassign
Admin-only. Removes a book from its slot. Book row preserved.

**Response 200**
```json
{ "book": { ... with slot_id=null, is_active=false ... } }
```

**Errors:**
- 422 `BOOK_HAS_OPEN_SCAN` — book has an open scan in a currently-open sub-shift; reassign instead
- 422 `BOOK_ALREADY_INACTIVE` — already unassigned

### POST /api/books/{book_id}/return-to-vendor
Any authenticated user (employee-friendly). Requires store PIN. Records book return.

**Request**
```json
{
  "barcode": "5555555555034",
  "pin": "4271"
}
```

**Server logic:**
1. Validate PIN against `Store.store_pin_hash` (rate-limited)
2. Extract `static_code` and `position` from barcode
3. Verify `static_code` matches `Book.static_code` (prevents wrong-book scan)
4. Verify book `is_active = true`
5. Validate position in range and ≥ open_position in current sub-shift (if any)
6. If a sub-shift is open AND book has an open scan in it:
   - Create close ShiftBooks row: `scan_type='close'`, `start_at_scan=position`, `scan_source='returned_to_vendor'`, `is_last_ticket=false`
7. Unassign: `slot_id=null`, `is_active=false`
8. Set `returned_at=now()`, `returned_by_user_id=current_user`
9. Log BookAssignmentHistory with `unassign_reason='returned_to_vendor'`

**Response 200**
```json
{
  "book": { ... with returned_at set ... },
  "close_scan_recorded": true,
  "position": 34
}
```

**Errors:**
- 401 `INVALID_PIN`
- 429 `PIN_LOCKOUT` — too many failed attempts
- 400 `BARCODE_MISMATCH` — scanned barcode's static_code doesn't match the book
- 422 `BOOK_NOT_ACTIVE`
- 400 `INVALID_POSITION` — out of range
- 400 `POSITION_BEFORE_OPEN` — position < open scan position
- 422 `PIN_NOT_CONFIGURED` — store PIN has never been set

---

## 6. Shifts

Each `{id}` in this section refers to an **EmployeeShift.id**. There is no longer a separate "main shift" or "sub-shift" concept — every shift is a direct employee session.

### POST /api/shifts
Opens a new EmployeeShift for the caller's store. Auto-creates today's BusinessDay if one doesn't exist yet (BR-BD-02).

**Request:** empty body or `{}`.

**Response 201**
```json
{
  "employee_shift": {
    "id": 1,
    "business_day_id": 1,
    "store_id": 1,
    "employee_id": 2,
    "shift_number": 1,
    "opened_at": "2026-04-30T08:00:00Z",
    "closed_at": null,
    "status": "open",
    "cash_in_hand": null,
    "gross_sales": null,
    "cash_out": null,
    "tickets_total": null,
    "expected_cash": null,
    "difference": null,
    "shift_status": null,
    "closed_by_user_id": null,
    "voided": false,
    "voided_at": null,
    "voided_by_user_id": null,
    "void_reason": null
  },
  "carried_forward_count": 0,
  "pending_scans": [
    {
      "book_id": 12,
      "book_name": null,
      "static_code": "1234567890",
      "slot_id": 1
    }
  ]
}
```

- `carried_forward_count` — number of close-scan positions automatically carried from the previous shift's close positions (only runs when previous `shift_status == "correct"`, BR-ES-03)
- `pending_scans` — active books that do not yet have an open scan in this shift

**Errors:** 409 `SHIFT_ALREADY_OPEN` — an EmployeeShift is already open for this store (BR-ES-01).

### GET /api/shifts
List all shifts for the store, ordered most-recent first.

**Query params:**

| Param | Type | Description |
|---|---|---|
| `business_day_id` | int | Filter to shifts for a specific BusinessDay |

**Response 200**
```json
{
  "shifts": [
    {
      "id": 2,
      "business_day_id": 1,
      "store_id": 1,
      "employee_id": 2,
      "shift_number": 2,
      "opened_at": "2026-04-30T12:00:00Z",
      "closed_at": "2026-04-30T16:00:00Z",
      "status": "closed",
      "tickets_total": "450.00",
      "difference": "0.00",
      "shift_status": "correct",
      "voided": false
    }
  ]
}
```

### GET /api/shifts/{id}
**Response 200** — full EmployeeShift object as above.

**Errors:** 404 `SHIFT_NOT_FOUND`

### GET /api/shifts/{id}/summary
Live-preview totals for an open shift. Used by the mobile close-shift modal to compute expected values before committing the close.

**Response 200**
```json
{
  "tickets_total": "440.00",
  "whole_book_total": "300.00",
  "books_total_active": 5,
  "books_with_close": 3,
  "books_pending_close": 2
}
```

- `tickets_total` — sum of (close − open) × ticket_price across paired scans, plus whole-book extras. Same formula used at close time.
- `whole_book_total` — broken out for UI display.
- `books_total_active` — count of currently-active books in the store.
- `books_with_close` — active books that have a close scan in this shift.
- `books_pending_close` — `books_total_active - books_with_close`. Mobile blocks close submission while > 0.

**Errors:** 404 `SHIFT_NOT_FOUND`

### PUT /api/shifts/{id}/close
Close an open EmployeeShift with financial reconciliation values.

**Request**
```json
{
  "cash_in_hand": "512.50",
  "gross_sales": "380.00",
  "cash_out": "20.00"
}
```

**Server logic:**
1. Verify all active books have close scans (BR-ES-04)
2. Compute `tickets_total`, `expected_cash = gross_sales + tickets_total - cash_out`
3. Compute `difference = cash_in_hand - expected_cash`
4. Set `shift_status`: `correct` (diff=0) / `over` (diff>0) / `short` (diff<0)
5. Set `status = "closed"`, record `closed_at` and `closed_by_user_id`

**Response 200**
```json
{
  "shift": { ...full EmployeeShift object... },
  "report": {
    "shift": {
      "shift_id": 1,
      "shift_number": 1,
      "status": "closed",
      "opened_at": "2026-04-30T08:00:00Z",
      "closed_at": "2026-04-30T16:00:00Z",
      "opened_by": { "user_id": 2, "username": "alice" },
      "closed_by": { "user_id": 2, "username": "alice" },
      "voided": false,
      "cash_in_hand": "512.50",
      "gross_sales": "380.00",
      "cash_out": "20.00",
      "tickets_total": "132.50",
      "expected_cash": "492.50",
      "difference": "20.00",
      "shift_status": "over",
      "ticket_breakdown": [
        { "ticket_price": "5.00", "source": "scanned",    "tickets_sold": 14, "subtotal": "70.00" },
        { "ticket_price": "5.00", "source": "whole_book", "tickets_sold": 60, "subtotal": "300.00" }
      ],
      "books": [ ...per-book lines... ],
      "whole_book_sales": [ ...extra sales... ],
      "returned_books": [ ...return-to-vendor close scans... ]
    },
    "business_day": {
      "id": 1,
      "business_date": "2026-04-30",
      "status": "open"
    }
  }
}
```

**Errors:**
- 422 `BOOKS_NOT_CLOSED` — active books without close scans (details lists `missing_book_ids`)
- 422 `SHIFT_ALREADY_CLOSED`
- 422 `SHIFT_VOIDED`
- 404 `SHIFT_NOT_FOUND`

### POST /api/shifts/{id}/void
Admin-only. Voids an EmployeeShift. If the shift is open, it is implicitly closed first.

**Request**
```json
{ "reason": "Accidentally opened during inventory count." }
```

**Response 200** — voided EmployeeShift object.

**Errors:**
- 422 `SHIFT_ALREADY_VOIDED`
- 400 `REASON_REQUIRED`
- 404 `SHIFT_NOT_FOUND`

---

## 7. Business Days

BusinessDay is auto-created when the first shift of a calendar date opens. Admins can close a BusinessDay once all its shifts are closed.

### GET /api/business-days
List all BusinessDays for the store, ordered most-recent first.

**Response 200**
```json
{
  "business_days": [
    {
      "id": 1,
      "store_id": 1,
      "business_date": "2026-04-30",
      "opened_at": "2026-04-30T08:00:00Z",
      "closed_at": null,
      "status": "open",
      "total_sales": null,
      "total_variance": null
    }
  ]
}
```

### GET /api/business-days/today
Returns today's BusinessDay, auto-creating it if it doesn't exist yet. The mobile app calls this on load to ensure a BusinessDay is always available before any shift is opened.

**Response 200** — single BusinessDay object (same shape as list item above).

### GET /api/business-days/{id}
Returns a single BusinessDay with its shifts.

**Response 200**
```json
{
  "business_day": { ...BusinessDay object... },
  "shifts": [
    {
      "shift_id": 1,
      "shift_number": 1,
      "status": "closed",
      "shift_status": "correct",
      "voided": false,
      "employee_id": 2,
      "opened_at": "2026-04-30T08:00:00Z",
      "closed_at": "2026-04-30T12:00:00Z"
    }
  ]
}
```

**Errors:** 404 `BUSINESS_DAY_NOT_FOUND`

### POST /api/business-days/{id}/close
Admin-only. Closes a BusinessDay, computing aggregate totals across all non-voided shifts.

**Request:** empty body or `{}`.

**Server logic:**
1. Verify no EmployeeShift is still open for this BusinessDay (BR-BD-04)
2. Sum `tickets_total` from all non-voided closed shifts → `total_sales`
3. Sum `difference` from all non-voided closed shifts → `total_variance`
4. Set `status = "closed"`, record `closed_at`

**Response 200** — updated BusinessDay object with `total_sales` and `total_variance` set.

**Errors:**
- 422 `OPEN_SHIFTS_REMAIN` — one or more EmployeeShifts are still open
- 422 `DAY_ALREADY_CLOSED`
- 404 `BUSINESS_DAY_NOT_FOUND`

---

## 8. Scanning

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

- `shift_id` must be an open EmployeeShift id
- `scan_type`: `open` or `close`
- `force_sold` (boolean, optional):
  - `true` — mark book as sold; still requires: `scan_type=close`, position at last ticket, and `close_position > open_position`
  - `false` — do NOT mark sold even if all auto-detection conditions are met
  - `null` / omitted — auto-detect (default; backward-compatible)

**Server logic (validates all 8 scan rules from SRS §5.7):**
1. Find book by static_code; if not found → 404
2. Verify book is active, not sold
3. Verify scan_type matches sub-shift state
4. If duplicate (same shift + barcode + scan_type): update existing row (no 409)
5. Validate position in `[0, length-1]` for book's price
6. For close: validate position ≥ open position
7. For open: reject if a prior open scan for this book already exists in this sub-shift AND any close scan has started — i.e. block re-writes after closing has begun. Brand-new opens for newly-assigned books are still allowed (Rule 8).
8. Last-ticket detection — sets `is_last_ticket = true` on the scan row when `position == length - 1`, regardless of scan_type. The book is marked **sold** only when ALL of:
   - `scan_type == "close"`
   - `position == length - 1` (last ticket position)
   - `close_position > open_position` for this book in this sub-shift (real movement happened)

   When the book is sold:
   - `book.is_sold = true`
   - Unassign book from slot (`slot_id = null`, `is_active = false`)
   - Log BookAssignmentHistory with `unassign_reason='sold'`

   This protects against (a) open scans accidentally selling books at the last position during shift initialization, and (b) close scans incorrectly selling books that sat at the last position with no movement this shift (e.g. carried forward from a previous shift).

**Response 200**
```json
{
  "book": {
    "book_id": 12,
    "static_code": "1234567890",
    "ticket_price": "5.00"
  },
  "scan": {
    "scan_type": "open",
    "start_at_scan": 0,
    "is_last_ticket": false,
    "scan_source": "scanned",
    "scanned_at": "2026-04-24T08:02:11Z"
  },
  "running_totals": {
    "books_scanned_open": 4,
    "books_scanned_close": 0,
    "tickets_total": "0.00"
  },
  "pending_scans_remaining": 2,
  "is_initialized": false
}
```

When `pending_scans_remaining = 0` and `is_initialized = true`, sale scans are unblocked.

**Errors:**
- 404 `BOOK_NOT_FOUND` — no active book matches static_code
- 422 `BOOK_NOT_ACTIVE` — book exists but not in a slot
- 422 `BOOK_ALREADY_SOLD` — already marked sold
- 400 `INVALID_POSITION` — position out of range
- 400 `POSITION_BEFORE_OPEN` — close position < open position
- 409 `OPEN_RESCAN_BLOCKED` — cannot rewrite an existing open scan after close has started in this shift (Rule 8). Brand-new open scans for newly-assigned books are still allowed.
- 422 `SHIFT_CLOSED` — target shift is not open
- 422 `SHIFT_VOIDED` — target shift has been voided
- 422 `SALES_BLOCKED_PENDING_INIT` — attempted sale scan before pending_scans empty
- 422 `FORCE_SOLD_REQUIRES_CLOSE` — `force_sold=true` sent on a non-close scan
- 422 `FORCE_SOLD_REQUIRES_LAST_POSITION` — `force_sold=true` sent at a position that is not the last ticket of the book
- 422 `FORCE_SOLD_REQUIRES_MOVEMENT` — `force_sold=true` sent but close position ≤ open position (no real movement this shift)

---

## 9. Whole-Book Sale

### POST /api/shifts/{shift_id}/whole-book-sale

Any authenticated user. Requires store PIN.

**Request**
```json
{
  "barcode": "5555555555012",
  "ticket_price": "5.00",
  "pin": "4271",
  "note": null
}
```

- `barcode` — scanned, stored for audit
- `ticket_price` — must be in valid set
- `pin` — validated against `Store.store_pin_hash`, rate-limited
- `note` — optional free text

**Server logic:**
1. Validate shift open, not voided, belongs to caller's store
2. Validate PIN (rate limit on failure)
3. Validate `ticket_price` in LENGTH_BY_PRICE
4. Compute `ticket_count = LENGTH_BY_PRICE[ticket_price]` and `value = ticket_price * ticket_count`
5. Create ShiftExtraSales row

**Response 201**
```json
{
  "extra_sale": {
    "extra_sale_id": 42,
    "shift_id": 1,
    "sale_type": "whole_book",
    "scanned_barcode": "5555555555012",
    "ticket_price": "5.00",
    "ticket_count": 60,
    "value": "300.00",
    "note": null,
    "created_at": "2026-04-30T11:22:00Z",
    "created_by": { "user_id": 2, "username": "alice" }
  }
}
```

**Errors:**
- 401 `INVALID_PIN`
- 429 `PIN_LOCKOUT`
- 400 `INVALID_PRICE`
- 422 `SHIFT_CLOSED`
- 422 `SHIFT_VOIDED`
- 422 `PIN_NOT_CONFIGURED`

---

## 10. Reports

### GET /api/reports/shift/{id}
`{id}` is an **EmployeeShift id**.

**Access control:** Employees may only fetch reports for shifts where they are the `employee_id`. Any other `shift_id` returns 404 `SHIFT_NOT_FOUND`. Admins have unrestricted access.

**Response 200**
```json
{
  "shift": {
    "shift_id": 1,
    "shift_number": 1,
    "status": "closed",
    "opened_at": "2026-04-30T08:00:00Z",
    "closed_at": "2026-04-30T16:00:00Z",
    "opened_by": { "user_id": 2, "username": "alice" },
    "closed_by": { "user_id": 2, "username": "alice" },
    "voided": false,
    "void_reason": null,
    "voided_at": null,
    "voided_by": null,
    "cash_in_hand": "512.50",
    "gross_sales": "380.00",
    "cash_out": "20.00",
    "tickets_total": "132.50",
    "expected_cash": "492.50",
    "difference": "20.00",
    "shift_status": "over",
    "ticket_breakdown": [
      { "ticket_price": "5.00",  "source": "scanned",    "tickets_sold": 14, "subtotal": "70.00" },
      { "ticket_price": "5.00",  "source": "whole_book", "tickets_sold": 60, "subtotal": "300.00" },
      { "ticket_price": "10.00", "source": "scanned",    "tickets_sold": 7,  "subtotal": "70.00" }
    ],
    "books": [
      {
        "book_id": 12,
        "static_code": "1234567890",
        "book_name": null,
        "slot_name": "Slot A",
        "ticket_price": "5.00",
        "open_position": 0,
        "close_position": 14,
        "tickets_sold": 14,
        "value": "70.00",
        "fully_sold": false,
        "scan_source_open": "scanned",
        "scan_source_close": "scanned"
      }
    ],
    "whole_book_sales": [
      {
        "extra_sale_id": 42,
        "scanned_barcode": "5555555555012",
        "ticket_price": "5.00",
        "ticket_count": 60,
        "value": "300.00",
        "note": null,
        "created_at": "2026-04-30T11:22:00Z",
        "created_by": { "user_id": 2, "username": "alice" }
      }
    ],
    "returned_books": [
      {
        "book_id": 15,
        "static_code": "7777777777",
        "slot_name": "Slot C",
        "ticket_price": "3.00",
        "open_position": 0,
        "returned_at_position": 27,
        "tickets_sold": 27,
        "value": "81.00",
        "returned_at": "2026-04-30T13:45:00Z",
        "returned_by": { "user_id": 2, "username": "alice" }
      }
    ]
  },
  "business_day": {
    "id": 1,
    "business_date": "2026-04-30",
    "status": "closed"
  }
}
```

**Errors:** 404 `SHIFT_NOT_FOUND`

---

## 11. Barcode Parsing Contract

Barcode format: `<static_code><3-digit-position>`

- `static_code` = barcode minus last 3 characters → matches `Book.static_code`
- `position` = last 3 characters parsed as integer (0 ≤ position ≤ 999)
- `is_last_ticket` = `position == LENGTH_BY_PRICE[book.ticket_price] - 1`

Example: `1234567890149` with `ticket_price=1.00`
- static_code: `1234567890`
- position: 149
- length for $1 price: 150
- is_last_ticket: `149 == 150 - 1` → **true**

---

## 12. PIN Rate Limiting

Applies to: `POST /api/books/{id}/return-to-vendor`, `POST /api/shifts/{shift_id}/whole-book-sale`

- Per `(user_id, store_id)` pair
- Max 5 failed PIN attempts in 10-minute rolling window
- On 6th failure: return 429 `PIN_LOCKOUT` with `Retry-After` header (seconds)
- Lockout duration: 10 minutes from most recent failure
- Successful PIN validation resets the counter

Implementation: in-memory counter for v2.0; Redis-backed for production later.

---

## 13. Versioning

- v2.0 uses `/api/` prefix
- v2.1 may introduce `/api/v2/` for breaking changes; current endpoints remain as default

---

## 14. Endpoint Quick Reference

| Method | Endpoint | Auth | Role |
|---|---|---|---|
| POST | /api/auth/setup | — | — |
| POST | /api/auth/login | — | — |
| POST | /api/auth/logout | JWT | any |
| GET | /api/auth/me | JWT | any |
| GET | /api/users | JWT | admin |
| POST | /api/users | JWT | admin |
| GET | /api/users/{id} | JWT | admin |
| PUT | /api/users/{id} | JWT | admin |
| DELETE | /api/users/{id} | JWT | admin |
| GET | /api/users/active | JWT | admin |
| PUT | /api/store/settings/pin | JWT | admin |
| PUT | /api/store/settings/scan-mode | JWT | admin |
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
| POST | /api/books/{book_id}/unassign | JWT | admin |
| POST | /api/books/{book_id}/return-to-vendor | JWT | any (PIN) |
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
| POST | /api/scan | JWT | any |
| POST | /api/shifts/{id}/whole-book-sale | JWT | any (PIN) |
| GET | /api/reports/shift/{id} | JWT | any |
