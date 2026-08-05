/** Comma-separated GitHub logins with lifetime Pro (case-insensitive). */
export function lifetimeProGithubLogins(): string[] {
  const raw = process.env.LIFETIME_PRO_GITHUB || 'UGilfoyle,Gilfoyle';
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** Comma-separated emails with lifetime Pro (case-insensitive). */
export function lifetimeProEmails(): string[] {
  const raw = process.env.LIFETIME_PRO_EMAILS || 'akashkaintura.ak@gmail.com';
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isLifetimeProGithub(login?: string | null): boolean {
  if (!login?.trim()) return false;
  return lifetimeProGithubLogins().includes(login.trim().toLowerCase());
}

export function isLifetimeProEmail(email?: string | null): boolean {
  if (!email?.trim()) return false;
  return lifetimeProEmails().includes(email.trim().toLowerCase());
}
