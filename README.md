# LottoMeter v2.0

> A shift management system for grocery and retail stores that sell lottery tickets.

LottoMeter v2.0 is a full rebuild of the original [LottoMeter desktop app](https://github.com/AbdelrahmanYousef9266/LottoMeter) (C# / Windows Forms), rebuilt as a cross-platform mobile application backed by a REST API — designed from day one with scalability and commercialization in mind.

---

## What It Does

Stores that sell lottery tickets traditionally rely on manual paperwork to track ticket books during shift opening and closing. LottoMeter replaces that with a fast, barcode-based digital workflow:

- Open a shift and record starting cash
- Scan lottery ticket books by barcode
- Automatically match books to records and calculate totals
- Close the shift with a full summary
- View shift history anytime

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
| Containerization | Docker |
| CI/CD | GitHub Actions |
| i18n | i18next + react-i18next |

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
                                                     │   Database            │
                                                     └──────────────────────┘
```

---

## Database Overview

| Model | Description |
|---|---|
| `Store` | Root tenant — every store is isolated by store_id |
| `User` | Store employees and admins with role-based access |
| `Slot` | Physical or logical location that holds lottery books |
| `Book` | A lottery ticket book with barcode, amount, and slot assignment |
| `ShiftDetails` | A shift record with financials, open/close state, and sub-shift support |
| `ShiftBooks` | Junction table — books scanned during a specific shift |

---

## Features

### v2.0 — Core Release
**Shift Management:** Open/close shifts, sub-shifts, financials tracking
**Barcode Scanning:** Camera scanner, manual fallback, duplicate protection
**Book & Slot Management:** Full CRUD, auto-calculated totals
**Authentication:** JWT login/logout, first-run setup
**UI:** Light/dark mode, English + Arabic, RTL support, bottom tab navigation, splash screen, onboarding, live shift totals, scan feedback, search & filter, loading skeletons, toast notifications, offline banner, confirmation dialogs

### v2.1 — Growth Release
Admin role, manager analytics dashboard, Stripe billing, print layout customization, Bluetooth thermal printer, Hindi/Spanish/French/Urdu languages, PDF & Excel export, font size preference

### v2.2 — Expansion Release
Push notifications, Bengali, Portuguese, Punjabi, Tamil languages

### v3.0 — Platform Release
Multi-store admin, POS integration, offline sync

---

## Supported Languages

| Language | Version |
|---|---|
| English | v2.0 |
| Arabic (RTL) | v2.0 |
| Hindi | v2.1 |
| Spanish | v2.1 |
| French | v2.1 |
| Urdu (RTL) | v2.1 |
| Bengali | v2.2 |
| Portuguese | v2.2 |
| Punjabi | v2.2 |
| Tamil | v2.2 |

---

## Project Status

| Phase | Status |
|---|---|
| Planning | ✅ Complete |
| Requirements (SRS) | ✅ Complete |
| System Design (ERD, API Contract) | ✅ Complete |
| Implementation | ⏳ Pending |
| Testing | ⏳ Pending |
| Deployment | ⏳ Pending |
| Maintenance | ⏳ Pending |
| Commercialization | 🗺️ Planned |

---

## Documentation

| Document | Description |
|---|---|
| [SRS.md](./SRS_LottoMeter_v2.md) | Software Requirements Specification |
| [SDLC.md](./SDLC.md) | SDLC phase tracker and commercialization roadmap |
| [docs/ERD.md](./docs/ERD.md) | Entity Relationship Diagram |
| [docs/API_Contract.md](./docs/API_Contract.md) | Full API endpoint and JSON contract |

---

## Repository Structure

```
LottoMeter-v2/
├── README.md
├── SRS_LottoMeter_v2.md
├── SDLC.md
├── .gitignore
├── docs/
│   ├── ERD.md
│   └── API_Contract.md
├── lottometer-api/          ← Flask backend (Phase 4)
└── lottometer-mobile/       ← React Native app (Phase 4)
```

---

## Previous Version

Source: [LottoMeter v1](https://github.com/AbdelrahmanYousef9266/LottoMeter) — C# / .NET 8 Windows Forms / SQLite

---

## Author

**Abdelrahman Yousef**
