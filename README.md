# LottoMeter v2.0

> A shift management system for grocery and retail stores that sell lottery tickets.

LottoMeter v2.0 is a full rebuild of the original [LottoMeter desktop app](https://github.com/AbdelrahmanYousef9266/LottoMeter) (C# / Windows Forms), rebuilt as a cross-platform mobile application backed by a REST API — designed from day one with scalability and commercialization in mind.

---

## What It Does

Stores that sell lottery tickets traditionally rely on manual paperwork to track ticket books during shift opening and closing. LottoMeter replaces that with a fast, barcode-based digital workflow:

- Admin sets up slots with ticket prices and assigns books to slots
- Employee opens a shift — system auto-creates Sub-shift 1
- Employee scans lottery ticket books at shift open
- During shift, employee scans last ticket barcodes when a book is fully sold
- Employee closes sub-shift by scanning remaining books and entering cash in hand, gross sales, and cash out
- System calculates tickets total, expected cash, difference, and shift status (correct / over / short)
- Full report shows combined totals + ticket price breakdown + each sub-shift separately
- Admin refills empty slots with new books for the next shift

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
                                                     │   PostgreSQL / SQLite │
                                                     └──────────────────────┘
```

---

## Database — 6 Models

| Model | Description |
|---|---|
| `Store` | Root tenant — all data isolated by store_id |
| `User` | Employees and admins with role-based access |
| `Slot` | Physical location holding books — has default ticket price |
| `Book` | Lottery ticket book — start/end numbers, ticket price, barcode |
| `ShiftDetails` | Main shift (container) or sub-shift (has scans + financials) |
| `ShiftBooks` | Books scanned during a shift — open or close scan type |

---

## Shift Validation Formula

```
expected_cash = gross_sales + tickets_total - cash_out
difference    = cash_in_hand - expected_cash

difference = 0  → ✅ correct
difference > 0  → ⚠️ over  (more cash than expected)
difference < 0  → ❌ short (less cash than expected)
```

---

## Features

### v2.0 — Core
- Admin slot + book management with ticket pricing
- Shift management (main shift + sub-shifts)
- Barcode scanning — open and close scan types
- Last ticket detection via fixed suffixes (029, 149, 059, 099)
- Auto-calculated tickets total, expected cash, difference, shift status
- Ticket price breakdown on every report
- Light/dark mode, English + Arabic, RTL support
- Bottom tab navigation, splash, onboarding, live totals, scan feedback

### v2.1 — Growth
- Admin role enforcement, manager analytics dashboard
- Stripe subscription billing
- Print layout customization, Bluetooth thermal printer
- Hindi, Spanish, French, Urdu languages
- PDF & Excel export, font size preference

### v2.2 — Expansion
- Push notifications
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
| Requirements (SRS v4.0) | ✅ Complete — Verified |
| System Design (ERD, API Contract) | ✅ Complete |
| Implementation | ⏳ Next |
| Testing | ⏳ Pending |
| Deployment | ⏳ Pending |
| Maintenance | ⏳ Pending |
| Commercialization | 🗺️ Planned |

---

## Documentation

| Document | Description |
|---|---|
| [SRS_LottoMeter_v2.md](./SRS_LottoMeter_v2.md) | Software Requirements Specification v4.0 |
| [SDLC.md](./SDLC.md) | SDLC phase tracker + commercialization roadmap |
| [docs/ERD.md](./docs/ERD.md) | Entity Relationship Diagram |
| [docs/API_Contract.md](./docs/API_Contract.md) | Full API endpoint and JSON contract |

---

## Previous Version

Source: [LottoMeter v1](https://github.com/AbdelrahmanYousef9266/LottoMeter) — C# / .NET 8 Windows Forms / SQLite

---

## Author

**Abdelrahman Yousef**
