/** Comma-separated admin emails (case-insensitive). */
export function adminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS || 'admin@career-ops.local';
  return raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return adminEmails().includes(email.trim().toLowerCase());
}

export function adminPassword(): string {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  if (process.env.NODE_ENV !== 'production') return 'career2026';
  return '';
}
