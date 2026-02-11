/**
 * Authentication Routes
 * GET  /auth/google   - Redirect to Google OAuth
 * GET  /auth/callback - Handle OAuth callback
 * GET  /auth/logout   - Clear session
 */
import { Env } from '../types';
import { getAuthUrl, exchangeCode, getUserInfo } from '../services/oauth';
import { getUserByGoogleId, createUser, updateRefreshToken, initDefaultSettings } from '../services/db';
import { encrypt } from '../services/crypto';
import { createSessionToken, createSessionCookie, clearSessionCookie } from '../services/session';

/** Generate a URL-safe slug from email or name */
function generateSlug(email: string, name: string): string {
  // Try email prefix first
  const prefix = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
  if (prefix.length >= 3) return prefix;
  // Fallback to name
  return name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) || 'user';
}

/** Ensure slug is unique by appending a number */
async function ensureUniqueSlug(db: D1Database, baseSlug: string): Promise<string> {
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await db
      .prepare('SELECT id FROM users WHERE slug = ?')
      .bind(slug)
      .first();

    if (!existing) return slug;
    slug = `${baseSlug}${counter}`;
    counter++;
  }
}

export const handleAuthRoutes = {
  /** GET /auth/google - Redirect to Google OAuth consent screen */
  async startAuth(env: Env): Promise<Response> {
    const url = getAuthUrl(env);
    return Response.redirect(url, 302);
  },

  /** GET /auth/callback - Handle OAuth callback */
  async callback(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');

    if (error) {
      return Response.redirect(`${env.BASE_URL}/?error=auth_denied`, 302);
    }

    if (!code) {
      return Response.redirect(`${env.BASE_URL}/?error=no_code`, 302);
    }

    try {
      // Exchange code for tokens
      const tokens = await exchangeCode(code, env);
      const userInfo = await getUserInfo(tokens.access_token);

      // Encrypt refresh token
      const encryptedRefreshToken = tokens.refresh_token
        ? await encrypt(tokens.refresh_token, env.ENCRYPTION_KEY)
        : '';

      // Find or create user
      let user = await getUserByGoogleId(env.DB, userInfo.sub);

      if (user) {
        // Update refresh token if we got a new one
        if (encryptedRefreshToken) {
          await updateRefreshToken(env.DB, user.id, encryptedRefreshToken);
        }
      } else {
        // Create new user
        const baseSlug = generateSlug(userInfo.email, userInfo.name);
        const slug = await ensureUniqueSlug(env.DB, baseSlug);

        user = await createUser(env.DB, {
          googleId: userInfo.sub,
          email: userInfo.email,
          name: userInfo.name,
          slug,
          avatarUrl: userInfo.picture || '',
          refreshToken: encryptedRefreshToken,
        });

        // Initialize default settings
        await initDefaultSettings(env.DB, user.id, userInfo.email, userInfo.name);
      }

      // Create session
      const sessionToken = await createSessionToken(user.id, user.email, env.JWT_SECRET);
      const cookie = createSessionCookie(sessionToken, env.BASE_URL);

      return new Response(null, {
        status: 302,
        headers: {
          Location: `${env.BASE_URL}/dashboard`,
          'Set-Cookie': cookie,
        },
      });
    } catch (err) {
      console.error('OAuth callback error:', err);
      return Response.redirect(`${env.BASE_URL}/?error=auth_failed`, 302);
    }
  },

  /** GET /auth/logout - Clear session and redirect */
  async logout(env: Env): Promise<Response> {
    return new Response(null, {
      status: 302,
      headers: {
        Location: env.BASE_URL + '/',
        'Set-Cookie': clearSessionCookie(),
      },
    });
  },
};
