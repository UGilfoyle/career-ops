/** Geo-priced Pro plan — Resume Studio + unlimited Copilot + Interview Practice. */

export type ProPlanRegion = {
  country: string;
  currency: 'usd' | 'inr' | 'eur' | 'gbp' | 'cad' | 'aud' | 'sgd' | 'jpy' | 'aed';
  amountMinor: number;
  display: string;
  stripePriceId?: string;
  manualCheckoutUrl?: string;
};

const USD = process.env.STRIPE_PRICE_USD || process.env.NEXT_PUBLIC_STRIPE_PRICE_USD || '';
const INR = process.env.STRIPE_PRICE_INR || process.env.NEXT_PUBLIC_STRIPE_PRICE_INR || '';

export const COPILOT_FREE_LIMIT = 10;
export const COPILOT_FREE_WINDOW_MS = 2 * 60 * 60 * 1000;

/** Free Interview Practice: 1 JD pack per rolling 7 days. Pro = unlimited. */
export const PRACTICE_FREE_LIMIT = 1;
export const PRACTICE_FREE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

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
      amountMinor: 89,
      display: '€0.89',
      stripePriceId: process.env.STRIPE_PRICE_EUR,
      manualCheckoutUrl: process.env.BILLING_CHECKOUT_URL_EU,
    };
  }

  if (cc === 'CA') {
    return {
      country: 'CA',
      currency: 'cad',
      amountMinor: 139,
      display: 'C$1.39',
      stripePriceId: process.env.STRIPE_PRICE_CAD,
      manualCheckoutUrl: process.env.BILLING_CHECKOUT_URL_CA,
    };
  }

  if (cc === 'AU') {
    return {
      country: 'AU',
      currency: 'aud',
      amountMinor: 149,
      display: 'A$1.49',
      stripePriceId: process.env.STRIPE_PRICE_AUD,
      manualCheckoutUrl: process.env.BILLING_CHECKOUT_URL_AU,
    };
  }

  if (cc === 'SG') {
    return {
      country: 'SG',
      currency: 'sgd',
      amountMinor: 129,
      display: 'S$1.29',
      stripePriceId: process.env.STRIPE_PRICE_SGD,
      manualCheckoutUrl: process.env.BILLING_CHECKOUT_URL_SG,
    };
  }

  if (cc === 'JP') {
    return {
      country: 'JP',
      currency: 'jpy',
      amountMinor: 149,
      display: '¥149',
      stripePriceId: process.env.STRIPE_PRICE_JPY,
      manualCheckoutUrl: process.env.BILLING_CHECKOUT_URL_JP,
    };
  }

  if (cc === 'AE') {
    return {
      country: 'AE',
      currency: 'aed',
      amountMinor: 369,
      display: 'AED 3.69',
      stripePriceId: process.env.STRIPE_PRICE_AED,
      manualCheckoutUrl: process.env.BILLING_CHECKOUT_URL_AE,
    };
  }

  return {
    country: cc || 'US',
    currency: 'usd',
    amountMinor: 99,
    display: '$0.99',
    stripePriceId: USD || undefined,
    manualCheckoutUrl: process.env.BILLING_CHECKOUT_URL_US,
  };
}

export function planSubtitle(plan: ProPlanRegion): string {
  return `${plan.display}/month · Resume Studio + unlimited Copilot + Interview Practice`;
}
