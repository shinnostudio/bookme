/**
 * Settings Routes (Multi-tenant)
 * GET  /api/u/:slug/settings       - Public settings for a user
 * GET  /api/dashboard/settings      - Current user's settings (auth required)
 * PUT  /api/dashboard/settings      - Update current user's settings (auth required)
 */
import { Env, PublicSettings, User } from '../types';
import { getSettings, saveSettings, getUserBySlug, getUserById, updateUser, isSlugAvailable } from '../services/db';
import { jsonResponse } from '../index';

export const handleSettingsRoutes = {
  /** GET /api/u/:slug/settings - Public settings (no auth) */
  async getPublic(slug: string, env: Env): Promise<Response> {
    const user = await getUserBySlug(env.DB, slug);
    if (!user) {
      return jsonResponse({ error: 'ユーザーが見つかりません' }, 404);
    }

    const settings = await getSettings(env.DB, user.id);

    const publicSettings: PublicSettings = {
      ownerName: settings.ownerName,
      duration: settings.duration,
      startHour: settings.startHour,
      endHour: settings.endHour,
      timezone: settings.timezone || 'Asia/Tokyo',
      maxDays: settings.maxDays,
      availableDays: settings.availableDays,
      slug: user.slug,
    };

    return jsonResponse(publicSettings);
  },

  /** GET /api/dashboard/settings - Full settings for logged-in user */
  async getDashboard(userId: number, env: Env): Promise<Response> {
    const user = await getUserById(env.DB, userId);
    if (!user) {
      return jsonResponse({ error: 'User not found' }, 404);
    }

    const settings = await getSettings(env.DB, userId);

    return jsonResponse({
      ...settings,
      slug: user.slug,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatar_url,
      effectiveTimezone: settings.timezone || 'Asia/Tokyo',
    });
  },

  /** PUT /api/dashboard/settings - Update settings */
  async update(request: Request, userId: number, env: Env): Promise<Response> {
    const body = (await request.json()) as Record<string, unknown>;

    // Handle slug change
    if (body.slug !== undefined) {
      const newSlug = String(body.slug).toLowerCase().replace(/[^a-z0-9-_]/g, '');
      if (newSlug.length < 3) {
        return jsonResponse({ error: 'slug は3文字以上にしてください' }, 400);
      }
      const reserved = ['dashboard', 'auth', 'api', 'admin', 'settings', 'login', 'logout'];
      if (reserved.includes(newSlug)) {
        return jsonResponse({ error: 'この slug は使用できません' }, 400);
      }
      const available = await isSlugAvailable(env.DB, newSlug, userId);
      if (!available) {
        return jsonResponse({ error: 'この slug は既に使用されています' }, 409);
      }
      await updateUser(env.DB, userId, { slug: newSlug });
    }

    // Build settings updates
    const updates: Record<string, string | number | number[]> = {};
    const allowedKeys = [
      'ownerName', 'ownerEmail', 'calendarId', 'duration',
      'startHour', 'endHour', 'timezone', 'maxDays', 'availableDays',
    ];

    for (const key of allowedKeys) {
      if (body[key] !== undefined) {
        updates[key] = body[key] as string | number | number[];
      }
    }

    if (Object.keys(updates).length > 0) {
      await saveSettings(env.DB, userId, updates);
    }

    // Return updated settings
    const user = await getUserById(env.DB, userId);
    const settings = await getSettings(env.DB, userId);

    return jsonResponse({
      ...settings,
      slug: user?.slug,
      email: user?.email,
      name: user?.name,
      effectiveTimezone: settings.timezone || 'Asia/Tokyo',
    });
  },
};
