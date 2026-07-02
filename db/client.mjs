import postgres from 'postgres';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');

const envCandidates = [
  path.join(process.cwd(), '.env.local'),
  path.join(process.cwd(), '.env'),
  path.join(repoRoot, '.env.local'),
  path.join(repoRoot, '.env'),
  path.join(repoRoot, 'dashboard-v2', '.env.local'),
];

for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false });
  }
}

const cleanDbUrl = (process.env.DATABASE_URL || '')
  .replace('&channel_binding=require', '')
  .replace('?channel_binding=require&', '?')
  .replace('?channel_binding=require', '');

if (!cleanDbUrl) {
  console.error(
    '❌ DATABASE_URL is not set. Add it to dashboard-v2/.env.local (copy from Vercel) or export it in your shell.',
  );
}

const sql = postgres(cleanDbUrl, {
  ssl: cleanDbUrl ? 'require' : false,
  max: 10,
  idle_timeout: 20,
  connect_timeout: 30,
});

export default sql;
