# API Contract — LottoMeter v2.0

**Version:** 2.3
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

### POST /api/shifts
Opens a new main shift AND auto-creates Sub-shift 1 (FR-SHIFT-01).

**Request:** empty body `{}`.

**Response 201**
```json
{
  "main_shift": {
    "shift_id": 10,
    "shift_start_time": "2026-04-24T08:00:00Z",
    "is_shift_open": true,
    "opened_by": { "user_id": 2, "username": "alice" }
  },
  "current_subshift": {
    "shift_id": 11,
    "main_shift_id": 10,
    "shift_number": 1,
    "shift_start_time": "2026-04-24T08:00:00Z",
    "is_shift_open": true,
    "opened_by": { "user_id": 2, "username": "alice" },
    "pending_scans": [
      {
        "slot_id": 1,
        "slot_name": "Slot A",
        "book_id": 12,
        "static_code": "1234567890",
        "ticket_price": "5.00",
        "book_name": null
      }
    ],
    "is_initialized": false
  }
}
```

`is_initialized = false` means sale scans are blocked until all pending books scanned.

**Errors:** 409 `SHIFT_ALREADY_OPEN` — a main shift is already open for this store (FR-SHIFT-02).

### GET /api/shifts
Response is scoped by the caller's role.

**Admin role** — full listing with optional filters:
| Param | Type | Description |
|---|---|---|
| `status` | string | `open` / `closed` / `voided` |
| `from` | ISO date | Inclusive start date (`YYYY-MM-DD`) |
| `to` | ISO date | Inclusive end date (`YYYY-MM-DD`) |
| `opened_by_user_id` | int | Filter to shifts opened by a specific user (400 if unknown) |
| `limit` | int | Default 50 |
| `offset` | int | Default 0 |

**Employee role** — all query params are ignored. Returns at most 2 shifts: the currently open main shift (if any) and the most recently closed main shift (if any). Voided shifts are never included.

**Response 200**
```json
{
  "shifts": [
    {
      "shift_id": 10,
      "shift_start_time": "2026-04-24T08:00:00Z",
      "shift_end_time": "2026-04-24T16:00:00Z",
      "is_shift_open": false,
      "voided": false,
      "subshift_count": 2,
      "tickets_total": "450.00",
      "difference": "0.00",
      "shift_status": "correct"
    }
  ],
  "total": 42
}
```

Only main shifts returned.

**Errors (admin only):**
- 400 `VALIDATION_ERROR` — `from`/`to` not valid ISO dates, or `opened_by_user_id` not found in this store.

### GET /api/shifts/{id}
**Response 200** — full main shift with nested sub-shifts and pending_scans for the current open sub-shift.

### GET /api/shifts/{id}/summary

Returns live-preview totals for an OPEN sub-shift. Used by the mobile close-shift modal to compute `expected_cash` and `difference` as the employee types cash values, without committing the close.

`{id}` is a **sub-shift** id.

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

- `tickets_total` — sum of (close − open) × ticket_price across paired scans, plus all whole-book sale values, all return-to-vendor partials. Same formula used at close time.
- `whole_book_total` — broken out for UI display.
- `books_total_active` — count of currently-active books in the store.
- `books_with_close` — count of those active books that have a close scan in this sub-shift.
- `books_pending_close` — `books_total_active - books_with_close`. The mobile app blocks close-shift submission while this is > 0.

**Errors:**
- 404 `SUBSHIFT_NOT_FOUND` — id doesn't match a sub-shift in this store
- 422 `SHIFT_CLOSED` — sub-shift is already closed
- 422 `SHIFT_VOIDED` — sub-shift has been voided


### POST /api/shifts/{id}/subshifts
Closes the currently open sub-shift AND opens the next one (handover).

`id` is the **main shift** id.

**Request**
```json
{
  "cash_in_hand": "512.50",
  "gross_sales": "380.00",
  "cash_out": "20.00"
}
```

**Server logic:**
1. Find current open sub-shift on this main shift
2. Verify all active books have close scans (FR-CLOSE-01)
3. Compute `tickets_total`, `expected_cash`, `difference`, `shift_status`
4. Close the current sub-shift
5. Open a new sub-shift
6. If closed status was `correct`: carry forward close positions (skipping is_sold)
7. If closed status was `short`/`over`: no carry-forward
8. Compute pending_scans for the new sub-shift

**Response 200**
```json
{
  "closed_subshift": { ... full report ... },
  "new_subshift": {
    "shift_id": 12,
    "shift_number": 2,
    "carried_forward_count": 5,
    "pending_scans": [ ... any pending books ... ],
    "is_initialized": false
  }
}
```

**Errors:**
- 422 `BOOKS_NOT_CLOSED` — some active books don't have close scans
- 422 `SHIFT_NOT_INITIALIZED` — current sub-shift has pending scans still (edge case)
- 400 `INVALID_CASH_VALUES` — negative or malformed

### PUT /api/shifts/{id}/close
Closes the final sub-shift AND the main shift.

**Request** — same shape as handover.

**Response 200** — full main shift report (same shape as `GET /api/reports/shift/{id}`).

**Errors:** same as handover.

### POST /api/shifts/{id}/void
Admin-only. Voids a main shift (and cascades to all its sub-shifts).

**Request**
```json
{ "reason": "Accidentally opened during inventory count." }
```

**Response 200** — voided main shift object.

### POST /api/shifts/{id}/subshifts/{subshift_id}/void
Admin-only. Voids a specific sub-shift.

**Request**
```json
{ "reason": "Employee misscanned all open positions." }
```

**Response 200** — voided sub-shift.

**Errors:** 400 `REASON_REQUIRED`.

---

## 7. Scanning

### POST /api/scan
Records a ticket scan during an open sub-shift.

**Request**
```json
{
  "shift_id": 11,
  "barcode": "1234567890149",
  "scan_type": "open"
}
```

- `shift_id` must be an open sub-shift
- `scan_type`: `open` or `close`

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
- 409 `OPEN_RESCAN_BLOCKED` — cannot rewrite an existing open scan after close has started in this sub-shift (Rule 8). Brand-new open scans for newly-assigned books are still allowed.
- 422 `SHIFT_CLOSED` — target sub-shift is not open
- 422 `SHIFT_VOIDED` — target sub-shift has been voided
- 422 `SALES_BLOCKED_PENDING_INIT` — attempted sale scan before pending_scans empty

---

## 8. Whole-Book Sale

### POST /api/shifts/{subshift_id}/whole-book-sale

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
1. Validate sub-shift open, not voided, belongs to caller's store
2. Validate PIN (rate limit on failure)
3. Validate `ticket_price` in LENGTH_BY_PRICE
4. Compute `ticket_count = LENGTH_BY_PRICE[ticket_price]` and `value = ticket_price * ticket_count`
5. Create ShiftExtraSales row

**Response 201**
```json
{
  "extra_sale": {
    "extra_sale_id": 42,
    "shift_id": 11,
    "sale_type": "whole_book",
    "scanned_barcode": "5555555555012",
    "ticket_price": "5.00",
    "ticket_count": 60,
    "value": "300.00",
    "note": null,
    "created_at": "2026-04-24T11:22:00Z",
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

## 9. Reports

### GET /api/reports/shift/{id}
`id` is a **main shift** id.

**Access control:** Employees may only fetch reports for shifts returned by `GET /api/shifts` (their open shift + most recent closed shift). Any other `shift_id` returns 404 `SHIFT_NOT_FOUND`. Admins have unrestricted access.

**Response 200**
```json
{
  "main_shift": {
    "shift_id": 10,
    "shift_start_time": "2026-04-24T08:00:00Z",
    "shift_end_time": "2026-04-24T16:00:00Z",
    "voided": false,
    "opened_by": { "user_id": 2, "username": "alice" },
    "totals": {
      "tickets_total": "440.00",
      "gross_sales": "760.00",
      "expected_cash": "1200.00",
      "cash_in_hand": "1200.00",
      "difference": "0.00",
      "shift_status": "correct"
    },
    "ticket_breakdown": [
      { "ticket_price": "5.00",  "source": "scanned",    "tickets_sold": 14, "subtotal": "70.00" },
      { "ticket_price": "5.00",  "source": "whole_book", "tickets_sold": 60, "subtotal": "300.00" },
      { "ticket_price": "10.00", "source": "scanned",    "tickets_sold": 7,  "subtotal": "70.00" }
    ]
  },
  "subshifts": [
    {
      "shift_id": 11,
      "shift_number": 1,
      "voided": false,
      "opened_by": { "user_id": 2, "username": "alice" },
      "closed_by": { "user_id": 2, "username": "alice" },
      "shift_start_time": "...",
      "shift_end_time": "...",
      "cash_in_hand": "512.50",
      "gross_sales": "380.00",
      "cash_out": "20.00",
      "tickets_total": "440.00",
      "expected_cash": "1200.00",
      "difference": "0.00",
      "shift_status": "correct",
      "ticket_breakdown": [ ... scanned vs whole_book lines ... ],
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
          "created_at": "2026-04-24T11:22:00Z",
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
          "returned_at": "2026-04-24T13:45:00Z",
          "returned_by": { "user_id": 2, "username": "alice" }
        }
      ]
    }
  ],
  "voided_subshifts": []
}
```

Voided sub-shifts appear in `voided_subshifts` separately (not in totals).

---

## 10. Barcode Parsing Contract

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

## 11. PIN Rate Limiting

Applies to: `POST /api/books/{id}/return-to-vendor`, `POST /api/shifts/{subshift_id}/whole-book-sale`

- Per `(user_id, store_id)` pair
- Max 5 failed PIN attempts in 10-minute rolling window
- On 6th failure: return 429 `PIN_LOCKOUT` with `Retry-After` header (seconds)
- Lockout duration: 10 minutes from most recent failure
- Successful PIN validation resets the counter

Implementation: in-memory counter for v2.0; Redis-backed for production later.

---

## 12. Versioning

- v2.0 uses `/api/` prefix
- v2.1 may introduce `/api/v2/` for breaking changes; current endpoints remain as default

---

## 13. Endpoint Quick Reference

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
| POST | /api/books/{book_id}/unassign | JWT | admin |
| POST | /api/books/{book_id}/return-to-vendor | JWT | any (PIN) |
| POST | /api/shifts | JWT | any |
| GET | /api/shifts | JWT | any |
| GET | /api/shifts/{id} | JWT | any |
| GET | /api/shifts/{id}/summary | JWT | any |
| POST | /api/shifts/{id}/subshifts | JWT | any |
| PUT | /api/shifts/{id}/close | JWT | any |
| POST | /api/shifts/{id}/void | JWT | admin |
| POST | /api/shifts/{id}/subshifts/{sub_id}/void | JWT | admin |
| POST | /api/scan | JWT | any |
| POST | /api/shifts/{id}/whole-book-sale | JWT | any (PIN) |
| GET | /api/reports/shift/{id} | JWT | any |
