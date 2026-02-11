/**
 * Billing Routes
 * POST /api/dashboard/checkout   - Create Stripe Checkout session
 * GET  /api/dashboard/billing    - Get billing info
 * POST /api/dashboard/portal     - Create Stripe Customer Portal session
 * POST /api/webhooks/stripe      - Stripe webhook handler
 */
import { Env } from '../types';
import { getUserById, updateUserPlan, getMonthlyBookingCount } from '../services/db';
import { createCheckoutSession, createPortalSession, verifyWebhookSignature } from '../services/stripe';
import { jsonResponse } from '../index';

const FREE_MONTHLY_LIMIT = 10;

export const handleBillingRoutes = {
  /** POST /api/dashboard/checkout - Create Stripe Checkout Session */
  async checkout(userId: number, env: Env): Promise<Response> {
    const user = await getUserById(env.DB, userId);
    if (!user) return jsonResponse({ error: 'User not found' }, 404);

    if (user.plan === 'pro') {
      return jsonResponse({ error: '既に Pro プランです' }, 400);
    }

    const url = await createCheckoutSession(
      env,
      user.id,
      user.email,
      user.stripe_customer_id || undefined
    );

    return jsonResponse({ url });
  },

  /** GET /api/dashboard/billing - Get billing info */
  async getBilling(userId: number, env: Env): Promise<Response> {
    const user = await getUserById(env.DB, userId);
    if (!user) return jsonResponse({ error: 'User not found' }, 404);

    const monthlyCount = await getMonthlyBookingCount(env.DB, userId);

    return jsonResponse({
      plan: user.plan || 'free',
      monthlyBookings: monthlyCount,
      monthlyLimit: user.plan === 'pro' ? null : FREE_MONTHLY_LIMIT,
      hasStripeCustomer: !!user.stripe_customer_id,
    });
  },

  /** POST /api/dashboard/portal - Create Stripe Customer Portal session */
  async portal(userId: number, env: Env): Promise<Response> {
    const user = await getUserById(env.DB, userId);
    if (!user) return jsonResponse({ error: 'User not found' }, 404);

    if (!user.stripe_customer_id) {
      return jsonResponse({ error: 'Stripe アカウントがありません' }, 400);
    }

    const url = await createPortalSession(env, user.stripe_customer_id);
    return jsonResponse({ url });
  },

  /** POST /api/webhooks/stripe - Stripe Webhook handler */
  async webhook(request: Request, env: Env): Promise<Response> {
    const signature = request.headers.get('stripe-signature');
    if (!signature) {
      return jsonResponse({ error: 'Missing signature' }, 400);
    }

    const payload = await request.text();

    const valid = await verifyWebhookSignature(payload, signature, env.STRIPE_WEBHOOK_SECRET);
    if (!valid) {
      console.error('Stripe webhook signature verification failed');
      return jsonResponse({ error: 'Invalid signature' }, 400);
    }

    const event = JSON.parse(payload) as {
      type: string;
      data: { object: Record<string, unknown> };
    };

    console.log('Stripe webhook event:', event.type);

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object;
          const userId = parseInt(
            (session.metadata as Record<string, string>)?.user_id || '0',
            10
          );
          const customerId = session.customer as string;
          const subscriptionId = session.subscription as string;

          if (userId) {
            await updateUserPlan(env.DB, userId, 'pro', customerId, subscriptionId);
            console.log(`User ${userId} upgraded to pro`);
          }
          break;
        }

        case 'invoice.paid': {
          const invoice = event.data.object;
          const customerId = invoice.customer as string;
          // Confirm subscription is active
          const user = await findUserByStripeCustomer(env, customerId);
          if (user) {
            await updateUserPlan(env.DB, user.id, 'pro');
            console.log(`User ${user.id} subscription renewed`);
          }
          break;
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object;
          const customerId = subscription.customer as string;
          const user = await findUserByStripeCustomer(env, customerId);
          if (user) {
            await updateUserPlan(env.DB, user.id, 'free');
            console.log(`User ${user.id} downgraded to free`);
          }
          break;
        }

        default:
          console.log('Unhandled webhook event:', event.type);
      }
    } catch (err) {
      console.error('Webhook processing error:', err);
    }

    return jsonResponse({ received: true });
  },
};

/** Find a user by Stripe customer ID */
async function findUserByStripeCustomer(env: Env, customerId: string) {
  const row = await env.DB
    .prepare('SELECT * FROM users WHERE stripe_customer_id = ?')
    .bind(customerId)
    .first();
  return row as { id: number } | null;
}
