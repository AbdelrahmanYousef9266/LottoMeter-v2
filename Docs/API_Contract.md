# API Contract — LottoMeter v2.0

All requests and responses use `Content-Type: application/json`.  
All protected endpoints require the header: `Authorization: Bearer <token>`  
Base URL: `http://localhost:5000/api` (development)

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Slots](#2-slots)
3. [Books](#3-books)
4. [Shifts](#4-shifts)
5. [Scan](#5-scan)
6. [Error Responses](#6-error-responses)

---

## 1. Authentication

### POST /api/auth/setup
First-run only. Creates the initial user account.

**Request**
```json
{
  "username": "abodh",
  "password": "securepassword123"
}
```

**Response `201 Created`**
```json
{
  "message": "User created successfully",
  "user": {
    "user_id": 1,
    "username": "abodh"
  }
}
```

**Response `409 Conflict`** — user already exists
```json
{
  "error": "Setup already completed. A user account already exists."
}
```

---

### POST /api/auth/login
Authenticate and receive a JWT token.

**Request**
```json
{
  "username": "abodh",
  "password": "securepassword123"
}
```

**Response `200 OK`**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "user_id": 1,
    "username": "abodh"
  }
}
```

**Response `401 Unauthorized`**
```json
{
  "error": "Invalid username or password."
}
```

---

### POST /api/auth/logout
Logout the current user (client discards token).

**Headers:** `Authorization: Bearer <token>`

**Response `200 OK`**
```json
{
  "message": "Logged out successfully."
}
```

---

## 2. Slots

### GET /api/slots
Get all slots.

**Headers:** `Authorization: Bearer <token>`

**Response `200 OK`**
```json
{
  "slots": [
    {
      "slot_id": 1,
      "slot_name": "Slot A",
      "book_count": 5
    },
    {
      "slot_id": 2,
      "slot_name": "Slot B",
      "book_count": 3
    }
  ]
}
```

---

### POST /api/slots
Create a new slot.

**Headers:** `Authorization: Bearer <token>`

**Request**
```json
{
  "slot_name": "Slot C"
}
```

**Response `201 Created`**
```json
{
  "message": "Slot created successfully.",
  "slot": {
    "slot_id": 3,
    "slot_name": "Slot C",
    "book_count": 0
  }
}
```

**Response `409 Conflict`** — slot name already exists
```json
{
  "error": "A slot with this name already exists."
}
```

---

### GET /api/slots/{slot_id}
Get a single slot by ID.

**Headers:** `Authorization: Bearer <token>`

**Response `200 OK`**
```json
{
  "slot": {
    "slot_id": 1,
    "slot_name": "Slot A",
    "book_count": 5,
    "books": [
      {
        "book_id": 1,
        "book_name": "Book 001",
        "barcode": "123456789012",
        "is_scanned": false
      }
    ]
  }
}
```

**Response `404 Not Found`**
```json
{
  "error": "Slot not found."
}
```

---

### PUT /api/slots/{slot_id}
Update a slot name.

**Headers:** `Authorization: Bearer <token>`

**Request**
```json
{
  "slot_name": "Slot A Updated"
}
```

**Response `200 OK`**
```json
{
  "message": "Slot updated successfully.",
  "slot": {
    "slot_id": 1,
    "slot_name": "Slot A Updated",
    "book_count": 5
  }
}
```

---

### DELETE /api/slots/{slot_id}
Delete a slot. Only allowed if no books are assigned to it.

**Headers:** `Authorization: Bearer <token>`

**Response `200 OK`**
```json
{
  "message": "Slot deleted successfully."
}
```

**Response `400 Bad Request`** — slot has books assigned
```json
{
  "error": "Cannot delete slot. It has books assigned to it."
}
```

---

## 3. Books

### GET /api/books
Get all books. Optionally filter by slot.

**Headers:** `Authorization: Bearer <token>`

**Query Params (optional):** `?slot_id=1`

**Response `200 OK`**
```json
{
  "books": [
    {
      "book_id": 1,
      "book_name": "Book 001",
      "barcode": "123456789012",
      "amount": 5.00,
      "start": 1000,
      "end": 1299,
      "total": 1500.00,
      "static_code": "ABC123",
      "slot_id": 1,
      "slot_name": "Slot A",
      "is_scanned": false
    }
  ]
}
```

---

### POST /api/books
Create a new book.

**Headers:** `Authorization: Bearer <token>`

**Request**
```json
{
  "book_name": "Book 002",
  "barcode": "987654321098",
  "amount": 5.00,
  "start": 1300,
  "end": 1599,
  "static_code": "DEF456",
  "slot_id": 1
}
```

**Response `201 Created`**
```json
{
  "message": "Book created successfully.",
  "book": {
    "book_id": 2,
    "book_name": "Book 002",
    "barcode": "987654321098",
    "amount": 5.00,
    "start": 1300,
    "end": 1599,
    "total": 1500.00,
    "static_code": "DEF456",
    "slot_id": 1,
    "slot_name": "Slot A",
    "is_scanned": false
  }
}
```

**Response `409 Conflict`** — barcode already exists
```json
{
  "error": "A book with this barcode already exists."
}
```

---

### GET /api/books/{book_id}
Get a single book by ID.

**Headers:** `Authorization: Bearer <token>`

**Response `200 OK`**
```json
{
  "book": {
    "book_id": 1,
    "book_name": "Book 001",
    "barcode": "123456789012",
    "amount": 5.00,
    "start": 1000,
    "end": 1299,
    "total": 1500.00,
    "static_code": "ABC123",
    "slot_id": 1,
    "slot_name": "Slot A",
    "is_scanned": false
  }
}
```

**Response `404 Not Found`**
```json
{
  "error": "Book not found."
}
```

---

### PUT /api/books/{book_id}
Update a book's details.

**Headers:** `Authorization: Bearer <token>`

**Request**
```json
{
  "book_name": "Book 001 Updated",
  "amount": 10.00,
  "start": 1000,
  "end": 1299,
  "slot_id": 2
}
```

**Response `200 OK`**
```json
{
  "message": "Book updated successfully.",
  "book": {
    "book_id": 1,
    "book_name": "Book 001 Updated",
    "barcode": "123456789012",
    "amount": 10.00,
    "start": 1000,
    "end": 1299,
    "total": 3000.00,
    "static_code": "ABC123",
    "slot_id": 2,
    "slot_name": "Slot B",
    "is_scanned": false
  }
}
```

---

### DELETE /api/books/{book_id}
Delete a book.

**Headers:** `Authorization: Bearer <token>`

**Response `200 OK`**
```json
{
  "message": "Book deleted successfully."
}
```

---

## 4. Shifts

### GET /api/shifts
Get all main shifts.

**Headers:** `Authorization: Bearer <token>`

**Response `200 OK`**
```json
{
  "shifts": [
    {
      "shift_id": 1,
      "shift_start_time": "2026-04-23T08:00:00",
      "shift_end_time": "2026-04-23T16:00:00",
      "cash_in_hand": 200.00,
      "cash_out": 350.00,
      "gross_sales": 1200.00,
      "cancels": 50.00,
      "tickets_total": 1150.00,
      "is_shift_open": false,
      "shift_number": 1,
      "main_shift_id": null,
      "subshift_count": 2
    }
  ]
}
```

---

### POST /api/shifts
Open a new main shift.

**Headers:** `Authorization: Bearer <token>`

**Request**
```json
{
  "cash_in_hand": 200.00
}
```

**Response `201 Created`**
```json
{
  "message": "Shift opened successfully.",
  "shift": {
    "shift_id": 2,
    "shift_start_time": "2026-04-23T09:00:00",
    "shift_end_time": null,
    "cash_in_hand": 200.00,
    "cash_out": 0.00,
    "gross_sales": 0.00,
    "cancels": 0.00,
    "tickets_total": 0.00,
    "is_shift_open": true,
    "shift_number": 1,
    "main_shift_id": null
  }
}
```

**Response `409 Conflict`** — shift already open
```json
{
  "error": "A shift is already open. Please close it before opening a new one."
}
```

---

### GET /api/shifts/{shift_id}
Get a single shift with all its scanned books.

**Headers:** `Authorization: Bearer <token>`

**Response `200 OK`**
```json
{
  "shift": {
    "shift_id": 1,
    "shift_start_time": "2026-04-23T08:00:00",
    "shift_end_time": "2026-04-23T16:00:00",
    "cash_in_hand": 200.00,
    "cash_out": 350.00,
    "gross_sales": 1200.00,
    "cancels": 50.00,
    "tickets_total": 1150.00,
    "is_shift_open": false,
    "shift_number": 1,
    "main_shift_id": null,
    "scanned_books": [
      {
        "barcode": "123456789012",
        "slot_id": 1,
        "slot_name": "Slot A",
        "start": 1000,
        "end": 1299,
        "amount": 5.00,
        "total": 1500.00
      }
    ],
    "sub_shifts": [
      {
        "shift_id": 3,
        "shift_number": 2,
        "is_shift_open": false
      }
    ]
  }
}
```

---

### PUT /api/shifts/{shift_id}/close
Close an open shift.

**Headers:** `Authorization: Bearer <token>`

**Request**
```json
{
  "cash_out": 350.00,
  "gross_sales": 1200.00,
  "cancels": 50.00,
  "tickets_total": 1150.00
}
```

**Response `200 OK`**
```json
{
  "message": "Shift closed successfully.",
  "shift": {
    "shift_id": 1,
    "shift_start_time": "2026-04-23T08:00:00",
    "shift_end_time": "2026-04-23T16:00:00",
    "cash_in_hand": 200.00,
    "cash_out": 350.00,
    "gross_sales": 1200.00,
    "cancels": 50.00,
    "tickets_total": 1150.00,
    "is_shift_open": false
  }
}
```

**Response `400 Bad Request`** — shift already closed
```json
{
  "error": "This shift is already closed."
}
```

---

### POST /api/shifts/{shift_id}/subshifts
Create a sub-shift under a main shift.

**Headers:** `Authorization: Bearer <token>`

**Response `201 Created`**
```json
{
  "message": "Sub-shift created successfully.",
  "shift": {
    "shift_id": 3,
    "shift_start_time": "2026-04-23T12:00:00",
    "shift_end_time": null,
    "cash_in_hand": 0.00,
    "cash_out": 0.00,
    "gross_sales": 0.00,
    "cancels": 0.00,
    "tickets_total": 0.00,
    "is_shift_open": true,
    "shift_number": 2,
    "main_shift_id": 1
  }
}
```

---

### GET /api/shifts/{shift_id}/subshifts
Get all sub-shifts under a main shift.

**Headers:** `Authorization: Bearer <token>`

**Response `200 OK`**
```json
{
  "main_shift_id": 1,
  "sub_shifts": [
    {
      "shift_id": 3,
      "shift_start_time": "2026-04-23T12:00:00",
      "shift_end_time": "2026-04-23T14:00:00",
      "is_shift_open": false,
      "shift_number": 2
    }
  ]
}
```

---

## 5. Scan

### POST /api/scan
Submit a barcode scan during an active shift.

**Headers:** `Authorization: Bearer <token>`

**Request**
```json
{
  "barcode": "123456789012",
  "shift_id": 1
}
```

**Response `201 Created`** — scan successful
```json
{
  "message": "Book scanned successfully.",
  "scanned_book": {
    "barcode": "123456789012",
    "book_name": "Book 001",
    "slot_id": 1,
    "slot_name": "Slot A",
    "start": 1000,
    "end": 1299,
    "amount": 5.00,
    "total": 1500.00,
    "shift_id": 1
  }
}
```

**Response `404 Not Found`** — no book matches the static code
```json
{
  "error": "No book found matching this barcode."
}
```

**Response `409 Conflict`** — already scanned in this shift
```json
{
  "error": "This book has already been scanned in the current shift."
}
```

**Response `400 Bad Request`** — shift is not open
```json
{
  "error": "The specified shift is not open."
}
```

---

## 6. Error Responses

All errors follow this consistent format:

```json
{
  "error": "Human-readable error message here."
}
```

### HTTP Status Codes Used

| Code | Meaning |
|---|---|
| 200 | OK — request succeeded |
| 201 | Created — resource created successfully |
| 400 | Bad Request — invalid input or business rule violation |
| 401 | Unauthorized — missing or invalid JWT token |
| 404 | Not Found — resource does not exist |
| 409 | Conflict — duplicate resource or state conflict |
| 422 | Unprocessable Entity — validation error (missing required fields) |
| 500 | Internal Server Error — unexpected server error |

### Validation Error Format (422)

```json
{
  "error": "Validation failed.",
  "details": {
    "username": ["This field is required."],
    "password": ["Password must be at least 8 characters."]
  }
}
```

---

*Phase 3 — System Design | LottoMeter v2.0*
