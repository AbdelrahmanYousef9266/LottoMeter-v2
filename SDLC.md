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
- [x] SRS v4.0 — final verified document
- [x] Business logic verified with product owner
- [x] Functional requirements (Store, Auth, Slot, Book, Shift, Scan modules)
- [x] UI & UX requirements (all 9 screens)
- [x] Multilingual & RTL requirements (10 languages across v2.0–v2.2)
- [x] Accessibility requirements
- [x] Non-functional requirements
- [x] Use cases (UC-01 through UC-07)
- [x] Commercialization requirements

---

## Phase 3 — System Design ✅

**Status:** Complete | **Date:** April 2026

### Key Design Decisions

**Schema decisions made for scalability:**
- `store_id` on every table — enables multi-tenancy without future migration
- `role` on User — enables RBAC in v2.1
- `Store` table as root tenant entity

**Business logic decisions verified with product owner:**
- Every main shift auto-creates Sub-shift 1 on open
- Scanning and closing always happens on sub-shifts, never directly on main shift
- Main shift totals = sum of all sub-shifts
- Main shift always has at least one sub-shift
- Last ticket suffixes fixed at: 029, 149, 059, 099 — non-configurable
- `Slot.ticket_price` = default price, copied to `Book.ticket_price` at assignment (overridable)
- Book price stored permanently on book for accurate historical reports
- Closing inputs (cash_in_hand, gross_sales, cash_out) are all manually entered by employee
- tickets_total auto-calculated from sold books
- expected_cash = gross_sales + tickets_total - cash_out
- difference = cash_in_hand - expected_cash
- shift_status = correct (0), over (>0), short (<0)
- Ticket price breakdown shown on every sub-shift and main shift report
- Main shift report shows combined breakdown + each sub-shift separately

**Mobile structure finalized:**
- 9 screens including Splash, Onboarding, Settings
- Reusable components: SkeletonLoader, ToastNotification, ConfirmDialog, OfflineBanner
- locales/ folder with translation files per language
- utils/rtl.js for RTL layout management

### Deliverables
- [x] ERD — final verified with all 6 models
- [x] Full API Contract — all endpoints with correct request/response
- [x] Flask folder structure finalized
- [x] React Native folder structure finalized
- [x] Shift validation formula documented
- [x] Last ticket detection logic documented
- [x] Ticket price breakdown logic documented
- [x] Report structure documented

---

## Phase 4 — Implementation ⏳

**Status:** Pending — Next Phase

### Build Order
1. Flask API — models first, then schemas, then services, then routes
2. Tests written alongside each module
3. React Native app built after API is stable and tested

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

### Flask API Build Order
- [ ] Project scaffold (app factory, config, extensions)
- [ ] Store model + schema + service + routes
- [ ] Auth module (login, logout, setup)
- [ ] Slot model + schema + service + routes
- [ ] Book model + schema + service + routes
- [ ] ShiftDetails model + schema + service + routes
- [ ] ShiftBooks model + schema
- [ ] Scan service + routes (with last ticket detection)
- [ ] Shift closing logic (tickets_total, expected_cash, difference, shift_status)
- [ ] Ticket price breakdown calculation
- [ ] Main shift auto-totaling from sub-shifts
- [ ] Reports endpoint
- [ ] Docker + docker-compose setup

### React Native Build Order
- [ ] Project scaffold (Expo, navigation, i18n, RTL)
- [ ] Auth context + JWT storage
- [ ] Login screen
- [ ] Splash screen
- [ ] Onboarding screen
- [ ] Bottom tab navigation
- [ ] Home / Shift screen (live totals, shift timer, scanned books list)
- [ ] Scan screen (camera + manual fallback, feedback sounds, scan counter)
- [ ] Books screen (search, filter by slot, scanned badges, pull to refresh)
- [ ] Shift history screen (date filter, shift cards, detail view with report)
- [ ] Settings screen (language, theme, store info, logout)
- [ ] Reusable components (SkeletonLoader, ToastNotification, ConfirmDialog, OfflineBanner)
- [ ] English translation file
- [ ] Arabic translation file + RTL layout

---

## Phase 5 — Testing ⏳

**Status:** Pending

### Test Strategy
| Type | Tool | Target |
|---|---|---|
| Unit tests (API) | pytest | All service layer functions |
| Integration tests | pytest-flask | All route handlers + DB |
| API manual testing | Thunder Client | All 14+ endpoints |
| Mobile component tests | Jest | React Native components |
| Shift validation tests | pytest | expected_cash, difference, shift_status |
| Last ticket detection tests | pytest | All 4 suffixes (029, 149, 059, 099) |
| Ticket breakdown tests | pytest | Grouping by price, correct totals |
| i18n tests | Manual | Language switching, RTL layout flip |
| End-to-end | Manual | Full: open shift → scan → last ticket → close sub-shift → close main shift |

### Deliverables
- [ ] pytest test suite (80%+ coverage)
- [ ] Thunder Client collection for all endpoints
- [ ] Test results report
- [ ] RTL layout verification checklist
- [ ] Shift validation test cases document

---

## Phase 6 — Deployment ⏳

**Status:** Pending

### Plan
- Docker + docker-compose for local dev (Flask + PostgreSQL)
- Deploy to cloud (Railway / Render / VPS)
- GitHub Actions CI/CD pipeline
- Automated database backups

### Deliverables
- [ ] Dockerfile for Flask API
- [ ] docker-compose.yml
- [ ] GitHub Actions CI workflow
- [ ] Deployment guide
- [ ] .env.example with all required variables
- [ ] Production environment checklist

---

## Phase 7 — Maintenance ⏳

**Status:** Pending

### Plan
- GitHub Issues for bugs and feature requests
- CHANGELOG.md with semantic versioning
- v2.1 feature backlog tracked in GitHub

### Deliverables
- [ ] CHANGELOG.md
- [ ] GitHub Issues templates (bug, feature request)
- [ ] v2.1 backlog documented

---

## Phase 8 — Commercialization Roadmap 🗺️

**Status:** Planned | **Target:** Post v2.0 launch

### 8.1 Multi-Tenant Architecture
- `store_id` on all tables ✅ already done
- All queries scoped to store_id ✅ enforced from v2.0
- Store self-registration endpoint (v2.1)
- Tenant isolation enforced at service layer (v2.0) ✅

### 8.2 Role-Based Access Control
- `role` column on User ✅ already done
- Admin role enforcement + route decorators (v2.1)
- Admin unlocks: user management, analytics, store settings

### 8.3 Subscription & Billing
- Plan and Subscription models (v2.1)
- Stripe integration for payment processing (v2.1)
- Subscription enforcement middleware (v2.1)
- Planned tiers: Starter / Pro / Enterprise

### 8.4 Manager Analytics Dashboard
- Analytics API endpoints: sales summary, shifts by day, top books (v2.1)
- React web dashboard for managers (v2.1)

### 8.5 UI Customization
- Font size preference (v2.1)
- Print layout customization (v2.1)
- Bluetooth thermal printer support (v2.1)

### 8.6 Multilingual Expansion
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

### 8.7 Infrastructure
- Production cloud deployment (v2.0)
- Automated DB backups (v2.0)
- Sentry error monitoring (v2.1)
- Uptime monitoring (v2.1)

### 8.8 Support & Documentation
- Public documentation site (v2.1)
- Support ticketing process (v2.1)
- Public changelog (v2.0)

---

## Decision Log

| Date | Decision | Reason |
|---|---|---|
| April 2026 | Use Expo for React Native | Faster setup, no native build tools needed |
| April 2026 | SQLite for dev, PostgreSQL for prod | Zero-config dev, scalable prod |
| April 2026 | Marshmallow for serialization | Best-in-class for Flask |
| April 2026 | JWT expiry 8 hours | Matches a standard work shift duration |
| April 2026 | Add store_id to all tables | Enables multi-tenancy without future migration |
| April 2026 | Add role to User | Enables RBAC in v2.1 without schema change |
| April 2026 | Add Store model | Root tenant entity for commercialization |
| April 2026 | Use i18next for multilingual | Industry standard, supports RTL natively |
| April 2026 | Enable RTL from v2.0 | Arabic required, cannot bolt on later |
| April 2026 | Bottom tab navigation | Standard mobile UX pattern for this type of app |
| April 2026 | Skeleton loaders over spinners | Better perceived performance on slow networks |
| April 2026 | ticket_price on both Slot and Book | Slot = default, Book = permanent for historical reports |
| April 2026 | Main shift auto-creates Sub-shift 1 | Every main shift must have at least one sub-shift |
| April 2026 | Scanning/closing on sub-shifts only | Main shift is container only, not a work unit |
| April 2026 | Last ticket suffixes fixed (029,149,059,099) | Business rule — non-configurable by design |
| April 2026 | cash_in_hand/gross_sales/cash_out manual at close | Employee enters from physical register and cash count |
| April 2026 | expected_cash = gross_sales + tickets_total - cash_out | Verified shift validation formula with product owner |
| April 2026 | shift_status: correct/over/short | Clear language for store employees to understand result |
| April 2026 | Ticket breakdown on every report | Both sub-shift and main shift show price breakdown |
| April 2026 | Main shift report = combined + each sub-shift separately | Managers need both summary and per-employee details |
