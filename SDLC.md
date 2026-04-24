# SDLC — LottoMeter v2.0

This document tracks the Software Development Life Cycle progress for LottoMeter v2.0.

---

## Phase 1 — Planning ✅

**Status:** Complete | **Date:** April 2026

### Problem Statement
The original LottoMeter v1 was a Windows-only desktop app. Store employees are limited to one machine. The system needs to become mobile, accessible from any device, and designed for potential commercial scaling.

### Goals
- Rebuild as a mobile app (React Native) + REST API (Flask)
- Preserve all core features from v1
- Apply full SDLC and professional documentation
- Design with commercialization, multilingual support, and UI flexibility in mind

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
- [x] SRS v3.0 — full document including UI, multilingual, and commercialization requirements
- [x] Functional requirements (Auth, Store, Slot, Book, Shift, Scan modules)
- [x] UI & UX requirements (Navigation, Shift, Scan, Books, History, Settings screens)
- [x] Multilingual & RTL requirements (10 languages across v2.0–v2.2)
- [x] Accessibility requirements
- [x] Non-functional requirements
- [x] Use cases (UC-01 through UC-05)
- [x] Commercialization requirements

---

## Phase 3 — System Design ✅

**Status:** Complete | **Date:** April 2026

### Schema Updates
- `store_id` added to all tables — enables multi-tenancy
- `role` added to User — enables RBAC in v2.1
- `Store` table added as root tenant entity

### Mobile Structure Updates
- Added `SplashScreen`, `OnboardingScreen`, `SettingsScreen`
- Added reusable components: `SkeletonLoader`, `ToastNotification`, `ConfirmDialog`, `OfflineBanner`
- Added `locales/` folder with translation files per language
- Added `utils/rtl.js` for RTL layout management

### Deliverables
- [x] ERD — updated with Store, store_id, role
- [x] Full API contract — request/response JSON for all endpoints
- [x] Flask folder structure finalized
- [x] React Native folder structure finalized with i18n and components

---

## Phase 4 — Implementation ⏳

**Status:** Pending

### Build Order
1. Flask API (models → schemas → services → routes)
2. Tests alongside each module
3. React Native app after API is stable

### Branching Strategy
```
main          ← stable, production-ready
develop       ← integration branch
feature/*     ← one branch per feature
```

### Commit Convention
- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation
- `test:` tests
- `refactor:` restructure, no behavior change

### Flask API Deliverables
- [ ] Auth module (login, logout, setup)
- [ ] Store module
- [ ] Slot module
- [ ] Book module
- [ ] Shift module (open, close, sub-shifts)
- [ ] Scan module

### React Native Deliverables
- [ ] Splash screen
- [ ] Onboarding screen
- [ ] Login screen
- [ ] Bottom tab navigation
- [ ] Home / Shift screen with live totals and shift timer
- [ ] Scan screen (camera + manual fallback, feedback sounds)
- [ ] Books screen (search, filter by slot, scanned badges)
- [ ] Shift history screen (date filter, shift detail view)
- [ ] Settings screen (language, theme, store info, logout)
- [ ] Reusable components (SkeletonLoader, ToastNotification, ConfirmDialog, OfflineBanner)
- [ ] i18n setup with English and Arabic translation files
- [ ] RTL layout support

---

## Phase 5 — Testing ⏳

**Status:** Pending

### Test Strategy
| Type | Tool | Target |
|---|---|---|
| Unit tests (API) | pytest | Service layer |
| Integration tests | pytest-flask | Routes + DB |
| API manual testing | Thunder Client | All endpoints |
| Mobile component tests | Jest | React Native components |
| i18n tests | Manual | Language switching, RTL layout |
| End-to-end | Manual | Full shift open → scan → close flow |

### Deliverables
- [ ] pytest test suite (80%+ coverage)
- [ ] Thunder Client collection
- [ ] Test results report
- [ ] RTL layout verification checklist

---

## Phase 6 — Deployment ⏳

**Status:** Pending

### Plan
- Docker + docker-compose for local dev
- Deploy to cloud (Railway / Render / VPS)
- GitHub Actions CI/CD

### Deliverables
- [ ] Dockerfile
- [ ] docker-compose.yml
- [ ] GitHub Actions workflow
- [ ] Deployment guide
- [ ] .env.example

---

## Phase 7 — Maintenance ⏳

**Status:** Pending

### Plan
- GitHub Issues for bugs and features
- CHANGELOG.md
- Semantic versioning (v2.0.0, v2.1.0...)

### Deliverables
- [ ] CHANGELOG.md
- [ ] GitHub Issues templates
- [ ] v2.1 backlog

---

## Phase 8 — Commercialization Roadmap 🗺️

**Status:** Planned

### 8.1 Multi-Tenant Architecture
- `store_id` already on all tables ✅
- Store self-registration endpoint (v2.1)
- Tenant isolation enforced at service layer (v2.0) ✅

### 8.2 Role-Based Access Control
- `role` column already on User ✅
- Admin role enforcement (v2.1)
- Route decorators for role protection (v2.1)

### 8.3 Subscription & Billing
- Plan and Subscription models (v2.1)
- Stripe integration (v2.1)
- Subscription enforcement middleware (v2.1)

### 8.4 Manager Analytics Dashboard
- Analytics API endpoints (v2.1)
- React web dashboard for managers (v2.1)

### 8.5 UI Customization
- Font size preference (v2.1)
- Print layout customization (v2.1)
- Bluetooth thermal printer support (v2.1)

### 8.6 Multilingual Expansion
| Language | Version |
|---|---|
| English + Arabic (RTL) | v2.0 |
| Hindi, Spanish, French, Urdu (RTL) | v2.1 |
| Bengali, Portuguese, Punjabi, Tamil | v2.2 |

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
| April 2026 | Use Expo for React Native | Faster setup, no native build tools |
| April 2026 | SQLite for dev, PostgreSQL for prod | Zero-config dev, scalable prod |
| April 2026 | Marshmallow for serialization | Best-in-class for Flask |
| April 2026 | JWT expiry 8 hours | Matches a standard work shift |
| April 2026 | Add store_id to all tables | Enables multi-tenancy without migration |
| April 2026 | Add role to User | Enables RBAC in v2.1 |
| April 2026 | Add Store model | Root tenant entity |
| April 2026 | Use i18next for multilingual | Industry standard, supports RTL |
| April 2026 | Enable RTL from v2.0 | Arabic support required, cannot bolt on later |
| April 2026 | Bottom tab navigation | Standard mobile UX pattern |
| April 2026 | Skeleton loaders over spinners | Better perceived performance |
