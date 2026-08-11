/** Comma-separated GitHub logins with lifetime Pro (case-insensitive). */
export function lifetimeProGithubLogins(): string[] {
  const raw = process.env.LIFETIME_PRO_GITHUB || 'UGilfoyle,Gilfoyle';
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** Default lifetime Pro emails when LIFETIME_PRO_EMAILS is unset. */
const DEFAULT_LIFETIME_PRO_EMAILS =
  'akashkaintura.ak@gmail.com,akash.k96.official@gmail.com';

/** Interview Practice live beta — Akash only unless PRACTICE_BETA_EMAILS overrides. */
const DEFAULT_PRACTICE_BETA_EMAILS = 'akash.k96.official@gmail.com';

function splitEmailList(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** Comma-separated emails with lifetime Pro (case-insensitive). */
export function lifetimeProEmails(): string[] {
  return splitEmailList(process.env.LIFETIME_PRO_EMAILS || DEFAULT_LIFETIME_PRO_EMAILS);
}

/** Emails allowed to use live Interview Practice (generate / packs). */
export function practiceBetaEmails(): string[] {
  return splitEmailList(process.env.PRACTICE_BETA_EMAILS || DEFAULT_PRACTICE_BETA_EMAILS);
}

export function isLifetimeProGithub(login?: string | null): boolean {
  if (!login?.trim()) return false;
  return lifetimeProGithubLogins().includes(login.trim().toLowerCase());
}

function gmailLocalBase(local: string): string {
  return local.split('+')[0].replace(/\./g, '');
}

/** Match exact emails; for Gmail/Googlemail also ignore dots and plus-tags. */
function emailMatchesAllowlist(email: string, listed: string[]): boolean {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  if (listed.includes(normalized)) return true;

  const at = normalized.lastIndexOf('@');
  if (at < 0) return false;
  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  if (domain !== 'gmail.com' && domain !== 'googlemail.com') return false;

  const localBase = gmailLocalBase(local);
  return listed.some((entry) => {
    const eAt = entry.lastIndexOf('@');
    if (eAt < 0) return false;
    const eLocal = entry.slice(0, eAt);
    const eDomain = entry.slice(eAt + 1);
    if (eDomain !== 'gmail.com' && eDomain !== 'googlemail.com') return false;
    return gmailLocalBase(eLocal) === localBase;
  });
}

/**
 * True for exact lifetime emails and Gmail local-part variants
 * (dots / plus-tags), e.g. akash.k96.official+dev@gmail.com.
 */
export function isLifetimeProEmail(email?: string | null): boolean {
  if (!email?.trim()) return false;
  return emailMatchesAllowlist(email, lifetimeProEmails());
}

/**
 * Live Interview Practice beta (generate UI + APIs).
 * Default: only akash.k96.official@gmail.com (and Gmail variants).
 */
export function canAccessPracticeBeta(email?: string | null): boolean {
  if (!email?.trim()) return false;
  return emailMatchesAllowlist(email, practiceBetaEmails());
}
