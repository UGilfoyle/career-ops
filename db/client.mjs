import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { createRequire } from 'module';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

async function loadPostgres() {
  try {
    const mod = await import('postgres');
    return mod.default || mod;
  } catch (err) {
    const candidateDirs = [
      path.resolve(__dirname, 'node_modules'),
      path.resolve(__dirname, '../node_modules'),
      path.resolve(__dirname, 'dashboard-v2/node_modules'),
      path.resolve(__dirname, 'dashboard-v2/scripts/node_modules'),
      path.resolve(__dirname, 'dashboard-v2/runtime-assets/node_modules'),
      process.env.APP_ROOT && path.join(process.env.APP_ROOT, 'node_modules'),
      '/var/task/dashboard-v2/node_modules',
      '/var/task/node_modules',
      process.cwd(),
      path.join(process.cwd(), 'node_modules'),
    ].filter(Boolean);

    for (const dir of candidateDirs) {
      try {
        const resolved = require.resolve('postgres', { paths: [dir] });
        const mod = await import(pathToFileURL(resolved).href);
        return mod.default || mod;
      } catch {}
    }
    throw err;
  }
}

const postgres = await loadPostgres();
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
