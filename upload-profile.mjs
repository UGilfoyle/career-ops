#!/usr/bin/env node

import fs from 'fs';
import yaml from 'js-yaml';
import postgres from 'postgres';

const profilePath = 'config/profile.yml';
if (!fs.existsSync(profilePath)) {
  console.error("❌ config/profile.yml not found.");
  process.exit(1);
}

// Support reading DATABASE_URL from dashboard-v2/.env.local if not in process.env
let dbUrl = process.env.DATABASE_URL || '';
if (!dbUrl) {
  const envLocalPath = 'dashboard-v2/.env.local';
  if (fs.existsSync(envLocalPath)) {
    const content = fs.readFileSync(envLocalPath, 'utf8');
    const match = content.match(/^DATABASE_URL\s*=\s*([^\n]+)/m);
    if (match && match[1]) {
      dbUrl = match[1].trim().replace(/^["']|["']$/g, '');
    }
  }
}

const cleanDbUrl = dbUrl
  .replace('&channel_binding=require', '')
  .replace('?channel_binding=require&', '?')
  .replace('?channel_binding=require', '');

if (!cleanDbUrl) {
  console.error("❌ DATABASE_URL is not set. Run 'npx vercel env pull' or set DATABASE_URL in dashboard-v2/.env.local first.");
  process.exit(1);
}

const sql = postgres(cleanDbUrl, { ssl: 'require' });

async function main() {
  try {
    const yamlContent = fs.readFileSync(profilePath, 'utf8');
    const p = yaml.load(yamlContent);
    const userId = process.env.SCAN_USER_ID || 19; // Using user ID 19 from user's logs
    
    console.log(`⏳ Uploading local profile for user [${userId}] to database...`);
    
    const keywords = p.target_roles?.primary || [];
    
    const [existingRow] = await sql`SELECT resume_context FROM user_profiles WHERE user_id = ${userId}`;
    const existingContext = existingRow?.resume_context || {};
    const merged = { ...existingContext, ...p };

    await sql`
      INSERT INTO user_profiles (user_id, resume_context, targeting_keywords)
      VALUES (${userId}, ${sql.json(merged)}, ${sql.json(keywords)})
      ON CONFLICT (user_id) 
      DO UPDATE SET 
        resume_context = EXCLUDED.resume_context,
        targeting_keywords = EXCLUDED.targeting_keywords,
        updated_at = NOW()
    `;
    
    console.log("✅ Profile successfully uploaded and synced to the remote database!");
  } catch (err) {
    console.error("❌ Upload failed:", err.message);
  } finally {
    await sql.end();
  }
}

main();
