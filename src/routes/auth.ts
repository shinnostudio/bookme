/**
 * Admin Authentication Route
 * POST /api/admin/login
 */
import { Env } from '../types';
import { verifyPassword } from '../utils/auth';
import { jsonResponse } from '../index';

export async function handleAuthRoute(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as { password?: string };

  if (!body.password) {
    return jsonResponse({ error: 'パスワードを入力してください' }, 400);
  }

  if (!verifyPassword(body.password, env)) {
    return jsonResponse({ error: 'パスワードが正しくありません' }, 401);
  }

  // Return the password as the token (simple auth)
  // In production you'd want JWT or session-based auth
  return jsonResponse({ token: env.ADMIN_PASSWORD });
}
