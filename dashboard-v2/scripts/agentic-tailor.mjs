#!/usr/bin/env node
/**
 * Thin wrapper — dashboard local tailor MUST use the root engine.
 * Prevents drift between dashboard-v2/scripts and root agentic-tailor.mjs.
 */
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootTailor = path.resolve(__dirname, '../../agentic-tailor.mjs');
const repoRoot = path.resolve(__dirname, '../..');

const child = spawn(process.execPath, [rootTailor, ...process.argv.slice(2)], {
  stdio: 'inherit',
  cwd: repoRoot,
  env: process.env,
});
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
