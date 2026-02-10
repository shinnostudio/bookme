/**
 * Slots Route
 * GET /api/slots?date=2026-02-15
 *
 * Returns available time slots for a given date.
 */
import { Env } from '../types';
import { getSettings } from '../services/db';
import { getCalendarEvents, calculateSlots } from '../services/calendar';
import { jsonResponse } from '../index';

export async function handleSlotsRoute(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const dateStr = url.searchParams.get('date');

  if (!dateStr) {
    return jsonResponse({ error: 'date parameter is required (YYYY-MM-DD)' }, 400);
  }

  const settings = await getSettings(env.DB);

  if (!settings.calendarId) {
    return jsonResponse({ error: 'カレンダーが設定されていません' }, 400);
  }

  // Fetch events for the day (with buffer)
  const dayDate = new Date(dateStr + 'T00:00:00Z');
  const fetchStart = new Date(dayDate.getTime() - 86400000);
  const fetchEnd = new Date(dayDate.getTime() + 2 * 86400000);

  const events = await getCalendarEvents(
    env.GOOGLE_SERVICE_ACCOUNT_JSON,
    settings.calendarId,
    fetchStart.toISOString(),
    fetchEnd.toISOString()
  );

  const slots = calculateSlots(dateStr, events, settings);

  return jsonResponse(slots);
}
