import postgres from 'postgres';

function isLocalDb(url: string): boolean {
  return /localhost|127\.0\.0\.1|sslmode=disable/i.test(url);
}

const rawUrl = process.env.DATABASE_URL || '';
const cleanDbUrl = rawUrl
  .replace('&channel_binding=require', '')
  .replace('?channel_binding=require&', '?')
  .replace('?channel_binding=require', '');

const globalForDb = globalThis as unknown as { __careerOpsSql?: ReturnType<typeof postgres> };

export const sql = globalForDb.__careerOpsSql || postgres(cleanDbUrl, {
  ssl: rawUrl && !isLocalDb(rawUrl) ? { rejectUnauthorized: false } : false,
  max: 4,
  idle_timeout: 20,
  connect_timeout: 10,
});

if (process.env.NODE_ENV !== 'production') {
  globalForDb.__careerOpsSql = sql;
}

export default sql;
