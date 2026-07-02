import sql from '@/lib/db';

export async function getDashboardData(userId: string) {
  // Parallel fetchers definition
  const fetchJobMeta = async () => {
    try {
      const rows = await sql`
        SELECT
          COUNT(*)::int AS jobs_total,
          COUNT(*) FILTER (WHERE score IS NOT NULL AND score > 0)::int AS jobs_ranked,
          MAX(created_at) AS last_job_created_at,
          MAX(updated_at) AS last_job_updated_at
        FROM jobs
        WHERE user_id = ${userId}
      `;
      const row: any = rows[0] || {};
      return {
        jobs_total: Number(row.jobs_total ?? 0),
        jobs_ranked: Number(row.jobs_ranked ?? 0),
        last_job_created_at: row.last_job_created_at ?? null,
        last_job_updated_at: row.last_job_updated_at ?? null,
      };
    } catch {
      try {
        const rows = await sql`
          SELECT
            COUNT(*)::int AS jobs_total,
            COUNT(*) FILTER (WHERE score IS NOT NULL AND score > 0)::int AS jobs_ranked,
            MAX(created_at) AS last_job_created_at
          FROM jobs
          WHERE user_id = ${userId}
        `;
        const row: any = rows[0] || {};
        return {
          jobs_total: Number(row.jobs_total ?? 0),
          jobs_ranked: Number(row.jobs_ranked ?? 0),
          last_job_created_at: row.last_job_created_at ?? null,
          last_job_updated_at: row.last_job_created_at ?? null,
        };
      } catch {
        return { jobs_total: 0, jobs_ranked: 0, last_job_created_at: null, last_job_updated_at: null };
      }
    }
  };

  const fetchApplications = async () => {
    try {
      return await sql`
        SELECT 
          a.id as app_id,
          a.job_id as job_id,
          a.status,
          a.applied_at,
          a.resume_file,
          j.company,
          j.title as role,
          j.url,
          j.score
        FROM applications a
        JOIN jobs j ON a.job_id = j.id
        WHERE a.user_id = ${userId}
        ORDER BY a.applied_at DESC
      `;
    } catch {
      return [];
    }
  };

  const fetchStats = async () => {
    try {
      const rows = await sql`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'APPLIED') as applied,
          COUNT(*) FILTER (WHERE status = 'INTERVIEW') as interviews,
          COUNT(*) FILTER (WHERE status = 'OFFER') as offers
        FROM applications
        WHERE user_id = ${userId}
      `;
      return rows[0] || { total: 0, applied: 0, interviews: 0, offers: 0 };
    } catch {
      return { total: 0, applied: 0, interviews: 0, offers: 0 };
    }
  };

  const fetchPipeline = async () => {
    try {
      return await sql`
        SELECT
          id as pipeline_id,
          url,
          canonical_url,
          title,
          company,
          score,
          source,
          created_at,
          (
            resume_pdf_key IS NOT NULL OR cover_letter_pdf_key IS NOT NULL
            OR resume_html IS NOT NULL OR cover_letter_html IS NOT NULL
          ) AS is_tailored
        FROM jobs
        WHERE user_id = ${userId}
          AND (score IS NULL OR COALESCE(score, 0) >= 0)
          AND id NOT IN (SELECT job_id FROM applications WHERE user_id = ${userId})
        ORDER BY score DESC NULLS LAST, created_at DESC
      `;
    } catch {
      try {
        const pipeline = await sql`
          SELECT id as pipeline_id, url, title, company, score, source, created_at
          FROM jobs
          WHERE user_id = ${userId}
            AND (score IS NULL OR COALESCE(score, 0) >= 0)
            AND id NOT IN (SELECT job_id FROM applications WHERE user_id = ${userId})
          ORDER BY score DESC NULLS LAST, created_at DESC
        `;
        return pipeline.map((p: any) => ({ ...p, canonical_url: p.url, is_tailored: false }));
      } catch {
        return [];
      }
    }
  };

  const fetchProfile = async () => {
    try {
      const rows = await sql`
        SELECT resume_context, targeting_keywords 
        FROM user_profiles 
        WHERE user_id = ${userId}
        LIMIT 1
      `;
      return rows.length > 0 ? rows[0].resume_context : null;
    } catch {
      return null;
    }
  };

  const fetchPdfs = async () => {
    try {
      try {
        const docs = await sql`
          SELECT
            id,
            company,
            title,
            updated_at,
            url,
            canonical_url,
            ats_content_score,
            (resume_pdf_key IS NOT NULL OR resume_pdf IS NOT NULL) AS has_resume_pdf,
            (cover_letter_pdf_key IS NOT NULL OR cover_letter_pdf IS NOT NULL) AS has_cover_letter_pdf,
            (resume_html IS NOT NULL) AS has_resume_html,
            (cover_letter_html IS NOT NULL) AS has_cover_letter_html
          FROM jobs
          WHERE user_id = ${userId} 
            AND (
              resume_pdf_key IS NOT NULL OR cover_letter_pdf_key IS NOT NULL
              OR resume_pdf IS NOT NULL OR cover_letter_pdf IS NOT NULL
              OR resume_html IS NOT NULL OR cover_letter_html IS NOT NULL
            )
          ORDER BY updated_at DESC
        `;
        return docs.map(d => ({
          id: d.id,
          company: d.company,
          title: d.title,
          url: d.canonical_url || d.url,
          name: `Tailored Assets: ${d.company} - ${d.title}`,
          mtime: d.updated_at,
          ats_content_score: d.ats_content_score != null ? Number(d.ats_content_score) : null,
          has_resume_pdf: !!d.has_resume_pdf,
          has_cover_letter_pdf: !!d.has_cover_letter_pdf,
          has_resume_html: !!d.has_resume_html,
          has_cover_letter_html: !!d.has_cover_letter_html,
        }));
      } catch {
        const docs = await sql`
          SELECT
            id,
            company,
            title,
            created_at,
            url,
            canonical_url,
            (resume_pdf_key IS NOT NULL OR resume_pdf IS NOT NULL) AS has_resume_pdf,
            (cover_letter_pdf_key IS NOT NULL OR cover_letter_pdf IS NOT NULL) AS has_cover_letter_pdf,
            (resume_html IS NOT NULL) AS has_resume_html,
            (cover_letter_html IS NOT NULL) AS has_cover_letter_html
          FROM jobs
          WHERE user_id = ${userId} 
            AND (
              resume_pdf_key IS NOT NULL OR cover_letter_pdf_key IS NOT NULL
              OR resume_pdf IS NOT NULL OR cover_letter_pdf IS NOT NULL
              OR resume_html IS NOT NULL OR cover_letter_html IS NOT NULL
            )
          ORDER BY created_at DESC
        `;
        return docs.map((d: any) => ({
          id: d.id,
          company: d.company,
          title: d.title,
          url: d.canonical_url || d.url,
          name: `Tailored Assets: ${d.company} - ${d.title}`,
          mtime: d.created_at,
          ats_content_score: d.ats_content_score != null ? Number(d.ats_content_score) : null,
          has_resume_pdf: !!d.has_resume_pdf,
          has_cover_letter_pdf: !!d.has_cover_letter_pdf,
          has_resume_html: !!d.has_resume_html,
          has_cover_letter_html: !!d.has_cover_letter_html,
        }));
      }
    } catch {
      return [];
    }
  };

  const fetchLatestEvent = async () => {
    try {
      const evRows = await sql`
        SELECT id, action_script, status, created_at
        FROM background_events
        WHERE user_id = ${String(userId)}
        ORDER BY created_at DESC
        LIMIT 1
      `;
      return evRows[0] || null;
    } catch {
      return null;
    }
  };

  const fetchLatestRun = async () => {
    try {
      const runRows = await sql`
        SELECT id, action_script, status, run_url, queued_at, completed_at
        FROM background_runs
        WHERE user_id = ${String(userId)}
        ORDER BY queued_at DESC
        LIMIT 1
      `;
      return runRows[0] || null;
    } catch {
      return null;
    }
  };

  // Execute all queries concurrently in parallel
  const [
    jobMeta,
    applications,
    stats,
    pipeline,
    profile,
    pdfs,
    latestEvent,
    latestRun
  ] = await Promise.all([
    fetchJobMeta(),
    fetchApplications(),
    fetchStats(),
    fetchPipeline(),
    fetchProfile(),
    fetchPdfs(),
    fetchLatestEvent(),
    fetchLatestRun()
  ]);

  return {
    applications,
    pipeline,
    pdfs,
    stats: stats || { total: 0, applied: 0, interviews: 0, offers: 0 },
    profile,
    meta: {
      jobsTotal: jobMeta.jobs_total ?? 0,
      jobsRanked: jobMeta.jobs_ranked ?? 0,
      lastJobCreatedAt: jobMeta.last_job_created_at ?? null,
      lastJobUpdatedAt: jobMeta.last_job_updated_at ?? null,
      lastBackgroundEventId: latestEvent?.id ?? null,
      lastBackgroundActionScript: latestEvent?.action_script ?? null,
      lastBackgroundStatus: latestEvent?.status ?? null,
      lastBackgroundCompletedAt: latestEvent?.created_at ?? null,
      lastRunId: latestRun?.id ?? null,
      lastRunScript: latestRun?.action_script ?? null,
      lastRunStatus: latestRun?.status ?? null,
      lastRunUrl: latestRun?.run_url ?? null,
      lastRunQueuedAt: latestRun?.queued_at ?? null,
      lastRunCompletedAt: latestRun?.completed_at ?? null,
    },
    timestamp: new Date().toISOString()
  };
}
