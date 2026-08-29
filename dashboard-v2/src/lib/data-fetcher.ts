import sql from '@/lib/db';

const PIPELINE_PAGE_SIZE = 200;
const APPLICATIONS_PAGE_SIZE = 100;
const PDFS_PAGE_SIZE = 80;

export async function getDashboardData(userId: string, opts?: { pollOnly?: boolean }) {
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
    const fetchAppsWithoutTelemetry = () => sql`
      SELECT 
        a.id as app_id,
        a.job_id as job_id,
        a.status,
        a.applied_at,
        a.resume_file,
        j.company,
        j.title as role,
        j.url,
        j.score,
        j.source,
        j.portal_key,
        j.logo_url,
        j.logo_source,
        NULL::text as stealth_slug,
        0 as stealth_views,
        0 as stealth_clicks,
        0 as stealth_dwell_sec,
        NULL::timestamptz as stealth_last_engaged_at
      FROM applications a
      JOIN jobs j ON a.job_id = j.id
      WHERE a.user_id = ${userId}
      ORDER BY a.applied_at DESC
      LIMIT ${APPLICATIONS_PAGE_SIZE}
    `;

    try {
      const { ensureApplicationTelemetrySchema } = await import('@/lib/ops-schema');
      await ensureApplicationTelemetrySchema(sql);
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
          j.score,
          j.source,
          j.portal_key,
          j.logo_url,
          j.logo_source,
          t.slug as stealth_slug,
          COALESCE(t.view_count, 0) as stealth_views,
          COALESCE(t.click_count, 0) as stealth_clicks,
          COALESCE(t.total_dwell_sec, 0) as stealth_dwell_sec,
          t.last_engaged_at as stealth_last_engaged_at
        FROM applications a
        JOIN jobs j ON a.job_id = j.id
        LEFT JOIN application_tracking t ON t.application_id = a.id AND t.user_id = a.user_id
        WHERE a.user_id = ${userId}
        ORDER BY a.applied_at DESC
        LIMIT ${APPLICATIONS_PAGE_SIZE}
      `;
    } catch (err) {
      console.warn(
        '[fetchApplications] telemetry join/schema failed — loading apps without stealth cols:',
        err instanceof Error ? err.message : err
      );
      try {
        return await fetchAppsWithoutTelemetry();
      } catch {
        return [];
      }
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
    const scoreFilter = sql`AND (score IS NULL OR COALESCE(score, 0) >= 0)`;
    const orderBy = sql`ORDER BY score DESC NULLS LAST, created_at DESC`;

    const mapRow = (p: Record<string, unknown>, extras: Record<string, unknown> = {}) => {
      const appStatus = p.application_status ? String(p.application_status) : null;
      const isApplied = Boolean(
        p.applied_at ||
          (appStatus &&
            ['APPLIED', 'INTERVIEW', 'INTERVIEWING', 'OFFER', 'REJECTED'].includes(
              appStatus.toUpperCase()
            ))
      );
      return {
      pipeline_id: p.pipeline_id,
      url: p.url,
      canonical_url: p.canonical_url ?? p.url,
      title: p.title,
      company: p.company,
      score: p.score,
      source: p.source,
      portal_key: p.portal_key ?? null,
      logo_url: p.logo_url ?? null,
      logo_source: p.logo_source ?? null,
      created_at: p.created_at,
      posted_at: p.posted_at ?? null,
      posted_confidence: p.posted_confidence ?? null,
      company_type: p.company_type ?? null,
      gcc_signal_score: p.gcc_signal_score ?? null,
      gcc_high_value: p.gcc_high_value ?? false,
      app_id: p.app_id ?? null,
      application_status: appStatus,
      applied_at: p.applied_at ?? null,
      is_applied: isApplied,
      is_tailored: Boolean(extras.is_tailored),
      has_resume_html: Boolean(extras.has_resume_html),
      has_resume_pdf: Boolean(extras.has_resume_pdf),
      ats_content_score:
        extras.ats_content_score != null ? Number(extras.ats_content_score) : null,
      jd_alignment_score:
        extras.jd_alignment_score != null ? Number(extras.jd_alignment_score) : null,
    };
    };

    try {
      const rows = await sql`
        SELECT
          j.id as pipeline_id,
          j.url,
          j.canonical_url,
          j.title,
          j.company,
          j.score,
          j.source,
          j.portal_key,
          j.logo_url,
          j.logo_source,
          j.created_at,
          j.posted_at,
          j.posted_confidence,
          j.company_type,
          j.gcc_signal_score,
          j.gcc_high_value,
          j.ats_content_score,
          j.jd_alignment_score,
          (j.resume_html IS NOT NULL) AS has_resume_html,
          (j.resume_pdf_key IS NOT NULL OR j.resume_pdf IS NOT NULL) AS has_resume_pdf,
          (
            j.resume_pdf_key IS NOT NULL OR j.cover_letter_pdf_key IS NOT NULL
            OR j.resume_html IS NOT NULL OR j.cover_letter_html IS NOT NULL
          ) AS is_tailored,
          a.id AS app_id,
          a.status AS application_status,
          a.applied_at,
          (a.applied_at IS NOT NULL OR a.status IN ('APPLIED', 'INTERVIEW', 'INTERVIEWING', 'OFFER', 'REJECTED')) AS is_applied
        FROM jobs j
        LEFT JOIN LATERAL (
          SELECT id, status, applied_at
          FROM applications
          WHERE job_id = j.id AND user_id = ${userId}
          ORDER BY applied_at DESC NULLS LAST, id DESC
          LIMIT 1
        ) a ON true
        WHERE j.user_id = ${userId}
        ${scoreFilter}
        ${orderBy}
        LIMIT ${PIPELINE_PAGE_SIZE}
      `;
      return rows.map((p: Record<string, unknown>) =>
        mapRow(p, {
          is_tailored: p.is_tailored,
          has_resume_html: p.has_resume_html,
          has_resume_pdf: p.has_resume_pdf,
          ats_content_score: p.ats_content_score,
          jd_alignment_score: p.jd_alignment_score,
        })
      );
    } catch (errFull) {
      console.warn('[fetchPipeline] full query failed, trying fallback:', (errFull as Error).message);
    }

    try {
      const rows = await sql`
        SELECT
          j.id as pipeline_id,
          j.url,
          j.title,
          j.company,
          j.score,
          j.source,
          j.portal_key,
          j.logo_url,
          j.logo_source,
          j.created_at,
          j.company_type,
          j.gcc_signal_score,
          j.gcc_high_value,
          a.id AS app_id,
          a.status AS application_status,
          a.applied_at,
          (a.applied_at IS NOT NULL OR a.status IN ('APPLIED', 'INTERVIEW', 'INTERVIEWING', 'OFFER', 'REJECTED')) AS is_applied
        FROM jobs j
        LEFT JOIN LATERAL (
          SELECT id, status, applied_at
          FROM applications
          WHERE job_id = j.id AND user_id = ${userId}
          ORDER BY applied_at DESC NULLS LAST, id DESC
          LIMIT 1
        ) a ON true
        WHERE j.user_id = ${userId}
        ${scoreFilter}
        ${orderBy}
        LIMIT ${PIPELINE_PAGE_SIZE}
      `;
      return rows.map((p: Record<string, unknown>) => mapRow(p));
    } catch (errMid) {
      console.warn('[fetchPipeline] mid query failed, trying minimal:', (errMid as Error).message);
    }

    try {
      const rows = await sql`
        SELECT
          j.id as pipeline_id,
          j.url,
          j.title,
          j.company,
          j.score,
          j.source,
          j.portal_key,
          j.logo_url,
          j.logo_source,
          j.created_at,
          a.id AS app_id,
          a.status AS application_status,
          a.applied_at,
          (a.applied_at IS NOT NULL OR a.status IN ('APPLIED', 'INTERVIEW', 'INTERVIEWING', 'OFFER', 'REJECTED')) AS is_applied
        FROM jobs j
        LEFT JOIN LATERAL (
          SELECT id, status, applied_at
          FROM applications
          WHERE job_id = j.id AND user_id = ${userId}
          ORDER BY applied_at DESC NULLS LAST, id DESC
          LIMIT 1
        ) a ON true
        WHERE j.user_id = ${userId}
        ${scoreFilter}
        ${orderBy}
        LIMIT ${PIPELINE_PAGE_SIZE}
      `;
      return rows.map((p: Record<string, unknown>) => mapRow(p));
    } catch (errMin) {
      console.error('[fetchPipeline] all queries failed:', (errMin as Error).message);
      return [];
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
      if (rows.length === 0) return null;
      const ctx = rows[0].resume_context;
      if (!ctx || typeof ctx !== 'object') return ctx;
      const gh = (ctx as { github_settings?: { pat?: string; repo?: string } }).github_settings;
      if (!gh || typeof gh !== 'object') return ctx;
      const hasPat = Boolean(String(gh.pat || '').trim());
      return {
        ...ctx,
        github_settings: { ...gh, pat: '', has_pat: hasPat },
      };
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
            jd_alignment_score,
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
          LIMIT ${PDFS_PAGE_SIZE}
        `;
        return docs.map(d => ({
          id: d.id,
          company: d.company,
          title: d.title,
          url: d.canonical_url || d.url,
          name: `Tailored Assets: ${d.company} - ${d.title}`,
          mtime: d.updated_at,
          ats_content_score: d.ats_content_score != null ? Number(d.ats_content_score) : null,
          jd_alignment_score: d.jd_alignment_score != null ? Number(d.jd_alignment_score) : null,
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
          ORDER BY created_at DESC
          LIMIT ${PDFS_PAGE_SIZE}
        `;
        return docs.map((d: any) => ({
          id: d.id,
          company: d.company,
          title: d.title,
          url: d.canonical_url || d.url,
          name: `Tailored Assets: ${d.company} - ${d.title}`,
          mtime: d.created_at,
          ats_content_score: d.ats_content_score != null ? Number(d.ats_content_score) : null,
          jd_alignment_score: null,
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

  const fetchLastGccScan = async () => {
    try {
      const rows = await sql`
        SELECT jobs_found, duration_ms, created_at
        FROM scans
        WHERE user_id = ${userId} AND portal = 'GCC Scan'
        ORDER BY created_at DESC
        LIMIT 1
      `;
      return rows[0] || null;
    } catch {
      return null;
    }
  };

  const fetchGccPipelineCount = async () => {
    try {
      const rows = await sql`
        SELECT COUNT(*)::int AS n FROM jobs
        WHERE user_id = ${userId}
          AND (company_type = 'GCC' OR source ILIKE '%GCC Scan%')
      `;
      return Number(rows[0]?.n ?? 0);
    } catch {
      return 0;
    }
  };

  const buildMeta = (
    jobMeta: Awaited<ReturnType<typeof fetchJobMeta>>,
    latestEvent: Awaited<ReturnType<typeof fetchLatestEvent>>,
    lastGccScan: Awaited<ReturnType<typeof fetchLastGccScan>>,
    gccPipelineCount: number,
  ) => ({
    jobsTotal: jobMeta.jobs_total ?? 0,
    jobsRanked: jobMeta.jobs_ranked ?? 0,
    lastJobCreatedAt: jobMeta.last_job_created_at ?? null,
    lastJobUpdatedAt: jobMeta.last_job_updated_at ?? null,
    lastBackgroundEventId: latestEvent?.id ?? null,
    lastBackgroundActionScript: latestEvent?.action_script ?? null,
    lastBackgroundStatus: latestEvent?.status ?? null,
    lastBackgroundCompletedAt: latestEvent?.created_at ?? null,
    lastGccScanAdded: lastGccScan?.jobs_found != null ? Number(lastGccScan.jobs_found) : null,
    lastGccScanAt: lastGccScan?.created_at ?? null,
    gccPipelineCount,
    pipelinePageSize: PIPELINE_PAGE_SIZE,
  });

  if (opts?.pollOnly) {
    const [jobMeta, latestEvent, lastGccScan, gccPipelineCount] = await Promise.all([
      fetchJobMeta(),
      fetchLatestEvent(),
      fetchLastGccScan(),
      fetchGccPipelineCount(),
    ]);
    return {
      meta: buildMeta(jobMeta, latestEvent, lastGccScan, gccPipelineCount),
      timestamp: new Date().toISOString(),
    };
  }

  // Execute all queries concurrently in parallel
  const [
    jobMeta,
    applications,
    stats,
    pipeline,
    profile,
    pdfs,
    latestEvent,
    lastGccScan,
    gccPipelineCount,
  ] = await Promise.all([
    fetchJobMeta(),
    fetchApplications(),
    fetchStats(),
    fetchPipeline(),
    fetchProfile(),
    fetchPdfs(),
    fetchLatestEvent(),
    fetchLastGccScan(),
    fetchGccPipelineCount(),
  ]);

  return {
    applications,
    pipeline,
    pdfs,
    stats: stats || { total: 0, applied: 0, interviews: 0, offers: 0 },
    profile,
    meta: buildMeta(jobMeta, latestEvent, lastGccScan, gccPipelineCount),
    timestamp: new Date().toISOString()
  };
}
