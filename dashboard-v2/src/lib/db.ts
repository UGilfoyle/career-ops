import postgres from 'postgres';

const cleanDbUrl = (process.env.DATABASE_URL || '')
  .replace('&channel_binding=require', '')
  .replace('?channel_binding=require&', '?')
  .replace('?channel_binding=require', '');

const sql = postgres(cleanDbUrl, {
  ssl: { rejectUnauthorized: false },
  max: 4,
  idle_timeout: 20,
  connect_timeout: 10,
});

export default sql;
