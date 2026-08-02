import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import {
  ensureNewsletterSchema,
  verifyUnsubscribeToken,
} from '@/lib/newsletter';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function htmlPage(title: string, body: string) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title}</title>
<style>
  body{font-family:Inter,system-ui,sans-serif;background:#FAFAF8;color:#1C1C1E;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:24px;}
  .card{max-width:420px;background:#fff;border:1px solid #E5E5E0;border-radius:28px;padding:40px;text-align:center;}
  h1{font-size:22px;margin:0 0 12px;} p{color:#6B6B6B;font-size:14px;line-height:1.5;margin:0 0 24px;}
  a{color:#1C1C1E;font-weight:700;}
</style></head><body><div class="card">${body}</div></body></html>`;
}

async function unsubscribe(token: string | null) {
  if (!token) {
    return { ok: false as const, status: 400, message: 'Missing unsubscribe token.' };
  }
  const userId = verifyUnsubscribeToken(token);
  if (!userId) {
    return { ok: false as const, status: 400, message: 'Invalid or expired unsubscribe link.' };
  }

  await ensureNewsletterSchema(sql);
  await sql`
    UPDATE users
    SET
      newsletter_opt_in = false,
      newsletter_unsubscribed_at = COALESCE(newsletter_unsubscribed_at, NOW())
    WHERE id = ${userId}
  `;

  return { ok: true as const, status: 200, message: 'You are unsubscribed from monthly Career-Ops emails.' };
}

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('token');
  const result = await unsubscribe(token);
  const body = result.ok
    ? `<h1>Unsubscribed</h1><p>${result.message}</p><p><a href="/">Back to Career-Ops</a></p>`
    : `<h1>Could not unsubscribe</h1><p>${result.message}</p><p><a href="/">Back to Career-Ops</a></p>`;
  return new NextResponse(htmlPage(result.ok ? 'Unsubscribed' : 'Unsubscribe failed', body), {
    status: result.status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

export async function POST(req: Request) {
  const urlToken = new URL(req.url).searchParams.get('token');
  const body = await req.json().catch(() => ({}));
  const token = urlToken || (body as { token?: string })?.token || null;
  const result = await unsubscribe(token);
  return NextResponse.json(
    { success: result.ok, message: result.message },
    { status: result.status }
  );
}
