/**
 * D1 Database Service - Settings & Bookings CRUD
 */
import { Settings, BookingRecord } from '../types';

/** Retrieve all settings from D1 as a Settings object */
export async function getSettings(db: D1Database): Promise<Settings> {
  const rows = await db
    .prepare('SELECT key, value FROM settings')
    .all<{ key: string; value: string }>();

  const map: Record<string, string> = {};
  for (const row of rows.results) {
    map[row.key] = row.value;
  }

  return {
    ownerName: map['ownerName'] || 'オーナー',
    ownerEmail: map['ownerEmail'] || '',
    calendarId: map['calendarId'] || '',
    duration: parseInt(map['duration'] || '60', 10),
    startHour: parseInt(map['startHour'] || '9', 10),
    endHour: parseInt(map['endHour'] || '17', 10),
    timezone: map['timezone'] || 'Asia/Tokyo',
    maxDays: parseInt(map['maxDays'] || '30', 10),
    availableDays: (map['availableDays'] || '1,2,3,4,5').split(',').map(Number),
  };
}

/** Save settings (partial update) */
export async function saveSettings(
  db: D1Database,
  updates: Partial<Record<string, string | number | number[]>>
): Promise<void> {
  const stmt = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  );

  const batch: D1PreparedStatement[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;
    const strValue = Array.isArray(value) ? value.join(',') : String(value);
    batch.push(stmt.bind(key, strValue));
  }

  if (batch.length > 0) {
    await db.batch(batch);
  }
}

/** Insert a booking record */
export async function insertBooking(
  db: D1Database,
  booking: {
    date: string;
    startTime: string;
    endTime: string;
    startIso: string;
    endIso: string;
    name: string;
    email: string;
    message: string;
    eventId: string;
  }
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO bookings (date, start_time, end_time, start_iso, end_iso, name, email, message, event_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      booking.date,
      booking.startTime,
      booking.endTime,
      booking.startIso,
      booking.endIso,
      booking.name,
      booking.email,
      booking.message,
      booking.eventId
    )
    .run();
}

/** Get all bookings (newest first) */
export async function getBookings(db: D1Database): Promise<BookingRecord[]> {
  const result = await db
    .prepare('SELECT * FROM bookings ORDER BY created_at DESC')
    .all<BookingRecord>();

  return result.results;
}
