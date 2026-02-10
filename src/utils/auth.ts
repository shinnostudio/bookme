/**
 * Simple admin authentication
 * Uses a shared password stored as a Cloudflare secret
 */
import { Env } from '../types';

/** Verify admin password from Authorization header (Bearer token) */
export function verifyAdmin(request: Request, env: Env): boolean {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return false;

  const token = authHeader.replace('Bearer ', '');
  return token === env.ADMIN_PASSWORD;
}

/** Verify admin password from request body */
export function verifyPassword(password: string, env: Env): boolean {
  return password === env.ADMIN_PASSWORD;
}
