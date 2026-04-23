# Software Requirements Specification (SRS)
## LottoMeter v2.0 — Mobile & API Rebuild

---

| Field | Value |
|---|---|
| **Project Name** | LottoMeter v2.0 |
| **Document Version** | 1.0 |
| **Author** | Abdelrahman Yousef |
| **Date** | April 2026 |
| **Status** | Draft |
| **Previous Version** | LottoMeter v1 (C# / Windows Forms / SQLite) |

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Overall Description](#2-overall-description)
3. [Tech Stack](#3-tech-stack)
4. [User Roles](#4-user-roles)
5. [Functional Requirements](#5-functional-requirements)
6. [Non-Functional Requirements](#6-non-functional-requirements)
7. [System Architecture Overview](#7-system-architecture-overview)
8. [Database Design](#8-database-design)
9. [API Endpoints Overview](#9-api-endpoints-overview)
10. [Use Cases](#10-use-cases)
11. [Constraints & Assumptions](#11-constraints--assumptions)
12. [Future Enhancements](#12-future-enhancements)
13. [Glossary](#13-glossary)

---

## 1. Introduction

### 1.1 Purpose

This document defines the software requirements for **LottoMeter v2.0**, a full rebuild of the original LottoMeter desktop application. The v2 system replaces the Windows Forms + C# desktop app with a **mobile application (React Native)** backed by a **RESTful API (Flask + SQLAlchemy)**, making the system accessible on any device and no longer limited to a single Windows machine.

### 1.2 Scope

LottoMeter v2.0 is a shift management system for grocery and retail stores that sell lottery tickets. It enables store employees to:

- Manage lottery ticket book inventory organized by slots
- Open and close work shifts with barcode-based scanning
- Track ticket book scan activity during shifts
- Calculate gross sales, ticket totals, and cash figures automatically
- View shift history and summaries

The system replaces all manual paperwork involved in lottery shift tracking.

### 1.3 Intended Audience

This document is intended for:
- The developer (Abdelrahman Yousef) building the system
- Any future contributors or reviewers
- Academic evaluators reviewing the SDLC documentation

### 1.4 References

- LottoMeter v1 Source Code: https://github.com/AbdelrahmanYousef9266/LottoMeter
- Flask Documentation: https://flask.palletsprojects.com
- SQLAlchemy Documentation: https://docs.sqlalchemy.org
- React Native Documentation: https://reactnative.dev

---

## 2. Overall Description

### 2.1 Product Perspective

LottoMeter v2.0 is a client-server system. The **Flask API** acts as the backend server, managing all business logic and data persistence via **SQLAlchemy**. The **React Native app** is the client, consumed by store employees on their mobile devices.

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

### 2.2 Product Functions (Summary)

- User authentication (login / logout)
- Slot management (add, edit, delete slots)
- Book management (add, edit, delete, assign to slot)
- Shift management (open shift, scan books, close shift, sub-shifts)
- Barcode scanning and matching
- Automatic total calculations (gross sales, tickets total, cash in/out)
- Shift history and reporting

### 2.3 Operating Environment

| Component | Environment |
|---|---|
| Backend | Python 3.11+, Flask 3.x, SQLAlchemy 2.x |
| Database | PostgreSQL (production), SQLite (development/testing) |
| Mobile Client | React Native (Expo), iOS 14+, Android 10+ |
| Authentication | JWT (JSON Web Tokens) |
| Deployment | Docker container, any Linux cloud server |

---

## 3. Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| Mobile Frontend | React Native (Expo) | Cross-platform iOS & Android from one codebase |
| API Framework | Flask | Lightweight, flexible, Python-native |
| ORM | SQLAlchemy | Mirrors EF Core from v1, robust relationships |
| Database (Dev) | SQLite | Zero-config, matches v1 |
| Database (Prod) | PostgreSQL | Production-grade, scalable |
| Auth | JWT via Flask-JWT-Extended | Stateless, mobile-friendly |
| Serialization | Marshmallow | Schema validation + JSON serialization |
| Testing (API) | pytest + pytest-flask | Unit and integration tests |
| Testing (Mobile) | Jest + React Native Testing Library | Component and integration tests |
| Containerization | Docker + docker-compose | Consistent environments |
| CI/CD | GitHub Actions | Automated test and deploy pipeline |

---

## 4. User Roles

### 4.1 Employee (Standard User)

The primary user of the system. A store employee who:
- Logs in at the start of their shift
- Opens a new shift
- Scans lottery ticket books via barcode
- Closes the shift at the end
- Views shift summaries

### 4.2 Admin (Future Phase)

An administrative user (manager) who can:
- Manage all slots and books
- View all shift history across all employees
- Generate reports
- Manage user accounts

> **Note:** For v2.0, only the Employee role will be implemented. Admin role is planned for v2.1.

---

## 5. Functional Requirements

Requirements are tagged as:
- **FR** = Functional Requirement
- **Priority:** High / Medium / Low

---

### 5.1 Authentication Module

| ID | Requirement | Priority |
|---|---|---|
| FR-AUTH-01 | The system shall allow a user to log in with a username and password | High |
| FR-AUTH-02 | The system shall return a JWT access token upon successful login | High |
| FR-AUTH-03 | The system shall reject invalid credentials with a 401 response | High |
| FR-AUTH-04 | The system shall allow a logged-in user to log out (token invalidation or client-side removal) | High |
| FR-AUTH-05 | All API endpoints except login shall require a valid JWT token | High |
| FR-AUTH-06 | The system shall support first-run setup to create the initial user account | Medium |

---

### 5.2 Slot Management Module

| ID | Requirement | Priority |
|---|---|---|
| FR-SLOT-01 | The system shall allow creating a new slot with a name | High |
| FR-SLOT-02 | The system shall allow retrieving a list of all slots | High |
| FR-SLOT-03 | The system shall allow updating an existing slot's name | Medium |
| FR-SLOT-04 | The system shall allow deleting a slot that has no books assigned | Medium |
| FR-SLOT-05 | Each slot shall have a unique name | High |

---

### 5.3 Book Management Module

| ID | Requirement | Priority |
|---|---|---|
| FR-BOOK-01 | The system shall allow creating a new lottery book with: name, barcode, amount, start value, end value, static code, and assigned slot | High |
| FR-BOOK-02 | The system shall calculate the total for a book automatically based on (end - start) * amount | High |
| FR-BOOK-03 | The system shall allow retrieving all books, optionally filtered by slot | High |
| FR-BOOK-04 | The system shall allow retrieving a single book by its ID or barcode | High |
| FR-BOOK-05 | The system shall allow updating book details | Medium |
| FR-BOOK-06 | The system shall allow deleting a book | Medium |
| FR-BOOK-07 | Each book shall have a unique barcode | High |
| FR-BOOK-08 | The system shall track whether a book has been scanned (is_scanned flag) | High |

---

### 5.4 Shift Management Module

| ID | Requirement | Priority |
|---|---|---|
| FR-SHIFT-01 | The system shall allow opening a new main shift, recording the start time and cash in hand | High |
| FR-SHIFT-02 | The system shall prevent opening a new main shift if one is already open | High |
| FR-SHIFT-03 | The system shall allow closing an open shift, recording end time, cash out, gross sales, cancels, and tickets total | High |
| FR-SHIFT-04 | The system shall allow creating a sub-shift linked to an active main shift, with a shift number | High |
| FR-SHIFT-05 | The system shall allow retrieving all shifts (main shifts and sub-shifts) | High |
| FR-SHIFT-06 | The system shall allow retrieving a single shift with all its scanned books | High |
| FR-SHIFT-07 | The system shall allow retrieving all sub-shifts under a specific main shift | High |
| FR-SHIFT-08 | The system shall calculate and return shift totals when a shift is retrieved | High |

---

### 5.5 Barcode Scanning Module

| ID | Requirement | Priority |
|---|---|---|
| FR-SCAN-01 | The system shall accept a barcode string submitted during an active shift | High |
| FR-SCAN-02 | The system shall extract the static code from the submitted barcode | High |
| FR-SCAN-03 | The system shall match the extracted static code against stored book records | High |
| FR-SCAN-04 | If a match is found, the system shall create a ShiftBook record associating the book with the current shift | High |
| FR-SCAN-05 | The system shall reject a scan if no book matches the extracted static code | High |
| FR-SCAN-06 | The system shall reject a duplicate scan of the same barcode within the same shift | High |
| FR-SCAN-07 | The system shall update the book's is_scanned flag upon a successful scan | High |
| FR-SCAN-08 | The system shall return the matched book details upon a successful scan | High |

---

### 5.6 Shift Books (Scan Records) Module

| ID | Requirement | Priority |
|---|---|---|
| FR-SB-01 | Each shift book record shall store: shift ID, slot ID, barcode, start, end, amount, and total | High |
| FR-SB-02 | The system shall allow retrieving all scanned books for a given shift | High |
| FR-SB-03 | The composite key of shift_id + barcode shall be unique (no duplicate scans per shift) | High |

---

## 6. Non-Functional Requirements

### 6.1 Performance

| ID | Requirement |
|---|---|
| NFR-PERF-01 | API response time for standard requests shall be under 500ms on a local network |
| NFR-PERF-02 | The barcode matching operation shall complete in under 200ms |
| NFR-PERF-03 | The mobile app shall load the home/shift screen in under 2 seconds |

### 6.2 Security

| ID | Requirement |
|---|---|
| NFR-SEC-01 | All passwords shall be hashed using bcrypt before storage |
| NFR-SEC-02 | JWT tokens shall expire after 8 hours |
| NFR-SEC-03 | All API communication shall occur over HTTPS in production |
| NFR-SEC-04 | The API shall validate and sanitize all input data to prevent SQL injection |

### 6.3 Reliability

| ID | Requirement |
|---|---|
| NFR-REL-01 | The system shall use database transactions to prevent partial writes during shift operations |
| NFR-REL-02 | The API shall return meaningful error messages and correct HTTP status codes for all failure scenarios |

### 6.4 Usability

| ID | Requirement |
|---|---|
| NFR-USE-01 | The React Native app shall work on both iOS and Android without separate builds (Expo) |
| NFR-USE-02 | The barcode scanning screen shall be operable with one hand |
| NFR-USE-03 | Error messages in the app shall be human-readable and actionable |

### 6.5 Maintainability

| ID | Requirement |
|---|---|
| NFR-MAIN-01 | The Flask API shall follow a blueprint-based modular structure |
| NFR-MAIN-02 | All business logic shall be separated into service-layer functions, not placed in route handlers |
| NFR-MAIN-03 | The codebase shall include docstrings on all service functions and API routes |
| NFR-MAIN-04 | Database migrations shall be managed via Flask-Migrate (Alembic) |

### 6.6 Testability

| ID | Requirement |
|---|---|
| NFR-TEST-01 | API test coverage shall reach a minimum of 80% of route handlers |
| NFR-TEST-02 | All service-layer functions shall have corresponding unit tests |
| NFR-TEST-03 | A Postman collection shall be maintained documenting all API endpoints |

---

## 7. System Architecture Overview

### 7.1 Backend (Flask) Folder Structure

```
lottometer-api/
├── app/
│   ├── __init__.py          # App factory
│   ├── config.py            # Config classes (Dev, Test, Prod)
│   ├── extensions.py        # db, jwt, ma instances
│   ├── models/
│   │   ├── user.py
│   │   ├── slot.py
│   │   ├── book.py
│   │   ├── shift_details.py
│   │   └── shift_books.py
│   ├── schemas/             # Marshmallow schemas
│   │   ├── user_schema.py
│   │   ├── slot_schema.py
│   │   ├── book_schema.py
│   │   ├── shift_schema.py
│   │   └── shift_books_schema.py
│   ├── services/            # Business logic layer
│   │   ├── auth_service.py
│   │   ├── slot_service.py
│   │   ├── book_service.py
│   │   ├── shift_service.py
│   │   └── scan_service.py
│   └── routes/              # Flask Blueprints
│       ├── auth_routes.py
│       ├── slot_routes.py
│       ├── book_routes.py
│       ├── shift_routes.py
│       └── scan_routes.py
├── migrations/              # Flask-Migrate / Alembic
├── tests/
│   ├── conftest.py
│   ├── test_auth.py
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

### 7.2 Mobile (React Native) Folder Structure

```
lottometer-mobile/
├── src/
│   ├── api/                 # Axios API client
│   │   ├── client.js
│   │   ├── authApi.js
│   │   ├── slotApi.js
│   │   ├── bookApi.js
│   │   └── shiftApi.js
│   ├── screens/
│   │   ├── LoginScreen.js
│   │   ├── HomeScreen.js
│   │   ├── ShiftScreen.js
│   │   ├── ScanScreen.js
│   │   ├── BookListScreen.js
│   │   └── ShiftHistoryScreen.js
│   ├── components/
│   │   ├── BookCard.js
│   │   ├── ShiftSummary.js
│   │   └── BarcodeInput.js
│   ├── context/
│   │   └── AuthContext.js
│   ├── navigation/
│   │   └── AppNavigator.js
│   └── utils/
│       └── storage.js       # AsyncStorage JWT helper
├── App.js
├── app.json
└── package.json
```

---

## 8. Database Design

### 8.1 Entity Relationship Summary

```
User           (1) ──────────────── has no FK relations in v2.0 (auth only)

Slot           (1) ──────────────── (many) Book
Book           (many) ──────────── (many) ShiftBooks  ← junction
ShiftDetails   (1) ──────────────── (many) ShiftBooks
ShiftDetails   (1) ──────────────── (many) ShiftDetails  ← self-ref (sub-shifts)
```

### 8.2 SQLAlchemy Models

#### User
| Column | Type | Constraints |
|---|---|---|
| user_id | Integer | PK, Auto-increment |
| username | String(100) | Unique, Not Null |
| password_hash | String(256) | Not Null |
| created_at | DateTime | Default: now() |

#### Slot
| Column | Type | Constraints |
|---|---|---|
| slot_id | Integer | PK, Auto-increment |
| slot_name | String(100) | Unique, Not Null |

#### Book
| Column | Type | Constraints |
|---|---|---|
| book_id | Integer | PK, Auto-increment |
| book_name | String(150) | Not Null |
| barcode | String(100) | Unique, Not Null |
| amount | Numeric(10,2) | Not Null |
| start | Integer | Not Null |
| end | Integer | Not Null |
| total | Numeric(10,2) | Computed: (end-start) * amount |
| static_code | String(100) | Not Null, Indexed |
| slot_id | Integer | FK → Slot.slot_id, Not Null |
| is_scanned | Boolean | Default: False |

#### ShiftDetails
| Column | Type | Constraints |
|---|---|---|
| shift_id | Integer | PK, Auto-increment |
| shift_start_time | DateTime | Not Null, Default: now() |
| shift_end_time | DateTime | Nullable |
| cash_in_hand | Numeric(10,2) | Default: 0 |
| cash_out | Numeric(10,2) | Default: 0 |
| gross_sales | Numeric(10,2) | Default: 0 |
| cancels | Numeric(10,2) | Default: 0 |
| tickets_total | Numeric(10,2) | Default: 0 |
| is_shift_open | Boolean | Default: True |
| main_shift_id | Integer | FK → ShiftDetails.shift_id, Nullable (NULL = main shift) |
| shift_number | Integer | Not Null, Default: 1 |

#### ShiftBooks
| Column | Type | Constraints |
|---|---|---|
| shift_id | Integer | PK (composite), FK → ShiftDetails.shift_id |
| barcode | String(100) | PK (composite) |
| slot_id | Integer | FK → Slot.slot_id, Not Null |
| start | Integer | Not Null |
| end | Integer | Not Null |
| amount | Numeric(10,2) | Not Null |
| total | Numeric(10,2) | Not Null |

---

## 9. API Endpoints Overview

### Authentication

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| POST | /api/auth/login | Login, returns JWT | No |
| POST | /api/auth/logout | Logout | Yes |
| POST | /api/auth/setup | First-run user creation | No |

### Slots

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| GET | /api/slots | List all slots | Yes |
| POST | /api/slots | Create a slot | Yes |
| GET | /api/slots/{id} | Get a slot by ID | Yes |
| PUT | /api/slots/{id} | Update a slot | Yes |
| DELETE | /api/slots/{id} | Delete a slot | Yes |

### Books

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| GET | /api/books | List all books (filter by slot optional) | Yes |
| POST | /api/books | Create a book | Yes |
| GET | /api/books/{id} | Get book by ID | Yes |
| PUT | /api/books/{id} | Update a book | Yes |
| DELETE | /api/books/{id} | Delete a book | Yes |

### Shifts

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| GET | /api/shifts | List all main shifts | Yes |
| POST | /api/shifts | Open a new main shift | Yes |
| GET | /api/shifts/{id} | Get shift with scanned books | Yes |
| PUT | /api/shifts/{id}/close | Close an open shift | Yes |
| POST | /api/shifts/{id}/subshifts | Create a sub-shift | Yes |
| GET | /api/shifts/{id}/subshifts | List sub-shifts of a main shift | Yes |

### Barcode Scanning

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| POST | /api/scan | Submit a barcode scan for active shift | Yes |

---

## 10. Use Cases

### UC-01: Open a Shift

**Actor:** Employee  
**Precondition:** User is logged in. No shift is currently open.  
**Main Flow:**
1. Employee opens the app and navigates to the Shift screen
2. Employee taps "Open Shift" and enters cash in hand
3. App sends POST /api/shifts with cash_in_hand
4. System creates a new ShiftDetails record with is_shift_open = True
5. App displays the active shift screen with shift details

**Alternate Flow:**  
- If a shift is already open, the system returns 409 Conflict and the app shows an error

---

### UC-02: Scan a Book

**Actor:** Employee  
**Precondition:** A shift is open.  
**Main Flow:**
1. Employee navigates to the Scan screen
2. Employee scans or manually enters a barcode
3. App sends POST /api/scan with barcode and shift_id
4. System extracts the static code from the barcode
5. System looks up a Book by static_code
6. System creates a ShiftBook record and marks book as scanned
7. App displays the matched book details (name, amount, slot)

**Alternate Flows:**
- If no book matches: system returns 404, app shows "Book not found"
- If already scanned in this shift: system returns 409, app shows "Already scanned"

---

### UC-03: Close a Shift

**Actor:** Employee  
**Precondition:** A shift is open.  
**Main Flow:**
1. Employee taps "Close Shift"
2. App displays a summary of all scanned books and totals
3. Employee enters cash out, gross sales, and cancels
4. App sends PUT /api/shifts/{id}/close
5. System sets shift_end_time and is_shift_open = False
6. App shows a closed shift summary

---

### UC-04: Create a Sub-Shift

**Actor:** Employee  
**Precondition:** A main shift is open.  
**Main Flow:**
1. Employee taps "Add Sub-Shift" within an active main shift
2. App sends POST /api/shifts/{main_shift_id}/subshifts
3. System creates a new ShiftDetails record linked via main_shift_id
4. App adds the sub-shift to the current session view

---

## 11. Constraints & Assumptions

### Constraints

- The system is designed for single-store use in v2.0 (no multi-store/multi-tenant support)
- Only one main shift can be open at a time per deployment
- Barcode format must include the static code extractable at a known position (to be defined during implementation based on actual barcode format used in v1)
- Internet connectivity is required for the mobile app to communicate with the API

### Assumptions

- The store has a reliable local WiFi or internet connection during shift hours
- Each employee has access to a smartphone running iOS 14+ or Android 10+
- The barcode scanning input on the mobile app can be handled via the device camera (Expo Barcode Scanner) or manual text entry
- The static code extraction logic from v1 (C#) will be reverse-engineered and reimplemented in Python

---

## 12. Future Enhancements

These items are out of scope for v2.0 but planned for future versions:

| Feature | Version |
|---|---|
| Role-based access control (Admin role) | v2.1 |
| PDF shift report export | v2.1 |
| Dashboard with analytics and charts | v2.1 |
| Multi-store / multi-location support | v3.0 |
| Offline mode with sync | v3.0 |
| Push notifications for shift reminders | v2.2 |
| Excel/CSV export of shift history | v2.1 |

---

## 13. Glossary

| Term | Definition |
|---|---|
| **Book** | A lottery ticket book identified by a barcode and assigned to a slot |
| **Slot** | A physical or logical location in the store that holds lottery books |
| **Shift** | A working period during which an employee manages lottery book activity |
| **Sub-shift** | A child shift linked to a main shift, used to track partial or overlapping shift activity |
| **Static Code** | A unique identifier extracted from a book's barcode used for matching |
| **ShiftBooks** | A record of a book that was scanned during a specific shift |
| **JWT** | JSON Web Token — a stateless authentication token passed in API request headers |
| **ORM** | Object Relational Mapper — maps Python classes to database tables (SQLAlchemy) |
| **Barcode** | A scannable code printed on each lottery ticket book used to identify it |
| **Gross Sales** | Total sales amount recorded at shift close |
| **Cash In Hand** | Starting cash amount recorded at shift open |
| **Cash Out** | Final cash amount recorded at shift close |
| **Tickets Total** | Total value of all scanned lottery ticket books in a shift |

---

*Document end — LottoMeter v2.0 SRS v1.0*
