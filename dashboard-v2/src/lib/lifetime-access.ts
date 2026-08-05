/** Comma-separated GitHub logins with lifetime Pro (case-insensitive). */
export function lifetimeProGithubLogins(): string[] {
  const raw = process.env.LIFETIME_PRO_GITHUB || 'UGilfoyle';
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isLifetimeProGithub(login?: string | null): boolean {
  if (!login?.trim()) return false;
  return lifetimeProGithubLogins().includes(login.trim().toLowerCase());
}
