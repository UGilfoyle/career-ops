import { upiConfigFromEnv } from './upi';

/**
 * Stripe is opt-in when UPI is configured (zero gateway fees).
 * Set BILLING_STRIPE_ENABLED=1 + STRIPE_SECRET_KEY to allow card checkout.
 */
export function stripeBillingEnabled(): boolean {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  const flag = process.env.BILLING_STRIPE_ENABLED?.trim();

  if (flag === '1') return Boolean(key);
  if (flag === '0') return false;

  // Default: UPI configured → do not hit Stripe (Path 1).
  if (upiConfigFromEnv()) return false;
  return Boolean(key);
}

/** True when checkout should route to /billing/upi instead of Stripe. */
export function shouldUseUpiCheckout(countryCode?: string | null): boolean {
  const cfg = upiConfigFromEnv();
  if (!cfg) return false;

  const cc = String(countryCode || '').trim().toUpperCase();
  if (cc === 'IN') return true;

  // Optional: accept UPI from any geo (diaspora on VPN, etc.)
  return process.env.BILLING_UPI_GLOBAL === '1';
}
