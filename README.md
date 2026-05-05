# LottoMeter v2.0

> SaaS shift management system for convenience stores that sell lottery tickets.

LottoMeter v2.0 is a full rebuild of the original [LottoMeter desktop app](https://github.com/AbdelrahmanYousef9266/LottoMeter) (C# / Windows Forms), rebuilt as a cross-platform mobile application backed by a REST API — designed from day one for multi-tenancy, auditability, and commercial scale.

**Live backend:** https://api.lottometer.com

---

## What It Does

Stores that sell lottery tickets track ticket books across shifts using barcodes. LottoMeter replaces manual paperwork with a fast digital workflow:

- **Shift open** — employee opens a shift; system lists every book needing an open scan
- **During shift** — employees scan at key events: last ticket sold, whole-book sale, return to vendor
- **Shift close** — employee scans final positions, enters cash totals; system calculates expected cash, difference, and status (correct / over / short)
- **Admin tools** — slot and book management, user management, void, bulk operations
- **BusinessDay** — daily container auto-created on first shift; admin closes it at end of day
- **Offline mode** — all 8 scan rules run locally on device; scans sync to server when online
- **Account settings** — store profile, business hours, report email, password management
- **Superadmin panel** — LottoMeter staff manage stores, subscriptions, and form submissions
- **Marketing site** — public landing page, pricing, apply, and contact forms

---

## Architecture

```
┌───────────────────────┐        HTTPS / REST        ┌──────────────────────────┐
│  React Native App     │ ◄─────────────────────────► │  Flask REST API          │
│  (iOS / Android)      │                              │  api.lottometer.com      │
│  Expo SDK 54          │                              │  Render (Ohio)           │
│  + Local SQLite       │                              └──────────┬───────────────┘
│    (offline engine)   │                                         │
└─────────┬─────────────┘                              ┌──────────▼───────────────┐
          │ sync on reconnect                          │  PostgreSQL              │
          └────────────────────────────────────────────►  Render Postgres         │
                                                       └──────────────────────────┘
┌───────────────────────┐
│  React Web Dashboard  │ ◄─────────────────────────► Flask API (same)
│  Vite + React 18      │
│  (dev: localhost:3001)│
└───────────────────────┘
┌───────────────────────┐
│  Public Marketing     │   (static pages, public API endpoints)
│  Website              │
│  lottometer.com       │
└───────────────────────┘
┌───────────────────────┐
│  Superadmin Panel     │   (JWT superadmin role, cross-store management)
│  /superadmin/*        │
└───────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Mobile App | React Native (Expo SDK 54) | iOS + Android, New Architecture |
| Web Dashboard | React 18 + Vite | 18 pages |
| API | Flask (Python 3.11+), Gunicorn | 52+ endpoints |
| ORM | SQLAlchemy 2.x | 13 models |
| Serialization | Marshmallow | 12 schemas |
| Database (dev) | SQLite | |
| Database (prod) | PostgreSQL (Render) | |
| Auth | Flask-JWT-Extended | 8-hour tokens |
| Camera | expo-camera | Barcode scanning |
| Token storage | expo-secure-store | PIN + session offline |
| Local DB (mobile) | expo-sqlite | Offline engine (WAL mode) |
| Network detection | @react-native-community/netinfo | Online/offline switching |
| i18n | i18next + react-i18next | English + Arabic (RTL) |
| Containerization | Docker + docker-compose | |
| Deployment | Render Web Service + Render Postgres | |
| Error tracking | Sentry | Flask + React Native |
| Uptime monitoring | UptimeRobot | 5-min interval |
| Testing | pytest + pytest-flask | 46 tests passing |
| Payments | Stripe | Pending (Phase 5b) |
| Email | SendGrid | Infrastructure ready, integration pending |

---

## Folder Structure

```
LottoMeter-v2/
├── docs/
│   ├── ERD.md                    ← Entity Relationship Diagram v5.0 (13 models)
│   ├── API_Contract.md           ← Full API endpoint reference v4.0 (52+ endpoints)
│   ├── SRS_LottoMeter_v2.md      ← Software Requirements Specification v7.0
│   └── DEPLOYMENT_RUNBOOK.md     ← Production ops guide
├── lottometer-api/               ← Flask REST API
│   ├── app/
│   │   ├── models/               ← 13 SQLAlchemy models
│   │   ├── schemas/              ← Marshmallow serialization schemas
│   │   ├── services/             ← Business logic layer
│   │   ├── routes/               ← 12 Flask blueprints
│   │   ├── config.py
│   │   ├── constants.py          ← LENGTH_BY_PRICE
│   │   ├── errors.py
│   │   ├── auth_helpers.py
│   │   └── extensions.py
│   ├── migrations/               ← Alembic migrations
│   ├── tests/                    ← pytest test suite (46 tests)
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── run.py
├── lottometer-mobile/            ← React Native (Expo SDK 54)
│   ├── src/
│   │   ├── api/                  ← Axios API client modules
│   │   ├── components/           ← Reusable UI components
│   │   ├── context/              ← AuthContext
│   │   ├── hooks/                ← useFeedback
│   │   ├── locales/              ← en.json, ar.json
│   │   ├── navigation/           ← Stack + bottom tabs
│   │   ├── offline/              ← Offline engine (SQLite, sync queue, scan rules)
│   │   ├── screens/              ← All app screens
│   │   ├── theme/                ← Colors, Radius, Shadow
│   │   ├── utils/                ← bookConstants, scanErrorMessages, etc.
│   │   └── i18n.js
│   ├── App.js
│   ├── eas.json
│   └── package.json
├── lottometer-dashboard/         ← React + Vite web dashboard
│   ├── src/
│   │   ├── components/           ← UI primitives, Layout, Charts
│   │   ├── context/              ← AuthContext
│   │   ├── pages/                ← Dashboard, Shifts, Reports, Books, Slots,
│   │   │                            Users, BusinessDays, Subscription, Login,
│   │   │                            AccountSettings
│   │   │   ├── public/           ← Home, Pricing, Apply, Contact, GetStarted
│   │   │   └── superadmin/       ← SuperDashboard, SuperStores, SuperCreateStore,
│   │   │                            SuperSubmissions, SuperAdminLogin
│   │   └── App.jsx
│   └── package.json
├── README.md
├── SDLC.md
└── .gitignore
```

---

## Getting Started

### Backend Setup

**Prerequisites:** Python 3.11+, Docker (optional)

```bash
cd lottometer-api

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate       # macOS/Linux
venv\Scripts\activate          # Windows

# Install dependencies
pip install -r requirements.txt

# Set environment variables (copy and edit)
cp .env.example .env

# Run database migrations
flask db upgrade

# Start development server
flask run
```

**Or with Docker:**
```bash
docker-compose up --build
```

**Run tests:**
```bash
cd lottometer-api
pytest tests/ -v
# 46 tests, all passing
```

### Mobile Setup

**Prerequisites:** Node.js 20+, Expo CLI, Android Studio or physical device

```bash
cd lottometer-mobile
npm install

# Start Metro bundler
npx expo start

# Press 'a' for Android emulator, scan QR code for physical device
```

### Dashboard Setup

**Prerequisites:** Node.js 20+

```bash
cd lottometer-dashboard
npm install
npm run dev
# Opens at http://localhost:3001
```

---

## Environment Variables

### Backend (`lottometer-api/.env`)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string (or `sqlite:///dev.db` for local) |
| `JWT_SECRET_KEY` | Yes | Random secret for JWT signing (min 32 chars) |
| `FLASK_ENV` | No | `development` or `production` |
| `PORT` | No | Server port (default 5000) |
| `PAYMENTS_ENABLED` | No | `true` to activate Stripe webhook handler (default false) |
| `STRIPE_SECRET_KEY` | No | Stripe secret key (required when PAYMENTS_ENABLED=true) |
| `STRIPE_WEBHOOK_SECRET` | No | Stripe webhook signing secret |
| `EMAIL_ENABLED` | No | `true` to send emails via SendGrid (default false) |
| `SENDGRID_API_KEY` | No | SendGrid API key (required when EMAIL_ENABLED=true) |
| `FROM_EMAIL` | No | Sender address for report emails |
| `SENTRY_DSN` | No | Sentry DSN for error tracking |

### Dashboard (`lottometer-dashboard/.env`)

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | Yes | Backend API base URL (e.g. `https://api.lottometer.com`) |
| `VITE_SUPERADMIN_STORE_CODE` | Yes | Store code used for superadmin login |

---

## Deployment

### Backend — Render
1. Push to GitHub
2. Connect repo to Render Web Service
3. Set environment variables in Render dashboard
4. Docker builds automatically; `flask db upgrade` runs on startup

**Live:** https://api.lottometer.com

### Database — Render Postgres
- Basic-256mb tier ($6/mo)
- Daily automated backups
- Connection string injected via `DATABASE_URL` environment variable

### Mobile — EAS Build
```bash
cd lottometer-mobile
eas build --platform android --profile preview
```

Produces an APK for internal distribution. For Play Store release, use `--profile production`.

---

## Key Features

### Shift Management
- BusinessDay auto-created on first shift open; admin closes at end of day
- EmployeeShift: one per employee per day; one open shift per store enforced at DB level
- Carry-forward from previous shift when `shift_status == 'correct'`; short/over forces full rescan
- Live close preview: tickets_total, expected_cash, difference computed before commit
- Cancels field captured at shift close and subtracted from expected cash

### Barcode Scanning
- **Camera single** — scan one barcode, return to scan screen
- **Camera continuous** — camera stays open; 2-second dedup guard
- **Hardware scanner** — keystroke-wedge mode; text input auto-focused
- ITF-14 normalization: strips leading zero from 14-digit barcodes

### Offline Mode
- Local SQLite DB seeded with current slots, books, and shift data on login
- All 8 scan validation rules run locally — no network required
- PIN login with 72-hour session expiry (expo-secure-store)
- Carry-forward logic runs offline
- Sync queue uploads offline scans when connection restores
- Offline banner visible while disconnected; close shift requires network

### Account Settings
- Store profile management (name, owner, contact info)
- Business hours and report email configuration
- Report settings: format, delay hours, enable/disable
- Password change for logged-in user

### Daily Report Email
- Automatically triggered when a BusinessDay is closed
- Branded HTML email with full shift breakdown
- Plain-text fallback
- Controlled by `report_enabled` setting; failure never blocks day close
- SendGrid integration ready — awaiting `EMAIL_ENABLED=true` in production

### Subscription System
- Each store auto-provisioned with a trial subscription on creation
- Superadmin can cancel, reactivate, and extend trials
- Stripe integration is a placeholder; `PAYMENTS_ENABLED` flag gates the webhook

### Superadmin Panel
- Cross-store store management (create, suspend, activate)
- Review and approve contact/apply form submissions → provision store
- Audit log for all significant platform actions
- Subscription management across all stores

### Public Marketing Site
- Landing page, pricing, apply form, contact form, waitlist
- Rate-limited API endpoints (5/min contact, 3/hr apply)
- All submissions visible in superadmin panel

---

## Data Model

13 SQLAlchemy models. Every operational table carries `store_id` for multi-tenancy.

| Model | Description |
|---|---|
| `Store` | Root tenant — holds PIN, scan_mode, contact info |
| `User` | Employees, admins, superadmins (role-based) |
| `Slot` | Physical rack position (soft-deletable) |
| `Book` | Lottery ticket book lifecycle |
| `BookAssignmentHistory` | Every assignment/unassignment event |
| `BusinessDay` | Daily container (auto-created, admin-closable) |
| `EmployeeShift` | Employee work session within a BusinessDay |
| `ShiftBooks` | Scan records — PK `(shift_id, static_code, scan_type)` |
| `ShiftExtraSales` | Whole-book sales (not tied to Book rows) |
| `Subscription` | Store billing state (trial → active → expired) |
| `StoreSettings` | Timezone, currency, hours, notification + report prefs |
| `AuditLog` | Append-only platform action log |
| `ContactSubmission` | Public form submissions (contact/apply/waitlist) |

Full schema: [docs/ERD.md](docs/ERD.md)

---

## Book Length Constants

Fixed in code — not configurable:

| Ticket Price | Book Length | Last Position |
|---|---|---|
| $1 | 150 | 149 |
| $2 | 150 | 149 |
| $3 | 100 | 99 |
| $5 | 60 | 59 |
| $10 | 30 | 29 |
| $20 | 30 | 29 |

---

## Supported Languages

| Language | RTL | Status |
|---|---|---|
| English | No | ✅ v2.0 |
| Arabic | Yes | ✅ v2.0 |
| Hindi | No | Planned v2.1 |
| Spanish | No | Planned v2.1 |
| French | No | Planned v2.1 |
| Urdu | Yes | Planned v2.1 |
| Bengali | No | Planned v2.2 |
| Portuguese | No | Planned v2.2 |
| Punjabi | No | Planned v2.2 |
| Tamil | No | Planned v2.2 |

---

## Project Status

| Feature / Phase | Status |
|---|---|
| Planning | ✅ Complete |
| Requirements (SRS v7.0) | ✅ Complete |
| System Design (ERD v5.0, API v4.0) | ✅ Complete |
| Backend (52+ endpoints, 13 models) | ✅ Complete |
| Mobile App | ✅ Complete |
| Web Dashboard (18 pages) | ✅ Complete |
| Public Marketing Site | ✅ Complete |
| Superadmin Panel | ✅ Complete |
| Subscription Foundation | ✅ Complete |
| Offline Mode | ✅ Complete |
| Account Settings | ✅ Complete |
| Daily Report Email | ✅ Ready (SendGrid pending) |
| Pytest (46/46 tests) | ✅ Complete |
| Stripe Integration | ⏳ Pending |
| SendGrid Email | ⏳ Pending |
| Google Play Publishing | ⏳ Pending |
| lottometer.com Deployment | ⏳ Pending |

---

## Documentation

| Document | Description |
|---|---|
| [docs/ERD.md](docs/ERD.md) | Entity Relationship Diagram v5.0 — 13 models |
| [docs/API_Contract.md](docs/API_Contract.md) | Full API endpoint reference v4.0 — 52+ endpoints |
| [docs/SRS_LottoMeter_v2.md](docs/SRS_LottoMeter_v2.md) | Software Requirements Specification v7.0 |
| [SDLC.md](SDLC.md) | SDLC phase tracker + decision log |
| [docs/DEPLOYMENT_RUNBOOK.md](docs/DEPLOYMENT_RUNBOOK.md) | Production operations guide |

---

## Previous Version

[LottoMeter v1](https://github.com/AbdelrahmanYousef9266/LottoMeter) — C# / .NET 8 / Windows Forms / SQLite

---

## Author

**Abdelrahman Yousef**
