import { runWithWandbox } from './wandbox';
import { runWithOnlineCompiler } from './onlinecompiler';
import { runWithPiston } from './piston';
import { runWithLocalNode, runWithLocalCLI } from './local';
import {
  PRACTICE_RUN_MAX_CODE_BYTES,
  PRACTICE_RUN_MAX_STDIN_BYTES,
  isPracticeRunLanguage,
  type PracticeRunLanguage,
  type PracticeRunRequest,
  type PracticeRunResult,
} from './types';

export type PracticeRunnerProvider = 'auto' | 'wandbox' | 'onlinecompiler' | 'piston' | 'local';

export function resolvePracticeRunnerProvider(
  raw = process.env.PRACTICE_RUNNER_PROVIDER,
): PracticeRunnerProvider {
  const v = String(raw || '').trim().toLowerCase();
  if (v === 'wandbox') return 'wandbox';
  if (v === 'piston') return 'piston';
  if (v === 'onlinecompiler') return 'onlinecompiler';
  if (v === 'local') return 'local';
  if (process.env.ONLINECOMPILER_API_KEY) return 'onlinecompiler';
  if (process.env.PISTON_URL) return 'piston';
  return 'auto';
}

export function validatePracticeRunInput(body: {
  language?: unknown;
  code?: unknown;
  stdin?: unknown;
}): { ok: true; req: PracticeRunRequest } | { ok: false; error: string } {
  const language = String(body.language || '').trim().toLowerCase();
  if (!isPracticeRunLanguage(language)) {
    return {
      ok: false,
      error: `Unsupported language. Use one of: python, typescript, javascript, java, cpp, c, go, rust, ruby, php.`,
    };
  }
  const code = String(body.code ?? '');
  if (!code.trim()) {
    return { ok: false, error: 'Code is required.' };
  }
  if (Buffer.byteLength(code, 'utf8') > PRACTICE_RUN_MAX_CODE_BYTES) {
    return { ok: false, error: `Code exceeds ${PRACTICE_RUN_MAX_CODE_BYTES} byte limit.` };
  }
  const stdin = body.stdin == null ? '' : String(body.stdin);
  if (Buffer.byteLength(stdin, 'utf8') > PRACTICE_RUN_MAX_STDIN_BYTES) {
    return { ok: false, error: `stdin exceeds ${PRACTICE_RUN_MAX_STDIN_BYTES} byte limit.` };
  }
  return {
    ok: true,
    req: { language: language as PracticeRunLanguage, code, stdin },
  };
}

export async function executePracticeRun(
  req: PracticeRunRequest,
  opts?: { provider?: PracticeRunnerProvider },
): Promise<PracticeRunResult> {
  const provider = opts?.provider ?? resolvePracticeRunnerProvider();

  // Explicit provider overrides
  if (provider === 'onlinecompiler') {
    return runWithOnlineCompiler(req);
  }
  if (provider === 'piston') {
    return runWithPiston(req);
  }

  // 1. JavaScript / TypeScript: Safe local isolated VM (0ms network delay, full process mock)
  if (req.language === 'javascript' || req.language === 'typescript') {
    return runWithLocalNode(req);
  }

  // 2. Python: Local python3 spawn if available, fallback to Wandbox
  if (req.language === 'python') {
    const localPy = await runWithLocalCLI(req, 'python3', ['-u'], '.py');
    if (localPy && localPy.status !== 'misconfigured') {
      return localPy;
    }
    return runWithWandbox(req);
  }

  // 3. Ruby: Local ruby spawn if available, fallback to Wandbox
  if (req.language === 'ruby') {
    const localRuby = await runWithLocalCLI(req, 'ruby', [], '.rb');
    if (localRuby && localRuby.status !== 'misconfigured') {
      return localRuby;
    }
    return runWithWandbox(req);
  }

  // 4. Default for compiled languages (Go, Rust, C++, C, Java, PHP): Wandbox Free Cloud API
  return runWithWandbox(req);
}

export {
  PRACTICE_RUN_LANGUAGES,
  PRACTICE_RUN_MAX_CODE_BYTES,
  PRACTICE_RUN_MAX_STDIN_BYTES,
  isPracticeRunLanguage,
} from './types';
export type { PracticeRunLanguage, PracticeRunRequest, PracticeRunResult } from './types';
export { WANDBOX_COMPILER } from './wandbox';
export { ONLINECOMPILER_COMPILER } from './onlinecompiler';
export { PISTON_LANGUAGE } from './piston';
