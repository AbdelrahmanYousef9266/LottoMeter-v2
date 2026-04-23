# SDLC — LottoMeter v2.0

This document tracks the Software Development Life Cycle progress for LottoMeter v2.0.
Each phase is documented with its status, decisions made, and deliverables produced.

---

## Phase 1 — Planning ✅

**Status:** Complete
**Date:** April 2026

### Objective
Define the problem, goals, and scope of the rebuild.

### Problem Statement
The original LottoMeter v1 was a Windows-only desktop app. Store employees are limited to one machine and cannot access shift data on the go. The system needs to become mobile and accessible from any device.

### Goals
- Rebuild LottoMeter as a mobile app (React Native) backed by a REST API (Flask)
- Preserve all core features from v1
- Apply full SDLC and professional documentation practices
- Make the system deployable on a cloud server with Docker
- Design with future commercialization in mind from day one

### Tech Stack Decision
| Choice | Reason |
|---|---|
| Flask | Lightweight Python framework, easy to structure as REST API |
| SQLAlchemy | Mirrors Entity Framework Core from v1, powerful ORM |
| React Native (Expo) | Cross-platform iOS + Android from one codebase |
| JWT | Stateless auth, ideal for mobile clients |
| PostgreSQL | Production-grade database, replaces SQLite in prod |
| Docker | Consistent deployment across environments |

### Deliverables
- [x] Project scope defined
- [x] Tech stack selected and justified
- [x] Repository created

---

## Phase 2 — Requirements Analysis ✅

**Status:** Complete
**Date:** April 2026

### Objective
Define all functional and non-functional requirements for the system.

### Deliverables
- [x] SRS.md (Software Requirements Specification) — full document produced
- [x] Functional requirements defined (Auth, Slot, Book, Shift, Scan modules)
- [x] Non-functional requirements defined (Performance, Security, Reliability, Usability, Testability)
- [x] Use cases documented (UC-01 through UC-04)
- [x] API endpoints outlined
- [x] Database schema defined

---

## Phase 3 — System Design ✅

**Status:** Complete
**Date:** April 2026

### Objective
Produce the technical design artifacts before writing any code.

### Schema Updates Made in This Phase
After reviewing commercialization requirements, two fields were added to the schema proactively:
- `store_id` added to all tables — enables multi-tenancy without future migration
- `role` added to User model — enables role-based access control in v2.1

A new `Store` table was also added as the root tenant entity.

### Deliverables
- [x] ERD (Entity Relationship Diagram) — updated with Store, store_id, and role
- [x] Full API contract (request/response JSON for every endpoint)
- [x] Flask project folder structure finalized
- [x] React Native project folder structure finalized

---

## Phase 4 — Implementation ⏳

**Status:** Pending

### Objective
Build the system according to the design documents.

### Plan
- Build Flask API first (models → schemas → services → routes)
- Write tests alongside each module
- Build React Native app after API is stable
- Use GitFlow branching: `main`, `develop`, `feature/*`

### Branching Strategy
```
main          ← stable, production-ready code only
develop       ← integration branch
feature/*     ← one branch per feature (e.g. feature/auth, feature/shift-management)
```

### Coding Standards
- Python: PEP8, docstrings on all functions
- JavaScript: ESLint + Prettier
- Commit messages: Conventional Commits format
  - `feat:` new feature
  - `fix:` bug fix
  - `docs:` documentation only
  - `test:` adding tests
  - `refactor:` code restructure, no behavior change

### Deliverables
- [ ] Flask API — Auth module
- [ ] Flask API — Store module
- [ ] Flask API — Slot module
- [ ] Flask API — Book module
- [ ] Flask API — Shift module
- [ ] Flask API — Scan module
- [ ] React Native — Login screen
- [ ] React Native — Home/Shift screen
- [ ] React Native — Scan screen
- [ ] React Native — Book list screen
- [ ] React Native — Shift history screen

---

## Phase 5 — Testing ⏳

**Status:** Pending

### Objective
Verify that all requirements are met and the system behaves correctly.

### Test Strategy
| Type | Tool | Target |
|---|---|---|
| Unit tests (API) | pytest | Service layer functions |
| Integration tests (API) | pytest-flask | Route handlers + DB |
| API manual testing | Thunder Client / Postman | All endpoints |
| Mobile component tests | Jest | React Native components |
| End-to-end workflow | Manual | Full shift open → scan → close flow |

### Deliverables
- [ ] Test plan document
- [ ] pytest test suite (80%+ coverage)
- [ ] Postman / Thunder Client collection
- [ ] Test results report

---

## Phase 6 — Deployment ⏳

**Status:** Pending

### Objective
Package and deploy the system to a production environment.

### Plan
- Dockerize the Flask API
- Use docker-compose for local dev (Flask + PostgreSQL)
- Deploy to a cloud server (Railway / Render / VPS)
- Set up GitHub Actions CI/CD pipeline

### Deliverables
- [ ] Dockerfile for Flask API
- [ ] docker-compose.yml for local dev
- [ ] GitHub Actions CI workflow
- [ ] Deployment guide document
- [ ] Environment variable documentation (.env.example)

---

## Phase 7 — Maintenance ⏳

**Status:** Pending

### Objective
Plan for ongoing support, bug fixes, and future improvements.

### Plan
- Use GitHub Issues to track bugs and feature requests
- Maintain a CHANGELOG.md
- Version releases using semantic versioning (v2.0.0, v2.1.0, etc.)

### Deliverables
- [ ] CHANGELOG.md
- [ ] GitHub Issues templates
- [ ] v2.1 feature backlog

---

## Phase 8 — Commercialization Roadmap ⏳

**Status:** Planned
**Target:** Post v2.0 launch

### Objective
Transform LottoMeter from a single-store tool into a commercially viable SaaS product for grocery and retail stores.

### Why Plan This Now
The schema decisions made in Phase 3 (`store_id` on all tables, `role` on User) were made specifically to enable this roadmap without breaking changes later. Documenting the commercialization plan now ensures every implementation decision in Phase 4 keeps the door open.

---

### 8.1 Multi-Tenant Architecture

**Challenge:** Every store must be completely isolated. One store must never see another store's data.

**Solution:**
- `store_id` is already on every table
- Every API query will be scoped to `current_user.store_id`
- A new store registration flow will provision a store record and first admin user
- Row-level isolation enforced at the service layer, not just the route layer

**Deliverables:**
- [ ] Store registration endpoint
- [ ] Store-scoped query middleware
- [ ] Tenant isolation tests

---

### 8.2 Role-Based Access Control (RBAC)

**Challenge:** Store managers need different permissions than employees.

**Solution:**
- `role` column already exists on User (`employee`, `admin`)
- A Flask decorator `@require_role('admin')` will guard manager-only endpoints
- Employees can operate shifts and scan books
- Admins can manage users, view analytics, and configure the store

**Roles planned:**

| Role | Permissions |
|---|---|
| `employee` | Open/close shifts, scan books, view own shift history |
| `admin` | All employee permissions + manage users, view all shifts, analytics, store settings |

**Deliverables:**
- [ ] Role-based route decorators
- [ ] Admin user management endpoints
- [ ] Role enforcement tests

---

### 8.3 Subscription & Billing System

**Challenge:** Stores need to pay for access. Different plans offer different features.

**Solution:**
- Integrate Stripe for payment processing
- Add `Subscription` and `Plan` models to the database
- Webhook handler for Stripe events (payment success, failure, cancellation)
- Middleware to block API access for stores with expired subscriptions

**Planned models:**
```
Plan        — plan_id, name, price, features (JSON), max_users
Subscription — sub_id, store_id FK, plan_id FK, status, start_date, end_date
```

**Planned plans:**
| Plan | Features |
|---|---|
| Starter | 1 user, basic shift tracking |
| Pro | 5 users, analytics, PDF export |
| Enterprise | Unlimited users, API access, priority support |

**Deliverables:**
- [ ] Stripe integration
- [ ] Plan and Subscription models
- [ ] Billing portal endpoint
- [ ] Subscription enforcement middleware

---

### 8.4 Manager Analytics Dashboard

**Challenge:** Store owners want insight into sales trends, employee performance, and ticket activity over time.

**Solution:**
- Build a web dashboard (React) consuming the same Flask API
- Add analytics endpoints that aggregate shift data
- Display charts for gross sales, tickets total, shift duration, and book activity

**Planned analytics endpoints:**
```
GET /api/analytics/sales-summary?period=week
GET /api/analytics/shifts-by-day
GET /api/analytics/top-books
GET /api/analytics/employee-performance
```

**Deliverables:**
- [ ] Analytics service layer
- [ ] Analytics API endpoints
- [ ] React web dashboard (v2.1)

---

### 8.5 Deployment & Infrastructure

**Challenge:** A commercial product needs 99.9%+ uptime, backups, and monitoring.

**Solution:**
- Host on a managed cloud platform (Railway, Render, or AWS)
- Automated daily PostgreSQL backups
- Error monitoring with Sentry
- Uptime monitoring with BetterUptime or similar
- Staging environment separate from production

**Deliverables:**
- [ ] Production deployment on managed cloud
- [ ] Automated database backup schedule
- [ ] Sentry error monitoring integration
- [ ] Staging environment setup

---

### 8.6 Support & Maintenance System

**Challenge:** Real customers need real support. Issues need to be tracked and resolved.

**Solution:**
- Public documentation site (GitBook or Docusaurus)
- In-app feedback mechanism
- GitHub Issues for bug tracking
- Semantic versioning and changelogs for all releases

**Deliverables:**
- [ ] Documentation site
- [ ] Support ticketing process
- [ ] Public changelog

---

## Decision Log

| Date | Decision | Reason |
|---|---|---|
| April 2026 | Use Expo for React Native | Faster setup, no native build tools needed for v2.0 |
| April 2026 | SQLite for dev, PostgreSQL for prod | Zero-config dev, production-grade in prod |
| April 2026 | Marshmallow for serialization | Best-in-class for Flask, handles validation + schema |
| April 2026 | JWT expiry set to 8 hours | Matches a standard work shift duration |
| April 2026 | Add store_id to all tables now | Enables multi-tenancy without future breaking migration |
| April 2026 | Add role to User model now | Enables RBAC in v2.1 without schema changes |
| April 2026 | Add Store model now | Root tenant entity needed for commercialization |
