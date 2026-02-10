/**
 * Google Calendar API Service
 * Uses service account authentication via JWT
 */
import { CalendarEvent, ServiceAccountKey, TimeSlot, Settings } from '../types';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';
const SCOPE = 'https://www.googleapis.com/auth/calendar';

// Token cache (in-memory, per isolate)
let cachedToken: { token: string; expiresAt: number } | null = null;

/** Base64url encode */
function base64url(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Base64url encode string */
function base64urlStr(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Import PEM private key for signing */
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const pemContents = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '');

  const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  return crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

/** Create a JWT and exchange for access token */
async function getAccessToken(serviceAccountJson: string): Promise<string> {
  // Check cache
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt > now + 60) {
    return cachedToken.token;
  }

  const sa: ServiceAccountKey = JSON.parse(serviceAccountJson);
  const iat = now;
  const exp = now + 3600;

  // Create JWT
  const header = base64urlStr(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64urlStr(
    JSON.stringify({
      iss: sa.client_email,
      scope: SCOPE,
      aud: GOOGLE_TOKEN_URL,
      iat,
      exp,
    })
  );

  const signingInput = `${header}.${payload}`;
  const key = await importPrivateKey(sa.private_key);
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(signingInput)
  );

  const jwt = `${signingInput}.${base64url(signature)}`;

  // Exchange JWT for access token
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get Google access token: ${errorText}`);
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };

  cachedToken = {
    token: data.access_token,
    expiresAt: now + data.expires_in,
  };

  return data.access_token;
}

/** Fetch events from Google Calendar for a time range */
export async function getCalendarEvents(
  serviceAccountJson: string,
  calendarId: string,
  timeMin: string,
  timeMax: string
): Promise<CalendarEvent[]> {
  const token = await getAccessToken(serviceAccountJson);

  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
  });

  const url = `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Calendar API error: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as {
    items?: Array<{
      start: { dateTime?: string; date?: string };
      end: { dateTime?: string; date?: string };
    }>;
  };

  return (data.items || []).map((item) => {
    const isAllDay = !item.start.dateTime;
    return {
      start: item.start.dateTime || item.start.date || '',
      end: item.end.dateTime || item.end.date || '',
      isAllDay,
    };
  });
}

/** Create a calendar event */
export async function createCalendarEvent(
  serviceAccountJson: string,
  calendarId: string,
  summary: string,
  description: string,
  startIso: string,
  endIso: string,
  timezone: string
): Promise<string> {
  const token = await getAccessToken(serviceAccountJson);

  const url = `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events`;

  const body = {
    summary,
    description,
    start: { dateTime: startIso, timeZone: timezone },
    end: { dateTime: endIso, timeZone: timezone },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Calendar event creation failed: ${response.status} ${errorText}`);
  }

  const result = (await response.json()) as { id: string };
  return result.id;
}

/** Calculate available time slots for a given date */
export function calculateSlots(
  dateStr: string,
  events: CalendarEvent[],
  settings: Settings
): TimeSlot[] {
  const tz = settings.timezone || 'Asia/Tokyo';
  const date = new Date(dateStr + 'T00:00:00');

  // Get day of week in the target timezone
  const dayFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'short',
  });
  const dayName = dayFormatter.format(date);
  const dayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  const dayOfWeek = dayMap[dayName] ?? date.getDay();

  // Check if this day is available
  if (!settings.availableDays.includes(dayOfWeek)) {
    return [];
  }

  // Build start/end times in the target timezone
  // dateStr is 'YYYY-MM-DD'
  const startHourStr = String(settings.startHour).padStart(2, '0');
  const endHourStr = String(settings.endHour).padStart(2, '0');

  // Create Date objects using timezone-aware ISO strings
  // We need to find the UTC time that corresponds to startHour in the target timezone
  const slotStartLocal = new Date(`${dateStr}T${startHourStr}:00:00`);
  const slotEndLocal = new Date(`${dateStr}T${endHourStr}:00:00`);

  // Get UTC offset for the target timezone on this date
  const utcOffsetMs = getTimezoneOffsetMs(tz, slotStartLocal);
  const slotStart = new Date(slotStartLocal.getTime() - utcOffsetMs);
  const slotEnd = new Date(slotEndLocal.getTime() - utcOffsetMs);

  // Parse busy periods
  const busyPeriods = events.map((ev) => ({
    start: new Date(ev.start).getTime(),
    end: new Date(ev.end).getTime(),
    isAllDay: ev.isAllDay,
  }));
  const hasAllDayEvent = busyPeriods.some((b) => b.isAllDay);

  const durationMs = settings.duration * 60 * 1000;
  const now = Date.now();
  const slots: TimeSlot[] = [];

  let current = slotStart.getTime();
  const endTime = slotEnd.getTime();

  while (current + durationMs <= endTime) {
    const currentEnd = current + durationMs;
    const isPast = current < now;

    const isConflict =
      hasAllDayEvent ||
      busyPeriods.some((busy) => current < busy.end && currentEnd > busy.start);

    // Format times in the target timezone
    const startDate = new Date(current);
    const endDate = new Date(currentEnd);
    const timeFormat = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const startParts = timeFormat.formatToParts(startDate);
    const endParts = timeFormat.formatToParts(endDate);

    const sH = parseInt(startParts.find((p) => p.type === 'hour')?.value || '0', 10);
    const sM = parseInt(startParts.find((p) => p.type === 'minute')?.value || '0', 10);
    const eH = parseInt(endParts.find((p) => p.type === 'hour')?.value || '0', 10);
    const eM = parseInt(endParts.find((p) => p.type === 'minute')?.value || '0', 10);

    slots.push({
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      startHour: sH,
      startMinute: sM,
      endHour: eH,
      endMinute: eM,
      available: !isConflict && !isPast,
      isPast,
      isBusy: isConflict,
    });

    current += durationMs;
  }

  return slots;
}

/** Get the UTC offset in milliseconds for a timezone at a given date */
function getTimezoneOffsetMs(tz: string, date: Date): number {
  // Format the date in the target timezone to get local components
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const getValue = (type: string) =>
    parseInt(parts.find((p) => p.type === type)?.value || '0', 10);

  const year = getValue('year');
  const month = getValue('month') - 1;
  const day = getValue('day');
  let hour = getValue('hour');
  if (hour === 24) hour = 0;
  const minute = getValue('minute');
  const second = getValue('second');

  // Construct a UTC date from these local-in-tz components
  const utcFromLocal = Date.UTC(year, month, day, hour, minute, second);
  // The offset is: local_time_as_utc - actual_utc
  return utcFromLocal - date.getTime();
}
