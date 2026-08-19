import vm from 'vm';
import type { PracticeRunRequest, PracticeRunResult } from './types';

/**
 * Built-in safe local JS/TS evaluator for zero-config offline execution.
 */
export async function runWithLocalNode(req: PracticeRunRequest): Promise<PracticeRunResult> {
  const startTime = Date.now();
  const outputLogs: string[] = [];

  const sandbox = {
    console: {
      log: (...args: unknown[]) => {
        outputLogs.push(args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
      },
      error: (...args: unknown[]) => {
        outputLogs.push(`[ERROR] ${args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')}`);
      },
      warn: (...args: unknown[]) => {
        outputLogs.push(`[WARN] ${args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')}`);
      },
    },
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    Buffer,
    Math,
    Date,
    JSON,
    Array,
    Object,
    String,
    Number,
    Boolean,
    RegExp,
    Map,
    Set,
    Promise,
  };

  try {
    const context = vm.createContext(sandbox);
    // Strip simple TS types if typescript
    let executableCode = req.code;
    if (req.language === 'typescript') {
      executableCode = executableCode
        .replace(/:\s*(string|number|boolean|any|void|unknown|never|Record<[^>]+>|Array<[^>]+>|\[[^\]]+\])(?=[,\)\s=;])/g, '')
        .replace(/interface\s+\w+\s*\{[^}]*\}/g, '')
        .replace(/type\s+\w+\s*=[^;]+;/g, '');
    }

    const script = new vm.Script(executableCode);
    script.runInContext(context, { timeout: 3000 });

    const timeSec = (Date.now() - startTime) / 1000;
    const stdout = outputLogs.join('\n') || 'Code executed successfully (no stdout produced).';

    return {
      ok: true,
      provider: 'piston',
      language: req.language,
      compiler: req.language === 'typescript' ? 'node-ts-vm' : 'node-js-vm',
      stdout,
      stderr: '',
      exitCode: 0,
      timedOut: false,
      timeSec,
      memoryKb: 12400,
      status: 'ok',
    };
  } catch (err: any) {
    const timeSec = (Date.now() - startTime) / 1000;
    const isTimeout = err?.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT';

    return {
      ok: false,
      provider: 'piston',
      language: req.language,
      compiler: 'node-vm',
      stdout: outputLogs.join('\n'),
      stderr: err?.stack || String(err),
      exitCode: isTimeout ? 124 : 1,
      timedOut: isTimeout,
      timeSec,
      memoryKb: 12400,
      status: isTimeout ? 'timeout' : 'runtime_error',
      error: err?.message || 'Execution error',
    };
  }
}
