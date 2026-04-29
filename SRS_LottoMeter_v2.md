# Software Requirements Specification (SRS)
## LottoMeter v2.0 — Mobile & API Rebuild

---

| Field | Value |
|---|---|
| **Project Name** | LottoMeter v2.0 |
| **Document Version** | 5.7 |
| **Author** | Abdelrahman Yousef |
| **Date** | April 2026 |
| **Status** | Final — Verified |

---

## Revision History

| Version | Date | Notes |
|---|---|---|
| 4.0 | April 2026 | Initial verified SRS |
| 5.0 | April 2026 | Design review revisions — see §18 Decision Log |
| 5.1 | April 2026 | Clarified scan event model — scans happen only at shift open, last ticket, return-to-vendor, and shift close (not on every sale) |
| 5.2 | April 2026 | Implementation revisions caught via end-to-end mobile testing: ShiftBooks PK changed to (shift_id, static_code, scan_type); last-ticket detection refined (close + position movement required); Rule 8 narrowed to rewrites only; mobile UX rules; i18n implemented |
| 5.3 | April 2026 | Multi-tenancy hardened (19 security fixes, cross-tenant audit complete); admin user management CRUD added (§6.12, FR-USER-01–07); bulk slot management (FR-SLOT-08–10); scan_mode preference (FR-STORE-05–06); FR-AUTH-06 security scoping requirement added; mobile: continuous scan, ITF-14 normalization, hardware scanner mode, bulk slot UI, PIN change complete |
| 5.4 | April 2026 | Shift history role-based scoping added (§6.13, FR-HIST-01–06): admin filter bar (date range, status, employee), employee view restricted to current open + most recent closed shift in store, voided shifts excluded from employee view; client-side PDF export of shift reports via expo-print + OS share sheet; GET /api/users/active endpoint added to §12 |
| 5.5 | April 2026 | `force_sold` parameter added to scan API (§5.8, API Contract §7) to disambiguate "sell last ticket" from "record close at last position without selling"; three new error codes; mobile confirmation gate wired to client-side last-ticket detection |
| 5.6 | April 2026 | `GET /api/books/summary` endpoint added for mobile books dashboard widget (aggregate counts: active, sold, returned, total); API Contract bumped to v2.5 |
| 5.7 | April 2026 | `GET /api/books/activity` endpoint added for rolling time-windowed sold/returned counts with previous-period comparison; `sold_at` column added to `books` table; API Contract bumped to v2.6 |

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Overall Description](#2-overall-description)
3. [Tech Stack](#3-tech-stack)
4. [User Roles](#4-user-roles)
5. [Business Logic & Workflows](#5-business-logic--workflows)
6. [Functional Requirements](#6-functional-requirements)
7. [UI & UX Requirements](#7-ui--ux-requirements)
8. [Multilingual & Accessibility Requirements](#8-multilingual--accessibility-requirements)
9. [Non-Functional Requirements](#9-non-functional-requirements)
10. [System Architecture Overview](#10-system-architecture-overview)
11. [Database Design](#11-database-design)
12. [API Endpoints Overview](#12-api-endpoints-overview)
13. [Use Cases](#13-use-cases)
14. [Commercialization Requirements](#14-commercialization-requirements)
15. [Constraints & Assumptions](#15-constraints--assumptions)
16. [Future Enhancements](#16-future-enhancements)
17. [Glossary](#17-glossary)
18. [Decision Log](#18-decision-log)

---

## 1. Introduction

### 1.1 Purpose
This document defines the complete, verified software requirements for LottoMeter v2.0. All business logic has been reviewed and confirmed with the product owner before implementation begins.

### 1.2 Scope
LottoMeter v2.0 is a shift management system for grocery and retail stores that sell lottery tickets. It replaces manual paperwork with a mobile barcode-based workflow for tracking ticket book sales across shifts.

### 1.3 References
- LottoMeter v1: https://github.com/AbdelrahmanYousef9266/LottoMeter
- LottoMeter v2: https://github.com/AbdelrahmanYousef9266/LottoMeter-v2

---

## 2. Overall Description

### 2.1 System Architecture

```
┌─────────────────────┐        HTTPS / REST        ┌──────────────────────┐
│   React Native App  │ ◄─────────────────────────► │   Flask REST API     │
│   (iOS / Android)   │       JSON Responses         │   + SQLAlchemy ORM   │
└─────────────────────┘                              └──────────┬───────────┘
                                                                │
                                                     ┌──────────▼───────────┐
                                                     │   PostgreSQL / SQLite │
                                                     └──────────────────────┘
```

### 2.2 Operating Environment

| Component | Environment |
|---|---|
| Backend | Python 3.11+, Flask 3.x, SQLAlchemy 2.x |
| Database | PostgreSQL (prod), SQLite (dev) |
| Mobile | React Native (Expo), iOS 14+, Android 10+ |
| Auth | JWT |
| i18n | i18next + react-i18next |
| Deploy | Docker + GitHub Actions |

---

## 3. Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| Mobile | React Native (Expo) | Cross-platform iOS & Android |
| API | Flask | Lightweight Python REST framework |
| ORM | SQLAlchemy | Mirrors EF Core from v1 |
| DB Dev | SQLite | Zero-config |
| DB Prod | PostgreSQL | Production-grade |
| Auth | JWT (Flask-JWT-Extended) | Stateless, mobile-friendly |
| Serialization | Marshmallow | Validation + JSON |
| i18n | i18next | Multilingual + RTL |
| Testing API | pytest + pytest-flask | Unit + integration |
| Testing Mobile | Jest | Components |
| Deploy | Docker + GitHub Actions | CI/CD |

---

## 4. User Roles

Role enforcement is active from v2.0 — protected endpoints check the `role` claim on the JWT.

### 4.1 Admin
- Creates, edits, and soft-deletes slots
- Assigns books to slots (bulk sequential workflow)
- Reassigns books between slots (allowed anytime, including during open sub-shifts)
- Sets and changes the store PIN
- Manages user accounts (create, list, edit role, deactivate — cannot deactivate own account)
- Configures store scan mode (camera_single, camera_continuous, or hardware_scanner)
- Voids sub-shifts or main shifts (with reason)
- Views all shift reports

### 4.2 Employee
- Opens main shifts (triggers auto-creation of Sub-shift 1)
- Scans books at open and close of each sub-shift
- Scans the last ticket of each book as it finishes during the shift
- Performs whole-book-sale (with store PIN)
- Performs return-to-vendor when a lottery salesman removes a book (with store PIN)
- Manually enters cash_in_hand, gross_sales, cash_out at sub-shift close
- Views shift reports

---

## 5. Business Logic & Workflows

### 5.1 Book Length by Ticket Price

Every lottery book has a fixed number of tickets determined by its ticket price. This mapping is a business constant and not configurable:

| Ticket Price | Book Length (tickets) | Last Position |
|---|---|---|
| $1 | 150 | 149 |
| $2 | 150 | 149 |
| $3 | 100 | 99 |
| $5 | 60 | 59 |
| $10 | 30 | 29 |
| $20 | 30 | 29 |

A book's "position" is a number from 0 to (length - 1) representing the next ticket to be sold. When the book is fresh, position = 0. When the final ticket is scanned, position = (length - 1).

### 5.2 Barcode Structure

Every lottery ticket barcode encodes:
- `static_code` = all digits except the last 3 (uniquely identifies the book)
- `position` = the last 3 digits parsed as an integer (the ticket's position within the book)

Example: barcode `1234567890149`
- static_code = `1234567890`
- position = `149`

**static_code is globally unique per book.** Two different books never share a static_code. This is guaranteed by the barcode format — not enforced by the system.

### 5.3 Store Setup

One-time initial setup, performed by the first admin:

1. Admin creates the store record (name, code)
2. Admin creates the first admin user account
3. Admin sets a 4-digit store PIN (required — cannot be skipped)
4. Admin creates all slots for the store, each with a name and ticket price
5. Setup is complete — the system is ready for book assignment

### 5.4 Slot Management

Slots are managed by admins from the store settings area.

**Creation:** admin provides slot name + ticket price (must be one of the six valid prices).

**Edit:**
- `slot_name` — editable at any time
- `ticket_price` — editable only when the slot is empty (no active book)

**Delete:** soft delete only — sets `deleted_at`, preserves historical references. Only allowed when the slot is empty.

### 5.5 Book Assignment (Admin — Bulk Workflow)

Admin assigns books to slots by scanning barcodes. The workflow is sequential and optimized for speed:

1. Admin opens the slots screen
2. Admin taps a slot → scan modal opens
3. Admin scans the book's barcode
4. System:
   - Extracts `static_code` and `start_position` from the barcode
   - Validates `start_position < LENGTH_BY_PRICE[slot.ticket_price]`
   - Inherits `ticket_price` from the slot (overridable)
   - Creates the Book row (or reassigns if `static_code` already exists)
   - Flips `is_active = true`
   - Logs to `BookAssignmentHistory`
5. Response includes the next empty slot for auto-advance
6. Admin continues to next slot or taps "Done"

**Reassignment:** if the scanned `static_code` matches an already-active book in another slot, the server treats it as a reassignment. The request must include `confirm_reassign: true` — the app shows a confirmation dialog first. The old slot becomes empty; the book moves to the new slot.

**Remove book from slot:** admin unassigns a book via a separate endpoint. The book's row is preserved in the database for historical reports; `slot_id = null`, `is_active = false`.

There is no concept of hard-deleting a Book record. "Delete book" in admin UI language means "unassign from slot."

### 5.6 Opening a Main Shift

1. Employee opens a new main shift
2. System auto-creates Sub-shift 1 (employees never interact with main shift directly)
3. Sub-shift 1 starts in "pending initialization" state
4. All active books in all slots are added to the pending scans list
5. Employee must scan every pending book (open scan) before any mid-shift scan events are accepted
6. Once pending list is empty, the sub-shift is initialized and sales proceed normally

### 5.7 Scan Events During a Sub-Shift

Once a sub-shift is initialized, scans occur **only at specific events** — not on every individual ticket sale. Routine ticket sales are tracked by the cash register; the app reconciles totals at close using open and close positions.

**Scan events during an open sub-shift:**

1. **Last-ticket scan** — when an employee sells the final ticket of a book, they scan it. Triggers last-ticket detection, marks the book as sold, and frees the slot.
2. **Return-to-vendor scan** — when a lottery salesman removes a book mid-shift (PIN-authorized).
3. **Pending open scan** — if admin assigns a new book to a slot during the shift, that book becomes a pending open scan before any further scan events can proceed.

Between these events, employees sell tickets normally at the register without using the app. The app is not a point-of-sale — it is a shift reconciliation and book-lifecycle tool.

**Every scan is validated against these rules:**

1. Barcode's `static_code` must match an active book in this store
2. The book must currently be in a slot (`is_active = true`)
3. The book must not already be sold (`is_sold = false`)
4. The scan_type must match the sub-shift state
5. Rescanning the same book with the same scan_type **overwrites** the existing scan (no duplicate error)
6. Extracted position must be within `[0, length-1]` for the book's price
7. For close scans: position must be ≥ the open scan position for this book in this sub-shift
8. Open scans cannot be **rewritten** (overwritten) after any close scan has started on this sub-shift. New books assigned mid-shift can still receive their initial open scan; only re-writes of existing open scans are blocked.

Any violation returns a specific error code so the app can display clear feedback to the employee.

### 5.8 Last Ticket Detection

Last-ticket detection runs whenever an employee scans the final ticket of a book during a sub-shift. This is the only routine in-shift scan event — employees do not scan every sale, only the last ticket of each finished book.

When a ticket is scanned, the system checks whether this is the book's final ticket:

```
is_last_ticket = (scanned_position == LENGTH_BY_PRICE[book.ticket_price] - 1)
```

**The book is marked sold ONLY when all three conditions hold (auto-detect mode):**
1. `scan_type == "close"` — open scans at the last position never sell the book (they just record the position)
2. `position == LENGTH_BY_PRICE[ticket_price] - 1` — the scan is at the last ticket position
3. `close_position > open_position` — at least one ticket was sold this sub-shift (rules out the edge case where a book sat at the last position with no movement)

The client may override auto-detection via the `force_sold` parameter in the scan request:
- `force_sold: true` — explicitly sell the book (all three structural conditions above are still validated server-side; the client cannot bypass them)
- `force_sold: false` — record the close position without marking the book sold, even if all three conditions are met (used when the last ticket is still physically in the book)
- `force_sold: null` / omitted — auto-detect (default, backward-compatible)

When all three hold (or `force_sold: true`):
- `ShiftBooks.is_last_ticket = true` on that scan row
- `Book.is_sold = true`
- `Book.slot_id = null` (slot becomes empty)
- `Book.is_active = false`
- BookAssignmentHistory row gets `unassigned_at = now()` and `unassign_reason = "sold"`
- If a new book is assigned to the now-empty slot later in this sub-shift, it becomes a pending scan that blocks further scan events until scanned

**Mobile UX enforcement:** the scan_type picker auto-locks to "open" when the sub-shift is not yet initialized, and to "close" when initialized. This makes accidental "open scan at last position" impossible during the sales phase, and makes "close scan during initialization" impossible during the opening phase.

### 5.9 Sub-Shift Handover (Mid-Shift)

When the current employee's shift ends and the next begins, the current sub-shift closes and a new one opens within the same main shift.

**If the closed sub-shift's status is `correct`:**
- Carry forward close positions from the closed sub-shift to the new sub-shift's open positions (skipping books marked `is_sold`)
- `scan_source = 'carried_forward'` on these inherited open-scan rows
- New sub-shift is ready to accept mid-shift scan events immediately (if no new pending scans)

**If the closed sub-shift's status is `short` or `over`:**
- No carry-forward
- Every active book becomes pending
- New employee must scan all books before the sub-shift is initialized (same as Sub-shift 1)

**In either case, if admin added new books to any slot during or since the previous sub-shift,** those new books become pending scans that must be completed before the new sub-shift is fully initialized.

**Resume after gap:** if a sub-shift is reopened after the app was closed or a break occurred, the pending-scans check re-runs. Books added by admin during the gap become pending.

### 5.10 Closing a Sub-Shift

1. Employee initiates close
2. Every book currently in a slot (`is_active = true`, not already sold mid-shift via last-ticket scan) must have a close scan recording its final position. Books that finished mid-shift are already accounted for and don't need a close scan.
3. Employee manually enters:
   - `cash_in_hand` — physical cash counted at close
   - `gross_sales` — from the register
   - `cash_out` — amount paid out in cash
4. System auto-calculates:
   - `tickets_total` = (sum of scanned-book values in this sub-shift) + (sum of whole-book-sale values) + (sum of return-to-vendor partial values)
   - `expected_cash` = gross_sales + tickets_total - cash_out
   - `difference` = cash_in_hand - expected_cash
   - `shift_status`:
     - `correct` if difference == 0
     - `over` if difference > 0
     - `short` if difference < 0

### 5.11 Per-Book Sales Calculation

For each book with an open and close (or last-ticket) scan in a sub-shift:

```
tickets_sold = close_position - open_position
             (+ 1 if scan was marked is_last_ticket)
value        = tickets_sold × book.ticket_price
```

The `+1` accounts for the fact that scanning the last-ticket position means that position itself was sold.

This calculation works regardless of whether the book finished mid-shift (last-ticket scan) or at close (regular close scan). Both cases use the same formula against the two known positions.

### 5.12 Ticket Price Breakdown

Every sub-shift report and main shift report shows a breakdown grouped by ticket price, with scanned-book and whole-book-sale lines shown separately:

```
$5 tickets (scanned):    14 sold → $70.00
$5 tickets (whole book): 60 sold → $300.00
$10 tickets (scanned):   8 sold → $80.00
```

### 5.13 Closing the Main Shift

1. Employee closes the final sub-shift
2. System automatically closes the main shift
3. Main shift totals = sum of all non-voided sub-shift totals
4. Main shift report shows:
   - Combined totals
   - Combined ticket price breakdown (scanned vs whole-book per price)
   - Each sub-shift separately, with its own breakdown and status
   - Any voided sub-shifts clearly marked and excluded from totals

### 5.14 Whole-Book Sale

Used when a customer purchases an entire book in one transaction. The book is physically pulled from inventory (stockroom) — it is not in any slot, and no Book record is created.

**Flow:**
1. Employee taps "Sell Whole Book"
2. Scans the barcode of the book being sold
3. Picks the ticket price from a dropdown ($1/$2/$3/$5/$10/$20)
4. Enters the 4-digit store PIN
5. System validates PIN and records the sale in `ShiftExtraSales`

**Recorded data:**
- `sale_type = 'whole_book'`
- `scanned_barcode` — for audit
- `ticket_price` — the price picked
- `ticket_count` = `LENGTH_BY_PRICE[ticket_price]`
- `value` = `ticket_price × ticket_count`
- `created_by_user_id` — the employee
- `shift_id` — the current open sub-shift

**Constraints:**
- A sub-shift must be open
- The store PIN must be configured (set during store setup)
- PIN attempts are rate-limited: 5 failures in 10 minutes triggers a temporary lockout on the whole-book-sale endpoint for that user

### 5.15 Return to Vendor

Used when a lottery salesman visits the store and removes a book from a slot (e.g. a prize has been claimed, the book is being recalled).

**Flow:**
1. Employee taps "Return Book"
2. Scans the barcode of the book being returned
3. Enters the 4-digit store PIN
4. System records the return

**System actions on return:**
- From the scan: extract `static_code` → find the book; extract position
- Validate position is in range `[open_position_in_current_subshift, length - 1]`
- If a sub-shift is open and the book has an open scan in it:
  - Create a close ShiftBooks row with `scan_source = 'returned_to_vendor'`, `start_at_scan = extracted_position`
  - This preserves all pre-return revenue in the current sub-shift
- Unassign the book: `slot_id = null`, `is_active = false`
- Mark: `Book.returned_at = now()`, `Book.returned_by_user_id = current user`
- Add BookAssignmentHistory row with `unassigned_at = now()`
- Slot becomes empty; if admin assigns a new book later, it becomes pending

**Principle:** everything before the return is normal shift activity. The return event is purely "remove at current position" — no retroactive changes to prior sales.

### 5.16 Void Operations (Admin Safety Valve)

Voids are an admin-only tool for handling errors that the normal validation rules cannot catch (e.g. admin misconfigured books before shift start, entire shift opened by mistake, external event requires shift exclusion).

**Void a sub-shift:**
- Admin provides a reason (required)
- System sets `voided = true`, records `voided_at`, `voided_by_user_id`, `void_reason`
- No data is deleted — ShiftBooks rows, cash values, and all fields are preserved
- The voided sub-shift is excluded from main shift totals and ticket breakdown
- Voided sub-shifts appear in reports with a clear "VOIDED" badge plus the reason

**Void a main shift:** voids all its sub-shifts, then marks the main shift itself as voided.

**Propagation rules:**
- Voiding a sub-shift does NOT modify data in subsequent sub-shifts that carried forward from it
- This is by design — the next employee acted in good faith on the data they had; rewriting their history would be wrong
- Managers handle anomalies in voided-then-carried data out-of-band

### 5.17 Book State Summary

A Book row can be in one of these states (combinations of flags):

| State | is_active | is_sold | returned_at | slot_id |
|---|---|---|---|---|
| Unassigned (orphan) | false | false | null | null |
| Active in slot | true | false | null | set |
| Fully sold | false | true | null | null |
| Returned to vendor | false | false | set | null |

State transitions:
- Unassigned → Active in slot: via assignment
- Active in slot → Fully sold: via last-ticket scan
- Active in slot → Returned: via return-to-vendor action
- Active in slot → Active in (different) slot: via reassignment
- Active in slot → Unassigned: via explicit unassign
- Any state → Unassigned: via admin unassign (except Fully sold / Returned are terminal for active state)

---

## 6. Functional Requirements

### 6.1 Store Module

| ID | Requirement | Priority |
|---|---|---|
| FR-STORE-01 | Store is the root tenant — all data scoped by store_id | High |
| FR-STORE-02 | First-run setup creates store + first admin user + store PIN | High |
| FR-STORE-03 | All API queries scoped to authenticated user's store_id | High |
| FR-STORE-04 | Admin can change the store PIN anytime | High |
| FR-STORE-05 | Admin can configure store scan_mode (camera_single \| camera_continuous \| hardware_scanner) | High |
| FR-STORE-06 | scan_mode is returned in auth responses so the mobile client applies it immediately on login | High |

### 6.2 Authentication & Authorization

| ID | Requirement | Priority |
|---|---|---|
| FR-AUTH-01 | Login with username + password + store_code returns JWT | High |
| FR-AUTH-02 | JWT contains user_id, role, store_id | High |
| FR-AUTH-03 | All endpoints except login/setup require JWT | High |
| FR-AUTH-04 | Admin-only endpoints reject non-admin JWTs with 403 | High |
| FR-AUTH-05 | Logout blocklists the current token until its natural expiry | High |
| FR-AUTH-06 | All endpoints scoped to caller's store_id; cross-store access returns 404 (existence not leaked) | High |

### 6.3 Slot Management

| ID | Requirement | Priority |
|---|---|---|
| FR-SLOT-01 | Admin creates slots with name + ticket_price | High |
| FR-SLOT-02 | slot_name unique within store (excluding soft-deleted) | High |
| FR-SLOT-03 | slot_name editable anytime | High |
| FR-SLOT-04 | ticket_price editable only when slot is empty | High |
| FR-SLOT-05 | ticket_price must be one of $1, $2, $3, $5, $10, $20 | High |
| FR-SLOT-06 | Soft-delete slots (deleted_at); only when empty | High |
| FR-SLOT-07 | Soft-deleted slots remain joinable for historical reports | High |
| FR-SLOT-08 | Admin can bulk-create up to 500 slots in a single request | Medium |
| FR-SLOT-09 | Admin can bulk-delete slots by id list (only empty, non-deleted slots) | Medium |
| FR-SLOT-10 | Bulk operations are transactional — partial failure rolls back all changes | High |

### 6.4 Book Management

| ID | Requirement | Priority |
|---|---|---|
| FR-BOOK-01 | Books are created via slot assignment, never standalone | High |
| FR-BOOK-02 | Assignment auto-derives static_code and start_position from scanned barcode | High |
| FR-BOOK-03 | Book inherits ticket_price from slot; admin may override in request | High |
| FR-BOOK-04 | static_code is globally unique per book (enforced within store) | High |
| FR-BOOK-05 | Reassignment requires `confirm_reassign: true` | High |
| FR-BOOK-06 | Admin unassign is a separate endpoint; preserves Book row | High |
| FR-BOOK-07 | Admin cannot unassign a book that has an open scan in a current open sub-shift | High |
| FR-BOOK-08 | One book per slot at a time (slot capacity = 1) | High |
| FR-BOOK-09 | Assignment position must be < LENGTH_BY_PRICE for slot price | High |
| FR-BOOK-10 | No hard-delete endpoint for books | High |

### 6.5 Shift Management

| ID | Requirement | Priority |
|---|---|---|
| FR-SHIFT-01 | Opening a main shift auto-creates Sub-shift 1 | High |
| FR-SHIFT-02 | Only one open main shift per store at any time (DB-level enforcement) | High |
| FR-SHIFT-03 | Main shift always has at least one sub-shift | High |
| FR-SHIFT-04 | Employees interact only with sub-shifts | High |
| FR-SHIFT-05 | Closing a sub-shift mid-shift auto-creates the next sub-shift | High |
| FR-SHIFT-06 | Closing the final sub-shift closes the main shift automatically | High |
| FR-SHIFT-07 | Main shift totals = sum of non-voided sub-shifts | High |
| FR-SHIFT-08 | Sub-shifts track opened_by_user_id and closed_by_user_id | High |

### 6.6 Pending Scans & Sub-Shift Initialization

| ID | Requirement | Priority |
|---|---|---|
| FR-PEND-01 | Sub-shift 1: all active books are pending scans | High |
| FR-PEND-02 | Sub-shift N+1 after 'correct' A: carry forward close positions (skip is_sold) | High |
| FR-PEND-03 | Sub-shift N+1 after 'short'/'over' A: no carry-forward, all active books pending | High |
| FR-PEND-04 | Any active book without an open scan in the current sub-shift is pending | High |
| FR-PEND-05 | Sub-shift blocks mid-shift scan events while pending scans exist | High |
| FR-PEND-06 | Pending check re-runs every time a sub-shift is resumed after a gap | High |

### 6.7 Sub-Shift Closing

| ID | Requirement | Priority |
|---|---|---|
| FR-CLOSE-01 | All active books (not already sold mid-shift via last-ticket scan) must have close scans before sub-shift close accepts submission | High |
| FR-CLOSE-02 | Employee manually enters cash_in_hand, gross_sales, cash_out | High |
| FR-CLOSE-03 | System calculates tickets_total including scanned books, whole-book sales, and returns | High |
| FR-CLOSE-04 | expected_cash = gross_sales + tickets_total - cash_out | High |
| FR-CLOSE-05 | difference = cash_in_hand - expected_cash | High |
| FR-CLOSE-06 | shift_status = correct / over / short | High |
| FR-CLOSE-07 | Ticket breakdown per sub-shift, scanned vs whole-book split | High |
| FR-CLOSE-08 | Main shift report = combined totals + each sub-shift separately | High |

### 6.8 Barcode Scanning (Shift)

Scan events occur only at: shift open, last ticket of a book during shift, return-to-vendor, and shift close.

| ID | Requirement | Priority |
|---|---|---|
| FR-SCAN-01 | Accept barcode + shift_id + scan_type | High |
| FR-SCAN-02 | Extract static_code (barcode minus last 3 digits) | High |
| FR-SCAN-03 | Match static_code to an active book scoped to store_id | High |
| FR-SCAN-04 | Record position in start_at_scan | High |
| FR-SCAN-05 | Last-ticket detection via position == LENGTH_BY_PRICE[price] - 1 | High |
| FR-SCAN-06 | On last ticket: set is_last_ticket, is_sold, clear slot_id, unassign | High |
| FR-SCAN-07 | Reject position out of range | High |
| FR-SCAN-08 | Reject close position < open position | High |
| FR-SCAN-09 | Duplicate scan (same shift + book + type) overwrites existing row | High |
| FR-SCAN-10 | Reject open rescan after any close scan on this sub-shift | High |
| FR-SCAN-11 | Record scanned_at, scanned_by_user_id, scan_source on every ShiftBooks row | High |
| FR-SCAN-12 | Record slot_id on each scan (current slot at scan time) | High |

### 6.9 Whole-Book Sale

| ID | Requirement | Priority |
|---|---|---|
| FR-WBS-01 | Employee can perform whole-book-sale with store PIN | High |
| FR-WBS-02 | Records ShiftExtraSales row with scanned_barcode, ticket_price, ticket_count, value | High |
| FR-WBS-03 | ticket_count = LENGTH_BY_PRICE[ticket_price] | High |
| FR-WBS-04 | No Book row is created for whole-book sales | High |
| FR-WBS-05 | Rate limit: 5 failed PIN attempts in 10 minutes → temporary lockout | High |
| FR-WBS-06 | Reject if store PIN is not configured | High |

### 6.10 Return to Vendor

| ID | Requirement | Priority |
|---|---|---|
| FR-RTV-01 | Employee can return a book with store PIN | High |
| FR-RTV-02 | Return scan extracts position like any other scan | High |
| FR-RTV-03 | If sub-shift is open and book has open scan, records close ShiftBooks row with scan_source='returned_to_vendor' | High |
| FR-RTV-04 | Unassigns the book; sets returned_at and returned_by_user_id | High |
| FR-RTV-05 | Slot becomes empty; pending-scans check runs on any refill | High |
| FR-RTV-06 | Same rate limit as whole-book-sale PIN | High |

### 6.11 Void Operations

| ID | Requirement | Priority |
|---|---|---|
| FR-VOID-01 | Only admins may void shifts | High |
| FR-VOID-02 | Reason is required on every void | High |
| FR-VOID-03 | Voiding preserves all data — no deletion | High |
| FR-VOID-04 | Voided shifts excluded from main shift totals | High |
| FR-VOID-05 | Voided shifts appear in reports with VOIDED badge + reason | High |
| FR-VOID-06 | Voiding a sub-shift does not modify downstream carried-forward data | High |

### 6.12 User Management

| ID | Requirement | Priority |
|---|---|---|
| FR-USER-01 | Admin can list all users (active and soft-deleted) in the store | High |
| FR-USER-02 | Admin can create a new user (username, password, role) | High |
| FR-USER-03 | Admin can edit a user's username, password, or role | High |
| FR-USER-04 | Admin can soft-delete a user (sets deleted_at; login immediately blocked) | High |
| FR-USER-05 | Admin cannot delete or deactivate their own account | High |
| FR-USER-06 | username is unique within store among active (non-deleted) users | High |
| FR-USER-07 | Soft-deleted users cannot log in | High |

### 6.13 Shift History & Reporting

| ID | Requirement | Priority |
|---|---|---|
| FR-HIST-01 | Admin can filter shift history by date range, status (open/closed/voided), and opened_by user | High |
| FR-HIST-02 | Employee shift history shows only the current open main shift and the most recently closed main shift in the store | High |
| FR-HIST-03 | Voided shifts are excluded from the employee shift history view | High |
| FR-HIST-04 | Both admin and employee can export any visible shift report as PDF | High |
| FR-HIST-05 | PDF export uses client-side rendering (expo-print) and the OS share sheet for output (print, save, email, etc.) | High |
| FR-HIST-06 | PDF export respects the user's current language and applies RTL layout for Arabic | High |

---

## 7. UI & UX Requirements

### 7.1 Navigation
- Bottom tab: Home, Scan, Books, History, Settings
- Splash screen on launch
- Onboarding for first-time users
- Empty states on all screens

### 7.2 Shift Screen
- Active shift indicator (green badge)
- Live running totals updating as scan events occur
- Scrollable list of scanned books
- Shift timer
- Quick close button
- Pending scans banner when initialization not complete

### 7.3 Scan Screen

The scan screen is used at shift open, end-of-book (last ticket), return-to-vendor, and shift close — not for routine ticket sales, which are handled at the register.

- Camera barcode scanner (Expo Camera)
- Hardware barcode scanner support (Zebra, Honeywell, etc. via keystroke wedge mode)
- Manual text input fallback
- Success sound + green flash on success
- Error sound + red flash on failure
- Last scanned book card
- Scan counter

### 7.4 Books Screen (Admin)
- Shows slots grid — each slot shows its ticket price and either "empty" or the assigned book
- Tapping an empty slot opens the assign-book scan flow
- Tapping an occupied slot shows reassign / remove / edit options
- Bulk assignment auto-advances to next empty slot after each successful scan
- "Done" button to exit bulk flow early

### 7.5 History Screen
- **Admin view:** filter bar with date range picker, status selector (open/closed/voided), and employee dropdown (populated from `GET /api/users/active`); all main shifts in the store are shown with filters applied
- **Employee view:** static list of at most 2 shifts — the currently open main shift (if any) and the most recently closed main shift in the store; voided shifts never shown; query filters are not exposed
- Shift cards with date, totals, status badge (correct/over/short/voided)
- Tap shift → full report with sub-shift breakdown
- Export PDF button on report detail screen — triggers client-side rendering via expo-print and opens the OS share sheet (print / save / email)

### 7.6 Settings Screen
- Language selector
- Light/dark mode toggle
- Store name and code display
- Store PIN change (admin only)
- Logout button
- App version

### 7.7 Special Action Buttons
- "Sell Whole Book" — on shift screen, employee action, PIN protected
- "Return Book" — on shift screen, employee action, PIN protected

### 7.8 General UI
- Skeleton loaders
- Toast notifications
- Confirmation dialogs before closing shift, voiding, or reassigning
- Offline banner
- Keyboard avoiding view on all forms

---

## 8. Multilingual & Accessibility Requirements

### 8.1 Languages

| Language | RTL | Version |
|---|---|---|
| English | No | v2.0 |
| Arabic | Yes | v2.0 |
| Hindi | No | v2.1 |
| Spanish | No | v2.1 |
| French | No | v2.1 |
| Urdu | Yes | v2.1 |
| Bengali | No | v2.2 |
| Portuguese | No | v2.2 |
| Punjabi | No | v2.2 |
| Tamil | No | v2.2 |

### 8.2 RTL
- RTL enabled from v2.0 via React Native RTL API
- All screens flip layout for RTL languages
- Icons, navigation, text alignment all respect layout direction

### 8.3 Accessibility
- Touch targets minimum 44×44 points
- High contrast mode for bright store environments
- Screen reader labels on all interactive elements

---

## 9. Non-Functional Requirements

### Performance
- API response under 500ms
- Barcode matching under 200ms
- App home screen loads under 2 seconds
- Language switching instant, no restart required

### Security
- Passwords hashed with bcrypt (log rounds ≥ 12 in production)
- Store PIN hashed with bcrypt, rate-limited
- JWT expires after 8 hours
- HTTPS in production
- All queries scoped to store_id
- Role enforcement at service layer

### Reliability
- DB transactions prevent partial writes
- Assignment atomicity — reassignment is a single transaction
- Meaningful error messages for all failures

### Scalability
- store_id on all tables enables multi-tenancy
- Stateless API, horizontally scalable

### Maintainability
- Blueprint-based Flask structure
- Business logic in service layer only
- Docstrings on all functions and routes
- Flask-Migrate for schema migrations

### Testability
- 80%+ route coverage with pytest
- All service functions unit tested
- Thunder Client collection for all endpoints

---

## 10. System Architecture Overview

### Flask API Structure
```
lottometer-api/
├── app/
│   ├── __init__.py            # app factory
│   ├── config.py
│   ├── constants.py           # LENGTH_BY_PRICE
│   ├── extensions.py
│   ├── errors.py
│   ├── models/
│   │   ├── store.py
│   │   ├── user.py
│   │   ├── slot.py
│   │   ├── book.py
│   │   ├── book_assignment_history.py
│   │   ├── shift_details.py
│   │   ├── shift_books.py
│   │   └── shift_extra_sales.py
│   ├── schemas/
│   ├── services/
│   │   ├── auth_service.py
│   │   ├── store_service.py
│   │   ├── slot_service.py
│   │   ├── book_service.py
│   │   ├── shift_service.py
│   │   ├── scan_service.py
│   │   ├── extra_sales_service.py
│   │   └── report_service.py
│   └── routes/
├── migrations/
├── tests/
├── .env.example
├── requirements.txt
├── Dockerfile
└── docker-compose.yml
```

### React Native Structure
```
lottometer-mobile/
├── src/
│   ├── api/
│   ├── screens/
│   │   ├── SplashScreen.js
│   │   ├── OnboardingScreen.js
│   │   ├── LoginScreen.js
│   │   ├── HomeScreen.js
│   │   ├── ShiftScreen.js
│   │   ├── ScanScreen.js
│   │   ├── BookListScreen.js           # admin slots view
│   │   ├── ShiftHistoryScreen.js
│   │   └── SettingsScreen.js
│   ├── components/
│   │   ├── SkeletonLoader.js
│   │   ├── ToastNotification.js
│   │   ├── ConfirmDialog.js
│   │   ├── PinDialog.js
│   │   └── OfflineBanner.js
│   ├── context/
│   ├── navigation/
│   ├── locales/
│   └── utils/
├── App.js
└── package.json
```

---

## 11. Database Design

Eight models. Full ERD with columns, constraints, and relationships is in `docs/ERD.md`.

| Model | Purpose |
|---|---|
| Store | Root tenant; holds store PIN and scan_mode preference |
| User | Employees and admins; soft-deletable (deleted_at) |
| Slot | Physical location for a book, holds ticket_price |
| Book | Lottery ticket book — created via slot assignment |
| BookAssignmentHistory | Every assignment / reassignment / unassignment event |
| ShiftDetails | Main shifts and sub-shifts (self-referential) |
| ShiftBooks | Scan records (open + close per book per sub-shift) |
| ShiftExtraSales | Whole-book sales (not tied to Book records) |

---

## 12. API Endpoints Overview

Full API contract is in `docs/API_Contract.md`.

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
| POST | /api/shifts/{id}/subshifts | JWT | any |
| PUT | /api/shifts/{id}/close | JWT | any |
| POST | /api/shifts/{id}/void | JWT | admin |
| POST | /api/shifts/{id}/subshifts/{sub_id}/void | JWT | admin |
| POST | /api/scan | JWT | any |
| POST | /api/shifts/{id}/whole-book-sale | JWT | any (PIN) |
| GET | /api/reports/shift/{id} | JWT | any |

---

## 13. Use Cases

### UC-01: Store Setup
Admin performs first-run setup: creates store, first admin user, store PIN, and slots.

### UC-02: Bulk Book Assignment
Admin opens slots screen, taps Slot 1, scans book barcode. App auto-advances to Slot 2. Admin continues until all slots filled.

### UC-03: Reassign Book
Admin scans a book that's already active in another slot. App prompts to confirm move. On confirm, book moves to new slot; old slot becomes empty.

### UC-04: Open Shift
Employee opens main shift. Sub-shift 1 auto-created, all active books pending. Employee scans each book's open position before the sub-shift is initialized.

### UC-05: Last-Ticket Scan Mid-Shift
Employee sells the final ticket of a book. Scans the barcode. Last-ticket detection fires, book marked sold, slot becomes empty. Subsequent sales of the new (replacement) book — if any — continue normally.

### UC-06: Sub-Shift Handover (Correct Close)
Previous sub-shift closed with difference=0. New sub-shift auto-inherits close positions. Employee can continue immediately unless admin added new books.

### UC-07: Sub-Shift Handover (Short/Over Close)
Previous sub-shift closed with difference ≠ 0. New sub-shift requires full rescan of all books.

### UC-08: Sell Whole Book
Employee taps Sell Whole Book. Scans barcode, picks price, enters PIN. ShiftExtraSales row created. Sub-shift total updated.

### UC-09: Return to Vendor
Lottery salesman removes a book. Employee taps Return Book. Scans barcode, enters PIN. Book unassigned and marked returned. Pre-return revenue preserved in current sub-shift.

### UC-10: Close Final Sub-Shift
Employee scans the final position of each book still in a slot. Enters cash_in_hand, gross_sales, cash_out. System calculates totals and status. Main shift closes.

### UC-11: View Report
Employee or admin opens history, taps a shift. Sees main shift totals + each sub-shift + ticket breakdown + whole-book sales + returns + voids.

### UC-12: Void a Sub-Shift
Admin identifies an erroneous sub-shift. Provides reason. System marks voided. Data preserved, excluded from main totals.

### UC-13: Switch Language
Employee opens Settings, picks a language. App switches instantly, RTL applied if applicable.

---

## 14. Commercialization Requirements

| Area | Requirement | Version |
|---|---|---|
| Multi-tenancy | store_id on all tables | v2.0 ✅ |
| Multi-tenancy | Store self-registration | v2.1 |
| RBAC | role column on User | v2.0 ✅ |
| RBAC | Admin role enforcement on endpoints | v2.0 ✅ |
| Billing | Stripe + Plan + Subscription models | v2.1 |
| Analytics | Analytics API + web dashboard | v2.1 |
| UI | Font size, print layout, thermal printer | v2.1 |
| Languages | Hindi, Spanish, French, Urdu | v2.1 |
| Languages | Bengali, Portuguese, Punjabi, Tamil | v2.2 |
| Infrastructure | Sentry, uptime monitoring | v2.1 |

---

## 15. Constraints & Assumptions

- One store per deployment in v2.0 (multi-store is v3.0)
- One open main shift per store at any time
- Every main shift has at least one sub-shift
- Slot capacity is exactly one active book at a time
- Ticket prices are fixed to six values ($1, $2, $3, $5, $10, $20)
- Book lengths by price are fixed business constants
- static_code is globally unique per lottery book (barcode manufacturer guarantee)
- The app is not a point-of-sale — routine ticket sales are handled at the register; the app handles book lifecycle and shift reconciliation
- Supports both camera-based scanning and hardware barcode scanners (keystroke wedge mode)
- Internet required for mobile app
- Employees have iOS 14+ or Android 10+ devices

---

## 16. Future Enhancements

| Feature | Version |
|---|---|
| Admin role enforcement | v2.0 ✅ (moved up from v2.1) |
| Store self-registration | v2.1 |
| Stripe billing | v2.1 |
| Analytics dashboard (web) | v2.1 |
| PDF shift report export | v2.1 |
| Excel/CSV export | v2.1 |
| Font size preference | v2.1 |
| Print layout customization | v2.1 |
| Bluetooth thermal printer | v2.1 |
| Hindi, Spanish, French, Urdu | v2.1 |
| Push notifications | v2.2 |
| Bengali, Portuguese, Punjabi, Tamil | v2.2 |
| Multi-store platform | v3.0 |
| POS integration | v3.0 |
| Offline mode with sync | v3.0 |
| Alternate auth for return (admin approval via push) | v2.2 |

---

## 17. Glossary

| Term | Definition |
|---|---|
| Store | Root tenant entity representing a retail store |
| Slot | Physical location holding lottery books, has a fixed ticket price |
| Book | A lottery ticket book with barcode, static_code, and position |
| static_code | Barcode minus last 3 digits — globally unique per book |
| position | A ticket's index within the book (0-indexed, last 3 digits of barcode) |
| start_position | The book's position at the time of assignment |
| is_active | True when a book is assigned to a slot |
| is_sold | True when the last ticket barcode has been scanned |
| returned_at | Set when the book was removed by the lottery vendor |
| LENGTH_BY_PRICE | Mapping from ticket price to book length |
| Main Shift | Container shift — totals are sum of non-voided sub-shifts |
| Sub-shift | A work period within a main shift — has its own scans and financials |
| scan event | A discrete moment requiring a scan: shift open, last ticket of a book, return-to-vendor, or shift close |
| scan_type | open or close |
| scan_source | scanned, carried_forward, whole_book_sale, or returned_to_vendor |
| start_at_scan | The book's position at the time of the scan |
| is_last_ticket | True when position == LENGTH_BY_PRICE[price] - 1 |
| pending_scans | Books that must be scanned before the sub-shift is initialized |
| tickets_total | Sum of sub-shift scanned sales + whole-book sales + return partials |
| expected_cash | gross_sales + tickets_total - cash_out |
| difference | cash_in_hand - expected_cash |
| shift_status | correct (=0), over (>0), short (<0) |
| ticket_breakdown | Per-price breakdown of tickets sold (scanned vs whole-book) |
| Void | Admin action that excludes a shift from totals without deleting data |
| Store PIN | 4-digit PIN for whole-book-sale and return-to-vendor authorization |
| RTL | Right-to-Left layout for Arabic and Urdu |
| i18n | Internationalization — multilingual support |
| store_id | Foreign key scoping all data to a specific store |
| RBAC | Role-Based Access Control |
| PDF export | Client-side generation of a printable shift report via expo-print, delivered through the OS share sheet for print, save, or email |

---

## 18. Decision Log

Key decisions made during SRS v5.0 design review (April 2026):

1. **`end` and `total` removed from Book schema** — derived from `LENGTH_BY_PRICE` and scan history.
2. **Book lengths by price are fixed business constants** — not configurable.
3. **static_code globally unique per book** — barcode format guarantee; removes suffix-price ambiguity.
4. **Book assignment and creation unified** — `POST /api/slots/{slot_id}/assign-book` handles both new-book creation and reassignment.
5. **No hard-delete for Book** — "delete" in admin UI means unassign.
6. **Slot edits split by field** — slot_name anytime, ticket_price only when empty.
7. **Soft delete for slots** — preserves historical references.
8. **Carry-forward is trust-based** — only after 'correct' status; 'short'/'over' forces full rescan.
9. **Pending-scans blocking** — sub-shift cannot complete initialization until all active books scanned.
10. **Scan rescan overwrites** — no duplicate-scan error; simpler correction UX.
11. **Rule 8: no open rescan after close started** — prevents mid-shift history rewriting.
12. **Whole-book-sale doesn't create Book row** — new ShiftExtraSales table handles it.
13. **Single store PIN** — reused for whole-book-sale and return-to-vendor.
14. **Store PIN mandatory at setup** — no "configure later" path.
15. **Return-to-vendor preserves pre-return revenue** — scan captures position, recorded as close scan.
16. **Admin role enforced from v2.0** — moved up from v2.1.
17. **Void preserves all data** — flag-only; no deletion; downstream sub-shifts unaffected.
18. **Per-book reports include open_position, close_position, scan_source, slot_at_scan_time**.
19. **ShiftBooks PK = (shift_id, barcode, scan_type)** — fixes double-scan bug from v4.0.
20. **Partial unique index for one open main shift per store** — DB-level enforcement.
21. **Composite unique constraints** — (store_id, X) for barcode, static_code, slot_name, username.
22. **Reassignment requires explicit confirmation** — `confirm_reassign: true` flag.

### v5.1 revision (April 2026):

23. **Scan event model clarified** — scans occur only at shift open, last-ticket of a book, return-to-vendor, and shift close. The app is not a point-of-sale; routine ticket sales are handled at the register. Per-book totals are reconciled at close from open/close positions.

24. **Hardware barcode scanner support** — scan screen supports both camera (Expo Camera) and hardware scanners (Zebra, Honeywell, etc. via keystroke wedge mode).

### v5.2 revisions (April 2026 — implementation phase, caught via end-to-end mobile testing):

25. **ShiftBooks PK changed to (shift_id, static_code, scan_type)** — the previous PK `(shift_id, barcode, scan_type)` did not pair open and close scans correctly because the full barcode includes the position digits. An open scan at position 0 (`<static_code>000`) and a close scan at position 59 (`<static_code>059`) for the same book have different PKs under the old scheme, breaking Rule 7's "close ≥ open" lookup. Keying on `static_code` fixes this — the position is captured in `start_at_scan` regardless. Migration: required a table rebuild; no scan data was preserved (caught early in implementation).

26. **Last-ticket detection requires scan_type=close** — the original §5.8 implementation fired on any scan at the last position, including opens. Open scans at the last position should never sell the book; they're just opening it at that position. Now requires `scan_type == "close"`.

27. **Last-ticket detection requires close > open** — added second guard: even on a close scan at the last position, the book is only marked sold if `close_position > open_position`. This rules out the edge case of a book sitting at the last position all shift with zero movement (e.g. carried forward from a previous shift, never sold). Without this, the close-at-last scan would mark the book sold incorrectly.

28. **Rule 8 narrowed to rewrites only** — the original §5.7 Rule 8 blocked ALL open scans after any close had started in the sub-shift. This broke the legitimate case of an admin assigning a brand-new book mid-shift, which then needs its first open scan. Now Rule 8 only blocks **rewriting** an existing open scan; brand-new opens are allowed.

29. **Mobile scan_type picker auto-locks based on sub-shift state** — the picker forces "Open" when the sub-shift is not yet initialized (pending opens exist) and forces "Close" when initialized. This eliminates the entire class of UX errors where an employee accidentally selects the wrong scan_type. Combined with #26, makes the close-at-last sale flow unambiguous.

30. **Slot serializer populates current_book** — the original `serialize_slot` had `current_book: None` as a TODO that was never finished, causing the slots list to always show "empty" even when books were assigned. Now correctly queries the active book by `(slot_id, store_id, is_active=True)` and includes it in the slot dict.

31. **`_compute_subshift_tickets_total` now scoped to store_id** — previously took only `subshift_id`, leaving the function multi-tenancy-unsafe. All ShiftBooks/Book/ShiftExtraSales queries inside now also filter by `store_id`. Same change applied to `get_running_summary`. (Note: an audit pass for similar holes is recommended pre-deployment.)

32. **i18n implemented from v2.0 with English + Arabic + RTL** — all user-facing strings flow through `react-i18next`'s `t()` lookups, with translations in `src/locales/{en,ar}.json`. Language preference persists in AsyncStorage. RTL layout flip via `I18nManager.forceRTL` requires app restart and is signaled to the user with a "Restart Required" prompt. Architecture supports adding the v2.1 languages (Hindi, Spanish, French, Urdu) by dropping in JSON files only.

33. **Live preview on shift close modal** — the close shift modal computes `expected_cash`, `difference`, and status (correct/over/short) live as the employee types cash values, using a new `GET /api/shifts/{id}/summary` endpoint for the running tickets_total. Submission is blocked when any active books still need close scans (`books_pending_close > 0`).

34. **Camera barcode scanning via expo-camera** — full-screen modal scanner with a target rectangle and vibration feedback on detection. Used from Scan, SlotDetail (assign), WholeBookSale, and Return modals. Manual barcode entry remains as a fallback on every screen that uses scanning.

35. **Reassignment confirmation flow on mobile** — when a scanned barcode matches a book already active in another slot, the API returns `REASSIGN_CONFIRMATION_REQUIRED` (409). The mobile app catches this and shows a "Move it" / "Cancel" dialog before retrying with `confirm_reassign: true`. Implements the SRS Decision #22.

### v5.3 revisions (April 2026 — Phase 5 pre-deployment hardening):

36. **Multi-tenancy audit complete** — swept all 8 service files for queries touching multi-tenant tables that lacked `store_id` filtering. Found and fixed 19 gaps: 1 direct exploit (`GET /api/shifts/{id}/summary` had no ownership check on the subshift_id from the URL) and 18 depth-gap holes in internal helper functions. Cross-tenant test sequence T-01–T-10 verified. `FR-AUTH-06` added to §6.2.

37. **Admin user management CRUD** — `GET|POST /api/users`, `GET|PUT|DELETE /api/users/{id}`. Admin can create, list, edit, and soft-delete users. Self-protection rules: admin cannot delete or deactivate their own account. Moved up from v2.1 scope.

38. **User soft-delete (deleted_at column)** — consistent with Slot soft-delete pattern. Partial unique index `(store_id, username) WHERE deleted_at IS NULL` allows username reuse after deactivation while preserving historical login and audit rows. Soft-deleted users cannot log in.

39. **Bulk slot management** — `POST /api/slots/bulk` (up to 500 slots per request, transactional) and `POST /api/slots/bulk-delete` (by id list, only empty non-deleted slots). Avoids one-at-a-time slot creation during initial store setup.

40. **Store.scan_mode preference** — new column on Store, values: `camera_single | camera_continuous | hardware_scanner`, default `camera_single`. Returned in auth responses; mobile client reads on login and applies immediately. Admin changes via `PUT /api/store/settings/scan-mode`.

41. **Mobile continuous scan mode** — camera stays open after a successful scan; 2-second deduplication guard prevents double-recording the same barcode in rapid succession. Activated when `scan_mode = camera_continuous`.

42. **ITF-14 normalization on mobile** — 13-digit barcodes beginning with 0 are stripped of the leading 0 before barcode parsing. Lottery ticket barcodes may be wrapped in an ITF-14 carrier by scanner firmware; normalization ensures the correct `static_code` is extracted regardless.

43. **Client-side L1 and L2 validation on mobile** — the scan screen pre-fetches the store's active-book map. Before calling `POST /api/scan`, the mobile client checks (L1) whether the `static_code` exists in the map and (L2) whether the extracted position is in `[0, length-1]` for the book's price. Immediate UI feedback without a round-trip; server still enforces all rules.

### v5.4 revisions (April 2026):

44. **Role-based scoping on GET /api/shifts** — admin receives all main shifts in the store with full filter support (date range, status, opened_by user); employee receives at most 2 shifts (current open + most recent closed in the store), all query params ignored except pagination, voided shifts excluded.

45. **Store-wide "most recent closed" for employee view rather than per-employee** — returns the most recently closed main shift in the store, not the most recent one opened by that employee. Simpler and sufficient for the small-store trust model; avoids ambiguity when multiple employees share a device.

46. **Client-side PDF export for v2.0 via expo-print + OS share sheet** — server-side PDF generation deferred to v2.1 dashboard work. Client-side approach requires no new backend endpoint and covers print, save, and email through the OS share sheet in a single action.

47. **Single share-sheet export button rather than separate print/save/email actions** — the OS share sheet already exposes all output options natively; separate buttons would duplicate the sheet's own UI and clutter the report detail screen.

### v5.6 revisions (April 2026):

50. **Books summary endpoint added** — `GET /api/books/summary` returns aggregate counts (`active`, `sold`, `returned`, `total`) scoped to the store. Added to support the mobile books-dashboard chip widget without fetching the full book list on every navigation. Lightweight aggregate query (four `.count()` calls on the same base query); cheaper than returning all book rows and computing counts client-side. Read-only; no writes. Any authenticated role may call it.

### v5.7 revisions (April 2026):

51. **Books activity endpoint and `sold_at` column** — `GET /api/books/activity?period=<week|month|year|all>` returns rolling time-windowed counts of sold and returned books, plus an equal-length previous-period snapshot to power trend arrows in the mobile home dashboard. `sold_at` (nullable DateTime) was added to the `books` table and stamped by `scan_service` at the moment `is_sold` is set; this keeps the activity query a simple `COUNT` with a range filter on an indexed column rather than a derived join against `shift_books`. `returned_at` was already present. Admin-only because activity trends are a management concern, not operational. Calendar-day rolling windows (7/30/365) chosen over ISO calendar weeks/months for implementation simplicity.

### v5.5 revisions (April 2026):

48. **`force_sold` parameter on scan API** — auto-detection of the "last ticket sold" event collapsed two distinct employee intents: (a) "I'm selling the final ticket — mark this book sold" and (b) "I'm recording the close position at N-1 but the last ticket is still in the book." Both produce a close scan at `position == length - 1` with movement, so auto-detect cannot distinguish them. The `force_sold` boolean lets the mobile client be explicit. `force_sold: true` sells the book (server still validates the three structural conditions); `force_sold: false` records the position without selling; `null`/omitted is unchanged auto-detect. Surfaced as a UX issue during mobile last-ticket confirmation testing.

49. **Mobile last-ticket confirmation gate** — mobile ScanScreen now fetches the store's active slot list on focus to detect client-side when a close scan is at the last position of the book. When detected, a confirmation dialog is shown before submitting. On confirm, the scan is submitted with `force_sold: true`; on cancel, the input is cleared and no scan is sent. Falls back gracefully (no confirmation, auto-detect) if the slot list fails to load.

---

*Document end — LottoMeter v2.0 SRS v5.5 — Verified & Final*
