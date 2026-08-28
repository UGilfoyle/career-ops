const MAX_COMMENT = 2000;
const MAX_CONTEXT = 64;

export function parseFeedbackScore(raw: unknown): number | null {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 5) return null;
  return n;
}

export function sanitizeFeedbackComment(raw: unknown): string | null {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  return text.slice(0, MAX_COMMENT);
}

export function sanitizeFeedbackContext(raw: unknown): string | null {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  return text.slice(0, MAX_CONTEXT);
}

export const FEEDBACK_SCORE_LABELS: Record<number, string> = {
  1: 'Not helpful',
  2: 'Needs work',
  3: 'Okay',
  4: 'Good',
  5: 'Love it',
};
