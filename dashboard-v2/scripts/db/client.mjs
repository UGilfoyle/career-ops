import fs from 'fs';
import path from 'path';
import pg from 'pg';

function loadEnvLocal() {
  const candidates = [
    path.join(process.cwd(), '.env.local'),
    process.env.APP_ROOT && path.join(process.env.APP_ROOT, '.env.local'),
    path.join(process.cwd(), '..', '.env.local'),
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

const normalizeDbUrl = (value) => {
  if (!value) return value;
  // Keep compatibility with providers that still append these params.
  let next = value
    .replace('&channel_binding=require', '')
    .replace('?channel_binding=require&', '?')
    .replace('?channel_binding=require', '');

  if (next.includes('sslmode=require') && !next.includes('uselibpqcompat=')) {
    next += next.includes('?') ? '&uselibpqcompat=true' : '?uselibpqcompat=true';
  }
  return next;
};

function dbNeedsSsl(url) {
  return /neon\.tech|sslmode=require|supabase\.co/i.test(String(url || ''));
}

const pool = new pg.Pool({
  connectionString: normalizeDbUrl(process.env.DATABASE_URL),
  ssl: dbNeedsSsl(process.env.DATABASE_URL) ? { rejectUnauthorized: false } : undefined,
  max: 10,
});

function sql(strings, ...values) {
  const text = strings.reduce((acc, part, i) => {
    const next = i < values.length ? `$${i + 1}` : '';
    return `${acc}${part}${next}`;
  }, '');
  return pool.query(text, values).then((res) => res.rows);
}

export default sql;
