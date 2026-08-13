#!/usr/bin/env node
/**
 * Thin wrapper — use dashboard-v2/scripts/gcc-scan.mjs as the canonical scanner.
 */
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dashScan = path.resolve(__dirname, 'dashboard-v2/scripts/gcc-scan.mjs');

const child = spawn(process.execPath, [dashScan, ...process.argv.slice(2)], {
  stdio: 'inherit',
  cwd: __dirname,
  env: process.env,
});
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
