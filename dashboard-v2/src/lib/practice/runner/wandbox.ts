import type { PracticeRunLanguage, PracticeRunRequest, PracticeRunResult } from './types';

const WANDBOX_API_URL = 'https://wandbox.org/api/compile.json';

/** Map practice language → Wandbox compiler ID */
export const WANDBOX_COMPILER: Record<PracticeRunLanguage, string> = {
  python: 'cpython-3.14.0',
  javascript: 'nodejs-20.17.0',
  typescript: 'typescript-5.6.2',
  go: 'go-1.23.2',
  rust: 'rust-1.82.0',
  cpp: 'gcc-head',
  c: 'gcc-head-c',
  java: 'openjdk-jdk-22+36',
  ruby: 'ruby-3.4.9',
  php: 'php-8.3.12',
};

type WandboxCompileResponse = {
  status?: string | number;
  signal?: string;
  compiler_output?: string;
  compiler_error?: string;
  compiler_message?: string;
  program_output?: string;
  program_error?: string;
  program_message?: string;
  permlink?: string;
  url?: string;
  message?: string;
};

export async function runWithWandbox(
  req: PracticeRunRequest,
  opts?: { fetchImpl?: typeof fetch; timeoutMs?: number },
): Promise<PracticeRunResult> {
  const fetchImpl = opts?.fetchImpl ?? fetch;
  const timeoutMs = opts?.timeoutMs ?? 15000;
  const compiler = WANDBOX_COMPILER[req.language] || 'nodejs-20.17.0';

  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetchImpl(WANDBOX_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        compiler,
        code: req.code,
        stdin: req.stdin ?? '',
        'compiler-option-raw': compiler.startsWith('gcc') ? '-Wall -O2' : undefined,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const durationSec = (Date.now() - startTime) / 1000;

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return {
        ok: false,
        provider: 'piston',
        language: req.language,
        compiler,
        stdout: '',
        stderr: errText.slice(0, 800) || `Wandbox HTTP ${res.status}`,
        exitCode: res.status,
        timedOut: false,
        timeSec: durationSec,
        memoryKb: null,
        status: 'http_error',
        error: `Wandbox API error (${res.status})`,
      };
    }

    const data: WandboxCompileResponse = await res.json().catch(() => ({}));
    const rawExitCode = data.status != null ? Number(data.status) : 0;
    const isSuccess = rawExitCode === 0 && !data.compiler_error;
    const stdout = (data.program_output || data.compiler_output || '').trim();
    const stderr = [data.compiler_error, data.program_error].filter(Boolean).join('\n').trim();

    return {
      ok: isSuccess,
      provider: 'piston',
      language: req.language,
      compiler,
      stdout: stdout || (isSuccess ? 'Code executed successfully (no stdout produced).' : ''),
      stderr,
      exitCode: rawExitCode,
      timedOut: Boolean(data.signal?.includes('KILL') || data.signal?.includes('ABRT')),
      timeSec: durationSec,
      memoryKb: null,
      status: isSuccess ? 'ok' : 'error',
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    const durationSec = (Date.now() - startTime) / 1000;
    const isTimeout = err?.name === 'AbortError' || /timeout/i.test(String(err));

    return {
      ok: false,
      provider: 'piston',
      language: req.language,
      compiler,
      stdout: '',
      stderr: isTimeout ? 'Execution timed out (15s limit).' : String(err?.message || err),
      exitCode: isTimeout ? 124 : -1,
      timedOut: isTimeout,
      timeSec: durationSec,
      memoryKb: null,
      status: isTimeout ? 'timeout' : 'network_error',
      error: err?.message || 'Wandbox execution failed',
    };
  }
}
