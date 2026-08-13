import pg from 'pg';

function cleanDbUrl(url: string): string {
  return url
    .replace('&channel_binding=require', '')
    .replace('?channel_binding=require&', '?')
    .replace('?channel_binding=require', '');
}

const globalForPg = globalThis as typeof globalThis & { __careerOpsPgPool?: pg.Pool };

/** One pg.Pool per Node isolate — shared by auth.ts and credentials login. */
export function getPgPool(): pg.Pool {
  if (!globalForPg.__careerOpsPgPool) {
    globalForPg.__careerOpsPgPool = new pg.Pool({
      connectionString: cleanDbUrl(process.env.DATABASE_URL || ''),
      ssl: { rejectUnauthorized: false },
      max: 4,
      idleTimeoutMillis: 20_000,
      connectionTimeoutMillis: 10_000,
    });
  }
  return globalForPg.__careerOpsPgPool;
}
