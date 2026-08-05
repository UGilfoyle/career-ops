/** Geo-priced Pro plan — Resume Studio + unlimited Copilot. */

export type ProPlanRegion = {
  country: string;
  currency: 'usd' | 'inr' | 'eur' | 'gbp';
  amountMinor: number;
  display: string;
  stripePriceId?: string;
  manualCheckoutUrl?: string;
};

const USD = process.env.STRIPE_PRICE_USD || process.env.NEXT_PUBLIC_STRIPE_PRICE_USD || '';
const INR = process.env.STRIPE_PRICE_INR || process.env.NEXT_PUBLIC_STRIPE_PRICE_INR || '';

export const COPILOT_FREE_LIMIT = 10;
export const COPILOT_FREE_WINDOW_MS = 2 * 60 * 60 * 1000;

export const PRO_FEATURE = 'pro' as const;

export function resolvePlanForCountry(countryCode?: string | null): ProPlanRegion {
  const cc = String(countryCode || '').trim().toUpperCase();

  if (cc === 'IN') {
    return {
      country: 'IN',
      currency: 'inr',
      amountMinor: 9900,
      display: '₹99',
      stripePriceId: INR || undefined,
      manualCheckoutUrl: process.env.BILLING_CHECKOUT_URL_IN,
    };
  }

  if (cc === 'GB') {
    return {
      country: 'GB',
      currency: 'gbp',
      amountMinor: 79,
      display: '£0.79',
      stripePriceId: process.env.STRIPE_PRICE_GBP,
      manualCheckoutUrl: process.env.BILLING_CHECKOUT_URL_GB,
    };
  }

  if (['DE', 'FR', 'NL', 'ES', 'IT', 'BE', 'AT', 'IE', 'PT'].includes(cc)) {
    return {
      country: cc,
      currency: 'eur',
      amountMinor: 79,
      display: '€0.79',
      stripePriceId: process.env.STRIPE_PRICE_EUR,
      manualCheckoutUrl: process.env.BILLING_CHECKOUT_URL_EU,
    };
  }

  return {
    country: cc || 'US',
    currency: 'usd',
    amountMinor: 79,
    display: '$0.79',
    stripePriceId: USD || undefined,
    manualCheckoutUrl: process.env.BILLING_CHECKOUT_URL_US,
  };
}

export function planSubtitle(plan: ProPlanRegion): string {
  return `${plan.display}/month · Resume Studio + unlimited Copilot`;
}
