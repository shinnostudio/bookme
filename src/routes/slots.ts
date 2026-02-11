/**
 * Slots Route (Multi-tenant)
 * GET /api/u/:slug/slots?date=2026-02-15
 */
import { Env } from '../types';
import { getUserBySlug, getSettings } from '../services/db';
import { getCalendarEvents, calculateSlots } from '../services/calendar';
import { refreshAccessToken } from '../services/oauth';
import { decrypt } from '../services/crypto';
import { jsonResponse } from '../index';

export async function handleSlotsRoute(
  request: Request,
  slug: string,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const dateStr = url.searchParams.get('date');

  if (!dateStr) {
    return jsonResponse({ error: 'date parameter is required (YYYY-MM-DD)' }, 400);
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

  const dayDate = new Date(dateStr + 'T00:00:00Z');
  const fetchStart = new Date(dayDate.getTime() - 86400000);
  const fetchEnd = new Date(dayDate.getTime() + 2 * 86400000);

  const events = await getCalendarEvents(
    accessToken,
    settings.calendarId,
    fetchStart.toISOString(),
    fetchEnd.toISOString()
  );

  const slots = calculateSlots(dateStr, events, settings);
  return jsonResponse(slots);
}
