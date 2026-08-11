import type { PracticeRunLanguage, PracticeRunRequest, PracticeRunResult } from './types';

/** Piston language aliases for when PRACTICE_RUNNER_PROVIDER=piston. */
export const PISTON_LANGUAGE: Record<PracticeRunLanguage, string> = {
  python: 'python',
  typescript: 'typescript',
  javascript: 'javascript',
  java: 'java',
  cpp: 'c++',
  c: 'c',
  go: 'go',
  rust: 'rust',
  ruby: 'ruby',
  php: 'php',
};

type PistonExecuteResponse = {
  language?: string;
  version?: string;
  run?: {
    stdout?: string;
    stderr?: string;
    code?: number | null;
    signal?: string | null;
    output?: string;
    status?: string | null;
  };
  compile?: {
    stdout?: string;
    stderr?: string;
    code?: number | null;
  };
  message?: string;
};

export async function runWithPiston(
  req: PracticeRunRequest,
  opts?: { baseUrl?: string; apiKey?: string; fetchImpl?: typeof fetch },
): Promise<PracticeRunResult> {
  const baseUrl = (opts?.baseUrl ?? process.env.PISTON_URL ?? '').replace(/\/$/, '');
  const apiKey = (opts?.apiKey ?? process.env.PISTON_API_KEY ?? '').trim();
  const fetchImpl = opts?.fetchImpl ?? fetch;
  const language = PISTON_LANGUAGE[req.language];

  if (!baseUrl) {
    return {
      ok: false,
      provider: 'piston',
      language: req.language,
      compiler: language,
      stdout: '',
      stderr: '',
      exitCode: null,
      timedOut: false,
      timeSec: null,
      memoryKb: null,
      status: 'misconfigured',
      error: 'PISTON_URL is not set. Point it at your self-hosted Piston API (e.g. http://host:2000).',
    };
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers.Authorization = apiKey;

  let res: Response;
  try {
    res = await fetchImpl(`${baseUrl}/api/v2/execute`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        language,
        version: '*',
        files: [{ content: req.code }],
        stdin: req.stdin ?? '',
      }),
    });
  } catch (e) {
    return {
      ok: false,
      provider: 'piston',
      language: req.language,
      compiler: language,
      stdout: '',
      stderr: '',
      exitCode: null,
      timedOut: false,
      timeSec: null,
      memoryKb: null,
      status: 'network_error',
      error: e instanceof Error ? e.message : 'Failed to reach Piston',
    };
  }

  const rawText = await res.text();
  let data: PistonExecuteResponse = {};
  try {
    data = rawText ? (JSON.parse(rawText) as PistonExecuteResponse) : {};
  } catch {
    data = { message: rawText.slice(0, 500) };
  }

  if (!res.ok) {
    return {
      ok: false,
      provider: 'piston',
      language: req.language,
      compiler: language,
      stdout: '',
      stderr: '',
      exitCode: null,
      timedOut: false,
      timeSec: null,
      memoryKb: null,
      status: 'http_error',
      error: String(data.message || `Piston HTTP ${res.status}`).slice(0, 800),
    };
  }

  const compileErr = String(data.compile?.stderr || '');
  const stdout = String(data.run?.stdout || '');
  const stderr = [compileErr, String(data.run?.stderr || '')].filter(Boolean).join('\n');
  const exitCode = data.run?.code ?? data.compile?.code ?? null;
  const timedOut = /time|timeout/i.test(String(data.run?.status || '')) || data.run?.signal === 'SIGKILL';
  const ok = exitCode === 0 && !compileErr && !timedOut;

  return {
    ok,
    provider: 'piston',
    language: req.language,
    compiler: `${data.language || language}${data.version ? `@${data.version}` : ''}`,
    stdout,
    stderr,
    exitCode,
    timedOut,
    timeSec: null,
    memoryKb: null,
    status: ok ? 'success' : timedOut ? 'timeout' : 'error',
  };
}
