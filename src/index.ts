/**
 * BookMe SaaS - Cloudflare Workers Entry Point
 *
 * URL Structure:
 *   /                          → Landing page (static)
 *   /dashboard                 → Dashboard (requires auth, serves dashboard.html)
 *   /:slug                     → Public booking page (serves booking.html)
 *   /auth/google               → Start Google OAuth
 *   /auth/callback             → OAuth callback
 *   /auth/logout               → Logout
 *   /api/u/:slug/settings      → Public settings
 *   /api/u/:slug/events        → Calendar events
 *   /api/u/:slug/slots         → Available slots
 *   /api/u/:slug/bookings      → Create booking
 *   /api/dashboard/settings    → User settings (auth)
 *   /api/dashboard/bookings    → User bookings (auth)
 *   /api/dashboard/me          → Current user info (auth)
 */
import { Env, SessionPayload } from './types';
import { handleAuthRoutes } from './routes/auth';
import { handleSettingsRoutes } from './routes/settings';
import { handleEventsRoute } from './routes/events';
import { handleSlotsRoute } from './routes/slots';
import { handleBookingsRoutes } from './routes/bookings';
import { getSessionFromRequest, verifySessionToken } from './services/session';
import { getUserById, getUserBySlug } from './services/db';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    const corsHeaders: Record<string, string> = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      let response: Response | null = null;

      // ========== Auth Routes ==========
      if (path === '/auth/google' && method === 'GET') {
        response = await handleAuthRoutes.startAuth(env);
      } else if (path === '/auth/callback' && method === 'GET') {
        response = await handleAuthRoutes.callback(request, env);
      } else if (path === '/auth/logout' && method === 'GET') {
        response = await handleAuthRoutes.logout(env);
      }

      // ========== Dashboard API (auth required) ==========
      else if (path.startsWith('/api/dashboard/')) {
        const session = await getSession(request, env);
        if (!session) {
          response = jsonResponse({ error: 'Unauthorized' }, 401);
        } else if (path === '/api/dashboard/settings' && method === 'GET') {
          response = await handleSettingsRoutes.getDashboard(session.userId, env);
        } else if (path === '/api/dashboard/settings' && method === 'PUT') {
          response = await handleSettingsRoutes.update(request, session.userId, env);
        } else if (path === '/api/dashboard/bookings' && method === 'GET') {
          response = await handleBookingsRoutes.list(session.userId, env);
        } else if (path === '/api/dashboard/me' && method === 'GET') {
          const user = await getUserById(env.DB, session.userId);
          if (!user) {
            response = jsonResponse({ error: 'User not found' }, 404);
          } else {
            response = jsonResponse({
              id: user.id,
              email: user.email,
              name: user.name,
              slug: user.slug,
              avatarUrl: user.avatar_url,
            });
          }
        }
      }

      // ========== Public API (slug-based) ==========
      else if (path.startsWith('/api/u/')) {
        const slugMatch = path.match(/^\/api\/u\/([^/]+)\/(.+)$/);
        if (slugMatch) {
          const slug = slugMatch[1];
          const action = slugMatch[2];

          if (action === 'settings' && method === 'GET') {
            response = await handleSettingsRoutes.getPublic(slug, env);
          } else if (action === 'events' && method === 'GET') {
            response = await handleEventsRoute(request, slug, env);
          } else if (action === 'slots' && method === 'GET') {
            response = await handleSlotsRoute(request, slug, env);
          } else if (action === 'bookings' && method === 'POST') {
            response = await handleBookingsRoutes.create(request, slug, env);
          }
        }
      }

      // ========== Dashboard Page ==========
      else if (path === '/dashboard' || path === '/dashboard/') {
        const session = await getSession(request, env);
        if (!session) {
          return Response.redirect(`${env.BASE_URL}/`, 302);
        }
        return Response.redirect(`${env.BASE_URL}/dashboard.html`, 302);
      }

      // ========== Slug-based Booking Page ==========
      else if (method === 'GET' && path.match(/^\/[a-z0-9][a-z0-9_-]*\/?$/)) {
        const slug = path.replace(/^\//, '').replace(/\/$/, '');
        const reserved = ['dashboard', 'favicon.ico', 'robots.txt', 'booking.html', 'dashboard.html'];
        if (!reserved.includes(slug)) {
          const user = await getUserBySlug(env.DB, slug);
          if (user) {
            return Response.redirect(`${env.BASE_URL}/booking.html?s=${slug}`, 302);
          }
          return htmlResponse(notFoundPage(slug), 404);
        }
      }

      // ========== API response with CORS ==========
      if (response) {
        const newHeaders = new Headers(response.headers);
        for (const [key, value] of Object.entries(corsHeaders)) {
          newHeaders.set(key, value);
        }
        return new Response(response.body, {
          status: response.status,
          headers: newHeaders,
        });
      }

      // Return 404 for unmatched routes (static assets served by platform)
      return new Response('Not Found', { status: 404 });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal Server Error';
      console.error('API Error:', message);
      return jsonResponse({ error: message }, 500, corsHeaders);
    }
  },
};

/** Helper: extract and verify session from request */
async function getSession(request: Request, env: Env): Promise<SessionPayload | null> {
  const token = getSessionFromRequest(request);
  if (!token) return null;
  return verifySessionToken(token, env.JWT_SECRET);
}

/** Helper to create JSON responses */
export function jsonResponse(
  data: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  });
}

/** Helper to create HTML responses */
function htmlResponse(html: string, status = 200): Response {
  return new Response(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

/** 404 Not Found page */
function notFoundPage(slug: string): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ページが見つかりません - BookMe</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Hiragino Sans', sans-serif;
      background: #F0F4F8; color: #1E293B;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; margin: 0; padding: 20px;
    }
    .card {
      background: #fff; border-radius: 16px;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.07);
      padding: 48px 40px; text-align: center; max-width: 420px;
    }
    .code { font-size: 4rem; font-weight: 800; color: #E2E8F0; margin-bottom: 8px; }
    h1 { font-size: 1.3rem; margin-bottom: 8px; }
    p { color: #64748B; font-size: 0.9rem; margin-bottom: 24px; }
    .slug { font-family: monospace; background: #F1F5F9; padding: 2px 8px; border-radius: 4px; }
    a {
      display: inline-block; padding: 12px 28px;
      background: #4F46E5; color: white; border-radius: 8px;
      text-decoration: none; font-weight: 600; font-size: 0.9rem;
      transition: background 0.15s;
    }
    a:hover { background: #4338CA; }
  </style>
</head>
<body>
  <div class="card">
    <div class="code">404</div>
    <h1>ページが見つかりません</h1>
    <p><span class="slug">/${slug}</span> は存在しないか、まだ公開されていません。</p>
    <a href="/">BookMe トップへ</a>
  </div>
</body>
</html>`;
}
