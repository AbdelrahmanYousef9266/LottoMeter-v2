# LottoMeter v2.0

> A shift management system for grocery and retail stores that sell lottery tickets.

LottoMeter v2.0 is a full rebuild of the original [LottoMeter desktop app](https://github.com/AbdelrahmanYousef9266/LottoMeter) (C# / Windows Forms), rebuilt as a cross-platform mobile application backed by a REST API — designed from day one with scalability, auditability, and commercialization in mind.

---

## What It Does

Stores that sell lottery tickets traditionally rely on manual paperwork to track ticket books during shift opening and closing. LottoMeter replaces that with a fast, barcode-based digital workflow:

- **Admin setup:** creates slots (each with a fixed ticket price) and assigns books to them by scanning barcodes
- **Shift open:** employee opens a main shift → Sub-shift 1 is auto-created → system lists every book that needs an open scan
- **During shift:** employees only scan at key events — last ticket of a book sold, whole-book sale, return to vendor, or shift close. Routine ticket sales go through the cash register.
- **Last-ticket sale:** customer buys the final ticket; employee scans it as a close — system marks book sold and frees the slot
- **Whole-book sale:** customer buys an entire book in one transaction — PIN-authorized quick flow
- **Return to vendor:** lottery salesman removes a book — PIN-authorized, preserves pre-return revenue
- **Sub-shift handover:** clean-close carries positions forward automatically; short/over forces full rescan by the next employee
- **Sub-shift close:** employee scans final positions of remaining books, enters cash numbers; system calculates totals and status (correct / over / short) with a live preview as they type
- **Admin void:** safety valve for admin-level errors — flags a shift, preserves all data, excluded from totals
- **Reports:** main shift totals + each sub-shift separately + ticket price breakdown + per-book open/close positions + whole-book sales + returns + voids

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile App | React Native (Expo SDK 54) |
| API | Flask (Python 3.11+) |
| ORM | SQLAlchemy 2.x |
| Database (Dev) | SQLite |
| Database (Prod) | PostgreSQL |
| Auth | JWT (Flask-JWT-Extended) |
| Serialization | Marshmallow |
| Camera | expo-camera |
| Token storage | expo-secure-store |
| i18n | i18next + react-i18next + expo-localization |
| Containerization | Docker + docker-compose |
| CI/CD | GitHub Actions (planned) |

---

## Architecture

```
┌─────────────────────┐        HTTPS / REST        ┌──────────────────────┐
│   React Native App  │ ◄─────────────────────────► │   Flask REST API     │
│   (iOS / Android)   │       JSON Responses         │   + SQLAlchemy ORM   │
└─────────────────────┘                              └──────────┬───────────┘
                                                                │
                                                     ┌──────────▼───────────┐
                                                     │  PostgreSQL / SQLite │
                                                     └──────────────────────┘
```

---

## Database — 8 Models

| Model | Description |
|---|---|
| `Store` | Root tenant — holds store PIN and scan_mode preference; all data isolated by store_id |
| `User` | Employees and admins with role-based access; soft-deletable (deleted_at) |
| `Slot` | Physical location holding a book — fixed ticket price, soft-deletable |
| `Book` | Lottery ticket book — created via slot assignment, tracked through lifecycle |
| `BookAssignmentHistory` | Every assignment / reassignment / unassignment event |
| `ShiftDetails` | Main shift (container) or sub-shift (has scans + financials) |
| `ShiftBooks` | Scan records — keyed on `(shift_id, static_code, scan_type)` so open and close pair correctly across position changes |
| `ShiftExtraSales` | Whole-book sales — not tied to Book records |

---

## Book Lengths by Ticket Price

Fixed business constants — not configurable:

| Ticket Price | Book Length | Last Position |
|---|---|---|
| $1 | 150 | 149 |
| $2 | 150 | 149 |
| $3 | 100 | 99 |
| $5 | 60 | 59 |
| $10 | 30 | 29 |
| $20 | 30 | 29 |

Barcode parsing: `static_code` = barcode minus the last 3 digits; `position` = last 3 digits as integer.

---

## Last-Ticket Detection

The book is marked sold ONLY when ALL three conditions hold:

1. `scan_type == "close"` — open scans at the last position never sell the book
2. `position == LENGTH_BY_PRICE[ticket_price] - 1` — at the last ticket
3. `close_position > open_position` — at least one ticket actually sold this sub-shift

This protects against accidental sales during shift opening, and against books that just sat at their last position with no movement (e.g. carried forward from a previous shift).

The mobile UI also auto-locks the scan_type picker — "open" while pending opens exist, "close" once initialized — making the wrong scan_type impossible to select.

---

## Shift Validation Formula

```
tickets_total = scanned_book_sales + whole_book_sales + return_partials
expected_cash = gross_sales + tickets_total - cash_out
difference    = cash_in_hand - expected_cash

difference = 0  → ✅ correct
difference > 0  → ⚠️ over  (more cash than expected)
difference < 0  → ❌ short (less cash than expected)
```

The mobile close-shift modal computes `expected_cash` and `difference` live as the employee types, using `GET /api/shifts/{id}/summary` for the running tickets_total.

---

## Trust-Based Sub-Shift Handover

When a sub-shift closes and the next opens within the same main shift:

- **Close status = correct** → positions carry forward automatically; next employee can sell immediately
- **Close status = short or over** → no carry-forward; next employee must rescan all books
- **Admin added new books during handover** → those become pending scans regardless of previous status
- **Sub-shift blocks sales until all pending scans complete**

Clean closes reward employees with fast handover. Discrepancies trigger full verification.

---

## Features

### v2.0 — Core (complete)
- Backend: 35 REST endpoints, 8 SQLAlchemy models, JWT auth, Marshmallow schemas, PIN rate-limiting, Docker
- Mobile: full app — auth, scanning (camera + manual), slot management, shift lifecycle, history, reports
- Admin bulk slot + book management with scan-to-assign + reassignment confirmation flow
- Admin bulk slot creation (up to 500 per request) and bulk delete via dedicated endpoints
- Admin user management: create, list, edit, soft-delete (self-protection rules enforced)
- Store scan_mode preference (camera_single | camera_continuous | hardware_scanner)
- Shift management with handover and final close, both with live cash preview
- Barcode scanning via `expo-camera` with manual fallback on every screen
- Continuous scan mode with deduplication guard (same barcode within 2 seconds ignored)
- ITF-14 normalization: strips leading 0 from 13-digit barcodes for lottery scanner compatibility
- Client-side L1 (book existence) and L2 (position range) validation before API call
- Hardware scanner mode: hides camera UI, auto-focuses text input for keystroke-wedge devices
- PIN change UI in Settings (admin-only — backend + mobile wired)
- Smart scan_type auto-locking by sub-shift initialization state
- Last-ticket detection refined to require close + real movement
- Whole-book sale with store PIN
- Return-to-vendor flow with store PIN (revenue-preserving)
- Admin void with audit trail (data-preserving)
- Auto-calculated tickets total, expected cash, difference, shift status
- Ticket price breakdown on every report (scanned vs whole-book)
- English + Arabic with full RTL layout flip
- Bottom tab navigation, pull-to-refresh, status badges
- Admin role enforcement from day 1
- PIN rate-limiting (5 attempts / 10 min)
- Multi-tenancy hardened: 19 security fixes — all queries scoped to store_id, cross-tenant returns 404
- Admin shift history filters (date range, status, employee)
- Employee shift history restricted to current open + most recent closed shift in the store
- PDF export of shift reports via expo-print + OS share sheet

### Production deployment
- Backend: https://api.lottometer.com (Render)
- Database: Render Postgres with daily backups
- Mobile: EAS Build distributable APK (Android)
- Monitoring: Sentry (error tracking) + UptimeRobot (uptime)

### v2.0 — Outstanding (deferred)
- Custom splash screen
- Onboarding flow
- Theme picker (light/dark)
- Toast notifications + skeleton loaders (polish)

### v2.1 — Growth (planned)
- Store self-registration
- Manager analytics dashboard (web)
- Stripe subscription billing
- Print layout customization, Bluetooth thermal printer
- Hindi, Spanish, French, Urdu languages
- PDF & Excel export, font size preference

### v2.2 — Expansion
- Push notifications (enables alternate auth flows)
- Bengali, Portuguese, Punjabi, Tamil languages

### v3.0 — Platform
- Multi-store admin, POS integration, offline sync

---

## Supported Languages

| Language | RTL | Version | Status |
|---|---|---|---|
| English | No | v2.0 | ✅ Implemented |
| Arabic | Yes | v2.0 | ✅ Implemented (full RTL flip) |
| Hindi | No | v2.1 | Planned |
| Spanish | No | v2.1 | Planned |
| French | No | v2.1 | Planned |
| Urdu | Yes | v2.1 | Planned |
| Bengali | No | v2.2 | Planned |
| Portuguese | No | v2.2 | Planned |
| Punjabi | No | v2.2 | Planned |
| Tamil | No | v2.2 | Planned |

The i18n architecture (i18next + JSON translation files + AsyncStorage persistence + I18nManager RTL flip) is fully built — adding new languages in v2.1/v2.2 is just a JSON file drop-in.

---

## Project Status

| Phase | Status |
|---|---|
| Planning | ✅ Complete |
| Requirements (SRS v5.2) | ✅ Complete — Verified |
| System Design (ERD v2.1, API Contract v2.1) | ✅ Complete |
| Implementation — Backend | ✅ Complete |
| Implementation — Mobile | ✅ ~95% complete |
| Testing | ⏳ Pending (Phase 5) |
| Deployment | ✅ Complete |
| Maintenance | ⏳ Pending (Phase 7) |
| Commercialization | 🗺️ Planned (Phase 8) |

---

## Repository Layout

```
LottoMeter-v2/
├── docs/
│   ├── ERD.md
│   ├── API_Contract.md
│   └── DEPLOYMENT_RUNBOOK.md
├── lottometer-api/         ← Flask REST API
│   ├── app/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   ├── routes/
│   │   ├── config.py
│   │   ├── constants.py
│   │   └── errors.py
│   ├── migrations/
│   ├── tests/
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── run.py
├── lottometer-mobile/      ← React Native (Expo)
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   ├── context/
│   │   ├── locales/        ← en.json, ar.json
│   │   ├── navigation/
│   │   ├── screens/
│   │   ├── utils/
│   │   └── i18n.js
│   ├── App.js
│   ├── eas.json
│   └── package.json
├── README.md
├── SDLC.md
└── SRS_LottoMeter_v2.md
```

---

## Documentation

| Document | Description |
|---|---|
| [SRS_LottoMeter_v2.md](./SRS_LottoMeter_v2.md) | Software Requirements Specification v5.2 |
| [SDLC.md](./SDLC.md) | SDLC phase tracker + decision log + commercialization roadmap |
| [docs/ERD.md](./docs/ERD.md) | Entity Relationship Diagram v2.1 — 8 models |
| [docs/API_Contract.md](./docs/API_Contract.md) | Full API endpoint and JSON contract v2.1 |
| [docs/DEPLOYMENT_RUNBOOK.md](./docs/DEPLOYMENT_RUNBOOK.md) | Operational guide for production environment |

---

## Previous Version

Source: [LottoMeter v1](https://github.com/AbdelrahmanYousef9266/LottoMeter) — C# / .NET 8 Windows Forms / SQLite

---

## Author

**Abdelrahman Yousef**
