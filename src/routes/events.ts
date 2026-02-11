/**
 * Events Route (Multi-tenant)
 * GET /api/u/:slug/events?year=2026&month=1
 */
import { Env } from '../types';
import { getUserBySlug, getSettings } from '../services/db';
import { getCalendarEvents } from '../services/calendar';
import { refreshAccessToken } from '../services/oauth';
import { decrypt } from '../services/crypto';
import { jsonResponse } from '../index';

export async function handleEventsRoute(
  request: Request,
  slug: string,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const year = parseInt(url.searchParams.get('year') || '', 10);
  const month = parseInt(url.searchParams.get('month') || '', 10);

  if (isNaN(year) || isNaN(month)) {
    return jsonResponse({ error: 'year and month are required' }, 400);
  }

  const user = await getUserBySlug(env.DB, slug);
  if (!user) {
    return jsonResponse({ error: 'ユーザーが見つかりません' }, 404);
  }

  const settings = await getSettings(env.DB, user.id);

  if (!settings.calendarId) {
    return jsonResponse({ error: 'カレンダーが設定されていません' }, 400);
  }

  // Get access token from user's refresh token
  const refreshToken = await decrypt(user.refresh_token, env.ENCRYPTION_KEY);
  const accessToken = await refreshAccessToken(refreshToken, env);

  const startDate = new Date(Date.UTC(year, month, 1, 0, 0, 0));
  const endDate = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59));

  const events = await getCalendarEvents(
    accessToken,
    settings.calendarId,
    startDate.toISOString(),
    endDate.toISOString()
  );

  return jsonResponse(events);
}
