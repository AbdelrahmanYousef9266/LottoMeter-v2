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
- **Superadmin panel** — LottoMeter staff manage stores, subscriptions, and form submissions
- **Marketing site** — public landing page, pricing, apply, and contact forms

---

## Architecture

```
┌───────────────────────┐        HTTPS / REST        ┌──────────────────────────┐
│  React Native App     │ ◄─────────────────────────► │  Flask REST API          │
│  (iOS / Android)      │                              │  api.lottometer.com      │
│  Expo SDK 54          │                              │  Render (Ohio)           │
└───────────────────────┘                              └──────────┬───────────────┘
                                                                  │
┌───────────────────────┐                              ┌──────────▼───────────────┐
│  React Web Dashboard  │ ◄─────────────────────────► │  PostgreSQL              │
│  Vite + React 18      │                              │  Render Postgres         │
│  (dev: localhost:3001)│                              └──────────────────────────┘
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

## Folder Structure

```
LottoMeter-v2/
├── docs/
│   ├── ERD.md                    ← Entity Relationship Diagram v4.0 (13 models)
│   ├── API_Contract.md           ← Full API endpoint reference v3.0 (47+ endpoints)
│   ├── SRS_LottoMeter_v2.md      ← Software Requirements Specification v6.0
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
│   ├── tests/
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
│   │   │                            Users, BusinessDays, Subscription, Login
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

### Barcode Scanning
- **Camera single** — scan one barcode, return to scan screen
- **Camera continuous** — camera stays open; 2-second dedup guard
- **Hardware scanner** — keystroke-wedge mode; text input auto-focused
- ITF-14 normalization: strips leading zero from 14-digit barcodes

### Offline Mode (Phase 5a — in progress)
- Local SQLite DB seeded with current slots, books, and shift data
- All 8 scan validation rules run locally — no network required
- Sync queue uploads offline scans when connection restores
- Offline banner visible while disconnected; close shift requires network

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
| `StoreSettings` | Timezone, currency, hours, notification prefs |
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

| Phase | Status |
|---|---|
| Planning | ✅ Complete |
| Requirements (SRS v6.0) | ✅ Complete |
| System Design (ERD v4.0, API v3.0) | ✅ Complete |
| Backend (47+ endpoints, 13 models) | ✅ Complete |
| Mobile App (~95%) | ✅ Complete |
| Web Dashboard (15 pages) | ✅ Complete (dev) |
| Public Marketing Site | ✅ Complete |
| Superadmin Panel | ✅ Complete |
| Subscription Foundation | ✅ Complete |
| Offline Mode (Phase 5a) | 🔄 In Progress |
| Stripe Integration (Phase 5b) | ⏳ Planned |
| SendGrid Email (Phase 5c) | ⏳ Planned |
| Play Store Publishing (Phase 5d) | ⏳ Planned |
| Web Dashboard Deployment (Phase 5e) | ⏳ Planned |
| Automated Testing | ⏳ Planned |

---

## Documentation

| Document | Description |
|---|---|
| [docs/ERD.md](docs/ERD.md) | Entity Relationship Diagram v4.0 — 13 models |
| [docs/API_Contract.md](docs/API_Contract.md) | Full API endpoint reference v3.0 — 47+ endpoints |
| [docs/SRS_LottoMeter_v2.md](docs/SRS_LottoMeter_v2.md) | Software Requirements Specification v6.0 |
| [SDLC.md](SDLC.md) | SDLC phase tracker + decision log |
| [docs/DEPLOYMENT_RUNBOOK.md](docs/DEPLOYMENT_RUNBOOK.md) | Production operations guide |

---

## Previous Version

[LottoMeter v1](https://github.com/AbdelrahmanYousef9266/LottoMeter) — C# / .NET 8 / Windows Forms / SQLite

---

## Author

**Abdelrahman Yousef**
