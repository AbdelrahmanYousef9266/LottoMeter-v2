import * as SQLite from 'expo-sqlite';

let _db = null;
let _initPromise = null;

export const getDb = async () => {
  if (_db) return _db;
  // Cache the Promise so concurrent callers all await the same initialization
  // rather than each getting a 100ms sleep and returning null.
  if (!_initPromise) {
    _initPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('lottometer.db');
      await db.execAsync('PRAGMA journal_mode = WAL;');
      await db.execAsync('PRAGMA foreign_keys = ON;');
      await createTables(db);
      await migrateSchema(db);
      _db = db;
      return db;
    })().catch(e => {
      _initPromise = null; // allow retry on next call
      console.error('[db] Failed to open database:', e.message);
      throw e;
    });
  }
  return _initPromise;
};

export const closeDb = async () => {
  if (_db) {
    await _db.closeAsync();
    _db = null;
    _initPromise = null;
  }
};

const createTables = async (db) => {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS local_store (
      id INTEGER PRIMARY KEY,
      server_id INTEGER NOT NULL,
      store_code TEXT NOT NULL,
      store_name TEXT NOT NULL,
      scan_mode TEXT NOT NULL DEFAULT 'camera_single',
      synced_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS local_user (
      id INTEGER PRIMARY KEY,
      server_id INTEGER NOT NULL,
      username TEXT NOT NULL,
      role TEXT NOT NULL,
      store_id INTEGER NOT NULL,
      pin_hash TEXT,
      pin_expires_at TEXT,
      failed_attempts INTEGER NOT NULL DEFAULT 0,
      locked_until TEXT,
      synced_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS local_slots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER NOT NULL UNIQUE,
      store_id INTEGER NOT NULL,
      slot_name TEXT NOT NULL,
      ticket_price REAL NOT NULL,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      synced_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS local_books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER NOT NULL UNIQUE,
      store_id INTEGER NOT NULL,
      barcode TEXT NOT NULL,
      static_code TEXT NOT NULL,
      ticket_price REAL NOT NULL,
      slot_id INTEGER,
      is_active INTEGER NOT NULL DEFAULT 1,
      is_sold INTEGER NOT NULL DEFAULT 0,
      start_position INTEGER,
      synced_at TEXT NOT NULL
    );

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

    CREATE TABLE IF NOT EXISTS local_employee_shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER,
      uuid TEXT NOT NULL UNIQUE,
      store_id INTEGER NOT NULL,
      business_day_uuid TEXT NOT NULL,
      employee_id INTEGER NOT NULL,
      shift_number INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      opened_at TEXT NOT NULL,
      closed_at TEXT,
      cash_in_hand REAL,
      gross_sales REAL,
      cash_out REAL,
      cancels REAL DEFAULT 0,
      tickets_total REAL,
      expected_cash REAL,
      difference REAL,
      shift_status TEXT,
      sync_status TEXT NOT NULL DEFAULT 'synced',
      last_error TEXT,
      conflict_data TEXT,
      synced_at TEXT
    );

    CREATE TABLE IF NOT EXISTS local_shift_books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER,
      uuid TEXT NOT NULL UNIQUE,
      store_id INTEGER NOT NULL,
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

    CREATE TABLE IF NOT EXISTS local_extra_sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER,
      uuid TEXT NOT NULL UNIQUE,
      store_id INTEGER NOT NULL,
      shift_uuid TEXT NOT NULL,
      scanned_barcode TEXT NOT NULL,
      ticket_price REAL NOT NULL,
      ticket_count INTEGER NOT NULL,
      value REAL NOT NULL,
      created_by_user_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'synced',
      last_error TEXT,
      synced_at TEXT
    );

    -- status lifecycle: pending → syncing → synced | failed | conflict
    -- Only retryFailedSyncItem() may reset a failed row back to pending.
    -- Nothing automatically resets retry_count.
    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      operation TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_uuid TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      retry_count INTEGER NOT NULL DEFAULT 0,
      max_retries INTEGER NOT NULL DEFAULT 10,
      last_error TEXT,
      conflict_data TEXT,
      next_retry_at TEXT,
      created_at TEXT NOT NULL,
      synced_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_local_books_static_code
      ON local_books(static_code);
    CREATE INDEX IF NOT EXISTS idx_local_books_store
      ON local_books(store_id, is_active);
    CREATE INDEX IF NOT EXISTS idx_local_shift_books_shift
      ON local_shift_books(shift_uuid, scan_type);
    CREATE INDEX IF NOT EXISTS idx_local_shift_books_static
      ON local_shift_books(static_code, shift_uuid);
    CREATE INDEX IF NOT EXISTS idx_sync_queue_status
      ON sync_queue(status, created_at);
    CREATE INDEX IF NOT EXISTS idx_local_shifts_store
      ON local_employee_shifts(store_id, status);
  `);
};

// Idempotent column additions for users upgrading from older app versions.
// Each ALTER TABLE is wrapped in try/catch — "duplicate column" errors are safe to ignore.
const migrateSchema = async (db) => {
  try {
    await db.execAsync('ALTER TABLE sync_queue ADD COLUMN next_retry_at TEXT');
  } catch {
    // column already exists on installs that have run this before
  }
};

export default getDb;
