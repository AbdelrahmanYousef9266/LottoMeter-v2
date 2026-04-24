# API Contract — LottoMeter v2.0

All requests and responses use `Content-Type: application/json`.
All protected endpoints require: `Authorization: Bearer <token>`
Base URL: `http://localhost:5000/api` (development)

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Slots](#2-slots)
3. [Books](#3-books)
4. [Shifts](#4-shifts)
5. [Scan](#5-scan)
6. [Reports](#6-reports)
7. [Error Responses](#7-error-responses)

---

## 1. Authentication

### POST /api/auth/setup
First-run only. Creates the initial store and user.

**Request**
```json
{
  "store_name": "My Lottery Store",
  "store_code": "MLS001",
  "username": "employee1",
  "password": "securepassword123"
}
```

**Response `201 Created`**
```json
{
  "message": "Store and user created successfully.",
  "store": {
    "store_id": 1,
    "store_name": "My Lottery Store",
    "store_code": "MLS001"
  },
  "user": {
    "user_id": 1,
    "username": "employee1",
    "role": "employee"
  }
}
```

---

### POST /api/auth/login

**Request**
```json
{
  "username": "employee1",
  "password": "securepassword123"
}
```

**Response `200 OK`**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "user_id": 1,
    "username": "employee1",
    "role": "employee",
    "store_id": 1
  }
}
```

---

### POST /api/auth/logout

**Response `200 OK`**
```json
{
  "message": "Logged out successfully."
}
```

---

## 2. Slots

### GET /api/slots
**Response `200 OK`**
```json
{
  "slots": [
    {
      "slot_id": 1,
      "slot_name": "Slot A",
      "ticket_price": 5.00,
      "book_count": 3
    }
  ]
}
```

---

### POST /api/slots
**Request**
```json
{
  "slot_name": "Slot A",
  "ticket_price": 5.00
}
```

**Response `201 Created`**
```json
{
  "message": "Slot created successfully.",
  "slot": {
    "slot_id": 1,
    "slot_name": "Slot A",
    "ticket_price": 5.00,
    "book_count": 0
  }
}
```

---

### GET /api/slots/{slot_id}
**Response `200 OK`**
```json
{
  "slot": {
    "slot_id": 1,
    "slot_name": "Slot A",
    "ticket_price": 5.00,
    "books": [
      {
        "book_id": 1,
        "book_name": "Book 001",
        "barcode": "123456789012",
        "start": 1000,
        "end": 1300,
        "ticket_price": 5.00,
        "total": 1500.00,
        "is_active": true,
        "is_sold": false
      }
    ]
  }
}
```

---

### PUT /api/slots/{slot_id}
**Request**
```json
{
  "slot_name": "Slot A Updated",
  "ticket_price": 10.00
}
```

**Response `200 OK`**
```json
{
  "message": "Slot updated successfully.",
  "slot": {
    "slot_id": 1,
    "slot_name": "Slot A Updated",
    "ticket_price": 10.00
  }
}
```

---

### DELETE /api/slots/{slot_id}
**Response `200 OK`**
```json
{
  "message": "Slot deleted successfully."
}
```

---

## 3. Books

### GET /api/books
Query params: `?slot_id=1`

**Response `200 OK`**
```json
{
  "books": [
    {
      "book_id": 1,
      "book_name": "Book 001",
      "barcode": "123456789012",
      "start": 1000,
      "end": 1300,
      "ticket_price": 5.00,
      "total": 1500.00,
      "static_code": "ABC123",
      "slot_id": 1,
      "slot_name": "Slot A",
      "is_active": true,
      "is_sold": false
    }
  ]
}
```

---

### POST /api/books
Creates a book and assigns it to a slot. `ticket_price` is automatically copied from the slot but can be overridden.

**Request**
```json
{
  "book_name": "Book 001",
  "barcode": "123456789012",
  "start": 1000,
  "end": 1300,
  "static_code": "ABC123",
  "slot_id": 1,
  "ticket_price": 5.00
}
```

**Response `201 Created`**
```json
{
  "message": "Book created successfully.",
  "book": {
    "book_id": 1,
    "book_name": "Book 001",
    "barcode": "123456789012",
    "start": 1000,
    "end": 1300,
    "ticket_price": 5.00,
    "total": 1500.00,
    "static_code": "ABC123",
    "slot_id": 1,
    "slot_name": "Slot A",
    "is_active": true,
    "is_sold": false
  }
}
```

---

### GET /api/books/{book_id}
**Response `200 OK`**
```json
{
  "book": {
    "book_id": 1,
    "book_name": "Book 001",
    "barcode": "123456789012",
    "start": 1000,
    "end": 1300,
    "ticket_price": 5.00,
    "total": 1500.00,
    "static_code": "ABC123",
    "slot_id": 1,
    "slot_name": "Slot A",
    "is_active": true,
    "is_sold": false
  }
}
```

---

### PUT /api/books/{book_id}
**Request**
```json
{
  "book_name": "Book 001 Updated",
  "start": 1000,
  "end": 1300,
  "ticket_price": 10.00,
  "slot_id": 2
}
```

---

### DELETE /api/books/{book_id}
**Response `200 OK`**
```json
{
  "message": "Book deleted successfully."
}
```

---

## 4. Shifts

### POST /api/shifts
Opens a new main shift and automatically creates Sub-shift 1.

**Request**
```json
{}
```

**Response `201 Created`**
```json
{
  "message": "Main shift opened and Sub-shift 1 created automatically.",
  "main_shift": {
    "shift_id": 1,
    "shift_start_time": "2026-04-23T08:00:00",
    "is_shift_open": true,
    "main_shift_id": null,
    "shift_number": 1
  },
  "current_subshift": {
    "shift_id": 2,
    "shift_start_time": "2026-04-23T08:00:00",
    "is_shift_open": true,
    "main_shift_id": 1,
    "shift_number": 1
  }
}
```

---

### GET /api/shifts
**Response `200 OK`**
```json
{
  "shifts": [
    {
      "shift_id": 1,
      "shift_start_time": "2026-04-23T08:00:00",
      "shift_end_time": "2026-04-23T16:00:00",
      "is_shift_open": false,
      "shift_number": 1,
      "main_shift_id": null,
      "subshift_count": 2,
      "tickets_total": 2500.00,
      "difference": -36.00,
      "shift_status": "short"
    }
  ]
}
```

---

### GET /api/shifts/{shift_id}
Returns main shift with all sub-shift details and ticket price breakdown.

**Response `200 OK`**
```json
{
  "shift": {
    "shift_id": 1,
    "shift_start_time": "2026-04-23T08:00:00",
    "shift_end_time": "2026-04-23T16:00:00",
    "is_shift_open": false,
    "main_shift_id": null,
    "tickets_total": 2500.00,
    "gross_sales": 1200.00,
    "cash_in_hand": 3500.00,
    "cash_out": 300.00,
    "expected_cash": 3400.00,
    "difference": 100.00,
    "shift_status": "over",
    "ticket_breakdown": [
      { "price": 3.00, "tickets_sold": 142, "total_value": 426.00 },
      { "price": 5.00, "tickets_sold": 100, "total_value": 500.00 },
      { "price": 10.00, "tickets_sold": 45,  "total_value": 450.00 }
    ],
    "sub_shifts": [
      {
        "shift_id": 2,
        "shift_number": 1,
        "shift_start_time": "2026-04-23T08:00:00",
        "shift_end_time": "2026-04-23T12:00:00",
        "cash_in_hand": 1800.00,
        "gross_sales": 600.00,
        "cash_out": 150.00,
        "tickets_total": 1250.00,
        "expected_cash": 1700.00,
        "difference": 100.00,
        "shift_status": "over",
        "ticket_breakdown": [
          { "price": 5.00,  "tickets_sold": 50, "total_value": 250.00 },
          { "price": 10.00, "tickets_sold": 20, "total_value": 200.00 }
        ],
        "scanned_books": [
          {
            "barcode": "123456789012",
            "book_name": "Book 001",
            "slot_name": "Slot A",
            "ticket_price": 5.00,
            "start_at_open": 1000,
            "start_at_close": 1050,
            "tickets_sold": 50,
            "total_value": 250.00,
            "is_sold": false
          }
        ]
      }
    ]
  }
}
```

---

### POST /api/shifts/{shift_id}/subshifts
Closes the current sub-shift and opens the next one.

**Request**
```json
{
  "cash_in_hand": 1800.00,
  "gross_sales": 600.00,
  "cash_out": 150.00
}
```

**Response `201 Created`**
```json
{
  "message": "Sub-shift 1 closed and Sub-shift 2 created.",
  "closed_subshift": {
    "shift_id": 2,
    "shift_number": 1,
    "tickets_total": 1250.00,
    "expected_cash": 1700.00,
    "difference": 100.00,
    "shift_status": "over"
  },
  "new_subshift": {
    "shift_id": 3,
    "shift_number": 2,
    "shift_start_time": "2026-04-23T12:00:00",
    "is_shift_open": true,
    "main_shift_id": 1
  }
}
```

---

### PUT /api/shifts/{shift_id}/close
Closes the final sub-shift and the main shift.

**Request**
```json
{
  "cash_in_hand": 1700.00,
  "gross_sales": 600.00,
  "cash_out": 150.00
}
```

**Response `200 OK`**
```json
{
  "message": "Final sub-shift and main shift closed successfully.",
  "closed_subshift": {
    "shift_id": 3,
    "shift_number": 2,
    "tickets_total": 1250.00,
    "expected_cash": 1700.00,
    "difference": 0.00,
    "shift_status": "correct"
  },
  "main_shift": {
    "shift_id": 1,
    "shift_end_time": "2026-04-23T16:00:00",
    "tickets_total": 2500.00,
    "gross_sales": 1200.00,
    "cash_in_hand": 3500.00,
    "cash_out": 300.00,
    "expected_cash": 3400.00,
    "difference": 100.00,
    "shift_status": "over",
    "ticket_breakdown": [
      { "price": 5.00,  "tickets_sold": 100, "total_value": 500.00 },
      { "price": 10.00, "tickets_sold": 45,  "total_value": 450.00 }
    ]
  }
}
```

---

## 5. Scan

### POST /api/scan
Submit a barcode scan during an active sub-shift.

**Request**
```json
{
  "barcode": "123456789012",
  "shift_id": 2,
  "scan_type": "open"
}
```

**Response `201 Created` — Regular scan**
```json
{
  "message": "Book scanned successfully.",
  "is_last_ticket": false,
  "scanned_book": {
    "barcode": "123456789012",
    "book_name": "Book 001",
    "slot_name": "Slot A",
    "ticket_price": 5.00,
    "start_at_scan": 1000,
    "scan_type": "open",
    "shift_id": 2
  }
}
```

**Response `201 Created` — Last ticket detected**
```json
{
  "message": "Last ticket scanned. Book marked as sold.",
  "is_last_ticket": true,
  "scanned_book": {
    "barcode": "123456789029",
    "book_name": "Book 001",
    "slot_name": "Slot A",
    "ticket_price": 5.00,
    "total_value": 1500.00,
    "is_sold": true,
    "shift_id": 2
  }
}
```

**Response `404 Not Found`**
```json
{
  "error": "No book found matching this barcode."
}
```

**Response `409 Conflict`**
```json
{
  "error": "This book has already been scanned in this shift."
}
```

---

## 6. Reports

### GET /api/reports/shift/{shift_id}
Returns full report for a main shift including all sub-shifts, ticket breakdown, and validation status.

**Response `200 OK`**
```json
{
  "report": {
    "shift_id": 1,
    "date": "2026-04-23",
    "shift_start_time": "2026-04-23T08:00:00",
    "shift_end_time": "2026-04-23T16:00:00",
    "tickets_total": 2500.00,
    "gross_sales": 1200.00,
    "cash_in_hand": 3500.00,
    "cash_out": 300.00,
    "expected_cash": 3400.00,
    "difference": 100.00,
    "shift_status": "over",
    "ticket_breakdown": [
      { "price": 3.00,  "tickets_sold": 142, "total_value": 426.00 },
      { "price": 5.00,  "tickets_sold": 100, "total_value": 500.00 },
      { "price": 10.00, "tickets_sold": 45,  "total_value": 450.00 }
    ],
    "sub_shifts": [
      {
        "shift_id": 2,
        "shift_number": 1,
        "shift_start_time": "2026-04-23T08:00:00",
        "shift_end_time": "2026-04-23T12:00:00",
        "cash_in_hand": 1800.00,
        "gross_sales": 600.00,
        "cash_out": 150.00,
        "tickets_total": 1250.00,
        "expected_cash": 1700.00,
        "difference": 100.00,
        "shift_status": "over",
        "ticket_breakdown": [
          { "price": 5.00,  "tickets_sold": 50, "total_value": 250.00 },
          { "price": 10.00, "tickets_sold": 20, "total_value": 200.00 }
        ],
        "books": [
          {
            "book_name": "Book 001",
            "slot_name": "Slot A",
            "barcode": "123456789012",
            "start": 1000,
            "end": 1300,
            "ticket_price": 5.00,
            "start_at_open": 1000,
            "start_at_close": 1050,
            "tickets_sold": 50,
            "total_value": 250.00,
            "is_sold": false
          }
        ]
      }
    ]
  }
}
```

---

## 7. Error Responses

All errors follow this format:
```json
{
  "error": "Human-readable error message."
}
```

### HTTP Status Codes

| Code | Meaning |
|---|---|
| 200 | OK |
| 201 | Created |
| 400 | Bad Request — invalid input or business rule violation |
| 401 | Unauthorized — missing or invalid JWT |
| 404 | Not Found |
| 409 | Conflict — duplicate or state conflict |
| 422 | Validation error |
| 500 | Internal Server Error |

### Validation Error Format
```json
{
  "error": "Validation failed.",
  "details": {
    "cash_in_hand": ["This field is required."],
    "gross_sales": ["Must be a positive number."]
  }
}
```

---

*Phase 3 — System Design | LottoMeter v2.0*
