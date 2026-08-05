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

/**
 * Mask a VPA for display. The full handle only reaches the payer's UPI app via
 * the QR / deep link, so it is never harvestable from the page as plain text.
 */
export function maskVpa(vpa: string): string {
  const [handle = '', bank = ''] = String(vpa).split('@');
  if (!handle) return '••••';
  const visible = handle.length <= 4 ? 1 : 2;
  const head = handle.slice(0, visible);
  const tail = handle.length > visible * 2 ? handle.slice(-visible) : '';
  const dots = '•'.repeat(Math.max(4, handle.length - head.length - tail.length));
  const masked = `${head}${dots}${tail}`;
  return bank ? `${masked}@${bank}` : masked;
}

/** Short ref shown in UPI apps so you can match bank SMS to a user. */
export function upiTransactionRef(userId: string | number): string {
  return `CO${String(userId).replace(/\D/g, '').slice(-8)}${Date.now().toString(36).slice(-4).toUpperCase()}`;
}

export function qrCodeImageUrl(upiUri: string, size = 220): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(upiUri)}`;
}
