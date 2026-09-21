export function makeHttpCtx() {
  return {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
    },
    timeout: 15000,
  };
}

export async function fetchJson(url, ctx = {}) {
  const headers = { ...(ctx.headers || makeHttpCtx().headers), ...(ctx.extraHeaders || {}) };
  const timeout = ctx.timeout || 15000;
  const res = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(timeout),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} from ${url}`);
  }
  return res.json();
}
