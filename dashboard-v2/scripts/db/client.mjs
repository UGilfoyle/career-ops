import fs from 'fs';
import path from 'path';
import postgres from 'postgres';

function loadEnvLocal() {
  const candidates = [
    path.join(process.cwd(), '.env.local'),
    process.env.APP_ROOT && path.join(process.env.APP_ROOT, '.env.local'),
    path.join(process.cwd(), '..', '.env.local'),
    path.join(process.cwd(), 'dashboard-v2', '.env.local'),
  ].filter(Boolean);
  for (const envPath of candidates) {
    if (!fs.existsSync(envPath)) continue;
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const raw = trimmed.slice(eq + 1).trim();
      const val = raw.replace(/^['"]|['"]$/g, '');
      if (val && !process.env[key]) process.env[key] = val;
    }
    break;
  }
}

loadEnvLocal();

const cleanDbUrl = (process.env.DATABASE_URL || '')
  .replace('&channel_binding=require', '')
  .replace('?channel_binding=require&', '?')
  .replace('?channel_binding=require', '');

const sql = postgres(cleanDbUrl, {
  ssl: cleanDbUrl ? 'require' : false,
  max: 10,
  idle_timeout: 20,
  connect_timeout: 30,
});

export default sql;
