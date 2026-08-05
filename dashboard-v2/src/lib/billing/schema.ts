import type postgres from 'postgres';

/** Idempotent billing tables. */
export async function ensureBillingSchema(sql: postgres.Sql): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS user_subscriptions (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'inactive',
      plan TEXT NOT NULL DEFAULT 'pro_monthly',
      country_code TEXT,
      currency TEXT,
      amount_minor INT,
      provider TEXT,
      external_customer_id TEXT,
      external_subscription_id TEXT,
      current_period_end TIMESTAMPTZ,
      access_email_sent_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS user_subscriptions_status_idx
    ON user_subscriptions (status)
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS upi_payment_claims (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_email TEXT NOT NULL,
      amount_inr NUMERIC(10,2) NOT NULL,
      upi_vpa TEXT NOT NULL,
      transaction_ref TEXT,
      utr TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      reviewed_at TIMESTAMPTZ,
      reviewed_by TEXT
    )
  `;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS upi_payment_claims_utr_uidx
    ON upi_payment_claims (utr)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS upi_payment_claims_status_idx
    ON upi_payment_claims (status)
  `;
}

export type SubscriptionRow = {
  user_id: string;
  status: string;
  plan: string;
  country_code: string | null;
  currency: string | null;
  amount_minor: number | null;
  current_period_end: Date | null;
};
