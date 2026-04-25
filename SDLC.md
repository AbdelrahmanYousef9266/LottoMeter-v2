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
- [x] Business logic verified with product owner
- [x] Functional requirements (Store, Auth, Slot, Book, Shift, Scan, Whole-book-sale, Return-to-vendor, Void modules)
- [x] UI & UX requirements (all screens)
- [x] Multilingual & RTL requirements (10 languages across v2.0–v2.2)
- [x] Accessibility requirements
- [x] Non-functional requirements
- [x] Use cases (UC-01 through UC-13)
- [x] Commercialization requirements

---

## Phase 3 — System Design ✅

**Status:** Complete | **Date:** April 2026

### Design Review Outcome

A complete design review was conducted between SRS v4.0 and v5.0. Twenty-two design decisions were made during review; all are documented in SRS §18. Two additional decisions were added in v5.1 for the scan event model clarification and hardware scanner support.

### Key Design Decisions

**Schema decisions made for scalability:**
- `store_id` on every table — enables multi-tenancy without future migration
- `role` on User — enforced from v2.0 (moved up from v2.1 scope)
- `Store` table as root tenant entity
- Composite unique constraints `(store_id, X)` for barcode, static_code, slot_name, username
- Partial unique index ensuring only one open main shift per store (DB-level)

**Business logic decisions verified with product owner:**
- Every main shift auto-creates Sub-shift 1 on open
- Scanning and closing always happens on sub-shifts, never directly on main shift
- Main shift totals = sum of non-voided sub-shifts
- Main shift always has at least one sub-shift
- Book lengths are fixed by ticket price: $1/$2 → 150, $3 → 100, $5 → 60, $10/$20 → 30
- `static_code` is globally unique per lottery book (manufacturer guarantee)
- `Slot.ticket_price` = fixed price; `Book.ticket_price` copied at assignment (overridable)
- One book per slot at a time (slot capacity = 1)
- Book assignment and creation unified into one admin action (scan → assign)
- Reassignment allowed anytime, even during open sub-shifts; requires `confirm_reassign: true`
- Admin "delete book" = unassign (book row preserved for history)
- Slot soft-delete only; `slot_name` editable anytime, `ticket_price` only when empty
- Closing inputs (cash_in_hand, gross_sales, cash_out) entered manually at close
- tickets_total = scanned sales + whole-book sales + return partials
- expected_cash = gross_sales + tickets_total - cash_out
- difference = cash_in_hand - expected_cash
- shift_status: correct / over / short
- Trust-based carry-forward: only after 'correct' close; 'short'/'over' forces rescan
- Pending-scans blocking: sub-shift cannot accept sales until initialization complete
- Whole-book sale: separate flow, no Book row created, PIN-authorized
- Return-to-vendor: preserves pre-return revenue, unassigns book, PIN-authorized
- Single store PIN reused for whole-book-sale and return-to-vendor
- Store PIN mandatory at initial setup
- Void = flag + audit, never deletion; does not modify downstream carried data
- Reports show open_position, close_position, scan_source, slot-at-scan-time per book
- Ticket breakdown on reports separates scanned from whole_book by price
- Scans only at shift open, last-ticket of book, return-to-vendor, shift close (not per sale)

**Mobile structure finalized:**
- Screens including Splash, Onboarding, Settings, Shift, Scan, Books (admin slots view), History
- Reusable components: SkeletonLoader, ToastNotification, ConfirmDialog, PinDialog, OfflineBanner
- locales/ folder with translation files per language
- utils/rtl.js for RTL layout management

### Deliverables
- [x] SRS v5.1 — final, with decision log
- [x] ERD v2.0 — all 8 models with constraints, relationships, partial indexes
- [x] ERD diagram converted to Mermaid for GitHub rendering
- [x] API Contract v2.0 — all endpoints with request/response shapes and error codes
- [x] Updated README.md reflecting v2.0 design
- [x] Flask folder structure finalized
- [x] React Native folder structure finalized
- [x] Shift validation formula documented
- [x] Last ticket detection logic documented (price-indexed)
- [x] Ticket price breakdown logic documented
- [x] Report structure documented
- [x] PIN rate-limiting contract documented
- [x] Barcode parsing contract documented

---

## Phase 4 — Implementation

### Backend (Flask API) ✅

**Status:** Complete | **Date:** April 2026

The complete REST API is implemented and tested end-to-end with Thunder Client. All 28 endpoints from the API Contract are functional. PostgreSQL-compatible. Containerized with Docker and docker-compose.

**Build order completed in sequence:**

- [x] Project scaffold (app factory, config, extensions, constants.py)
- [x] Error handlers + APIError hierarchy
- [x] Store model + schema + service + routes
- [x] User model + auth module (setup, login, logout) + JWT wiring + role decorator
- [x] Store settings (PIN) module
- [x] Slot model + schema + service + routes (with soft-delete)
- [x] Book model + BookAssignmentHistory model
- [x] Slot assignment endpoint (scan-to-assign with reassignment)
- [x] Book unassign + return-to-vendor endpoints
- [x] ShiftDetails model + schema
- [x] Shift open / handover / close service + routes
- [x] Pending-scans computation
- [x] Carry-forward logic (correct-status only)
- [x] ShiftBooks model + scan service + routes
- [x] Last-ticket detection via LENGTH_BY_PRICE
- [x] Scan validation rules 1-8
- [x] ShiftExtraSales model + whole-book-sale endpoint
- [x] PIN rate-limiting
- [x] Void endpoints (sub-shift + main shift)
- [x] Reports service + endpoint
- [x] Docker + docker-compose setup

### Implementation Stats

| Metric | Value |
|---|---|
| SQLAlchemy models | 8 |
| API endpoints | 28 |
| Flask blueprints | 8 |
| Marshmallow schemas | 7 |
| Services | 9 |
| Database migrations | 6 |
| Lines of Python (approx) | 2,500 |

### Branching Strategy
```
main          ← stable, production-ready only
develop       ← integration branch
feature/*     ← one branch per feature
```

For Phase 4 backend, all commits went directly to `main` since this was solo development before any deployment.

### Commit Convention Used
- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation only
- `test:` adding tests
- `refactor:` restructure, no behavior change
- `chore:` tooling, config, dependency updates

### Testing During Implementation
Each module was end-to-end tested via Thunder Client immediately after implementation. Test sequences included:
- Happy path validation
- All error codes from the API Contract
- Edge cases (out-of-range positions, duplicate names, soft-deleted name reuse, etc.)
- Cross-feature interactions (slot guards triggered by book assignment, FR-CLOSE-01 blocking handover, carry-forward creating real ShiftBooks rows, return-to-vendor creating close scans)

### Mobile App (React Native) ⏳

**Status:** Pending — Next Phase

### Build Order
- [ ] Project scaffold (Expo, navigation, i18n, RTL)
- [ ] Auth context + JWT storage
- [ ] Login screen
- [ ] Splash screen
- [ ] Onboarding screen
- [ ] Bottom tab navigation
- [ ] Home / Shift screen (live totals, shift timer, scanned books list, pending banner)
- [ ] Scan screen (camera + manual fallback, hardware scanner support, feedback sounds, scan counter)
- [ ] Books screen (admin slots grid, bulk assignment flow)
- [ ] Shift history screen (date filter, shift cards, detail view with report)
- [ ] Settings screen (language, theme, store info, PIN change, logout)
- [ ] Whole-book-sale modal + PIN dialog
- [ ] Return-book modal + PIN dialog
- [ ] Reusable components (SkeletonLoader, ToastNotification, ConfirmDialog, PinDialog, OfflineBanner)
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
| API manual testing | Thunder Client | All endpoints (✅ already done) |
| Mobile component tests | Jest | React Native components |
| Shift validation tests | pytest | expected_cash, difference, shift_status |
| Last ticket detection tests | pytest | All 6 prices (1, 2, 3, 5, 10, 20) |
| Ticket breakdown tests | pytest | Scanned + whole-book grouping |
| Scan rule tests | pytest | All 8 scan validation rules |
| PIN rate-limit tests | pytest | Lockout + reset |
| Carry-forward tests | pytest | Correct-status carry, short/over rescan |
| Pending-scans tests | pytest | Initial, handover, refill, resume |
| Whole-book-sale tests | pytest | Valid + invalid prices, PIN flows |
| Return-to-vendor tests | pytest | With/without open sub-shift, revenue preservation |
| Void tests | pytest | Sub-shift void, main shift void, downstream unchanged |
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
- Docker + docker-compose for local dev (Flask + PostgreSQL) ✅ already done in Phase 4
- Deploy to cloud (Railway / Render / VPS)
- GitHub Actions CI/CD pipeline
- Automated database backups

### Deliverables
- [x] Dockerfile for Flask API
- [x] docker-compose.yml
- [ ] GitHub Actions CI workflow
- [ ] Deployment guide
- [x] .env.example with all required variables
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
- Admin role enforcement + route decorators ✅ already done
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
| April 2026 | `ticket_price` on both Slot and Book | Slot = default, Book = permanent for historical reports |
| April 2026 | Main shift auto-creates Sub-shift 1 | Every main shift must have at least one sub-shift |
| April 2026 | Scanning/closing on sub-shifts only | Main shift is container only, not a work unit |
| April 2026 | Book lengths fixed by price | Business constant; $1/$2→150, $3→100, $5→60, $10/$20→30 |
| April 2026 | cash_in_hand/gross_sales/cash_out manual at close | Employee enters from physical register and cash count |
| April 2026 | expected_cash = gross_sales + tickets_total - cash_out | Verified formula with product owner |
| April 2026 | shift_status: correct/over/short | Clear language for store employees to understand result |
| April 2026 | Ticket breakdown on every report | Both sub-shift and main shift show price breakdown |
| April 2026 | Main shift report = combined + each sub-shift separately | Managers need both summary and per-employee details |
| April 2026 | Drop Book.end and Book.total columns | Derivable from LENGTH_BY_PRICE and scan history; avoids stale cache bugs |
| April 2026 | static_code globally unique per book | Barcode manufacturer guarantee; removes suffix-price ambiguity |
| April 2026 | Book assignment unified with creation | One admin action: scan-to-assign. No standalone book creation |
| April 2026 | No hard-delete for Book | "Delete" in admin UI means unassign; preserves history |
| April 2026 | ShiftBooks PK = (shift_id, barcode, scan_type) | Fix: same book scanned at open AND close of same sub-shift |
| April 2026 | Slot soft-delete with partial unique index | Preserve historical references while allowing name reuse |
| April 2026 | Carry-forward only after 'correct' status | Trust boundary; short/over forces full rescan |
| April 2026 | Pending-scans blocking | Cannot accept sales until sub-shift initialized |
| April 2026 | Scan rescan overwrites | Simpler error correction; no 409 on duplicate |
| April 2026 | Rule 8: no open rescan after close started | Prevents mid-shift history rewriting |
| April 2026 | Whole-book-sale as ShiftExtraSales (no Book row) | Stockroom books never enter inventory |
| April 2026 | Single store PIN for both whole-book-sale and return | Simpler mental model for admin |
| April 2026 | Store PIN mandatory at initial setup | No "configure later" path; avoids unusable state |
| April 2026 | Return-to-vendor preserves pre-return revenue | Scan captures position, recorded as close scan |
| April 2026 | Admin role enforced from v2.0 | Moved up from v2.1; too risky to defer |
| April 2026 | Void preserves all data as flag | Audit integrity; downstream data unchanged |
| April 2026 | Reassignment requires confirm_reassign | Protects against accidental double-scans |
| April 2026 | Partial unique: one open main shift per store | DB-level enforcement of FR-SHIFT-02 |
| April 2026 | Assignment history in dedicated table | Reports show which slot a book was in at each scan |
| April 2026 | Boolean check constraints use `NOT col` syntax | PostgreSQL strict typing — `col = 0` doesn't work cross-dialect |
| April 2026 | In-memory PIN rate limiter for v2.0 | Single-instance dev; Redis for production multi-instance |
| April 2026 | In-memory JWT blocklist for v2.0 | Same reasoning as PIN limiter |
| April 2026 | Gunicorn 2 workers in Docker | Reasonable default for small deployments |
| April 2026 | Migrations run on container startup | `flask db upgrade` in docker-compose command |
