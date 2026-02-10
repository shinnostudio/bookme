/**
 * BookMe v2 - Cloudflare Workers Entry Point
 */
import { Env } from './types';
import { handleSettingsRoutes } from './routes/settings';
import { handleEventsRoute } from './routes/events';
import { handleSlotsRoute } from './routes/slots';
import { handleBookingsRoutes } from './routes/bookings';
import { handleAuthRoute } from './routes/auth';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS headers
    const corsHeaders: Record<string, string> = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      let response: Response;

      // API Routes
      if (path === '/api/settings' && method === 'GET') {
        response = await handleSettingsRoutes.getPublic(env);
      } else if (path === '/api/admin/settings' && method === 'GET') {
        response = await handleSettingsRoutes.getAdmin(request, env);
      } else if (path === '/api/admin/settings' && method === 'PUT') {
        response = await handleSettingsRoutes.update(request, env);
      } else if (path === '/api/events' && method === 'GET') {
        response = await handleEventsRoute(request, env);
      } else if (path === '/api/slots' && method === 'GET') {
        response = await handleSlotsRoute(request, env);
      } else if (path === '/api/bookings' && method === 'POST') {
        response = await handleBookingsRoutes.create(request, env);
      } else if (path === '/api/admin/bookings' && method === 'GET') {
        response = await handleBookingsRoutes.list(request, env);
      } else if (path === '/api/admin/login' && method === 'POST') {
        response = await handleAuthRoute(request, env);
      } else {
        // Not an API route - let static assets handle it
        return new Response('Not Found', { status: 404 });
      }

      // Add CORS headers to response
      const newHeaders = new Headers(response.headers);
      for (const [key, value] of Object.entries(corsHeaders)) {
        newHeaders.set(key, value);
      }

      return new Response(response.body, {
        status: response.status,
        headers: newHeaders,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal Server Error';
      console.error('API Error:', message);
      return jsonResponse({ error: message }, 500, corsHeaders);
    }
  },
};

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
