/**
 * Settings Routes
 * GET  /api/settings       - Public settings
 * GET  /api/admin/settings  - All settings (admin)
 * PUT  /api/admin/settings  - Update settings (admin)
 */
import { Env, PublicSettings } from '../types';
import { getSettings, saveSettings } from '../services/db';
import { verifyAdmin } from '../utils/auth';
import { jsonResponse } from '../index';

export const handleSettingsRoutes = {
  /** GET /api/settings - Public settings (no auth required) */
  async getPublic(env: Env): Promise<Response> {
    const settings = await getSettings(env.DB);

    const publicSettings: PublicSettings = {
      ownerName: settings.ownerName,
      duration: settings.duration,
      startHour: settings.startHour,
      endHour: settings.endHour,
      timezone: settings.timezone || 'Asia/Tokyo',
      maxDays: settings.maxDays,
      availableDays: settings.availableDays,
    };

    return jsonResponse(publicSettings);
  },

  /** GET /api/admin/settings - Full settings (admin auth required) */
  async getAdmin(request: Request, env: Env): Promise<Response> {
    if (!verifyAdmin(request, env)) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const settings = await getSettings(env.DB);
    // Don't return the admin password
    return jsonResponse({
      ...settings,
      effectiveTimezone: settings.timezone || 'Asia/Tokyo',
    });
  },

  /** PUT /api/admin/settings - Update settings (admin auth required) */
  async update(request: Request, env: Env): Promise<Response> {
    if (!verifyAdmin(request, env)) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const body = (await request.json()) as Record<string, unknown>;

    // Build updates map
    const updates: Record<string, string | number | number[]> = {};
    const allowedKeys = [
      'ownerName',
      'ownerEmail',
      'calendarId',
      'duration',
      'startHour',
      'endHour',
      'timezone',
      'maxDays',
      'availableDays',
    ];

    for (const key of allowedKeys) {
      if (body[key] !== undefined) {
        updates[key] = body[key] as string | number | number[];
      }
    }

    // Handle password change separately via wrangler secret
    // (or we could store it in D1, but secrets are more secure)

    await saveSettings(env.DB, updates);
    const newSettings = await getSettings(env.DB);

    return jsonResponse({
      ...newSettings,
      effectiveTimezone: newSettings.timezone || 'Asia/Tokyo',
    });
  },
};
