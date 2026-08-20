export function isPrefetchRequest(headers: Headers): boolean {
  return (
    headers.get('sec-purpose') === 'prefetch' ||
    headers.get('purpose') === 'prefetch'
  );
}

export function isBotUserAgent(ua: string): boolean {
  const lower = ua.toLowerCase();
  return (
    lower.includes('bot') ||
    lower.includes('spider') ||
    lower.includes('crawler') ||
    lower.includes('preview') ||
    lower.includes('slurp')
  );
}

export function clientIpFromHeaders(headers: Headers): string {
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    '127.0.0.1'
  );
}
