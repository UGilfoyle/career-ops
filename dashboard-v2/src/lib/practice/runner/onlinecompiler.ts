import type { PracticeRunLanguage, PracticeRunRequest, PracticeRunResult } from './types';

const DEFAULT_BASE = 'https://api.onlinecompiler.io';

/** Map practice language → OnlineCompiler.io compiler id. */
export const ONLINECOMPILER_COMPILER: Record<PracticeRunLanguage, string> = {
  python: 'python-3.14',
  typescript: 'typescript-deno',
  // No Node runtime on OnlineCompiler — Deno TS mode runs JS-ish snippets.
  javascript: 'typescript-deno',
  java: 'openjdk-25',
  cpp: 'g++-15',
  c: 'gcc-15',
  go: 'go-1.26',
  rust: 'rust-1.93',
  ruby: 'ruby-4.0',
  php: 'php-8.5',
};

type OcSyncResponse = {
  output?: string;
  error?: string;
  status?: string;
  exit_code?: number | null;
  signal?: number | null;
  time?: string | number | null;
  total?: string | number | null;
  memory?: string | number | null;
  detail?: string;
  message?: string;
};

function numOrNull(v: string | number | null | undefined): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function runWithOnlineCompiler(
  req: PracticeRunRequest,
  opts?: { apiKey?: string; baseUrl?: string; fetchImpl?: typeof fetch },
): Promise<PracticeRunResult> {
  const apiKey = (opts?.apiKey ?? process.env.ONLINECOMPILER_API_KEY ?? '').trim();
  const baseUrl = (opts?.baseUrl ?? process.env.ONLINECOMPILER_BASE_URL ?? DEFAULT_BASE).replace(
    /\/$/,
    '',
  );
  const fetchImpl = opts?.fetchImpl ?? fetch;
  const compiler = ONLINECOMPILER_COMPILER[req.language];

  if (!apiKey) {
    return {
      ok: false,
      provider: 'onlinecompiler',
      language: req.language,
      compiler,
      stdout: '',
      stderr: '',
      exitCode: null,
      timedOut: false,
      timeSec: null,
      memoryKb: null,
      status: 'misconfigured',
      error:
        'ONLINECOMPILER_API_KEY is not set. Create a free API key at https://onlinecompiler.io (no credit card).',
    };
  }

  const url = `${baseUrl}/api/run-code-sync/`;
  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: 'POST',
      headers: {
        Authorization: apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        compiler,
        code: req.code,
        input: req.stdin ?? '',
      }),
    });
  } catch (e) {
    return {
      ok: false,
      provider: 'onlinecompiler',
      language: req.language,
      compiler,
      stdout: '',
      stderr: '',
      exitCode: null,
      timedOut: false,
      timeSec: null,
      memoryKb: null,
      status: 'network_error',
      error: e instanceof Error ? e.message : 'Failed to reach OnlineCompiler',
    };
  }

  const rawText = await res.text();
  let data: OcSyncResponse = {};
  try {
    data = rawText ? (JSON.parse(rawText) as OcSyncResponse) : {};
  } catch {
    data = { error: rawText.slice(0, 500) };
  }

  if (!res.ok) {
    const msg =
      data.detail ||
      data.message ||
      data.error ||
      `OnlineCompiler HTTP ${res.status}`;
    return {
      ok: false,
      provider: 'onlinecompiler',
      language: req.language,
      compiler,
      stdout: String(data.output || ''),
      stderr: String(data.error || ''),
      exitCode: data.exit_code ?? null,
      timedOut: res.status === 408 || /timeout/i.test(String(msg)),
      timeSec: numOrNull(data.time ?? data.total),
      memoryKb: numOrNull(data.memory),
      status: res.status === 429 ? 'rate_limited' : 'http_error',
      error: String(msg).slice(0, 800),
    };
  }

  const exitCode = data.exit_code ?? (data.status === 'success' ? 0 : 1);
  const stderr = String(data.error || '');
  const stdout = String(data.output || '');
  const timedOut = exitCode === 124 || /timeout/i.test(stderr);
  const ok = data.status === 'success' && exitCode === 0 && !timedOut;

  return {
    ok,
    provider: 'onlinecompiler',
    language: req.language,
    compiler,
    stdout,
    stderr,
    exitCode,
    timedOut,
    timeSec: numOrNull(data.time ?? data.total),
    memoryKb: numOrNull(data.memory),
    status: String(data.status || (ok ? 'success' : 'error')),
  };
}
