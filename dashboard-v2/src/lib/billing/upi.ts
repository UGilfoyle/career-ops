/** Direct UPI (personal VPA) — zero gateway fees. Link never expires (unlike third-party pay pages). */

export type UpiConfig = {
  vpa: string;
  payeeName: string;
  amountInr: number;
  note: string;
};

export function upiConfigFromEnv(): UpiConfig | null {
  const vpa = process.env.UPI_VPA?.trim();
  if (!vpa) return null;
  const enabled = process.env.BILLING_UPI_ENABLED !== '0';
  if (!enabled) return null;
  return {
    vpa,
    payeeName: process.env.UPI_PAYEE_NAME?.trim() || 'Career-Ops',
    amountInr: Number(process.env.UPI_AMOUNT_INR || '99'),
    note: process.env.UPI_PAY_NOTE?.trim() || 'Career-ops Pro subscription',
  };
}

/** Build static UPI deep link — does not expire. */
export function buildUpiPayUri(cfg: UpiConfig, transactionRef?: string): string {
  const params = new URLSearchParams();
  params.set('pa', cfg.vpa);
  params.set('pn', cfg.payeeName);
  params.set('am', cfg.amountInr.toFixed(2));
  params.set('cu', 'INR');
  params.set('tn', cfg.note);
  if (transactionRef) params.set('tr', transactionRef.slice(0, 35));
  return `upi://pay?${params.toString()}`;
}

/** Short ref shown in UPI apps so you can match bank SMS to a user. */
export function upiTransactionRef(userId: string | number): string {
  return `CO${String(userId).replace(/\D/g, '').slice(-8)}${Date.now().toString(36).slice(-4).toUpperCase()}`;
}

export function qrCodeImageUrl(upiUri: string, size = 220): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(upiUri)}`;
}
