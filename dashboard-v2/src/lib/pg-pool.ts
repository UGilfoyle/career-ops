import pg from 'pg';

function cleanDbUrl(url: string): string {
  return url
    .replace('&channel_binding=require', '')
    .replace('?channel_binding=require&', '?')
    .replace('?channel_binding=require', '');
}

function isLocalDb(url: string): boolean {
  return /localhost|127\.0\.0\.1|sslmode=disable/i.test(url);
}

const globalForPg = globalThis as typeof globalThis & { __careerOpsPgPool?: pg.Pool };

/** One pg.Pool per Node isolate shared by auth.ts and credentials login. */
export function getPgPool(): pg.Pool {
  if (!globalForPg.__careerOpsPgPool) {
    const rawUrl = process.env.DATABASE_URL || '';
    const pool = new pg.Pool({
      connectionString: cleanDbUrl(rawUrl),
      ssl: rawUrl && !isLocalDb(rawUrl) ? { rejectUnauthorized: false } : false,
      max: 4,
      idleTimeoutMillis: 20_000,
      connectionTimeoutMillis: 10_000,
    });

    pool.on('error', (err) => {
      console.warn('[PG Pool] Idle client error:', err?.message || err);
    });

    globalForPg.__careerOpsPgPool = pool;
  }
  return globalForPg.__careerOpsPgPool;
}
