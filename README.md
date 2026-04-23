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

The system is built around 6 core models:

| Model | Description |
|---|---|
| `Store` | Root tenant — every store using the system is isolated by store_id |
| `User` | Store employees and admins with role-based access |
| `Slot` | Physical or logical location that holds lottery books |
| `Book` | A lottery ticket book with barcode, amount, and slot assignment |
| `ShiftDetails` | A shift record with financials, open/close state, and sub-shift support |
| `ShiftBooks` | Junction table — books scanned during a specific shift |

Every table is scoped by `store_id` to support future multi-tenancy without schema changes.

---

## Project Status

> 🚧 This project is currently under active development following a full SDLC process.

| Phase | Status |
|---|---|
| Planning | ✅ Complete |
| Requirements (SRS) | ✅ Complete |
| System Design (ERD, API Contract) | ✅ Complete |
| Implementation | ⏳ In Progress |
| Testing | ⏳ Pending |
| Deployment | ⏳ Pending |
| Maintenance | ⏳ Pending |
| Commercialization | 🗺️ Planned |

---

## Roadmap

| Version | Features |
|---|---|
| v2.0 | Mobile app, REST API, barcode scanning, shift management |
| v2.1 | Admin role, manager analytics dashboard, store registration, Stripe billing |
| v2.2 | Push notifications, Excel/CSV export |
| v3.0 | Multi-store platform, POS integration, offline mode |

---

## Documentation

All project documentation lives in this repository:

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

The original LottoMeter was built with:
- **Language:** C#
- **Framework:** .NET 8 Windows Forms
- **Database:** SQLite + Entity Framework Core

Source: [LottoMeter v1](https://github.com/AbdelrahmanYousef9266/LottoMeter)

---

## Author

**Abdelrahman Yousef**
