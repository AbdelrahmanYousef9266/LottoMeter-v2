# LottoMeter v2.0

> A shift management system for grocery and retail stores that sell lottery tickets.

LottoMeter v2.0 is a full rebuild of the original [LottoMeter desktop app](https://github.com/AbdelrahmanYousef9266/LottoMeter) (C# / Windows Forms), rebuilt as a cross-platform mobile application backed by a REST API.

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

---

## Project Status

> 🚧 This project is currently under active development following a full SDLC process.

| Phase | Status |
|---|---|
| Planning | ✅ Complete |
| Requirements (SRS) | ✅ Complete |
| System Design | 🔄 In Progress |
| Implementation | ⏳ Pending |
| Testing | ⏳ Pending |
| Deployment | ⏳ Pending |
| Maintenance | ⏳ Pending |

---

## Repository Structure

```
LottoMeter-v2/
├── README.md           ← You are here
├── SRS.md              ← Software Requirements Specification
├── SDLC.md             ← SDLC phase tracker and decisions log
├── .gitignore
├── lottometer-api/     ← Flask backend (coming in Phase 4)
└── lottometer-mobile/  ← React Native app (coming in Phase 4)
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
