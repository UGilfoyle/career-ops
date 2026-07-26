#!/usr/bin/env node
/**
 * Deloitte ETL one-shot — delegates to plan-driven tailor (no gate bypass).
 * Tailors Quest/INTVERSE/Glidewell/Srijan; freezes KOCO/Rubico/Artisanssoft.
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const jd = path.join(root, 'jds', 'deloitte-etl-testing-senior-consultant.txt');
const r = spawnSync(
  process.execPath,
  [
    path.join(root, 'scripts', 'run-plan-tailor.mjs'),
    '--jd', jd,
    '--company', 'Deloitte',
    '--role', 'Senior Consultant - ETL Testing',
    '--out-basename', 'AkashKaintura_Deloitte_ETL_Testing',
    '--downloads',
  ],
  { cwd: root, stdio: 'inherit', env: process.env },
);
process.exit(r.status ?? 1);
