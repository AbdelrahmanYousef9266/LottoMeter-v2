# Software Requirements Specification (SRS)
## LottoMeter v2.0 — Mobile & API Rebuild

---

| Field | Value |
|---|---|
| **Project Name** | LottoMeter v2.0 |
| **Document Version** | 3.0 |
| **Author** | Abdelrahman Yousef |
| **Date** | April 2026 |
| **Status** | Updated |
| **Previous Version** | LottoMeter v1 (C# / Windows Forms / SQLite) |

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Overall Description](#2-overall-description)
3. [Tech Stack](#3-tech-stack)
4. [User Roles](#4-user-roles)
5. [Functional Requirements](#5-functional-requirements)
6. [UI & UX Requirements](#6-ui--ux-requirements)
7. [Multilingual & Accessibility Requirements](#7-multilingual--accessibility-requirements)
8. [Non-Functional Requirements](#8-non-functional-requirements)
9. [System Architecture Overview](#9-system-architecture-overview)
10. [Database Design](#10-database-design)
11. [API Endpoints Overview](#11-api-endpoints-overview)
12. [Use Cases](#12-use-cases)
13. [Commercialization Requirements](#13-commercialization-requirements)
14. [Constraints & Assumptions](#14-constraints--assumptions)
15. [Future Enhancements](#15-future-enhancements)
16. [Glossary](#16-glossary)

---

## 1. Introduction

### 1.1 Purpose

This document defines the software requirements for **LottoMeter v2.0**, a full rebuild of the original LottoMeter desktop application. The v2 system replaces the Windows Forms + C# desktop app with a **mobile application (React Native)** backed by a **RESTful API (Flask + SQLAlchemy)**, making the system accessible on any device and no longer limited to a single Windows machine.

The system is designed from day one with commercialization in mind — the schema and architecture support future multi-tenancy, role-based access control, subscription billing, multilingual support, and UI customization without requiring breaking changes.

### 1.2 Scope

LottoMeter v2.0 is a shift management system for grocery and retail stores that sell lottery tickets. It enables store employees to:

- Manage lottery ticket book inventory organized by slots
- Open and close work shifts with barcode-based scanning
- Track ticket book scan activity during shifts
- Calculate gross sales, ticket totals, and cash figures automatically
- View shift history and summaries
- Use the app in their preferred language with full RTL support

### 1.3 Intended Audience

- The developer (Abdelrahman Yousef) building the system
- Any future contributors or reviewers
- Academic evaluators reviewing the SDLC documentation
- Future investors or partners evaluating the product

### 1.4 References

- LottoMeter v1: https://github.com/AbdelrahmanYousef9266/LottoMeter
- LottoMeter v2: https://github.com/AbdelrahmanYousef9266/LottoMeter-v2
- Flask Documentation: https://flask.palletsprojects.com
- SQLAlchemy Documentation: https://docs.sqlalchemy.org
- React Native Documentation: https://reactnative.dev
- i18next Documentation: https://www.i18next.com

---

## 2. Overall Description

### 2.1 Product Perspective

LottoMeter v2.0 is a client-server system. The **Flask API** acts as the backend server. The **React Native app** is the mobile client consumed by store employees.

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

### 2.2 Product Functions Summary

- Store registration and management
- User authentication with role-based access (JWT)
- Slot and book management (full CRUD)
- Shift management (open, scan, close, sub-shifts)
- Barcode scanning and auto-matching
- Automatic financial calculations
- Shift history and reporting
- Multilingual UI with RTL support
- Light/dark mode and UI customization

### 2.3 Operating Environment

| Component | Environment |
|---|---|
| Backend | Python 3.11+, Flask 3.x, SQLAlchemy 2.x |
| Database | PostgreSQL (production), SQLite (development) |
| Mobile Client | React Native (Expo), iOS 14+, Android 10+ |
| Authentication | JWT (JSON Web Tokens) |
| i18n | i18next + react-i18next |
| Deployment | Docker, Linux cloud server |

---

## 3. Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| Mobile Frontend | React Native (Expo) | Cross-platform iOS & Android |
| API Framework | Flask | Lightweight Python REST framework |
| ORM | SQLAlchemy | Mirrors EF Core from v1 |
| Database (Dev) | SQLite | Zero-config development |
| Database (Prod) | PostgreSQL | Production-grade, scalable |
| Auth | JWT via Flask-JWT-Extended | Stateless, mobile-friendly |
| Serialization | Marshmallow | Validation + JSON serialization |
| i18n | i18next + react-i18next | Multilingual + RTL support |
| Testing (API) | pytest + pytest-flask | Unit and integration tests |
| Testing (Mobile) | Jest + React Native Testing Library | Component tests |
| Containerization | Docker + docker-compose | Consistent environments |
| CI/CD | GitHub Actions | Automated pipeline |

---

## 4. User Roles

### 4.1 Employee (v2.0)
- Login / logout
- Open and close shifts
- Scan books
- View shift history
- Configure personal UI preferences (language, theme)

### 4.2 Admin (v2.1)
- All employee permissions
- Manage users, slots, books
- View all shifts and analytics
- Configure store settings and print layout

### 4.3 Super Admin (Commercialization)
- Platform-wide store and subscription management

---

## 5. Functional Requirements

### 5.1 Store Module

| ID | Requirement | Priority |
|---|---|---|
| FR-STORE-01 | The system shall support a Store entity as the root tenant | High |
| FR-STORE-02 | All users, slots, books, and shifts shall belong to a store via store_id | High |
| FR-STORE-03 | The system shall allow creating a store during first-run setup | High |
| FR-STORE-04 | All API queries shall be scoped to the authenticated user's store_id | High |

### 5.2 Authentication Module

| ID | Requirement | Priority |
|---|---|---|
| FR-AUTH-01 | The system shall allow login with username and password | High |
| FR-AUTH-02 | The system shall return a JWT token on successful login | High |
| FR-AUTH-03 | The system shall reject invalid credentials with 401 | High |
| FR-AUTH-04 | The system shall support logout | High |
| FR-AUTH-05 | All endpoints except login and setup shall require JWT | High |
| FR-AUTH-06 | First-run setup shall create the initial store and user | High |
| FR-AUTH-07 | JWT shall contain user role and store_id | High |

### 5.3 Slot Management Module

| ID | Requirement | Priority |
|---|---|---|
| FR-SLOT-01 | The system shall allow creating a slot scoped to the current store | High |
| FR-SLOT-02 | The system shall allow listing all slots for the current store | High |
| FR-SLOT-03 | The system shall allow updating a slot name | Medium |
| FR-SLOT-04 | The system shall allow deleting a slot with no books assigned | Medium |
| FR-SLOT-05 | Slot names shall be unique within a store | High |

### 5.4 Book Management Module

| ID | Requirement | Priority |
|---|---|---|
| FR-BOOK-01 | The system shall allow creating a book with name, barcode, amount, start, end, static code, and slot | High |
| FR-BOOK-02 | The system shall auto-calculate book total as (end - start) * amount | High |
| FR-BOOK-03 | The system shall allow listing all books, optionally filtered by slot | High |
| FR-BOOK-04 | The system shall allow retrieving a book by ID or barcode | High |
| FR-BOOK-05 | The system shall allow updating and deleting books | Medium |
| FR-BOOK-06 | Book barcodes shall be unique within a store | High |
| FR-BOOK-07 | The system shall track is_scanned status per book | High |

### 5.5 Shift Management Module

| ID | Requirement | Priority |
|---|---|---|
| FR-SHIFT-01 | The system shall allow opening a main shift with cash in hand | High |
| FR-SHIFT-02 | The system shall prevent opening a shift if one is already open | High |
| FR-SHIFT-03 | The system shall allow closing a shift with cash out, gross sales, cancels, tickets total | High |
| FR-SHIFT-04 | The system shall allow creating sub-shifts under a main shift | High |
| FR-SHIFT-05 | The system shall allow listing all shifts for the current store | High |
| FR-SHIFT-06 | The system shall allow retrieving a shift with all scanned books | High |

### 5.6 Barcode Scanning Module

| ID | Requirement | Priority |
|---|---|---|
| FR-SCAN-01 | The system shall accept a barcode string during an active shift | High |
| FR-SCAN-02 | The system shall extract the static code from the barcode | High |
| FR-SCAN-03 | The system shall match static code to a book record scoped to the store | High |
| FR-SCAN-04 | The system shall create a ShiftBook record on successful match | High |
| FR-SCAN-05 | The system shall reject unmatched barcodes with 404 | High |
| FR-SCAN-06 | The system shall reject duplicate scans within the same shift with 409 | High |
| FR-SCAN-07 | The system shall update is_scanned on successful scan | High |
| FR-SCAN-08 | The system shall return matched book details on success | High |

---

## 6. UI & UX Requirements

### 6.1 Navigation

| ID | Requirement | Priority |
|---|---|---|
| FR-UI-01 | The app shall use bottom tab navigation with tabs: Home, Scan, Books, History, Settings | High |
| FR-UI-02 | The app shall display a splash screen with the app logo on launch | High |
| FR-UI-03 | The app shall display an onboarding screen for first-time users | High |
| FR-UI-04 | All screens shall display friendly empty state messages when no data is available | High |

### 6.2 Shift Screen

| ID | Requirement | Priority |
|---|---|---|
| FR-UI-05 | The shift screen shall display a clear visual indicator when a shift is open (green badge) | High |
| FR-UI-06 | The shift screen shall display live running totals that update as books are scanned | High |
| FR-UI-07 | The shift screen shall display a scrollable list of all books scanned in the current shift | High |
| FR-UI-08 | The shift screen shall display a shift timer showing how long the shift has been open | Medium |
| FR-UI-09 | The shift screen shall include a quick close button to initiate the close shift flow | High |

### 6.3 Scan Screen

| ID | Requirement | Priority |
|---|---|---|
| FR-UI-10 | The scan screen shall support camera-based barcode scanning via Expo Camera | High |
| FR-UI-11 | The scan screen shall provide a manual text input fallback if camera is unavailable | High |
| FR-UI-12 | The scan screen shall play a success sound and show a green flash on successful scan | High |
| FR-UI-13 | The scan screen shall play an error sound and show a red flash on failed scan | High |
| FR-UI-14 | The scan screen shall display the last scanned book details as a card | High |
| FR-UI-15 | The scan screen shall display a counter showing total books scanned in the current shift | Medium |

### 6.4 Books Screen

| ID | Requirement | Priority |
|---|---|---|
| FR-UI-16 | The books screen shall include a search bar to search by name or barcode | High |
| FR-UI-17 | The books screen shall support filtering by slot | High |
| FR-UI-18 | Each book card shall display a scanned / unscanned badge | High |
| FR-UI-19 | The books screen shall support pull-to-refresh | Medium |

### 6.5 History Screen

| ID | Requirement | Priority |
|---|---|---|
| FR-UI-20 | The history screen shall display shifts as cards with date, totals, and status | High |
| FR-UI-21 | The history screen shall support filtering by date range (today, week, month, custom) | Medium |
| FR-UI-22 | Tapping a shift card shall open a detailed view with all scanned books and financials | High |
| FR-UI-23 | Shift cards shall show Open / Closed status badges with color coding | High |

### 6.6 Settings Screen

| ID | Requirement | Priority |
|---|---|---|
| FR-UI-24 | The settings screen shall include a language selector | High |
| FR-UI-25 | The settings screen shall include a light/dark mode toggle | High |
| FR-UI-26 | The settings screen shall display store name and store code | Medium |
| FR-UI-27 | The settings screen shall include a logout button | High |
| FR-UI-28 | The settings screen shall display the current app version | Low |
| FR-UI-29 | The settings screen shall include font size preference (v2.1) | v2.1 |
| FR-UI-30 | The settings screen shall include print layout customization (v2.1) | v2.1 |

### 6.7 General UI Polish

| ID | Requirement | Priority |
|---|---|---|
| FR-UI-31 | The app shall use loading skeletons instead of plain spinners while data loads | High |
| FR-UI-32 | The app shall display toast notifications for success and error messages | High |
| FR-UI-33 | The app shall display confirmation dialogs before closing a shift or deleting data | High |
| FR-UI-34 | The app shall display an offline banner when no internet connection is detected | High |
| FR-UI-35 | All forms shall implement keyboard avoiding view so inputs are not hidden by the keyboard | High |

---

## 7. Multilingual & Accessibility Requirements

### 7.1 Language Support

| ID | Requirement | Version |
|---|---|---|
| FR-LANG-01 | The app shall support English | v2.0 |
| FR-LANG-02 | The app shall support Arabic with full RTL layout | v2.0 |
| FR-LANG-03 | The app shall support Hindi | v2.1 |
| FR-LANG-04 | The app shall support Spanish | v2.1 |
| FR-LANG-05 | The app shall support French | v2.1 |
| FR-LANG-06 | The app shall support Urdu with full RTL layout | v2.1 |
| FR-LANG-07 | The app shall support Bengali | v2.2 |
| FR-LANG-08 | The app shall support Portuguese | v2.2 |
| FR-LANG-09 | The app shall support Punjabi | v2.2 |
| FR-LANG-10 | The app shall support Tamil | v2.2 |

### 7.2 RTL Support

| ID | Requirement | Priority |
|---|---|---|
| FR-RTL-01 | RTL layout support shall be enabled from v2.0 using React Native's built-in RTL API | High |
| FR-RTL-02 | All screens shall flip layout direction correctly when an RTL language is selected | High |
| FR-RTL-03 | Icons, navigation, and text alignment shall all respect the active layout direction | High |

### 7.3 Implementation

All UI text shall be stored in translation files per language:

```
lottometer-mobile/
└── src/
    └── locales/
        ├── en.json
        ├── ar.json
        ├── hi.json
        ├── es.json
        ├── fr.json
        └── ur.json
```

### 7.4 Accessibility

| ID | Requirement | Priority |
|---|---|---|
| FR-ACC-01 | The app shall support high contrast mode for visibility in bright store lighting | Medium |
| FR-ACC-02 | All interactive elements shall have touch targets of at least 44x44 points | High |
| FR-ACC-03 | The app shall support screen reader accessibility labels on all interactive elements | Medium |

---

## 8. Non-Functional Requirements

### 8.1 Performance

| ID | Requirement |
|---|---|
| NFR-PERF-01 | API response time shall be under 500ms on a local network |
| NFR-PERF-02 | Barcode matching shall complete in under 200ms |
| NFR-PERF-03 | The home/shift screen shall load in under 2 seconds |
| NFR-PERF-04 | Language switching shall be instant with no app restart required |

### 8.2 Security

| ID | Requirement |
|---|---|
| NFR-SEC-01 | All passwords shall be hashed using bcrypt |
| NFR-SEC-02 | JWT tokens shall expire after 8 hours |
| NFR-SEC-03 | All API communication shall use HTTPS in production |
| NFR-SEC-04 | All input shall be validated and sanitized |
| NFR-SEC-05 | All queries shall be scoped to store_id to prevent cross-tenant data leakage |
| NFR-SEC-06 | Role-based protection shall be enforced at the service layer |

### 8.3 Reliability

| ID | Requirement |
|---|---|
| NFR-REL-01 | Database transactions shall prevent partial writes during shift operations |
| NFR-REL-02 | All failure scenarios shall return meaningful error messages and correct HTTP codes |

### 8.4 Scalability

| ID | Requirement |
|---|---|
| NFR-SCALE-01 | The system shall support multi-tenancy via store_id on all tables |
| NFR-SCALE-02 | The API shall be stateless and horizontally scalable |
| NFR-SCALE-03 | Adding new stores shall require no schema changes |

### 8.5 Maintainability

| ID | Requirement |
|---|---|
| NFR-MAIN-01 | The Flask API shall follow blueprint-based modular structure |
| NFR-MAIN-02 | All business logic shall be in service-layer functions |
| NFR-MAIN-03 | All functions and routes shall have docstrings |
| NFR-MAIN-04 | Database migrations shall use Flask-Migrate (Alembic) |

### 8.6 Testability

| ID | Requirement |
|---|---|
| NFR-TEST-01 | API test coverage shall reach minimum 80% of route handlers |
| NFR-TEST-02 | All service functions shall have unit tests |
| NFR-TEST-03 | A Postman / Thunder Client collection shall document all endpoints |

---

## 9. System Architecture Overview

### 9.1 Backend Folder Structure

```
lottometer-api/
├── app/
│   ├── __init__.py
│   ├── config.py
│   ├── extensions.py
│   ├── models/
│   │   ├── store.py
│   │   ├── user.py
│   │   ├── slot.py
│   │   ├── book.py
│   │   ├── shift_details.py
│   │   └── shift_books.py
│   ├── schemas/
│   │   ├── store_schema.py
│   │   ├── user_schema.py
│   │   ├── slot_schema.py
│   │   ├── book_schema.py
│   │   ├── shift_schema.py
│   │   └── shift_books_schema.py
│   ├── services/
│   │   ├── auth_service.py
│   │   ├── store_service.py
│   │   ├── slot_service.py
│   │   ├── book_service.py
│   │   ├── shift_service.py
│   │   └── scan_service.py
│   └── routes/
│       ├── auth_routes.py
│       ├── store_routes.py
│       ├── slot_routes.py
│       ├── book_routes.py
│       ├── shift_routes.py
│       └── scan_routes.py
├── migrations/
├── tests/
│   ├── conftest.py
│   ├── test_auth.py
│   ├── test_stores.py
│   ├── test_slots.py
│   ├── test_books.py
│   ├── test_shifts.py
│   └── test_scan.py
├── .env
├── .env.example
├── requirements.txt
├── Dockerfile
├── docker-compose.yml
└── run.py
```

### 9.2 Mobile Folder Structure

```
lottometer-mobile/
├── src/
│   ├── api/
│   │   ├── client.js
│   │   ├── authApi.js
│   │   ├── slotApi.js
│   │   ├── bookApi.js
│   │   └── shiftApi.js
│   ├── screens/
│   │   ├── SplashScreen.js
│   │   ├── OnboardingScreen.js
│   │   ├── LoginScreen.js
│   │   ├── HomeScreen.js
│   │   ├── ShiftScreen.js
│   │   ├── ScanScreen.js
│   │   ├── BookListScreen.js
│   │   ├── ShiftHistoryScreen.js
│   │   └── SettingsScreen.js
│   ├── components/
│   │   ├── BookCard.js
│   │   ├── ShiftSummary.js
│   │   ├── BarcodeInput.js
│   │   ├── SkeletonLoader.js
│   │   ├── ToastNotification.js
│   │   ├── ConfirmDialog.js
│   │   └── OfflineBanner.js
│   ├── context/
│   │   └── AuthContext.js
│   ├── navigation/
│   │   └── AppNavigator.js
│   ├── locales/
│   │   ├── en.json
│   │   ├── ar.json
│   │   ├── hi.json
│   │   ├── es.json
│   │   ├── fr.json
│   │   └── ur.json
│   └── utils/
│       ├── storage.js
│       └── rtl.js
├── App.js
├── app.json
└── package.json
```

---

## 10. Database Design

### 10.1 Models

#### Store
| Column | Type | Constraints |
|---|---|---|
| store_id | Integer | PK |
| store_name | String(150) | Not Null |
| store_code | String(50) | Unique, Not Null |
| created_at | DateTime | Default: now() |

#### User
| Column | Type | Constraints |
|---|---|---|
| user_id | Integer | PK |
| username | String(100) | Not Null |
| password_hash | String(256) | Not Null |
| role | String(50) | Default: 'employee' |
| store_id | Integer | FK → Store |
| created_at | DateTime | Default: now() |

#### Slot
| Column | Type | Constraints |
|---|---|---|
| slot_id | Integer | PK |
| slot_name | String(100) | Not Null |
| store_id | Integer | FK → Store |

#### Book
| Column | Type | Constraints |
|---|---|---|
| book_id | Integer | PK |
| book_name | String(150) | Not Null |
| barcode | String(100) | Unique within store |
| amount | Numeric(10,2) | Not Null |
| start | Integer | Not Null |
| end | Integer | Not Null |
| total | Numeric(10,2) | Computed |
| static_code | String(100) | Not Null, Indexed |
| slot_id | Integer | FK → Slot |
| store_id | Integer | FK → Store |
| is_scanned | Boolean | Default: False |

#### ShiftDetails
| Column | Type | Constraints |
|---|---|---|
| shift_id | Integer | PK |
| shift_start_time | DateTime | Not Null |
| shift_end_time | DateTime | Nullable |
| cash_in_hand | Numeric(10,2) | Default: 0 |
| cash_out | Numeric(10,2) | Default: 0 |
| gross_sales | Numeric(10,2) | Default: 0 |
| cancels | Numeric(10,2) | Default: 0 |
| tickets_total | Numeric(10,2) | Default: 0 |
| is_shift_open | Boolean | Default: True |
| main_shift_id | Integer | FK → ShiftDetails, Nullable |
| shift_number | Integer | Default: 1 |
| store_id | Integer | FK → Store |

#### ShiftBooks
| Column | Type | Constraints |
|---|---|---|
| shift_id | Integer | PK (composite) |
| barcode | String(100) | PK (composite) |
| slot_id | Integer | FK → Slot |
| store_id | Integer | FK → Store |
| start | Integer | Not Null |
| end | Integer | Not Null |
| amount | Numeric(10,2) | Not Null |
| total | Numeric(10,2) | Not Null |

---

## 11. API Endpoints Overview

### Auth
| Method | Endpoint | Description | Auth |
|---|---|---|---|
| POST | /api/auth/setup | First-run store + user creation | No |
| POST | /api/auth/login | Login, returns JWT | No |
| POST | /api/auth/logout | Logout | Yes |

### Slots
| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | /api/slots | List all slots | Yes |
| POST | /api/slots | Create a slot | Yes |
| GET | /api/slots/{id} | Get slot by ID | Yes |
| PUT | /api/slots/{id} | Update slot | Yes |
| DELETE | /api/slots/{id} | Delete slot | Yes |

### Books
| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | /api/books | List all books | Yes |
| POST | /api/books | Create a book | Yes |
| GET | /api/books/{id} | Get book by ID | Yes |
| PUT | /api/books/{id} | Update book | Yes |
| DELETE | /api/books/{id} | Delete book | Yes |

### Shifts
| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | /api/shifts | List all shifts | Yes |
| POST | /api/shifts | Open a shift | Yes |
| GET | /api/shifts/{id} | Get shift details | Yes |
| PUT | /api/shifts/{id}/close | Close a shift | Yes |
| POST | /api/shifts/{id}/subshifts | Create sub-shift | Yes |
| GET | /api/shifts/{id}/subshifts | List sub-shifts | Yes |

### Scan
| Method | Endpoint | Description | Auth |
|---|---|---|---|
| POST | /api/scan | Submit barcode scan | Yes |

---

## 12. Use Cases

### UC-01: First-Run Setup
**Actor:** Employee | **Precondition:** No store or user exists
1. App shows setup screen
2. User enters store name and credentials
3. App sends POST /api/auth/setup
4. System creates Store and first User
5. App logs user in automatically

### UC-02: Open a Shift
**Actor:** Employee | **Precondition:** Logged in, no shift open
1. Employee taps "Open Shift" and enters cash in hand
2. App sends POST /api/shifts
3. System creates ShiftDetails record
4. App shows active shift screen with live totals

### UC-03: Scan a Book
**Actor:** Employee | **Precondition:** Shift is open
1. Employee scans barcode via camera or manual entry
2. App sends POST /api/scan
3. System matches static code to book
4. App shows success feedback and book details

**Alternate:** No match → 404 | Duplicate → 409

### UC-04: Close a Shift
**Actor:** Employee | **Precondition:** Shift is open
1. Employee taps "Close Shift"
2. App shows summary of scanned books and totals
3. Employee enters closing financials
4. App sends PUT /api/shifts/{id}/close
5. App shows closed shift summary

### UC-05: Switch Language
**Actor:** Employee | **Precondition:** Logged in
1. Employee opens Settings
2. Selects a language from the language selector
3. App instantly switches language and layout direction
4. RTL layout activates automatically for Arabic/Urdu

---

## 13. Commercialization Requirements

### 13.1 Multi-Tenancy
| ID | Requirement | Version |
|---|---|---|
| CR-MT-01 | store_id on every table | v2.0 ✅ |
| CR-MT-02 | All queries scoped to store_id | v2.0 ✅ |
| CR-MT-03 | Store self-registration endpoint | v2.1 |

### 13.2 RBAC
| ID | Requirement | Version |
|---|---|---|
| CR-RBAC-01 | role column on User | v2.0 ✅ |
| CR-RBAC-02 | Admin role enforcement | v2.1 |

### 13.3 Subscriptions
| ID | Requirement | Version |
|---|---|---|
| CR-SUB-01 | Plan and Subscription models | v2.1 |
| CR-SUB-02 | Stripe integration | v2.1 |
| CR-SUB-03 | Subscription enforcement middleware | v2.1 |

### 13.4 Analytics
| ID | Requirement | Version |
|---|---|---|
| CR-AN-01 | Analytics API endpoints | v2.1 |
| CR-AN-02 | Web manager dashboard | v2.1 |

---

## 14. Constraints & Assumptions

- One store active per deployment in v2.0
- One main shift open at a time per store
- Barcode static code extraction follows v1 logic
- Internet connection required for mobile app
- Employees have iOS 14+ or Android 10+ smartphones

---

## 15. Future Enhancements

| Feature | Version |
|---|---|
| Admin role enforcement | v2.1 |
| Store self-registration | v2.1 |
| Stripe billing | v2.1 |
| Manager analytics dashboard | v2.1 |
| PDF export | v2.1 |
| Excel/CSV export | v2.1 |
| Font size preference | v2.1 |
| Print layout customization | v2.1 |
| Bluetooth thermal printer | v2.1 |
| Hindi, Spanish, French, Urdu | v2.1 |
| Push notifications | v2.2 |
| Bengali, Portuguese, Punjabi, Tamil | v2.2 |
| Multi-store platform admin | v3.0 |
| POS integration | v3.0 |
| Offline mode with sync | v3.0 |

---

## 16. Glossary

| Term | Definition |
|---|---|
| **Store** | Root tenant entity representing a retail store |
| **Book** | A lottery ticket book identified by barcode |
| **Slot** | A location holding lottery books |
| **Shift** | A working period for lottery book management |
| **Sub-shift** | A child shift under a main shift |
| **Static Code** | Unique identifier extracted from a barcode |
| **ShiftBooks** | Record of a book scanned during a shift |
| **JWT** | JSON Web Token for stateless authentication |
| **ORM** | Object Relational Mapper |
| **RTL** | Right-to-Left — layout direction for Arabic and Urdu |
| **i18n** | Internationalization — multilingual support system |
| **Multi-tenancy** | Architecture serving multiple isolated customers |
| **RBAC** | Role-Based Access Control |
| **store_id** | Foreign key scoping all data to a specific store |

---

*Document end — LottoMeter v2.0 SRS v3.0*
