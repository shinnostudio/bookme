/**
 * Stripe API Service
 * Handles Checkout Sessions, Customer Portal, and Webhook verification
 */
import { Env } from '../types';

const STRIPE_API = 'https://api.stripe.com/v1';

/** Make a Stripe API request */
async function stripeRequest(
  path: string,
  secretKey: string,
  method: 'GET' | 'POST' = 'POST',
  body?: Record<string, string>
): Promise<Record<string, unknown>> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${secretKey}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  const response = await fetch(`${STRIPE_API}${path}`, {
    method,
    headers,
    body: body ? new URLSearchParams(body).toString() : undefined,
  });

  const data = (await response.json()) as Record<string, unknown>;

  if (!response.ok) {
    const error = data.error as Record<string, string> | undefined;
    throw new Error(`Stripe API error: ${error?.message || response.status}`);
  }

  return data;
}

/** Create a Stripe Checkout Session for subscription */
export async function createCheckoutSession(
  env: Env,
  userId: number,
  email: string,
  stripeCustomerId?: string
): Promise<string> {
  const params: Record<string, string> = {
    mode: 'subscription',
    'line_items[0][price]': env.STRIPE_PRICE_ID,
    'line_items[0][quantity]': '1',
    success_url: `${env.BASE_URL}/dashboard.html?billing=success`,
    cancel_url: `${env.BASE_URL}/dashboard.html?billing=cancel`,
    'metadata[user_id]': String(userId),
  };

  if (stripeCustomerId) {
    params.customer = stripeCustomerId;
  } else {
    params.customer_email = email;
  }

  const session = await stripeRequest('/checkout/sessions', env.STRIPE_SECRET_KEY, 'POST', params);
  return session.url as string;
}

/** Create a Stripe Customer Portal session */
export async function createPortalSession(
  env: Env,
  stripeCustomerId: string
): Promise<string> {
  const session = await stripeRequest(
    '/billing_portal/sessions',
    env.STRIPE_SECRET_KEY,
    'POST',
    {
      customer: stripeCustomerId,
      return_url: `${env.BASE_URL}/dashboard.html`,
    }
  );
  return session.url as string;
}

/** Verify Stripe webhook signature (using Web Crypto API) */
export async function verifyWebhookSignature(
  payload: string,
  sigHeader: string,
  webhookSecret: string
): Promise<boolean> {
  const parts = sigHeader.split(',');
  let timestamp = '';
  let signatures: string[] = [];

  for (const part of parts) {
    const [key, value] = part.split('=');
    if (key === 't') timestamp = value;
    if (key === 'v1') signatures.push(value);
  }

  if (!timestamp || signatures.length === 0) return false;

  // Check timestamp tolerance (5 minutes)
  const ts = parseInt(timestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > 300) return false;

  // Compute expected signature
  const signedPayload = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(webhookSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBytes = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(signedPayload)
  );

  const expectedSig = Array.from(new Uint8Array(signatureBytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return signatures.includes(expectedSig);
}
