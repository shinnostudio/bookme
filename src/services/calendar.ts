/**
 * Google Calendar API Service
 * Uses OAuth user tokens (not service account)
 */
import { CalendarEvent, TimeSlot, Settings } from '../types';

const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';

/** Fetch events from Google Calendar for a time range */
export async function getCalendarEvents(
  accessToken: string,
  calendarId: string,
  timeMin: string,
  timeMax: string
): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
  });

  const url = `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
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
  accessToken: string,
  calendarId: string,
  summary: string,
  description: string,
  startIso: string,
  endIso: string,
  timezone: string
): Promise<string> {
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
      Authorization: `Bearer ${accessToken}`,
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

  const dayFormatter = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' });
  const dayName = dayFormatter.format(date);
  const dayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  const dayOfWeek = dayMap[dayName] ?? date.getDay();

  if (!settings.availableDays.includes(dayOfWeek)) {
    return [];
  }

  const startHourStr = String(settings.startHour).padStart(2, '0');
  const endHourStr = String(settings.endHour).padStart(2, '0');

  const slotStartLocal = new Date(`${dateStr}T${startHourStr}:00:00`);
  const slotEndLocal = new Date(`${dateStr}T${endHourStr}:00:00`);

  const utcOffsetMs = getTimezoneOffsetMs(tz, slotStartLocal);
  const slotStart = new Date(slotStartLocal.getTime() - utcOffsetMs);
  const slotEnd = new Date(slotEndLocal.getTime() - utcOffsetMs);

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

    const startDate = new Date(current);
    const endDate = new Date(currentEnd);
    const timeFormat = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
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
      startHour: sH, startMinute: sM,
      endHour: eH, endMinute: eM,
      available: !isConflict && !isPast,
      isPast,
      isBusy: isConflict,
    });

    current += durationMs;
  }

  return slots;
}

function getTimezoneOffsetMs(tz: string, date: Date): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
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

  const utcFromLocal = Date.UTC(year, month, day, hour, minute, second);
  return utcFromLocal - date.getTime();
}
