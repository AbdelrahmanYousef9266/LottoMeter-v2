# SDLC — LottoMeter v2.0

This document tracks the Software Development Life Cycle progress for LottoMeter v2.0.

---

## Phase 1 — Planning ✅

**Status:** Complete | **Date:** April 2026

### Problem Statement
The original LottoMeter v1 was a Windows-only desktop app. Store employees are limited to one machine and cannot access shift data on the go. The system needs to become mobile, accessible from any device, and designed for potential commercial scaling.

### Goals
- Rebuild as a mobile app (React Native) + REST API (Flask)
- Preserve all core features from v1
- Apply full SDLC and professional documentation
- Design with commercialization, multilingual support, and UI flexibility in mind from day one

### Tech Stack Decision
| Choice | Reason |
|---|---|
| Flask | Lightweight Python REST framework |
| SQLAlchemy | Mirrors Entity Framework Core from v1 |
| React Native (Expo) | Cross-platform iOS + Android |
| JWT | Stateless auth, mobile-friendly |
| PostgreSQL | Production-grade database |
| Docker | Consistent deployment |
| i18next | Multilingual + RTL support |

### Deliverables
- [x] Project scope defined
- [x] Tech stack selected
- [x] Repository created

---

## Phase 2 — Requirements Analysis ✅

**Status:** Complete | **Date:** April 2026

### Deliverables
- [x] SRS v4.0 — initial verified document
- [x] SRS v5.0 — updated after design review (see Phase 3)
- [x] SRS v5.1 — clarified scan event model + hardware scanner support
- [x] SRS v5.2 — implementation corrections
- [x] SRS v6.0 — updated May 2026 (13 models, 47+ endpoints, offline architecture, web dashboard)
- [x] SRS v7.0 — updated May 2026 (offline mode complete, account settings, report email, pytest suite, 52+ endpoints)
- [x] Business logic verified with product owner
- [x] Functional requirements (Store, Auth, Slot, Book, Shift, Scan, Whole-book-sale, Return-to-vendor, Void, Subscription, Superadmin modules)
- [x] UI & UX requirements (all screens — mobile + web dashboard)
- [x] Multilingual & RTL requirements (10 languages across v2.0–v2.2)
- [x] Non-functional requirements
- [x] Commercialization requirements

---

## Phase 3 — System Design ✅

**Status:** Complete | **Date:** April 2026

### Deliverables
- [x] ERD v4.0 — 13 models with constraints, relationships, partial indexes
- [x] ERD v5.0 — StoreSettings report fields, EmployeeShift cancels field
- [x] ERD Mermaid diagram for GitHub rendering
- [x] API Contract v3.0 — 47+ endpoints with request/response shapes and error codes
- [x] API Contract v4.0 — 52+ endpoints; change-password, store profile, ticket-breakdown, sync endpoints documented
- [x] Flask folder structure finalized
- [x] React Native folder structure finalized
- [x] React web dashboard structure finalized
- [x] Shift validation formula documented
- [x] Last ticket detection logic documented
- [x] Barcode parsing contract documented
- [x] PIN rate-limiting contract documented

---

## Phase 4 — Implementation

### Phase 4a — Core Backend + Mobile ✅

**Status:** Complete | **Date:** April 2026

The complete REST API is implemented and tested end-to-end. All 39 original endpoints from the API Contract are functional. PostgreSQL-compatible. Containerized with Docker.

**Backend build order:**
- [x] Project scaffold (app factory, config, extensions, constants.py)
- [x] Error handlers + APIError hierarchy
- [x] Store model + schema + service + routes
- [x] User model + auth module (setup, login, logout) + JWT wiring + role decorator
- [x] Store settings (PIN + scan_mode) module
- [x] Slot model + schema + service + routes (with soft-delete)
- [x] Book model + BookAssignmentHistory model
- [x] Slot assignment endpoint (scan-to-assign with reassignment)
- [x] Book unassign + return-to-vendor endpoints
- [x] BusinessDay + EmployeeShift models + services + routes
- [x] Shift open / close service + routes
- [x] Pending-scans computation
- [x] Carry-forward logic (correct-status only)
- [x] ShiftBooks model + scan service + routes
- [x] Last-ticket detection via LENGTH_BY_PRICE
- [x] Scan validation rules 1–8
- [x] ShiftExtraSales model + whole-book-sale endpoint
- [x] PIN rate-limiting
- [x] Void endpoints
- [x] Reports service + endpoint
- [x] Sub-shift summary endpoint
- [x] Docker + docker-compose setup
- [x] GET /api/auth/me endpoint
- [x] Admin user management CRUD (5 endpoints)
- [x] Bulk slot management
- [x] Store scan_mode preference

**Mobile build order (React Native):**
- [x] Project scaffold (Expo SDK 54)
- [x] AuthContext with token validation on mount
- [x] Login screen
- [x] Stack + bottom tab navigation (5 tabs)
- [x] Home screen — shift state, open/close shift, pull-to-refresh
- [x] Scan screen — camera + manual fallback, scan-type auto-locking
- [x] Camera barcode scanner via expo-camera
- [x] Books screen — slots grid, create-slot modal
- [x] Slot detail screen — assign, reassign, unassign, return to vendor
- [x] History screen — closed shifts list with status badges
- [x] Report detail screen — totals, ticket breakdown, books, whole-book sales, returns
- [x] Close shift modal — live preview (tickets_total, expected_cash, difference)
- [x] Whole-book sale modal (PIN-protected)
- [x] Return-to-vendor modal (PIN-protected)
- [x] Settings screen — language picker, logout, PIN change (admin)
- [x] English + Arabic translation files (14 namespaces)
- [x] RTL layout flip via I18nManager.forceRTL
- [x] Continuous scan mode (2-second deduplication guard)
- [x] ITF-14 barcode normalization
- [x] Client-side L1 + L2 validation
- [x] Hardware scanner mode
- [x] Bulk slot UI
- [x] Admin history filters (date range, status, employee)
- [x] PDF export via expo-print + OS share sheet

### Phase 4b — BusinessDay + EmployeeShift Refactor ✅

**Status:** Complete | **Date:** April 2026

Replaced self-referential ShiftDetails model with two dedicated models. 2 new models, 2 new services, 2 new route files, 3 Alembic migrations. All 8 end-to-end sequences verified live.

### Phase 4c — Security Hardening ✅

**Status:** Complete | **Date:** April 2026

- [x] Multi-tenancy audit — 19 security fixes applied
- [x] T-01 through T-10 cross-tenant tests pass
- [x] PIN rate-limiting (in-memory, per user+store)
- [x] JWT blocklist (in-memory)
- [x] Admin role enforcement on all admin-only endpoints
- [x] Soft-delete partial unique indexes (User, Slot)
- [x] store_id on all tables verified

### Phase 4d — Commercial Database Improvements ✅

**Status:** Complete | **Date:** April 2026

- [x] Store.suspended, Store.is_active columns
- [x] Store contact fields (email, phone, address, city, state, zip_code, owner_name, created_by, notes)
- [x] User.role adds 'superadmin' value
- [x] EmployeeShift.uuid column (for offline sync)
- [x] BusinessDay.uuid column (for offline sync)
- [x] ShiftBooks.uuid column (for offline sync)
- [x] scan_source adds 'offline' value

### Phase 4e — Web Dashboard (React + Vite) ✅

**Status:** Complete | **Date:** April 2026

Full admin web dashboard with 9 pages (dashboard, shifts, reports, books, slots, users, business days, subscription, login). Connects to the same REST API as the mobile app. Includes reusable component library (Card, Button, Badge, StatCard, Table, Modal, Input).

### Phase 4f — Public Marketing Website ✅

**Status:** Complete | **Date:** April 2026

5-page public marketing site (Home, Pricing, Apply, Contact, GetStarted) built as part of the same Vite app. Contact and apply forms wire to the API. Rate-limited and honeypot-protected.

### Phase 4g — Superadmin Panel ✅

**Status:** Complete | **Date:** April 2026

Cross-store management interface for LottoMeter platform staff. Pages: Dashboard (stats), Stores (list + create + suspend), Submissions (review + approve). Separate login flow with `superadmin` role JWT. All actions logged to `audit_logs`.

### Phase 4h — Subscription System Foundation ✅

**Status:** Complete | **Date:** April 2026

- [x] Subscription model + service (trial, active, expired, suspended, cancelled)
- [x] StoreSettings model + service (timezone, currency, hours, notifications)
- [x] AuditLog model + service (append-only, cross-store)
- [x] ContactSubmission model (contact + apply + waitlist)
- [x] GET /api/subscription endpoint
- [x] GET/PUT /api/store/settings endpoints
- [x] POST /api/contact, /api/apply, /api/waitlist endpoints
- [x] POST /api/stripe/webhook placeholder
- [x] All /api/superadmin/* endpoints (14 endpoints)
- [x] Trial subscription auto-provisioned on store creation

---

### Implementation Stats (May 2026)

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

### Branching Strategy
```
main          ← stable, production-ready only
develop       ← integration branch
feature/*     ← one branch per feature
```

### Commit Convention
- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation only
- `test:` adding tests
- `refactor:` restructure, no behavior change
- `chore:` tooling, config, dependency updates
- `revert:` rollback

### Implementation Bug Discoveries

| # | Discovery | Resolution |
|---|---|---|
| 1 | Last-ticket fired on open scans | Required scan_type == "close" |
| 2 | Last-ticket fired without movement | Required close_position > open_position |
| 3 | ShiftBooks PK keyed on full barcode broke open/close pairing | Changed PK to (shift_id, static_code, scan_type) |
| 4 | Slot serializer hardcoded current_book: null | Implemented active-book lookup |
| 5 | Rule 8 blocked legitimate new opens after a close | Narrowed Rule 8 to rewrites only |
| 6 | parseBarcode wrong ITF-14 check (length===13 not 14) | Fixed to strip only 14-digit barcodes |
| 7 | AuthContext NetInfo.addEventListener doesn't fire on mount (Android) | Added NetInfo.fetch() call before listener |
| 8 | Camera validation blocks offline scans (bookMap empty) | Pass validate:!isOffline to CameraScanner |

---

## Phase 5 — Upcoming

### Phase 5a — Offline Mode (SQLite-first architecture) ✅

**Status:** Complete | **Date:** May 2026

- [x] Local SQLite DB setup (expo-sqlite WAL mode, 9 tables)
- [x] DB seeding: sync slots, books, shifts on login
- [x] Offline scan engine (mirrors all 8 server rules locally)
- [x] Offline PIN login with 72-hour session expiry (expo-secure-store)
- [x] Carry-forward logic runs offline (no network required)
- [x] Sync queue (pending scans uploaded on reconnect)
- [x] Offline banner + sync status indicator
- [x] ScanScreen offline fallbacks (loadShift, loadSlots)
- [x] HomeScreen offline fallbacks (loadData)
- [x] Auto-sync engine with conflict detection
- [x] Cancels field added to shift close
- [x] Slot Information section in reports (slot created, book assigned, assigned by, positions, subtotal)
- [x] Book detail modal with assignment history
- [x] Account Settings page (web dashboard — Profile, Hours & Reports, Security, Subscription tabs)
- [x] Daily report email infrastructure (email_service.py + triggered on BusinessDay close)
- [x] Pytest suite — 46/46 tests passing
- [ ] Sync endpoints on backend (/api/sync/* — Phase 5b backend)

### Phase 5b — Backend Sync Endpoints
**Status:** Planned

- [ ] POST /api/sync/business-days (idempotent, UUID-keyed)
- [ ] POST /api/sync/shifts (idempotent, UUID-keyed)
- [ ] POST /api/sync/scans (batch, idempotent, UUID-keyed)
- [ ] POST /api/sync/close-shifts (offline close with financial data)

### Phase 5c — Stripe Payment Integration
**Status:** Planned

- [ ] Stripe customer creation on subscription activation
- [ ] Checkout session flow
- [ ] Webhook handler (checkout.session.completed, invoice.payment_failed, customer.subscription.deleted)
- [ ] Subscription enforcement middleware
- [ ] Billing UI in web dashboard

### Phase 5d — SendGrid Email Integration
**Status:** Planned — Infrastructure Ready

- [x] email_service.py — send_email, send_daily_report_email, HTML/text builders
- [x] Daily report triggered on BusinessDay close
- [x] report_email, report_format, report_delay_hours, report_enabled in StoreSettings
- [ ] Set EMAIL_ENABLED=true + SENDGRID_API_KEY in production environment
- [ ] Transactional emails: welcome, trial expiry warning, payment confirmation
- [ ] Public form: auto-reply on contact/apply submission

### Phase 5e — Google Play Publishing
**Status:** Planned

- [ ] EAS production build profile
- [ ] Play Store listing, screenshots, privacy policy
- [ ] Production APK submitted for review

### Phase 5f — Web Dashboard Deployment
**Status:** Planned

- [ ] Deploy dashboard to lottometer.com
- [ ] Build pipeline for Vite + React dashboard
- [ ] Deploy to production (Render Static Site or Cloudflare Pages)
- [ ] Configure VITE_API_URL for production
- [ ] Custom domain: app.lottometer.com

### Phase 5g — Mobile UX Improvements
**Status:** Planned

- [ ] iPad optimization (larger screen layouts)
- [ ] Tap-to-confirm camera scanning (reduce accidental scans)

---

## Phase 6 — Deployment ✅

**Status:** Complete | **Date:** April 2026

- [x] Production-ready Dockerfile (env-driven port, migrations on startup, Gunicorn)
- [x] Render Web Service ($7/mo Starter tier, Ohio region)
- [x] Render Postgres ($6/mo Basic-256mb, daily backups)
- [x] Custom domain api.lottometer.com via Cloudflare Registrar + DNS
- [x] HTTPS via Render's automatic Let's Encrypt
- [x] Sentry error tracking (Flask + React Native projects)
- [x] UptimeRobot uptime monitoring (5-min interval, email alerts)
- [x] EAS Build pipeline configured (preview profile, Android APK, internal distribution)
- [x] Mobile app pointed at production API
- [x] First production store created via /api/auth/setup

---

## Phase 7 — Testing 🔄

**Status:** In Progress

### Test Strategy
| Type | Tool | Target | Status |
|---|---|---|---|
| Integration tests (API) | pytest + pytest-flask | Route handlers + DB | ✅ 46 tests passing |
| Shift validation tests | pytest | expected_cash, difference, shift_status | ✅ |
| Scan rule tests | pytest | All 8 scan rules | ✅ |
| Auth tests | pytest | Login, change-password, JWT | ✅ |
| Business day tests | pytest | Lifecycle, ticket breakdown | ✅ |
| Book tests | pytest | List, summary, detail, filters | ✅ |
| Last ticket detection | pytest | All 6 price tiers | Planned |
| PIN rate-limit tests | pytest | Lockout + reset | Planned |
| Carry-forward tests | pytest | correct-status carry, short/over rescan | Planned |
| Offline scan engine tests | Jest/Vitest | All 8 rules in scanEngine.js | Planned |
| i18n tests | Manual | Language switching, RTL layout flip | Manual |
| End-to-end | Manual | Full shift lifecycle | Manual |

### Deliverables
- [x] pytest test suite — 46 tests, all passing
- [ ] Expand to 80%+ service layer coverage
- [ ] Thunder Client collection for all 52+ endpoints
- [ ] Test results report

---

## Phase 8 — Maintenance ⏳

**Status:** Pending

### Plan
- GitHub Issues for bugs and feature requests
- CHANGELOG.md with semantic versioning
- v2.1 feature backlog tracked in GitHub

---

## Phase 9 — Commercialization Roadmap 🗺️

### 9.1 Multi-Tenant Architecture
- `store_id` on all tables ✅
- All queries scoped to store_id ✅
- Tenant isolation enforced at service layer ✅
- Superadmin cross-store management ✅
- Store self-registration (v2.1)

### 9.2 Role-Based Access Control
- `role` column on User ✅
- Admin + employee role enforcement ✅
- `superadmin` role for platform staff ✅

### 9.3 Subscription & Billing
- Subscription model ✅
- Trial provisioning ✅
- Stripe integration (Phase 5b)

### 9.4 Manager Analytics Dashboard
- Web dashboard built ✅ (dev only)
- Web dashboard deployed (Phase 5e)

### 9.5 Multilingual Expansion
| Language | RTL | Version |
|---|---|---|
| English | No | v2.0 ✅ |
| Arabic | Yes | v2.0 ✅ |
| Hindi | No | v2.1 |
| Spanish | No | v2.1 |
| French | No | v2.1 |
| Urdu | Yes | v2.1 |
| Bengali | No | v2.2 |
| Portuguese | No | v2.2 |
| Punjabi | No | v2.2 |
| Tamil | No | v2.2 |

### 9.6 Infrastructure
- Production cloud deployment ✅
- Automated DB backups ✅
- Sentry error monitoring ✅
- Uptime monitoring ✅
- Redis-backed PIN rate-limiter + JWT blocklist (v2.1)

---

## Decision Log

| Date | Decision | Reason |
|---|---|---|
| April 2026 | Use Expo for React Native | Faster setup, no native build tools needed |
| April 2026 | SQLite for dev, PostgreSQL for prod | Zero-config dev, scalable prod |
| April 2026 | Marshmallow for serialization | Best-in-class for Flask |
| April 2026 | JWT expiry 8 hours | Matches a standard work shift duration |
| April 2026 | Add store_id to all tables | Enables multi-tenancy without future migration |
| April 2026 | Add role to User | Enables RBAC without schema change |
| April 2026 | Use i18next for multilingual | Industry standard, supports RTL natively |
| April 2026 | Enable RTL from v2.0 | Arabic required, cannot bolt on later |
| April 2026 | BusinessDay + EmployeeShift replace ShiftDetails | Cleaner model matching the business domain |
| April 2026 | ShiftBooks PK = (shift_id, static_code, scan_type) | Open/close pairs same book across different barcodes |
| April 2026 | Scan rescan overwrites | Simpler error correction; no 409 on duplicate |
| April 2026 | Rule 8: no open rescan after close started | Prevents mid-shift history rewriting |
| April 2026 | Void preserves all data as flag | Audit integrity; downstream data unchanged |
| April 2026 | Single store PIN for whole-book-sale and return | Simpler mental model for employees |
| April 2026 | Carry-forward only after 'correct' status | Trust boundary; short/over forces full rescan |
| April 2026 | In-memory PIN rate-limiter and JWT blocklist for v2.0 | Single-instance pilot; Redis deferred to v2.1 |
| April 2026 | Render over Railway/Fly | Simpler Docker deployment, automatic HTTPS |
| April 2026 | Custom domain api.lottometer.com | Leaves apex domain for marketing site |
| April 2026 | EAS preview build, internal distribution | One-tap install without App/Play Store overhead |
| April 2026 | Subscription model with trial status | Auto-provisioned on store creation; Stripe deferred |
| April 2026 | StoreSettings separate from Store | Operational preferences decoupled from identity |
| April 2026 | AuditLog store_id nullable | Superadmin cross-store actions logged without forcing a store FK |
| April 2026 | ContactSubmission discriminator column | Single table for contact/apply/waitlist avoids three identical tables |
| April 2026 | superadmin role on User model | Platform staff need cross-store access; separate User table unnecessary |
| April 2026 | React + Vite for web dashboard | Fast dev server, modern tooling, same JS ecosystem as mobile |
| April 2026 | validate:false passed to CameraScanner when offline | Skips bookMap validation that would always fail when API unreachable |
| April 2026 | expo-sqlite WAL mode for offline DB | Write-ahead logging reduces lock contention during sync |
| May 2026 | NetInfo.fetch() before addEventListener in AuthContext | Android doesn't fire addEventListener on mount; fetch() gives immediate state |
| May 2026 | Direct SQLite re-query after offline scan (not result.pending_scans_remaining) | recordOfflineScan computed counts before the scan was written; re-query gets post-write truth |
