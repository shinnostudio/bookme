/**
 * Events Route
 * GET /api/events?year=2026&month=1
 *
 * Returns calendar events for a given month (titles hidden).
 */
import { Env } from '../types';
import { getSettings } from '../services/db';
import { getCalendarEvents } from '../services/calendar';
import { jsonResponse } from '../index';

export async function handleEventsRoute(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const year = parseInt(url.searchParams.get('year') || '', 10);
  const month = parseInt(url.searchParams.get('month') || '', 10);

  if (isNaN(year) || isNaN(month)) {
    return jsonResponse({ error: 'year and month are required' }, 400);
  }

  const settings = await getSettings(env.DB);

  if (!settings.calendarId) {
    return jsonResponse({ error: 'カレンダーが設定されていません' }, 400);
  }

  // Build time range for the month
  // month is 0-based (same as GAS getMonthEvents)
  const startDate = new Date(Date.UTC(year, month, 1, 0, 0, 0));
  const endDate = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59));

  const events = await getCalendarEvents(
    env.GOOGLE_SERVICE_ACCOUNT_JSON,
    settings.calendarId,
    startDate.toISOString(),
    endDate.toISOString()
  );

  // Return events without titles (just start/end/isAllDay)
  return jsonResponse(events);
}
