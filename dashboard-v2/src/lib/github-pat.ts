import sql from "@/lib/db";

export interface GitHubResolution {
  pat: string;
  repo: string;
  isSystemFallback: boolean;
}

/**
 * Resolves a valid GitHub PAT and repository.
 * Order of precedence:
 * 1. User's custom GitHub settings in their profile (if explicitly configured)
 * 2. System GITHUB_PAT environment variable (if defined)
 * 3. Global system_config table in database ('system_github_pat')
 * 4. Admin profile (user_id = 19 / Akash) in user_profiles
 */
export async function resolveGitHubPat(userId?: string): Promise<GitHubResolution> {
  const defaultRepo = process.env.GITHUB_REPO || "UGilfoyle/career-ops";

  // 1. Check logged-in user custom PAT
  if (userId) {
    try {
      const rows = await sql`
        SELECT resume_context FROM user_profiles WHERE user_id = ${userId} LIMIT 1
      `;
      if (rows && rows.length > 0) {
        const ctx = typeof rows[0].resume_context === "string"
          ? JSON.parse(rows[0].resume_context)
          : rows[0].resume_context;
        if (ctx?.github_settings?.pat && ctx.github_settings.pat.trim().length > 0) {
          return {
            pat: ctx.github_settings.pat.trim(),
            repo: ctx.github_settings.repo?.trim() || defaultRepo,
            isSystemFallback: false,
          };
        }
      }
    } catch (e) {
      console.warn("[resolveGitHubPat] Error reading user profile:", e);
    }
  }

  // 2. Check process.env.GITHUB_PAT
  if (process.env.GITHUB_PAT && process.env.GITHUB_PAT.trim().length > 0) {
    return {
      pat: process.env.GITHUB_PAT.trim(),
      repo: defaultRepo,
      isSystemFallback: true,
    };
  }

  // 3. Check system_config in DB (instant cloud fallback without redeploying)
  try {
    const rows = await sql`
      SELECT value FROM system_config WHERE key = "system_github_pat" LIMIT 1
    `;
    if (rows && rows.length > 0 && rows[0].value) {
      return {
        pat: rows[0].value.trim(),
        repo: defaultRepo,
        isSystemFallback: true,
      };
    }
  } catch (e) {
    console.warn("[resolveGitHubPat] Error reading system_config:", e);
  }

  // 4. Fallback to Admin profile (user_id = 19)
  try {
    const rows = await sql`
      SELECT resume_context FROM user_profiles WHERE user_id = 19 LIMIT 1
    `;
    if (rows && rows.length > 0) {
      const ctx = typeof rows[0].resume_context === "string"
        ? JSON.parse(rows[0].resume_context)
        : rows[0].resume_context;
      if (ctx?.github_settings?.pat && ctx.github_settings.pat.trim().length > 0) {
        return {
          pat: ctx.github_settings.pat.trim(),
          repo: ctx.github_settings.repo?.trim() || defaultRepo,
          isSystemFallback: true,
        };
      }
    }
  } catch (e) {
    console.warn("[resolveGitHubPat] Error reading admin profile:", e);
  }

  return { pat: "", repo: defaultRepo, isSystemFallback: true };
}
