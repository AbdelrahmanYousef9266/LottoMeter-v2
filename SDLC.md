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

## Phase 3 — System Design 🔄

**Status:** In Progress  
**Date:** April 2026

### Objective
Produce the technical design artifacts before writing any code.

### Deliverables
- [ ] ERD (Entity Relationship Diagram)
- [ ] Full API contract (request/response JSON for every endpoint)
- [ ] Flask project folder structure finalized
- [ ] React Native project folder structure finalized
- [ ] Auth flow diagram (JWT login → protected route)
- [ ] Barcode scan flow diagram

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
- Planned v2.1 features: Admin role, PDF export, analytics dashboard

### Deliverables
- [ ] CHANGELOG.md
- [ ] GitHub Issues templates
- [ ] v2.1 feature backlog

---

## Decision Log

| Date | Decision | Reason |
|---|---|---|
| April 2026 | Use Expo for React Native | Faster setup, no native build tools needed for v2.0 |
| April 2026 | SQLite for dev, PostgreSQL for prod | Zero-config dev, production-grade in prod |
| April 2026 | Marshmallow for serialization | Best-in-class for Flask, handles validation + schema |
| April 2026 | JWT expiry set to 8 hours | Matches a standard work shift duration |
