import sql from './client.mjs';

async function migrate() {
  console.log("🛠️ Starting Multi-Tenant Database Migration...");

  try {
    await sql.begin(async (sql) => {
      console.log("1. Creating NextAuth generic tables (users, accounts, sessions)...");
      
      // NextAuth Users
      await sql`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255),
          email VARCHAR(255) UNIQUE NOT NULL,
          email_verified TIMESTAMP WITH TIME ZONE,
          image TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `;

      // NextAuth Accounts
      await sql`
        CREATE TABLE IF NOT EXISTS accounts (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          type VARCHAR(255) NOT NULL,
          provider VARCHAR(255) NOT NULL,
          provider_account_id VARCHAR(255) NOT NULL,
          refresh_token TEXT,
          access_token TEXT,
          expires_at BIGINT,
          token_type VARCHAR(255),
          scope VARCHAR(255),
          id_token TEXT,
          session_state VARCHAR(255),
          UNIQUE (provider, provider_account_id)
        );
      `;

      // NextAuth Sessions
      await sql`
        CREATE TABLE IF NOT EXISTS sessions (
          id SERIAL PRIMARY KEY,
          session_token VARCHAR(255) UNIQUE NOT NULL,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          expires TIMESTAMP WITH TIME ZONE NOT NULL
        );
      `;

      // User Profiles (Settings & Resumes)
      console.log("2. Creating user_profiles table...");
      await sql`
        CREATE TABLE IF NOT EXISTS user_profiles (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
          resume_context JSONB DEFAULT '{}'::jsonb,
          targeting_keywords JSONB DEFAULT '{"positive": [], "negative": []}'::jsonb,
          openai_key TEXT,
          hf_token TEXT,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `;

      console.log("3. Ensuring an Admin user exists for existing data...");
      // Check if any user exists, if not, create a default one
      const [{ count }] = await sql`SELECT count(*) FROM users`;
      let adminId = null;
      if (parseInt(count) === 0) {
        const [user] = await sql`
          INSERT INTO users (name, email) 
          VALUES ('Admin', 'admin@career-ops.local')
          RETURNING id
        `;
        adminId = user.id;

        // Initialize default profile
        await sql`
          INSERT INTO user_profiles (user_id, resume_context, targeting_keywords)
          VALUES (
            ${adminId}, 
            '{"narrative": {"headline": "Senior Software Engineer"}, "skills": []}'::jsonb, 
            '{"positive": ["Software Engineer", "Backend", "AI"], "negative": ["Manager", "Intern"]}'::jsonb
          )
        `;
        console.log(`-> Created default Admin user with ID: ${adminId}`);
      } else {
        const [user] = await sql`SELECT id FROM users ORDER BY id ASC LIMIT 1`;
        adminId = user.id;
        console.log(`-> Using existing user ID: ${adminId} as Admin for migration`);
      }

      console.log("4. Upgrading existing tables (jobs, applications, scans) with user_id...");

      // Add user_id to jobs
      await sql`
        ALTER TABLE jobs 
        ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
      `;

      // Add updated_at to jobs
      await sql`
        ALTER TABLE jobs
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
      `;

      // Backfill jobs data
      await sql`
        UPDATE jobs SET user_id = ${adminId} WHERE user_id IS NULL;
      `;

      // Add NOT NULL constraint and redefine unique index
      await sql`
        ALTER TABLE jobs ALTER COLUMN user_id SET NOT NULL;
      `;

      // Update UNIQUE constraint on 'url' to be scoped per-user
      await sql`ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_url_key;`;
      await sql`ALTER TABLE jobs ADD CONSTRAINT jobs_user_url_key UNIQUE (user_id, url);`;

      // Add user_id to applications
      await sql`
        ALTER TABLE applications 
        ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
      `;
      // Backfill applications data
      await sql`
        UPDATE applications SET user_id = ${adminId} WHERE user_id IS NULL;
      `;
      await sql`ALTER TABLE applications ALTER COLUMN user_id SET NOT NULL;`;

      // Add user_id to scans
      await sql`
        ALTER TABLE scans 
        ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
      `;
      // Backfill scans data
      await sql`
        UPDATE scans SET user_id = ${adminId} WHERE user_id IS NULL;
      `;
      await sql`ALTER TABLE scans ALTER COLUMN user_id SET NOT NULL;`;

      // Create helpful indexes for multi-tenant querying
      await sql`CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id);`;
      await sql`CREATE INDEX IF NOT EXISTS idx_apps_user_id ON applications(user_id);`;
      await sql`CREATE INDEX IF NOT EXISTS idx_scans_user_id ON scans(user_id);`;

    });

    console.log("✅ Multi-Tenant Database Migration Completed Successfully!");
  } catch (err) {
    console.error("❌ Migration Failed:", err.message);
  } finally {
    process.exit();
  }
}

migrate();
