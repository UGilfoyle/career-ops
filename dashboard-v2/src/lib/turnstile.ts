/** Cloudflare Turnstile — optional; skipped when TURNSTILE_SECRET_KEY is unset. */

export function turnstileEnabled(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY?.trim());
}

export function turnstileSiteKey(): string | null {
  const key = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
  return key || null;
}

export async function verifyTurnstile(token: string | undefined | null, ip?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) return true;
  if (!token?.trim()) return false;

  try {
    const body = new URLSearchParams({
      secret,
      response: token.trim(),
      ...(ip && ip !== "unknown" ? { remoteip: ip } : {}),
    });

    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
    });

    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
