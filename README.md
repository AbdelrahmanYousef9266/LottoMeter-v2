# LottoMeter v2.0

> A shift management system for grocery and retail stores that sell lottery tickets.

LottoMeter v2.0 is a full rebuild of the original [LottoMeter desktop app](https://github.com/AbdelrahmanYousef9266/LottoMeter) (C# / Windows Forms), rebuilt as a cross-platform mobile application backed by a REST API — designed from day one with scalability, auditability, and commercialization in mind.

---

## What It Does

Stores that sell lottery tickets traditionally rely on manual paperwork to track ticket books during shift opening and closing. LottoMeter replaces that with a fast, barcode-based digital workflow:

- **Admin setup:** creates slots (each with a fixed ticket price) and assigns books to them by scanning barcodes
- **Shift open:** employee opens a main shift → Sub-shift 1 is auto-created → system lists every book that needs an open scan
- **During shift:** every ticket sale is scanned; the system auto-detects last tickets (by price) and marks books sold
- **Whole-book sale:** customer buys an entire book in one transaction — PIN-authorized quick flow
- **Return to vendor:** lottery salesman removes a book — PIN-authorized, preserves pre-return revenue
- **Sub-shift handover:** clean-close carries positions forward automatically; short/over forces full rescan by the next employee
- **Sub-shift close:** employee scans remaining books, enters cash numbers; system calculates totals and status (correct / over / short)
- **Admin void:** safety valve for admin-level errors — flags a shift, preserves all data, excluded from totals
- **Reports:** main shift totals + each sub-shift separately + ticket price breakdown + per-book open/close positions + whole-book sales + returns + voids

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile App | React Native (Expo) |
| API | Flask (Python) |
| ORM | SQLAlchemy |
| Database (Dev) | SQLite |
| Database (Prod) | PostgreSQL |
| Auth | JWT (Flask-JWT-Extended) |
| Serialization | Marshmallow |
| i18n | i18next + react-i18next |
| Containerization | Docker |
| CI/CD | GitHub Actions |

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
| `Store` | Root tenant — holds store PIN; all data isolated by store_id |
| `User` | Employees and admins with role-based access (enforced from v2.0) |
| `Slot` | Physical location holding a book — fixed ticket price, soft-deletable |
| `Book` | Lottery ticket book — created via slot assignment, tracked through lifecycle |
| `BookAssignmentHistory` | Every assignment / reassignment / unassignment event |
| `ShiftDetails` | Main shift (container) or sub-shift (has scans + financials) |
| `ShiftBooks` | Scan records — open + close per book per sub-shift |
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

Last-ticket detection checks `scanned_position == LENGTH_BY_PRICE[book.ticket_price] - 1`.

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

### v2.0 — Core
- Admin bulk slot + book management with scan-to-assign
- Shift management (main shift + sub-shifts) with trust-based handover
- Barcode scanning — open and close with all 8 validation rules
- Last ticket detection by ticket price (fixed book lengths)
- Whole-book sale with store PIN
- Return-to-vendor flow with store PIN (revenue-preserving)
- Admin void with audit trail (data-preserving)
- Auto-calculated tickets total, expected cash, difference, shift status
- Ticket price breakdown on every report (scanned vs whole-book)
- Light/dark mode, English + Arabic, RTL support
- Bottom tab navigation, splash, onboarding, live totals, scan feedback
- Admin role enforcement from day 1
- PIN rate-limiting

### v2.1 — Growth
- Store self-registration
- Manager analytics dashboard (web)
- Stripe subscription billing
- Print layout customization, Bluetooth thermal printer
- Hindi, Spanish, French, Urdu languages
- PDF & Excel export, font size preference
- Sentry + uptime monitoring

### v2.2 — Expansion
- Push notifications (enables alternate auth flows)
- Bengali, Portuguese, Punjabi, Tamil languages

### v3.0 — Platform
- Multi-store admin, POS integration, offline sync

---

## Supported Languages

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

---

## Project Status

| Phase | Status |
|---|---|
| Planning | ✅ Complete |
| Requirements (SRS v5.0) | ✅ Complete — Verified |
| System Design (ERD v2.0, API Contract v2.0) | ✅ Complete |
| Implementation | ⏳ Next |
| Testing | ⏳ Pending |
| Deployment | ⏳ Pending |
| Maintenance | ⏳ Pending |
| Commercialization | 🗺️ Planned |

---

## Documentation

| Document | Description |
|---|---|
| [SRS_LottoMeter_v2.md](./SRS_LottoMeter_v2.md) | Software Requirements Specification v5.0 |
| [SDLC.md](./SDLC.md) | SDLC phase tracker + decision log + commercialization roadmap |
| [docs/ERD.md](./docs/ERD.md) | Entity Relationship Diagram — 8 models |
| [docs/API_Contract.md](./docs/API_Contract.md) | Full API endpoint and JSON contract |

---

## Previous Version

Source: [LottoMeter v1](https://github.com/AbdelrahmanYousef9266/LottoMeter) — C# / .NET 8 Windows Forms / SQLite

---

## Author

**Abdelrahman Yousef**
