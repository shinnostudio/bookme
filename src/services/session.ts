/**
 * JWT Session Management
 * Uses HMAC-SHA256 for signing
 */
import { SessionPayload } from '../types';

const SESSION_COOKIE = 'bookme_session';
const SESSION_DURATION = 7 * 24 * 60 * 60; // 7 days in seconds

/** Base64url encode */
function b64url(data: string | ArrayBuffer): string {
  const str =
    typeof data === 'string'
      ? btoa(data)
      : btoa(String.fromCharCode(...new Uint8Array(data)));
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Import HMAC key from secret string */
async function getSigningKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

/** Create a JWT session token */
export async function createSessionToken(
  userId: number,
  email: string,
  secret: string
): Promise<string> {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));

  const payload: SessionPayload = {
    userId,
    email,
    exp: Math.floor(Date.now() / 1000) + SESSION_DURATION,
  };
  const payloadB64 = b64url(JSON.stringify(payload));

  const signingInput = `${header}.${payloadB64}`;
  const key = await getSigningKey(secret);
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(signingInput)
  );

  return `${signingInput}.${b64url(signature)}`;
}

/** Verify and decode a JWT session token */
export async function verifySessionToken(
  token: string,
  secret: string
): Promise<SessionPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, payload, sig] = parts;
    const signingInput = `${header}.${payload}`;

    const key = await getSigningKey(secret);
    const signatureBytes = Uint8Array.from(
      atob(sig.replace(/-/g, '+').replace(/_/g, '/')),
      (c) => c.charCodeAt(0)
    );

    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes,
      new TextEncoder().encode(signingInput)
    );

    if (!valid) return null;

    const decoded = JSON.parse(
      atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    ) as SessionPayload;

    // Check expiration
    if (decoded.exp < Math.floor(Date.now() / 1000)) return null;

    return decoded;
  } catch {
    return null;
  }
}

/** Extract session token from request cookies */
export function getSessionFromRequest(request: Request): string | null {
  const cookie = request.headers.get('Cookie');
  if (!cookie) return null;

  const match = cookie.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
  return match ? match[1] : null;
}

/** Create Set-Cookie header for session */
export function createSessionCookie(token: string, baseUrl: string): string {
  const isSecure = baseUrl.startsWith('https');
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DURATION}${isSecure ? '; Secure' : ''}`;
}

/** Create Set-Cookie header to clear session */
export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
