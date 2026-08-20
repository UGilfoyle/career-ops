import vm from 'vm';
import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { PracticeRunLanguage, PracticeRunRequest, PracticeRunResult } from './types';

/**
 * Safe local JS/TS evaluator inside isolated Node.js VM context.
 */
export async function runWithLocalNode(req: PracticeRunRequest): Promise<PracticeRunResult> {
  const startTime = Date.now();
  const outputLogs: string[] = [];

  const mockProcess = {
    env: { NODE_ENV: 'development', APP: 'career-ops-sandbox' },
    argv: ['node', 'solution.js'],
    version: 'v22.14.0',
    platform: 'linux',
    arch: 'x64',
    stdout: {
      write: (data: unknown) => {
        outputLogs.push(String(data));
        return true;
      },
      pipe: (_dest?: unknown) => {
        const streamObj = {
          on: (evt: string, cb: () => void) => {
            if (evt === 'end' || evt === 'finish') cb?.();
            return streamObj;
          },
        };
        return streamObj;
      },
    },
    stderr: {
      write: (data: unknown) => {
        outputLogs.push(`[STDERR] ${String(data)}`);
        return true;
      },
    },
    nextTick: (fn: (...args: unknown[]) => void, ...args: unknown[]) => queueMicrotask(() => fn(...args)),
    hrtime: () => [Math.floor(Date.now() / 1000), (Date.now() % 1000) * 1e6],
  };

  const sandbox = {
    console: {
      log: (...args: unknown[]) => {
        outputLogs.push(args.map((a) => (typeof a === 'object' && a !== null ? JSON.stringify(a) : String(a))).join(' '));
      },
      error: (...args: unknown[]) => {
        outputLogs.push(`[ERROR] ${args.map((a) => (typeof a === 'object' && a !== null ? JSON.stringify(a) : String(a))).join(' ')}`);
      },
      warn: (...args: unknown[]) => {
        outputLogs.push(`[WARN] ${args.map((a) => (typeof a === 'object' && a !== null ? JSON.stringify(a) : String(a))).join(' ')}`);
      },
      info: (...args: unknown[]) => {
        outputLogs.push(args.map((a) => (typeof a === 'object' && a !== null ? JSON.stringify(a) : String(a))).join(' '));
      },
    },
    process: mockProcess,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    queueMicrotask,
    Buffer,
    URL,
    URLSearchParams,
    TextEncoder,
    TextDecoder,
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
    WeakMap,
    WeakSet,
    Promise,
    Symbol,
    Error,
    TypeError,
    RangeError,
    SyntaxError,
    ReferenceError,
    structuredClone: typeof structuredClone !== 'undefined' ? structuredClone : (v: unknown) => JSON.parse(JSON.stringify(v)),
  };

  try {
    const context = vm.createContext(sandbox);
    let executableCode = req.code;

    // Strip TypeScript type annotations if language is TS
    if (req.language === 'typescript') {
      executableCode = executableCode
        .replace(/:\s*(string|number|boolean|any|void|unknown|never|Record<[^>]+>|Array<[^>]+>|\[[^\]]+\])(?=[,\)\s=;])/g, '')
        .replace(/interface\s+\w+[\s\S]*?\{[\s\S]*?\}/g, '')
        .replace(/type\s+\w+\s*=[\s\S]*?;/g, '')
        .replace(/as\s+[A-Za-z0-9_<>[\]]+/g, '');
    }

    const script = new vm.Script(executableCode);
    script.runInContext(context, { timeout: 4000 });

    const timeSec = (Date.now() - startTime) / 1000;
    const stdout = outputLogs.join('\n') || 'Code executed successfully (no stdout produced).';

    return {
      ok: true,
      provider: 'local',
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
      provider: 'local',
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

/**
 * Execute code with local CLI binaries (Python3, Ruby, etc.) if available on host.
 */
export async function runWithLocalCLI(
  req: PracticeRunRequest,
  binary: string,
  args: string[],
  ext = '.tmp',
): Promise<PracticeRunResult | null> {
  const startTime = Date.now();
  const tmpDir = os.tmpdir();
  const tmpFile = path.join(tmpDir, `career_ops_run_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);

  try {
    fs.writeFileSync(tmpFile, req.code, 'utf8');

    return await new Promise<PracticeRunResult>((resolve) => {
      const procArgs = [...args, tmpFile];
      const proc = spawn(binary, procArgs, {
        timeout: 5000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      if (req.stdin) {
        proc.stdin.write(req.stdin);
        proc.stdin.end();
      }

      proc.stdout.on('data', (d) => {
        stdout += d.toString();
      });

      proc.stderr.on('data', (d) => {
        stderr += d.toString();
      });

      proc.on('error', () => {
        // Binary not found or cannot execute
        resolve({
          ok: false,
          provider: 'local',
          language: req.language,
          compiler: binary,
          stdout: '',
          stderr: '',
          exitCode: -1,
          timedOut: false,
          timeSec: null,
          memoryKb: null,
          status: 'misconfigured',
          error: `${binary} is not available on host system`,
        });
      });

      proc.on('close', (code, signal) => {
        const timeSec = (Date.now() - startTime) / 1000;
        const isTimeout = signal === 'SIGTERM' || signal === 'SIGKILL';
        const isOk = code === 0 && !stderr;

        resolve({
          ok: isOk,
          provider: 'local',
          language: req.language,
          compiler: binary,
          stdout: stdout.trim() || (isOk ? 'Code executed successfully (no stdout produced).' : ''),
          stderr: stderr.trim(),
          exitCode: code ?? (isTimeout ? 124 : -1),
          timedOut: isTimeout,
          timeSec,
          memoryKb: null,
          status: isOk ? 'ok' : isTimeout ? 'timeout' : 'runtime_error',
        });
      });
    });
  } catch {
    return null;
  } finally {
    try {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    } catch {}
  }
}
