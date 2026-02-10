-- BookMe D1 Schema

-- Settings table (key-value store)
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Bookings table
CREATE TABLE IF NOT EXISTS bookings (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
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

-- Index for date-based queries
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(date);

-- Default settings
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('ownerName', 'あなたの名前'),
  ('ownerEmail', ''),
  ('calendarId', ''),
  ('duration', '60'),
  ('startHour', '9'),
  ('endHour', '17'),
  ('timezone', 'Asia/Tokyo'),
  ('maxDays', '30'),
  ('availableDays', '1,2,3,4,5');
