import { runWithOnlineCompiler } from './onlinecompiler';
import { runWithPiston } from './piston';
import { runWithLocalNode } from './local';
import {
  PRACTICE_RUN_MAX_CODE_BYTES,
  PRACTICE_RUN_MAX_STDIN_BYTES,
  isPracticeRunLanguage,
  type PracticeRunLanguage,
  type PracticeRunRequest,
  type PracticeRunResult,
} from './types';

export type PracticeRunnerProvider = 'onlinecompiler' | 'piston' | 'local';

export function resolvePracticeRunnerProvider(
  raw = process.env.PRACTICE_RUNNER_PROVIDER,
): PracticeRunnerProvider {
  const v = String(raw || '').trim().toLowerCase();
  if (v === 'piston') return 'piston';
  if (v === 'onlinecompiler') return 'onlinecompiler';
  if (process.env.PISTON_URL) return 'piston';
  if (process.env.ONLINECOMPILER_API_KEY) return 'onlinecompiler';
  return 'local';
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
  if (provider === 'piston') return runWithPiston(req);
  if (provider === 'onlinecompiler') return runWithOnlineCompiler(req);
  
  // Local zero-config fallback for JS/TS
  if (req.language === 'javascript' || req.language === 'typescript') {
    return runWithLocalNode(req);
  }
  
  // If piston URL is available, run with piston
  if (process.env.PISTON_URL) {
    return runWithPiston(req);
  }

  return runWithLocalNode(req);
}

export {
  PRACTICE_RUN_LANGUAGES,
  PRACTICE_RUN_MAX_CODE_BYTES,
  PRACTICE_RUN_MAX_STDIN_BYTES,
  isPracticeRunLanguage,
} from './types';
export type { PracticeRunLanguage, PracticeRunRequest, PracticeRunResult } from './types';
export { ONLINECOMPILER_COMPILER } from './onlinecompiler';
export { PISTON_LANGUAGE } from './piston';
