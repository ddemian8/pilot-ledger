-- Pilot Ledger production schema. All user-owned records are scoped by user_id.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS exchange_rates (
  date TEXT PRIMARY KEY NOT NULL,
  mdl_per_eur REAL NOT NULL CHECK (mdl_per_eur > 0),
  source TEXT NOT NULL DEFAULT 'BNM',
  fetched_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_cents INTEGER NOT NULL CHECK (target_cents > 0),
  saved_cents INTEGER NOT NULL DEFAULT 0 CHECK (saved_cents >= 0),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  cents INTEGER NOT NULL CHECK (cents > 0),
  date TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('expense', 'income')),
  original_currency TEXT CHECK (original_currency IN ('EUR', 'MDL')),
  original_cents INTEGER CHECK (original_cents > 0),
  fx_date TEXT,
  fx_mdl_per_eur REAL,
  fx_source TEXT,
  fx_fetched_at TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK ((original_currency IS NULL AND original_cents IS NULL) OR (original_currency IS NOT NULL AND original_cents IS NOT NULL)),
  CHECK (original_currency != 'MDL' OR (fx_date IS NOT NULL AND fx_mdl_per_eur > 0))
);

CREATE TABLE IF NOT EXISTS imports (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('receipt_photo', 'pdf_screenshot')),
  object_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'processing', 'needs_review', 'approved', 'failed')),
  extracted_json TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS transactions_user_date_idx ON transactions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS imports_user_created_idx ON imports(user_id, created_at DESC);
