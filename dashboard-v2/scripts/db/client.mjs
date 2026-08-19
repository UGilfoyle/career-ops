import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dashboardV2Root = path.resolve(__dirname, '../..');
const repoRoot = path.resolve(dashboardV2Root, '..');

function parseEnvValue(raw) {
  let val = raw.trim();
  if (
    (val.startsWith('"') && val.endsWith('"'))
    || (val.startsWith("'") && val.endsWith("'"))
  ) {
    val = val.slice(1, -1);
  }
  // Strip trailing inline comment: KEY=value # note
  const hash = val.indexOf(' #');
  if (hash > 0) val = val.slice(0, hash).trim();
  return val;
}

function isValidDatabaseUrl(value) {
  return /^postgres(ql)?:\/\//i.test(String(value || '').trim());
}

function loadEnvLocal() {
  const candidates = [
    path.join(dashboardV2Root, '.env.local'),
    path.join(process.cwd(), 'dashboard-v2', '.env.local'),
    path.join(process.cwd(), '.env.local'),
    path.join(repoRoot, '.env.local'),
    process.env.APP_ROOT && path.join(process.env.APP_ROOT, '.env.local'),
  ].filter(Boolean);

  for (const envPath of candidates) {
    if (!fs.existsSync(envPath)) continue;
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = parseEnvValue(trimmed.slice(eq + 1));
      if (!val || val.startsWith('#')) continue;

      if (key === 'DATABASE_URL') {
        if (!isValidDatabaseUrl(val)) continue;
        process.env.DATABASE_URL = val;
        continue;
      }

      if (!process.env[key]) process.env[key] = val;
    }
  }
}

loadEnvLocal();

const cleanDbUrl = (process.env.DATABASE_URL || '')
  .replace('&channel_binding=require', '')
  .replace('?channel_binding=require&', '?')
  .replace('?channel_binding=require', '');

if (!isValidDatabaseUrl(cleanDbUrl)) {
  throw new Error(
    'DATABASE_URL missing or invalid. Set postgresql://… in dashboard-v2/.env.local ' +
      '(remove placeholder lines like DATABASE_URL=# comment).',
  );
}

const sql = postgres(cleanDbUrl, {
  ssl: 'require',
  max: 10,
  idle_timeout: 20,
  connect_timeout: 30,
});

export default sql;
