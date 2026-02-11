/**
 * D1 Database Service - Multi-tenant Settings, Users & Bookings
 */
import { Settings, BookingRecord, User } from '../types';

// ==================== Users ====================

/** Find user by Google ID */
export async function getUserByGoogleId(db: D1Database, googleId: string): Promise<User | null> {
  const row = await db
    .prepare('SELECT * FROM users WHERE google_id = ?')
    .bind(googleId)
    .first<User>();
  return row || null;
}

/** Find user by slug */
export async function getUserBySlug(db: D1Database, slug: string): Promise<User | null> {
  const row = await db
    .prepare('SELECT * FROM users WHERE slug = ?')
    .bind(slug)
    .first<User>();
  return row || null;
}

/** Find user by ID */
export async function getUserById(db: D1Database, id: number): Promise<User | null> {
  const row = await db
    .prepare('SELECT * FROM users WHERE id = ?')
    .bind(id)
    .first<User>();
  return row || null;
}

/** Create a new user */
export async function createUser(
  db: D1Database,
  user: {
    googleId: string;
    email: string;
    name: string;
    slug: string;
    avatarUrl: string;
    refreshToken: string;
  }
): Promise<User> {
  await db
    .prepare(
      `INSERT INTO users (google_id, email, name, slug, avatar_url, refresh_token)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(user.googleId, user.email, user.name, user.slug, user.avatarUrl, user.refreshToken)
    .run();

  const created = await getUserByGoogleId(db, user.googleId);
  if (!created) throw new Error('Failed to create user');
  return created;
}

/** Update user refresh token */
export async function updateRefreshToken(
  db: D1Database,
  userId: number,
  encryptedToken: string
): Promise<void> {
  await db
    .prepare('UPDATE users SET refresh_token = ? WHERE id = ?')
    .bind(encryptedToken, userId)
    .run();
}

/** Update user profile */
export async function updateUser(
  db: D1Database,
  userId: number,
  updates: { name?: string; slug?: string; avatarUrl?: string }
): Promise<void> {
  const sets: string[] = [];
  const values: (string | number)[] = [];

  if (updates.name !== undefined) { sets.push('name = ?'); values.push(updates.name); }
  if (updates.slug !== undefined) { sets.push('slug = ?'); values.push(updates.slug); }
  if (updates.avatarUrl !== undefined) { sets.push('avatar_url = ?'); values.push(updates.avatarUrl); }

  if (sets.length === 0) return;
  values.push(userId);

  await db
    .prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run();
}

/** Check if a slug is available */
export async function isSlugAvailable(db: D1Database, slug: string, excludeUserId?: number): Promise<boolean> {
  const query = excludeUserId
    ? 'SELECT id FROM users WHERE slug = ? AND id != ?'
    : 'SELECT id FROM users WHERE slug = ?';

  const row = excludeUserId
    ? await db.prepare(query).bind(slug, excludeUserId).first()
    : await db.prepare(query).bind(slug).first();

  return !row;
}

// ==================== Settings ====================

/** Retrieve all settings for a user */
export async function getSettings(db: D1Database, userId: number): Promise<Settings> {
  const rows = await db
    .prepare('SELECT key, value FROM settings WHERE user_id = ?')
    .bind(userId)
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

/** Save settings for a user (upsert) */
export async function saveSettings(
  db: D1Database,
  userId: number,
  updates: Partial<Record<string, string | number | number[]>>
): Promise<void> {
  const stmt = db.prepare(
    'INSERT INTO settings (user_id, key, value) VALUES (?, ?, ?) ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value'
  );

  const batch: D1PreparedStatement[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;
    const strValue = Array.isArray(value) ? value.join(',') : String(value);
    batch.push(stmt.bind(userId, key, strValue));
  }

  if (batch.length > 0) {
    await db.batch(batch);
  }
}

/** Initialize default settings for a new user */
export async function initDefaultSettings(
  db: D1Database,
  userId: number,
  email: string,
  name: string
): Promise<void> {
  await saveSettings(db, userId, {
    ownerName: name,
    ownerEmail: email,
    calendarId: email,
    duration: 60,
    startHour: 9,
    endHour: 17,
    timezone: 'Asia/Tokyo',
    maxDays: 30,
    availableDays: [1, 2, 3, 4, 5],
  });
}

// ==================== Bookings ====================

/** Insert a booking record */
export async function insertBooking(
  db: D1Database,
  userId: number,
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
      `INSERT INTO bookings (user_id, date, start_time, end_time, start_iso, end_iso, name, email, message, event_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      userId,
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

/** Get all bookings for a user (newest first) */
export async function getBookings(db: D1Database, userId: number): Promise<BookingRecord[]> {
  const result = await db
    .prepare('SELECT * FROM bookings WHERE user_id = ? ORDER BY created_at DESC')
    .bind(userId)
    .all<BookingRecord>();

  return result.results;
}
