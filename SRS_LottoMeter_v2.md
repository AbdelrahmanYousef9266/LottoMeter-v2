# Software Requirements Specification (SRS)
## LottoMeter v2.0 — Mobile & API Rebuild

---

| Field | Value |
|---|---|
| **Project Name** | LottoMeter v2.0 |
| **Document Version** | 4.0 |
| **Author** | Abdelrahman Yousef |
| **Date** | April 2026 |
| **Status** | Final — Verified |

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Overall Description](#2-overall-description)
3. [Tech Stack](#3-tech-stack)
4. [User Roles](#4-user-roles)
5. [Business Logic & Workflows](#5-business-logic--workflows)
6. [Functional Requirements](#6-functional-requirements)
7. [UI & UX Requirements](#7-ui--ux-requirements)
8. [Multilingual & Accessibility Requirements](#8-multilingual--accessibility-requirements)
9. [Non-Functional Requirements](#9-non-functional-requirements)
10. [System Architecture Overview](#10-system-architecture-overview)
11. [Database Design](#11-database-design)
12. [API Endpoints Overview](#12-api-endpoints-overview)
13. [Use Cases](#13-use-cases)
14. [Commercialization Requirements](#14-commercialization-requirements)
15. [Constraints & Assumptions](#15-constraints--assumptions)
16. [Future Enhancements](#16-future-enhancements)
17. [Glossary](#17-glossary)

---

## 1. Introduction

### 1.1 Purpose
This document defines the complete, verified software requirements for LottoMeter v2.0. All business logic has been reviewed and confirmed with the product owner before implementation begins.

### 1.2 Scope
LottoMeter v2.0 is a shift management system for grocery and retail stores that sell lottery tickets. It replaces manual paperwork with a mobile barcode-based workflow for tracking ticket book sales across shifts.

### 1.3 References
- LottoMeter v1: https://github.com/AbdelrahmanYousef9266/LottoMeter
- LottoMeter v2: https://github.com/AbdelrahmanYousef9266/LottoMeter-v2

---

## 2. Overall Description

### 2.1 System Architecture

```
┌─────────────────────┐        HTTPS / REST        ┌──────────────────────┐
│   React Native App  │ ◄─────────────────────────► │   Flask REST API     │
│   (iOS / Android)   │       JSON Responses         │   + SQLAlchemy ORM   │
└─────────────────────┘                              └──────────┬───────────┘
                                                                │
                                                     ┌──────────▼───────────┐
                                                     │   PostgreSQL / SQLite │
                                                     └──────────────────────┘
```

### 2.2 Operating Environment

| Component | Environment |
|---|---|
| Backend | Python 3.11+, Flask 3.x, SQLAlchemy 2.x |
| Database | PostgreSQL (prod), SQLite (dev) |
| Mobile | React Native (Expo), iOS 14+, Android 10+ |
| Auth | JWT |
| i18n | i18next + react-i18next |
| Deploy | Docker + GitHub Actions |

---

## 3. Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| Mobile | React Native (Expo) | Cross-platform iOS & Android |
| API | Flask | Lightweight Python REST framework |
| ORM | SQLAlchemy | Mirrors EF Core from v1 |
| DB Dev | SQLite | Zero-config |
| DB Prod | PostgreSQL | Production-grade |
| Auth | JWT (Flask-JWT-Extended) | Stateless, mobile-friendly |
| Serialization | Marshmallow | Validation + JSON |
| i18n | i18next | Multilingual + RTL |
| Testing API | pytest + pytest-flask | Unit + integration |
| Testing Mobile | Jest | Components |
| Deploy | Docker + GitHub Actions | CI/CD |

---

## 4. User Roles

### 4.1 Admin
- Creates and manages slots (with ticket price)
- Creates and assigns books to slots
- Manages users
- Views all shift reports

### 4.2 Employee
- Opens shifts (triggers auto-creation of Sub-shift 1)
- Scans books at open and close of each sub-shift
- Scans last ticket barcodes during shift
- Manually enters cash in hand, gross sales, cash out at closing
- Views shift reports and validation status

---

## 5. Business Logic & Workflows

This section documents the verified real-world workflows that drive all implementation decisions.

### 5.1 Admin Setup (One Time)

1. Admin creates slots, each with a name and default ticket price
2. Admin creates books with barcode, start number, end number, static code
3. Admin assigns books to slots — this activates the book (`is_active = True`)
4. Book inherits ticket price from slot automatically, admin can override
5. Book total = (end - start) × ticket_price — stored permanently for reports
6. Books are now ready for scanning in shifts

### 5.2 Slot & Book Price Logic

- `Slot.ticket_price` = default price for all books in that slot
- `Book.ticket_price` = copied from slot at assignment, can be overridden per book
- Price is stored on the book permanently so historical reports remain accurate even if slot price changes later

### 5.3 Opening a Shift

1. Employee opens a new main shift
2. System **automatically creates Sub-shift 1** — employees never interact with main shift directly
3. Employee scans all books currently in their slots using `scan_type = open`
4. System records each book's current position as `start_at_scan`
5. No cash input at open — scanning only

### 5.4 During Shift — Last Ticket Detection

When the last ticket in a book is sold, the employee scans that ticket's barcode.

Last ticket barcodes always end in one of these fixed suffixes:
```
029, 149, 059, 099
```

These suffixes are fixed and cannot be configured by the admin.

When detected:
- `ShiftBooks.is_last_ticket = True`
- `Book.is_sold = True`
- Book is fully counted as sold in the sub-shift totals

### 5.5 Mid-Shift — Sub-shift Handover

1. New employee takes over mid-shift
2. Current employee closes their sub-shift (scan close + manual inputs)
3. System creates next sub-shift automatically
4. New employee begins scanning on the new sub-shift

### 5.6 Closing a Sub-shift

Employee scans all books **still remaining** in slots using `scan_type = close`.
Books marked as `is_sold = True` are skipped — they no longer exist in the slot.

Employee manually enters:
- `cash_in_hand` — physical cash at closing
- `gross_sales` — from the register
- `cash_out` — manually entered

System calculates automatically:
- `tickets_total` — sum of all sold book values for this sub-shift
- `expected_cash` = gross_sales + tickets_total - cash_out
- `difference` = cash_in_hand - expected_cash
- `shift_status`:
  - `correct` → difference = 0
  - `over` → difference > 0 (employee has more cash than expected)
  - `short` → difference < 0 (employee has less cash than expected)

### 5.7 Tickets Sold Calculation Per Book

For books NOT marked as fully sold:
```
tickets_sold = start_at_close - start_at_open
value        = tickets_sold × book.ticket_price
```

For books marked as fully sold (last ticket scanned):
```
tickets_sold = book.end - book.start
value        = tickets_sold × book.ticket_price
```

### 5.8 Ticket Price Breakdown

Calculated at every closing — both sub-shifts and main shift:

Groups all sold books by ticket price:
```
$3  tickets → X sold → $XXX
$5  tickets → X sold → $XXX
$10 tickets → X sold → $XXX
```

### 5.9 Closing the Main Shift

1. Last employee closes the final sub-shift
2. System automatically closes the main shift
3. Main shift totals = sum of all sub-shifts
4. Main shift report shows:
   - Combined totals
   - Combined ticket price breakdown
   - Each sub-shift details separately with their own breakdown and validation status

### 5.10 Post-Shift — Admin Refill

After shift closes, admin manually assigns new books to empty slots when needed.
Empty slots remain empty until admin refills them.
A main shift always has at least one sub-shift — scanning and closing never happens directly on the main shift.

---

## 6. Functional Requirements

### 6.1 Store Module

| ID | Requirement | Priority |
|---|---|---|
| FR-STORE-01 | Store is the root tenant — all data scoped by store_id | High |
| FR-STORE-02 | First-run setup creates store and first user | High |
| FR-STORE-03 | All API queries scoped to authenticated user's store_id | High |

### 6.2 Authentication

| ID | Requirement | Priority |
|---|---|---|
| FR-AUTH-01 | Login with username and password returns JWT | High |
| FR-AUTH-02 | JWT contains user_id, role, store_id | High |
| FR-AUTH-03 | All endpoints except login/setup require JWT | High |
| FR-AUTH-04 | Logout supported | High |

### 6.3 Slot Management

| ID | Requirement | Priority |
|---|---|---|
| FR-SLOT-01 | Admin creates slots with name and ticket_price | High |
| FR-SLOT-02 | List, get, update, delete slots | High |
| FR-SLOT-03 | Slot names unique within store | High |
| FR-SLOT-04 | Cannot delete slot with active books | Medium |

### 6.4 Book Management

| ID | Requirement | Priority |
|---|---|---|
| FR-BOOK-01 | Admin creates books with barcode, start, end, static_code, slot_id | High |
| FR-BOOK-02 | Book inherits ticket_price from slot, admin can override | High |
| FR-BOOK-03 | Book total = (end - start) × ticket_price, stored permanently | High |
| FR-BOOK-04 | Assigning book to slot sets is_active = True | High |
| FR-BOOK-05 | Book barcodes unique within store | High |
| FR-BOOK-06 | List, get, update, delete books | High |
| FR-BOOK-07 | Filter books by slot | Medium |

### 6.5 Shift Management

| ID | Requirement | Priority |
|---|---|---|
| FR-SHIFT-01 | Opening main shift auto-creates Sub-shift 1 | High |
| FR-SHIFT-02 | Only one main shift open at a time per store | High |
| FR-SHIFT-03 | Main shift always has at least one sub-shift | High |
| FR-SHIFT-04 | Employees only interact with sub-shifts, not main shift directly | High |
| FR-SHIFT-05 | Closing a sub-shift mid-shift auto-creates next sub-shift | High |
| FR-SHIFT-06 | Closing final sub-shift closes main shift automatically | High |
| FR-SHIFT-07 | Main shift totals = sum of all sub-shifts | High |

### 6.6 Sub-shift Closing

| ID | Requirement | Priority |
|---|---|---|
| FR-CLOSE-01 | Employee scans remaining books at close with scan_type = close | High |
| FR-CLOSE-02 | Employee manually enters cash_in_hand, gross_sales, cash_out | High |
| FR-CLOSE-03 | System calculates tickets_total from sold books | High |
| FR-CLOSE-04 | System calculates expected_cash = gross_sales + tickets_total - cash_out | High |
| FR-CLOSE-05 | System calculates difference = cash_in_hand - expected_cash | High |
| FR-CLOSE-06 | System sets shift_status to correct, over, or short | High |
| FR-CLOSE-07 | System generates ticket price breakdown per sub-shift | High |
| FR-CLOSE-08 | Main shift report shows combined breakdown + each sub-shift separately | High |

### 6.7 Barcode Scanning

| ID | Requirement | Priority |
|---|---|---|
| FR-SCAN-01 | Accept barcode with shift_id and scan_type (open/close) | High |
| FR-SCAN-02 | Extract static code from barcode to match book | High |
| FR-SCAN-03 | Match static code to book scoped to store_id | High |
| FR-SCAN-04 | Record start_at_scan position on scan | High |
| FR-SCAN-05 | Detect last ticket by suffix: 029, 149, 059, 099 (fixed, non-configurable) | High |
| FR-SCAN-06 | On last ticket: set is_last_ticket = True, book.is_sold = True | High |
| FR-SCAN-07 | Reject unmatched barcodes with 404 | High |
| FR-SCAN-08 | Reject duplicate scans in same shift with 409 | High |

---

## 7. UI & UX Requirements

### 7.1 Navigation
- Bottom tab: Home, Scan, Books, History, Settings
- Splash screen on launch
- Onboarding for first-time users
- Empty states on all screens

### 7.2 Shift Screen
- Active shift indicator (green badge)
- Live running totals updating as books scanned
- Scrollable list of scanned books
- Shift timer
- Quick close button

### 7.3 Scan Screen
- Camera barcode scanner (Expo Camera)
- Manual text input fallback
- Success sound + green flash on success
- Error sound + red flash on failure
- Last scanned book card
- Scan counter

### 7.4 Books Screen
- Search by name or barcode
- Filter by slot
- Scanned/unscanned badge per book
- Pull to refresh

### 7.5 History Screen
- Shift cards with date, totals, status badge (correct/over/short)
- Filter by date range
- Tap shift → full report with sub-shift breakdown

### 7.6 Settings Screen
- Language selector
- Light/dark mode toggle
- Store name and code display
- Logout button
- App version

### 7.7 General UI
- Skeleton loaders
- Toast notifications
- Confirmation dialogs before closing shift or deleting
- Offline banner
- Keyboard avoiding view on all forms

---

## 8. Multilingual & Accessibility Requirements

### 8.1 Languages

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

### 8.2 RTL
- RTL enabled from v2.0 via React Native RTL API
- All screens flip layout for RTL languages
- Icons, navigation, text alignment all respect layout direction

### 8.3 Accessibility
- Touch targets minimum 44×44 points
- High contrast mode for bright store environments
- Screen reader labels on all interactive elements

---

## 9. Non-Functional Requirements

### Performance
- API response under 500ms
- Barcode matching under 200ms
- App home screen loads under 2 seconds
- Language switching instant, no restart required

### Security
- Passwords hashed with bcrypt
- JWT expires after 8 hours
- HTTPS in production
- All queries scoped to store_id
- Role enforcement at service layer

### Reliability
- DB transactions prevent partial writes
- Meaningful error messages for all failures

### Scalability
- store_id on all tables enables multi-tenancy
- Stateless API, horizontally scalable

### Maintainability
- Blueprint-based Flask structure
- Business logic in service layer only
- Docstrings on all functions and routes
- Flask-Migrate for schema migrations

### Testability
- 80%+ route coverage with pytest
- All service functions unit tested
- Thunder Client collection for all endpoints

---

## 10. System Architecture Overview

### Flask API Structure
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
│   ├── services/
│   │   ├── auth_service.py
│   │   ├── store_service.py
│   │   ├── slot_service.py
│   │   ├── book_service.py
│   │   ├── shift_service.py
│   │   └── scan_service.py
│   └── routes/
├── migrations/
├── tests/
├── .env.example
├── requirements.txt
├── Dockerfile
└── docker-compose.yml
```

### React Native Structure
```
lottometer-mobile/
├── src/
│   ├── api/
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
│   │   ├── SkeletonLoader.js
│   │   ├── ToastNotification.js
│   │   ├── ConfirmDialog.js
│   │   └── OfflineBanner.js
│   ├── context/
│   ├── navigation/
│   ├── locales/
│   │   ├── en.json
│   │   ├── ar.json
│   │   └── ...
│   └── utils/
│       ├── storage.js
│       └── rtl.js
├── App.js
└── package.json
```

---

## 11. Database Design

### Store
| Column | Type | Constraints |
|---|---|---|
| store_id | Integer | PK |
| store_name | String(150) | Not Null |
| store_code | String(50) | Unique |
| created_at | DateTime | Default: now() |

### User
| Column | Type | Constraints |
|---|---|---|
| user_id | Integer | PK |
| username | String(100) | Not Null |
| password_hash | String(256) | Not Null |
| role | String(50) | Default: employee |
| store_id | Integer | FK → Store |
| created_at | DateTime | Default: now() |

### Slot
| Column | Type | Constraints |
|---|---|---|
| slot_id | Integer | PK |
| slot_name | String(100) | Not Null |
| ticket_price | Decimal(10,2) | Not Null |
| store_id | Integer | FK → Store |

### Book
| Column | Type | Constraints |
|---|---|---|
| book_id | Integer | PK |
| book_name | String(150) | Not Null |
| barcode | String(100) | Unique within store |
| start | Integer | Not Null |
| end | Integer | Not Null |
| ticket_price | Decimal(10,2) | Copied from slot, overridable |
| total | Decimal(10,2) | (end-start) × ticket_price |
| static_code | String(100) | Not Null, Indexed |
| slot_id | Integer | FK → Slot |
| store_id | Integer | FK → Store |
| is_active | Boolean | Default: False |
| is_sold | Boolean | Default: False |

### ShiftDetails
| Column | Type | Constraints |
|---|---|---|
| shift_id | Integer | PK |
| shift_start_time | DateTime | Not Null |
| shift_end_time | DateTime | Nullable |
| cash_in_hand | Decimal(10,2) | Entered at close (sub-shifts only) |
| gross_sales | Decimal(10,2) | Entered at close (sub-shifts only) |
| cash_out | Decimal(10,2) | Entered at close (sub-shifts only) |
| tickets_total | Decimal(10,2) | Auto calculated |
| expected_cash | Decimal(10,2) | gross_sales + tickets_total - cash_out |
| difference | Decimal(10,2) | cash_in_hand - expected_cash |
| shift_status | String(20) | correct / over / short |
| is_shift_open | Boolean | Default: True |
| main_shift_id | Integer | FK → self, Nullable (null = main shift) |
| shift_number | Integer | Default: 1 |
| store_id | Integer | FK → Store |

### ShiftBooks
| Column | Type | Constraints |
|---|---|---|
| shift_id | Integer | PK composite |
| barcode | String(100) | PK composite |
| scan_type | String(10) | open or close |
| start_at_scan | Integer | Book position at scan time |
| is_last_ticket | Boolean | Default: False |
| slot_id | Integer | FK → Slot |
| store_id | Integer | FK → Store |

---

## 12. API Endpoints Overview

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| POST | /api/auth/setup | First-run store + user | No |
| POST | /api/auth/login | Login → JWT | No |
| POST | /api/auth/logout | Logout | Yes |
| GET/POST | /api/slots | List / Create slots | Yes |
| GET/PUT/DELETE | /api/slots/{id} | Get / Update / Delete slot | Yes |
| GET/POST | /api/books | List / Create books | Yes |
| GET/PUT/DELETE | /api/books/{id} | Get / Update / Delete book | Yes |
| POST | /api/shifts | Open main shift + auto Sub-shift 1 | Yes |
| GET | /api/shifts | List all main shifts | Yes |
| GET | /api/shifts/{id} | Get shift with sub-shifts | Yes |
| POST | /api/shifts/{id}/subshifts | Close current sub-shift + open next | Yes |
| PUT | /api/shifts/{id}/close | Close final sub-shift + main shift | Yes |
| POST | /api/scan | Submit barcode scan | Yes |
| GET | /api/reports/shift/{id} | Full shift report | Yes |

---

## 13. Use Cases

### UC-01: Admin Setup
Admin creates slots with ticket prices, creates books, assigns books to slots.

### UC-02: Open Shift
Employee opens main shift → system auto-creates Sub-shift 1 → employee scans all books at open.

### UC-03: Scan During Shift
Employee scans last ticket barcode → system detects suffix (029/149/059/099) → marks book as sold.

### UC-04: Sub-shift Handover
Employee closes current sub-shift (scan close + manual inputs) → system creates next sub-shift → new employee continues.

### UC-05: Close Final Sub-shift
Employee scans remaining books → enters cash_in_hand, gross_sales, cash_out → system calculates totals, expected cash, difference, and status → main shift closes automatically.

### UC-06: View Report
Employee/Admin views main shift report with combined totals, ticket price breakdown, and each sub-shift breakdown with validation status.

### UC-07: Switch Language
Employee goes to Settings → selects language → app instantly switches with RTL support.

---

## 14. Commercialization Requirements

| Area | Requirement | Version |
|---|---|---|
| Multi-tenancy | store_id on all tables | v2.0 ✅ |
| Multi-tenancy | Store self-registration | v2.1 |
| RBAC | role column on User | v2.0 ✅ |
| RBAC | Admin role enforcement | v2.1 |
| Billing | Stripe + Plan + Subscription models | v2.1 |
| Analytics | Analytics API + web dashboard | v2.1 |
| UI | Font size, print layout, thermal printer | v2.1 |
| Languages | Hindi, Spanish, French, Urdu | v2.1 |
| Languages | Bengali, Portuguese, Punjabi, Tamil | v2.2 |
| Infrastructure | Sentry, uptime monitoring | v2.1 |

---

## 15. Constraints & Assumptions

- One store active per deployment in v2.0
- One main shift open at a time per store
- Every main shift has at least one sub-shift
- Last ticket suffixes (029, 149, 059, 099) are fixed and non-configurable
- Internet required for mobile app
- Employees have iOS 14+ or Android 10+ devices

---

## 16. Future Enhancements

| Feature | Version |
|---|---|
| Admin role enforcement | v2.1 |
| Store self-registration | v2.1 |
| Stripe billing | v2.1 |
| Analytics dashboard (web) | v2.1 |
| PDF shift report export | v2.1 |
| Excel/CSV export | v2.1 |
| Font size preference | v2.1 |
| Print layout customization | v2.1 |
| Bluetooth thermal printer | v2.1 |
| Hindi, Spanish, French, Urdu | v2.1 |
| Push notifications | v2.2 |
| Bengali, Portuguese, Punjabi, Tamil | v2.2 |
| Multi-store platform | v3.0 |
| POS integration | v3.0 |
| Offline mode with sync | v3.0 |

---

## 17. Glossary

| Term | Definition |
|---|---|
| Store | Root tenant entity representing a retail store |
| Slot | Physical location holding lottery books, has a default ticket price |
| Book | A lottery ticket book with start/end numbers and barcode |
| is_active | True when a book is assigned to a slot |
| is_sold | True when the last ticket barcode has been scanned |
| Static Code | Unique code extracted from barcode used to match book records |
| Main Shift | Container shift — totals are sum of all sub-shifts, no direct scans |
| Sub-shift | A work period within a main shift — has its own scans, inputs, and totals |
| scan_type | open (scanned at shift start) or close (scanned at shift end) |
| start_at_scan | The book's ticket position at the time it was scanned |
| is_last_ticket | True when barcode ends in 029, 149, 059, or 099 |
| tickets_total | Auto-calculated sum of all sold book values in a sub-shift |
| expected_cash | gross_sales + tickets_total - cash_out |
| difference | cash_in_hand - expected_cash |
| shift_status | correct (diff=0), over (diff>0), short (diff<0) |
| ticket_breakdown | Grouped count of tickets sold per price point |
| RTL | Right-to-Left layout for Arabic and Urdu |
| i18n | Internationalization — multilingual support |
| store_id | Foreign key scoping all data to a specific store |
| RBAC | Role-Based Access Control |

---

*Document end — LottoMeter v2.0 SRS v4.0 — Verified & Final*
