-- BookMe Billing: Add plan and Stripe fields to users
ALTER TABLE users ADD COLUMN plan TEXT DEFAULT 'free';
ALTER TABLE users ADD COLUMN stripe_customer_id TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN stripe_subscription_id TEXT DEFAULT '';
