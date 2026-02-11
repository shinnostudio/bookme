-- BookMe SaaS Migration: Multi-tenant support

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  google_id       TEXT UNIQUE NOT NULL,
  email           TEXT NOT NULL,
  name            TEXT NOT NULL,
  slug            TEXT UNIQUE NOT NULL,
  avatar_url      TEXT DEFAULT '',
  refresh_token   TEXT NOT NULL,
  created_at      TEXT DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_slug ON users(slug);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);

-- Drop old tables and recreate with user_id
DROP TABLE IF EXISTS bookings;
DROP TABLE IF EXISTS settings;

-- Settings table with user_id
CREATE TABLE settings (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id   INTEGER NOT NULL REFERENCES users(id),
  key       TEXT NOT NULL,
  value     TEXT NOT NULL,
  UNIQUE(user_id, key)
);

-- Bookings table with user_id
CREATE TABLE bookings (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  date       TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time   TEXT NOT NULL,
  start_iso  TEXT NOT NULL,
  end_iso    TEXT NOT NULL,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  message    TEXT DEFAULT '',
  event_id   TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_bookings_user_date ON bookings(user_id, date);
