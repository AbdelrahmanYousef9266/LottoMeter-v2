# Software Requirements Specification — LottoMeter v2.0

**Version:** 7.0
**Date:** May 2026
**Status:** Current — reflects system as built through Phase 5 (offline mode, account settings, report email, pytest)

---

## 1. Introduction

### 1.1 Purpose
This document specifies the functional and non-functional requirements for LottoMeter v2.0 — a SaaS shift management system for convenience stores that sell lottery tickets. It serves as the authoritative reference for the system as implemented and deployed.

### 1.2 Scope
LottoMeter v2.0 consists of:
- A Flask REST API backend deployed on Render (api.lottometer.com)
- A React Native mobile app (Expo SDK 54) for store employees and admins, with full offline scan capability (expo-sqlite)
- A React (Vite) web dashboard for store admins (18 pages including Account Settings)
- A public marketing website (React + Vite)
- A superadmin panel for LottoMeter platform staff

### 1.3 Definitions
| Term | Definition |
|---|---|
| Store | A single retail location — the root tenant entity |
| BusinessDay | One calendar day's operational container for a store; auto-created on first shift open |
| EmployeeShift | One employee's work session within a BusinessDay |
| Book | A physical lottery ticket book (a pad of tickets) assigned to a slot |
| Slot | A physical rack position in the store; holds one book at a time |
| static_code | A book's unique identity — the barcode minus the last 3 position digits |
| Scan | Recording of a barcode at shift open or close time |
| Initialization | The state when all active books have an open scan for the current shift |
| Superadmin | A LottoMeter platform staff member with cross-store access |

---

## 2. System Architecture

### 2.1 Components

**Online path:**
```
┌──────────────────────┐        HTTPS        ┌───────────────────────────┐
│  React Native App    │ ◄──────────────────► │   Flask REST API          │
│  (iOS / Android)     │                      │   api.lottometer.com      │
│  Expo SDK 54         │                      │   Render (Ohio)           │
└──────────────────────┘                      └────────────┬──────────────┘
                                                           │
┌──────────────────────┐                      ┌────────────▼──────────────┐
│  React Web Dashboard │ ◄──────────────────► │   PostgreSQL              │
│  (Vite + React)      │                      │   Render Postgres         │
│  localhost:3001 (dev)│                      └───────────────────────────┘
└──────────────────────┘
┌──────────────────────┐
│  Public Marketing    │   (static, no auth)
│  Website             │
│  lottometer.com      │
└──────────────────────┘
┌──────────────────────┐
│  Superadmin Panel    │   (React, superadmin-only JWT)
│  /superadmin/*       │
└──────────────────────┘
```

**Offline path (mobile only):**
```
┌──────────────────────┐   offline   ┌───────────────────────────┐
│  React Native App    │ ◄──────────► │  Local SQLite DB          │
│  (scan engine)       │             │  (expo-sqlite, WAL mode)  │
│  NetInfo: offline    │             │  9 tables, seeded on login │
└──────────┬───────────┘             └───────────────────────────┘
           │ on reconnect
           ▼
┌──────────────────────┐        HTTPS        ┌───────────────────────────┐
│  Sync Queue          │ ────────────────────► │   Flask REST API          │
│  (offline records)   │                      │   (sync endpoints — TBD)  │
└──────────────────────┘                      └───────────────────────────┘
```

### 2.2 Tech Stack

| Layer | Technology |
|---|---|
| Mobile App | React Native (Expo SDK 54), New Architecture |
| Web Dashboard | React 18 + Vite |
| API | Flask (Python 3.11+), Gunicorn |
| ORM | SQLAlchemy 2.x |
| Serialization | Marshmallow |
| Database (dev) | SQLite |
| Database (prod) | PostgreSQL (Render) |
| Auth | JWT (Flask-JWT-Extended), 8-hour expiry |
| Camera | expo-camera |
| Token storage | expo-secure-store (JWT + offline PIN) |
| Local DB (mobile) | expo-sqlite (WAL mode, offline engine — complete) |
| Network detection | @react-native-community/netinfo |
| i18n | i18next + react-i18next + expo-localization |
| Testing | pytest + pytest-flask (46 tests) |
| Containerization | Docker + docker-compose |
| Deployment | Render Web Service + Render Postgres |
| Error tracking | Sentry (Flask + React Native) |
| Uptime monitoring | UptimeRobot |
| Payments | Stripe (planned — Phase 5b) |
| Email | SendGrid (planned — Phase 5c) |

---

## 3. Data Model

### 3.1 Models (13 total)

| # | Model | Table | Description |
|---|---|---|---|
| 1 | Store | stores | Root tenant entity |
| 2 | User | users | Employees, admins, superadmins |
| 3 | Slot | slots | Physical book rack position |
| 4 | Book | books | Lottery ticket book lifecycle |
| 5 | BookAssignmentHistory | book_assignment_history | Assignment audit trail |
| 6 | BusinessDay | business_days | Daily container (auto-managed) |
| 7 | EmployeeShift | employee_shifts | Employee work session |
| 8 | ShiftBooks | shift_books | Scan records (open + close) |
| 9 | ShiftExtraSales | shift_extra_sales | Whole-book sales |
| 10 | Subscription | subscriptions | Store billing state |
| 11 | StoreSettings | store_settings | Store operational preferences |
| 12 | AuditLog | audit_logs | Platform action audit trail |
| 13 | ContactSubmission | contact_submissions | Public form submissions |

See [ERD.md](ERD.md) for full schema with column types, constraints, and relationships.

### 3.2 Multi-Tenancy
Every operational table carries `store_id` as a foreign key to `stores`. All service layer queries filter by `store_id` extracted from the JWT claim. Cross-store access returns 404 (does not leak existence). The multi-tenancy audit (Phase 4c) closed 19 identified gaps.

### 3.3 Soft Deletes
`User` and `Slot` use `deleted_at` timestamps for soft deletes. Partial unique indexes on `(store_id, username) WHERE deleted_at IS NULL` and `(store_id, slot_name) WHERE deleted_at IS NULL` allow name reuse after deactivation while preserving historical references.

### 3.4 Book Length Constants
Fixed in `app/constants.py`. Not configurable.

| Ticket Price | Book Length | Last Position |
|---|---|---|
| $1.00 | 150 | 149 |
| $2.00 | 150 | 149 |
| $3.00 | 100 | 99 |
| $5.00 | 60 | 59 |
| $10.00 | 30 | 29 |
| $20.00 | 30 | 29 |

---

## 4. API

### 4.1 Overview
- 52+ REST endpoints under `/api`
- 12 Flask blueprints: auth, store, user, slot, book, employee_shift, business_day, scan, extra_sales, report, subscription, public, superadmin, stripe
- Standard JWT auth; public endpoints are unauthenticated but rate-limited
- Uniform error envelope: `{ "error": { "code": "...", "message": "...", "details": {} } }`

See [API_Contract.md](API_Contract.md) for full endpoint reference.

### 4.2 Scan Rules (8 rules, server-enforced)
1. Book must exist (BOOK_NOT_FOUND)
2. Book must not be sold (BOOK_ALREADY_SOLD)
3. Book must be active (BOOK_NOT_ACTIVE)
4. Position must be in valid range for the book's price (INVALID_POSITION)
5. Open rescan blocked if close scans exist AND book already has an open scan (OPEN_RESCAN_BLOCKED)
6. Close requires an existing open scan (NO_OPEN_SCAN)
7. Close position must be ≥ open position (POSITION_BEFORE_OPEN)
8. force_sold validation: requires close scan, last position, and movement (FORCE_SOLD_REQUIRES_*)

Duplicate scans (same shift + book + scan_type) overwrite rather than error.

### 4.3 Last-Ticket Detection
The book is marked sold ONLY when all three hold:
- `scan_type == "close"`
- `position == LENGTH_BY_PRICE[ticket_price] - 1`
- `close_position > open_position` (real movement happened this shift)

### 4.4 Shift Validation Formula
```
tickets_total  = Σ scanned sales + whole-book extras + return partials
expected_cash  = gross_sales + tickets_total - cash_out - cancels
difference     = cash_in_hand - expected_cash

difference = 0   → correct
difference > 0   → over
difference < 0   → short
```

`cancels` is entered manually at shift close (defaults to 0.00). It represents voided/cancelled ticket value for the shift.

---

## 5. Functional Requirements

### 5.1 Authentication (FR-AUTH)
- FR-AUTH-01: Store identified by unique `store_code`; user by `username` within the store
- FR-AUTH-02: Passwords stored as bcrypt hashes
- FR-AUTH-03: JWT tokens expire after 8 hours
- FR-AUTH-04: Logout adds JWT `jti` to in-memory blocklist
- FR-AUTH-05: Role-based access: `employee`, `admin`, `superadmin`
- FR-AUTH-06: `superadmin` role grants cross-store access to the superadmin panel
- FR-AUTH-07: Any authenticated user may change their own password via `PUT /api/auth/change-password`; requires current password verification, minimum length 8, and confirmation match

### 5.2 Store Setup (FR-SETUP)
- FR-SETUP-01: First `/api/auth/setup` call creates the store, first admin, and store PIN
- FR-SETUP-02: Subsequent setup calls return 409
- FR-SETUP-03: Store PIN is mandatory at setup; 4 digits; stored as bcrypt hash
- FR-SETUP-04: Superadmins may provision additional stores via `/api/superadmin/stores`

### 5.3 Slot Management (FR-SLOT)
- FR-SLOT-01: Admin creates/edits/deletes slots (soft delete)
- FR-SLOT-02: Slot `ticket_price` is immutable while a book is active in it
- FR-SLOT-03: Slot names unique within a store (among non-deleted)
- FR-SLOT-04: Bulk slot creation (up to 500) and bulk delete in single requests

### 5.4 Book Management (FR-BOOK)
- FR-BOOK-01: Books are created by scanning a barcode into a slot (assign-book endpoint)
- FR-BOOK-02: A slot holds at most one active book; reassignment requires `confirm_reassign: true`
- FR-BOOK-03: "Delete book" = unassign (row preserved for history)
- FR-BOOK-04: Return-to-vendor flow: PIN-authorized; records a close scan; marks book returned

### 5.5 Shift Management (FR-SHIFT)
- FR-SHIFT-01: Only one EmployeeShift may be open per store at a time (DB-enforced partial unique index)
- FR-SHIFT-02: Opening a shift auto-creates today's BusinessDay if one doesn't exist
- FR-SHIFT-03: Carry-forward from previous shift only runs when previous `shift_status = 'correct'`
- FR-SHIFT-04: All active books must have close scans before a shift can be closed
- FR-SHIFT-05: Admin can void any shift; void preserves all data as a flag

### 5.6 BusinessDay Management (FR-BD)
- FR-BD-01: One BusinessDay per store per calendar date (unique constraint)
- FR-BD-02: BusinessDay is auto-created — never manually opened by store staff
- FR-BD-03: Only admins can close a BusinessDay
- FR-BD-04: BusinessDay cannot close while any EmployeeShift is still open

### 5.7 Scanning (FR-SCAN)
- FR-SCAN-01: Scans accepted only within an open, non-voided EmployeeShift
- FR-SCAN-02: All 8 scan rules enforced server-side (see §4.2)
- FR-SCAN-03: Sales blocked until shift is initialized (all active books have open scans)
- FR-SCAN-04: Camera, manual entry, and hardware scanner (keystroke-wedge) all supported
- FR-SCAN-05: Offline scanning supported via local SQLite (Phase 5a); synced to server when online

### 5.8 Financial Close (FR-CLOSE)
- FR-CLOSE-01: Closing inputs entered manually: cash_in_hand, gross_sales, cash_out, cancels (optional, default 0)
- FR-CLOSE-02: System calculates tickets_total, expected_cash (= gross_sales + tickets_total - cash_out - cancels), difference, shift_status
- FR-CLOSE-03: Live preview available via `GET /api/shifts/{id}/summary`

### 5.12 Account Settings (FR-ACCT)
- FR-ACCT-01: Store profile (store_name, owner_name, email, phone, address, city, state, zip_code) editable by admin via `PUT /api/store/profile`; store_code is immutable
- FR-ACCT-02: Store operational settings editable via `PUT /api/store/settings` (timezone, currency, business hours, max_employees, notification prefs, report prefs)
- FR-ACCT-03: Report settings: report_email, report_format (html/text), report_delay_hours, report_enabled
- FR-ACCT-04: Daily report email auto-triggered when BusinessDay closes; wrapped in try/except so email failure never blocks day close
- FR-ACCT-05: Web dashboard Account Settings page provides tabbed UI: Profile & Store, Hours & Reports, Security, Subscription

### 5.9 Subscription System (FR-SUB)
- FR-SUB-01: Each store has exactly one Subscription row, auto-created on provisioning with `status='trial'`
- FR-SUB-02: Store staff can view their own subscription status
- FR-SUB-03: Superadmins can cancel, reactivate, and extend trial periods
- FR-SUB-04: Stripe integration is a placeholder; `PAYMENTS_ENABLED` flag gates the webhook

### 5.10 Superadmin Panel (FR-SUPER)
- FR-SUPER-01: `superadmin` role required for all `/api/superadmin/*` endpoints
- FR-SUPER-02: Superadmins can create, update, suspend, and activate stores
- FR-SUPER-03: Superadmins review and approve contact/apply form submissions
- FR-SUPER-04: All significant superadmin actions logged to `audit_logs`
- FR-SUPER-05: Superadmins have read access to all subscriptions and audit logs

### 5.11 Public Marketing (FR-PUBLIC)
- FR-PUBLIC-01: Contact, apply, and waitlist forms are unauthenticated
- FR-PUBLIC-02: Rate limiting applied: 5/min for contact/waitlist, 3/hr for apply
- FR-PUBLIC-03: Honeypot field `website` silently discards bot submissions
- FR-PUBLIC-04: All submissions stored in `contact_submissions` and visible in superadmin panel

---

## 6. Non-Functional Requirements

### 6.1 Security
- NF-SEC-01: All passwords and PINs stored as bcrypt hashes; never in plaintext
- NF-SEC-02: JWT tokens validated on every request; blocklist enforced on logout
- NF-SEC-03: All data queries scoped to `store_id` from JWT (never from request body)
- NF-SEC-04: PIN rate-limited: max 5 failures in 10 minutes; 429 with `Retry-After` on lockout
- NF-SEC-05: Public endpoints rate-limited via Flask-Limiter
- NF-SEC-06: HTTPS enforced end-to-end (Render Let's Encrypt)
- NF-SEC-07: Sensitive fields (passwords, PINs) never serialized in API responses

### 6.2 Performance
- NF-PERF-01: Scan endpoint must respond within 500ms under normal load
- NF-PERF-02: Shift summary endpoint computes live — no caching required at current scale
- NF-PERF-03: Bulk slot creation handles up to 500 slots in one transaction

### 6.3 Reliability
- NF-REL-01: Production database has daily automated backups (Render Postgres)
- NF-REL-02: Uptime monitored at 5-minute intervals (UptimeRobot)
- NF-REL-03: Errors reported in real time (Sentry)
- NF-REL-04: Offline mode (Phase 5a) enables scanning without network; sync on reconnect

### 6.4 Internationalization
- NF-I18N-01: English and Arabic are fully implemented with translation parity
- NF-I18N-02: Arabic uses full RTL layout flip via `I18nManager.forceRTL`
- NF-I18N-03: Language persisted across app restarts (AsyncStorage)
- NF-I18N-04: Architecture (i18next + JSON files) supports adding new languages as a file drop-in

### 6.5 Deployment
- NF-DEPLOY-01: Backend deployed on Render Starter tier ($7/mo); containerized with Docker
- NF-DEPLOY-02: Database on Render Basic Postgres ($6/mo); daily backups
- NF-DEPLOY-03: Mobile distributed via EAS Build (APK, internal distribution)
- NF-DEPLOY-04: Web dashboard runs on localhost:3001 (dev); production deployment planned (Phase 5e)
- NF-DEPLOY-05: Custom domain: api.lottometer.com (Cloudflare DNS, Render SSL)

---

## 7. Mobile App Requirements

### 7.1 Screens
| Screen | Role | Description |
|---|---|---|
| Login | all | Store code + username + password |
| Home | all | Current shift state, open/close shift, offline banner |
| Scan | all | Barcode scan (camera + manual + hardware scanner) |
| Books | admin | Slots grid, assign/unassign/return |
| History | all | Shift history list with role-based scoping |
| Report | all | Shift report detail + PDF export |
| Settings | all | Language, logout; PIN change (admin) |

### 7.2 Scan Modes
| Mode | Behavior |
|---|---|
| `camera_single` | Open camera, scan one barcode, return to scan screen |
| `camera_continuous` | Camera stays open; 2-second deduplication guard |
| `hardware_scanner` | Camera hidden; text input auto-focused for keystroke-wedge |

### 7.3 Offline Mode (Complete)
- Local SQLite DB (expo-sqlite, WAL mode) with 9 tables seeded on login
- PIN login with 72-hour session expiry stored in expo-secure-store
- Offline scan engine mirrors all 8 server scan rules locally
- Carry-forward logic runs offline — open scans brought forward without network
- Sync queue persists offline scans for upload on reconnect
- Offline banner displayed when `NetInfo.isConnected === false`
- Close shift blocked when offline (requires network for financial commit)
- Up to 2 days of offline operation supported

---

## 8. Web Dashboard Requirements

### 8.1 Pages (18 pages)
| Page | Role | Description |
|---|---|---|
| Login | admin | Store code + username + password |
| Dashboard | admin | Stats overview, sales charts, tickets sold today |
| Shifts | admin | Shift list + filter |
| Reports | admin | Shift report detail |
| Books | admin | Book management + book detail modal |
| Slots | admin | Slot management |
| Users | admin | User CRUD |
| BusinessDays | admin | Business day list + close |
| Subscription | admin | Subscription status display |
| Account Settings | admin | Profile, Hours & Reports, Security, Subscription tabs |
| Public: Home | public | Marketing landing page |
| Public: Pricing | public | Pricing tiers |
| Public: Apply | public | Store application form |
| Public: Contact | public | Contact form |
| Public: GetStarted | public | CTA page |
| SuperAdmin: Dashboard | superadmin | Cross-store stats |
| SuperAdmin: Stores | superadmin | Store management |
| SuperAdmin: Create Store | superadmin | Provision new store |
| SuperAdmin: Submissions | superadmin | Form submission review |

---

## 9. Supported Languages

| Language | RTL | Status |
|---|---|---|
| English | No | ✅ Implemented |
| Arabic | Yes | ✅ Implemented |
| Hindi | No | Planned (v2.1) |
| Spanish | No | Planned (v2.1) |
| French | No | Planned (v2.1) |
| Urdu | Yes | Planned (v2.1) |
| Bengali | No | Planned (v2.2) |
| Portuguese | No | Planned (v2.2) |
| Punjabi | No | Planned (v2.2) |
| Tamil | No | Planned (v2.2) |

---

## 10. Implementation Stats (May 2026)

| Metric | Value |
|---|---|
| SQLAlchemy models | 13 |
| API endpoints | 52+ |
| Flask blueprints | 12 |
| Marshmallow schemas | 12 |
| Services | 14 |
| Database migrations | 16+ |
| React web pages | 18 |
| Offline SQLite tables | 9 |
| Test coverage | 46 tests (pytest) |
| Lines of Python (approx) | ~9,500 |
| Lines of JavaScript (approx) | ~15,000 |

---

## 11. Version History

| Version | Date | Summary |
|---|---|---|
| v1.0–v4.0 | April 2026 | Initial requirements through design review |
| v5.0 | April 2026 | Post-design-review update; 22 decisions logged |
| v5.1 | April 2026 | Scan event model + hardware scanner support |
| v5.2 | April 2026 | Implementation corrections (Rule 8 narrowing, ShiftBooks PK fix) |
| v6.0 | May 2026 | Phase 4h additions: subscription system, store settings, superadmin panel, web dashboard, public marketing site; model count 9 → 13; endpoint count 39 → 47+ |
| v7.0 | May 2026 | Phase 5 additions: offline mode complete (SQLite-first, 9 tables, all 8 rules local, PIN login, auto-sync); cancels field in shift close; slot information in reports; book detail modal with assignment history; daily report email infrastructure; account settings page (web dashboard); pytest suite 46/46 passing; endpoint count 47 → 52+; web pages 15 → 18 |
