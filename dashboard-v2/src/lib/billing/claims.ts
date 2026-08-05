/** UPI claim state machine — keeps one live claim per user so retries never duplicate rows. */

export type ClaimStatus = 'pending' | 'approved' | 'rejected';

export type ClaimRow = {
  id: number;
  userId: string;
  status: string;
  utr: string;
  createdAt?: string | Date | null;
  reviewedAt?: string | Date | null;
};

export type ClaimDecision =
  | { action: 'already_pro' }
  | { action: 'invalid_utr' }
  | { action: 'utr_taken_by_other_user' }
  | { action: 'reuse_own_claim'; claim: ClaimRow }
  | { action: 'awaiting_review'; claim: ClaimRow }
  | { action: 'create' };

export const UTR_PATTERN = /^[0-9A-Z]{8,22}$/;

export function normalizeUtr(raw: unknown): string {
  return String(raw ?? '').replace(/\s+/g, '').toUpperCase();
}

export function isValidUtr(utr: string): boolean {
  return UTR_PATTERN.test(utr);
}

export function decideClaimSubmission(input: {
  userId: string | number;
  hasPro: boolean;
  utr: string;
  /** Claim already stored against this exact UTR, if any. */
  sameUtrClaim?: ClaimRow | null;
  /** Latest still-open claim for this user, if any. */
  openClaim?: ClaimRow | null;
}): ClaimDecision {
  if (input.hasPro) return { action: 'already_pro' };

  const utr = normalizeUtr(input.utr);
  if (!isValidUtr(utr)) return { action: 'invalid_utr' };

  const userId = String(input.userId);

  if (input.sameUtrClaim) {
    return String(input.sameUtrClaim.userId) === userId
      ? { action: 'reuse_own_claim', claim: input.sameUtrClaim }
      : { action: 'utr_taken_by_other_user' };
  }

  // A different UTR while one is still under review must not create a second row.
  if (input.openClaim && input.openClaim.status === 'pending') {
    return { action: 'awaiting_review', claim: input.openClaim };
  }

  return { action: 'create' };
}

export function claimMessage(status: string): string {
  if (status === 'approved') return 'Payment verified. Pro is active.';
  if (status === 'rejected') {
    return 'We could not match this payment. Submit the correct UTR or contact support.';
  }
  return 'Payment is under verification. You will get the Pro access email once approved.';
}

/** True when the user should not be asked to pay again. */
export function blocksNewPayment(status?: string | null): boolean {
  return status === 'pending' || status === 'approved';
}
