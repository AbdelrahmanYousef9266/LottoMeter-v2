import * as SQLite from 'expo-sqlite';

let db = null;

export const getDb = async () => {
  if (!db) {
    db = await SQLite.openDatabaseAsync('lottometer_offline.db');
    await initializeSchema(db);
  }
  return db;
};

// Receives the already-opened db handle — no re-entrant getDb() call
const initializeSchema = async (database) => {
  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    -- Store info
    CREATE TABLE IF NOT EXISTS local_store (
      id INTEGER PRIMARY KEY,
      server_id INTEGER NOT NULL,
      store_code TEXT NOT NULL,
      store_name TEXT NOT NULL,
      scan_mode TEXT NOT NULL DEFAULT 'camera_single',
      synced_at TEXT NOT NULL
    );

    -- Current user
    CREATE TABLE IF NOT EXISTS local_user (
      id INTEGER PRIMARY KEY,
      server_id INTEGER NOT NULL,
      username TEXT NOT NULL,
      role TEXT NOT NULL,
      store_id INTEGER NOT NULL,
      pin_hash TEXT,
      pin_set_at TEXT,
      pin_expires_at TEXT,
      session_token TEXT,
      session_expires_at TEXT,
      synced_at TEXT NOT NULL
    );

    -- Books (all active books for this store)
    CREATE TABLE IF NOT EXISTS local_books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER NOT NULL UNIQUE,
      store_id INTEGER NOT NULL,
      book_name TEXT,
      barcode TEXT NOT NULL,
      static_code TEXT NOT NULL,
      start_position INTEGER,
      ticket_price REAL NOT NULL,
      slot_id INTEGER,
      is_active INTEGER NOT NULL DEFAULT 1,
      is_sold INTEGER NOT NULL DEFAULT 0,
      synced_at TEXT NOT NULL
    );

    -- Slots
    CREATE TABLE IF NOT EXISTS local_slots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER NOT NULL UNIQUE,
      store_id INTEGER NOT NULL,
      slot_name TEXT NOT NULL,
      ticket_price REAL NOT NULL,
      synced_at TEXT NOT NULL
    );

    -- Business days (today + last 7 days)
    CREATE TABLE IF NOT EXISTS local_business_days (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER,
      uuid TEXT NOT NULL UNIQUE,
      store_id INTEGER NOT NULL,
      business_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      opened_at TEXT NOT NULL,
      closed_at TEXT,
      total_sales REAL,
      total_variance REAL,
      sync_status TEXT NOT NULL DEFAULT 'synced',
      last_error TEXT,
      synced_at TEXT
    );

    -- Employee shifts
    CREATE TABLE IF NOT EXISTS local_employee_shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER,
      uuid TEXT NOT NULL UNIQUE,
      store_id INTEGER NOT NULL,
      business_day_id INTEGER NOT NULL,
      business_day_uuid TEXT NOT NULL,
      employee_id INTEGER NOT NULL,
      shift_number INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      opened_at TEXT NOT NULL,
      closed_at TEXT,
      cash_in_hand REAL,
      gross_sales REAL,
      cash_out REAL,
      tickets_total REAL,
      expected_cash REAL,
      difference REAL,
      shift_status TEXT,
      sync_status TEXT NOT NULL DEFAULT 'synced',
      last_error TEXT,
      conflict_data TEXT,
      synced_at TEXT
    );

    -- Shift books (scan records)
    CREATE TABLE IF NOT EXISTS local_shift_books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER,
      uuid TEXT NOT NULL UNIQUE,
      store_id INTEGER NOT NULL,
      shift_id INTEGER NOT NULL,
      shift_uuid TEXT NOT NULL,
      static_code TEXT NOT NULL,
      scan_type TEXT NOT NULL,
      start_at_scan INTEGER NOT NULL,
      is_last_ticket INTEGER NOT NULL DEFAULT 0,
      scan_source TEXT NOT NULL DEFAULT 'manual',
      slot_id INTEGER,
      scanned_at TEXT NOT NULL,
      scanned_by_user_id INTEGER NOT NULL,
      force_sold INTEGER,
      sync_status TEXT NOT NULL DEFAULT 'synced',
      last_error TEXT,
      synced_at TEXT
    );

    -- Extra sales (whole book sales)
    CREATE TABLE IF NOT EXISTS local_extra_sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER,
      uuid TEXT NOT NULL UNIQUE,
      store_id INTEGER NOT NULL,
      shift_id INTEGER NOT NULL,
      shift_uuid TEXT NOT NULL,
      sale_type TEXT NOT NULL DEFAULT 'whole_book',
      scanned_barcode TEXT NOT NULL,
      ticket_price REAL NOT NULL,
      ticket_count INTEGER NOT NULL,
      value REAL NOT NULL,
      note TEXT,
      created_by_user_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'synced',
      last_error TEXT,
      synced_at TEXT
    );

    -- LENGTH_BY_PRICE constants (downloaded once)
    CREATE TABLE IF NOT EXISTS local_constants (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      synced_at TEXT NOT NULL
    );

    -- Sync queue (ordered list of pending operations)
    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      operation TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_uuid TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      retry_count INTEGER NOT NULL DEFAULT 0,
      max_retries INTEGER NOT NULL DEFAULT 3,
      last_error TEXT,
      conflict_data TEXT,
      created_at TEXT NOT NULL,
      synced_at TEXT
    );

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_local_books_static_code
      ON local_books(static_code);
    CREATE INDEX IF NOT EXISTS idx_local_shift_books_shift
      ON local_shift_books(shift_id, scan_type);
    CREATE INDEX IF NOT EXISTS idx_local_shift_books_static
      ON local_shift_books(static_code, shift_id);
    CREATE INDEX IF NOT EXISTS idx_sync_queue_status
      ON sync_queue(status, created_at);
  `);
};

export default getDb;
