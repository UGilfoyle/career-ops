import sql from '@/lib/db';
import { ensureBackgroundSchema, ensureMasterPdfSchema } from '@/lib/ops-schema';

export type UserAnalyticsRow = {
  id: number;
  name: string;
  email: string;
  created_at: string | null;
  jobs_count: number;
  tailored_jobs: number;
  resume_html_count: number;
  resume_pdf_r2_count: number;
  cover_letter_count: number;
  applications_count: number;
  master_pdf_exports: number;
  github_runs_total: number;
  github_runs_success: number;
  github_runs_failure: number;
  tailor_runs: number;
  tailor_runs_success: number;
  scan_runs: number;
  apply_runs: number;
  last_job_at: string | null;
  last_tailored_at: string | null;
  last_github_run_at: string | null;
};

export type AnalyticsSummary = {
  total_users: number;
  active_users_7d: number;
  total_jobs: number;
  tailored_jobs: number;
  resume_pdf_r2: number;
  total_applications: number;
  github_runs_total: number;
  github_runs_success: number;
  github_runs_failure: number;
  tailor_runs: number;
  tailor_runs_success: number;
  tailor_output_rate: number | null;
  scan_runs: number;
  apply_runs: number;
  master_pdf_exports: number;
};

export type DailyActivityRow = {
  date: string;
  signups: number;
  jobs_added: number;
  tailored_jobs: number;
  github_runs: number;
  applications: number;
};

function rowNum(v: unknown): number {
  return Number(v ?? 0);
}

function iso(v: unknown): string | null {
  if (!v) return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export async function fetchProductAnalytics(): Promise<{
  summary: AnalyticsSummary;
  users: UserAnalyticsRow[];
  daily: DailyActivityRow[];
}> {
  await ensureBackgroundSchema(sql);
  await ensureMasterPdfSchema(sql);
  const [summaryRows, userRows, dailyRows] = await Promise.all([
    sql`
      SELECT
        (SELECT COUNT(*)::int FROM users) AS total_users,
        (
          SELECT COUNT(DISTINCT u.id)::int FROM users u
          WHERE EXISTS (
            SELECT 1 FROM jobs j
            WHERE j.user_id = u.id AND j.created_at >= NOW() - INTERVAL '7 days'
          )
          OR EXISTS (
            SELECT 1 FROM background_runs br
            WHERE br.user_id = u.id::text AND br.queued_at >= NOW() - INTERVAL '7 days'
          )
        ) AS active_users_7d,
        (SELECT COUNT(*)::int FROM jobs) AS total_jobs,
        (
          SELECT COUNT(*)::int FROM jobs j
          WHERE j.resume_html IS NOT NULL
             OR j.cover_letter_html IS NOT NULL
             OR j.resume_pdf_key IS NOT NULL
             OR j.cover_letter_pdf_key IS NOT NULL
             OR j.resume_pdf IS NOT NULL
             OR j.cover_letter_pdf IS NOT NULL
        ) AS tailored_jobs,
        (SELECT COUNT(*)::int FROM jobs WHERE resume_pdf_key IS NOT NULL) AS resume_pdf_r2,
        (SELECT COUNT(*)::int FROM applications) AS total_applications,
        (SELECT COUNT(*)::int FROM background_runs) AS github_runs_total,
        (SELECT COUNT(*)::int FROM background_runs WHERE status = 'success') AS github_runs_success,
        (SELECT COUNT(*)::int FROM background_runs WHERE status = 'failure') AS github_runs_failure,
        (
          SELECT COUNT(*)::int FROM background_runs
          WHERE action_script ILIKE '%agentic-tailor%'
             OR COALESCE(action_type, '') = 'tailor'
        ) AS tailor_runs,
        (
          SELECT COUNT(*)::int FROM background_runs
          WHERE (action_script ILIKE '%agentic-tailor%' OR COALESCE(action_type, '') = 'tailor')
            AND status = 'success'
        ) AS tailor_runs_success,
        (
          SELECT COUNT(*)::int FROM background_runs
          WHERE action_script ILIKE '%scratch-scan%'
             OR COALESCE(action_type, '') = 'scan'
        ) AS scan_runs,
        (
          SELECT COUNT(*)::int FROM background_runs
          WHERE action_script ILIKE '%auto-apply%'
             OR COALESCE(action_type, '') = 'apply'
        ) AS apply_runs,
        (SELECT COUNT(*)::int FROM master_pdf_exports) AS master_pdf_exports
    `,
    sql`
      SELECT
        u.id,
        u.name,
        u.email,
        u.created_at,
        COUNT(DISTINCT j.id)::int AS jobs_count,
        COUNT(DISTINCT j.id) FILTER (
          WHERE j.resume_html IS NOT NULL
             OR j.cover_letter_html IS NOT NULL
             OR j.resume_pdf_key IS NOT NULL
             OR j.cover_letter_pdf_key IS NOT NULL
             OR j.resume_pdf IS NOT NULL
             OR j.cover_letter_pdf IS NOT NULL
        )::int AS tailored_jobs,
        COUNT(DISTINCT j.id) FILTER (WHERE j.resume_html IS NOT NULL)::int AS resume_html_count,
        COUNT(DISTINCT j.id) FILTER (WHERE j.resume_pdf_key IS NOT NULL)::int AS resume_pdf_r2_count,
        COUNT(DISTINCT j.id) FILTER (
          WHERE j.cover_letter_html IS NOT NULL OR j.cover_letter_pdf_key IS NOT NULL
        )::int AS cover_letter_count,
        (SELECT COUNT(*)::int FROM applications a WHERE a.user_id = u.id) AS applications_count,
        (
          SELECT COUNT(*)::int FROM master_pdf_exports m
          WHERE m.user_id = u.id::text
        ) AS master_pdf_exports,
        (
          SELECT COUNT(*)::int FROM background_runs br WHERE br.user_id = u.id::text
        ) AS github_runs_total,
        (
          SELECT COUNT(*)::int FROM background_runs br
          WHERE br.user_id = u.id::text AND br.status = 'success'
        ) AS github_runs_success,
        (
          SELECT COUNT(*)::int FROM background_runs br
          WHERE br.user_id = u.id::text AND br.status = 'failure'
        ) AS github_runs_failure,
        (
          SELECT COUNT(*)::int FROM background_runs br
          WHERE br.user_id = u.id::text
            AND (br.action_script ILIKE '%agentic-tailor%' OR COALESCE(br.action_type, '') = 'tailor')
        ) AS tailor_runs,
        (
          SELECT COUNT(*)::int FROM background_runs br
          WHERE br.user_id = u.id::text
            AND (br.action_script ILIKE '%agentic-tailor%' OR COALESCE(br.action_type, '') = 'tailor')
            AND br.status = 'success'
        ) AS tailor_runs_success,
        (
          SELECT COUNT(*)::int FROM background_runs br
          WHERE br.user_id = u.id::text
            AND (br.action_script ILIKE '%scratch-scan%' OR COALESCE(br.action_type, '') = 'scan')
        ) AS scan_runs,
        (
          SELECT COUNT(*)::int FROM background_runs br
          WHERE br.user_id = u.id::text
            AND (br.action_script ILIKE '%auto-apply%' OR COALESCE(br.action_type, '') = 'apply')
        ) AS apply_runs,
        MAX(j.created_at) AS last_job_at,
        MAX(j.updated_at) FILTER (
          WHERE j.resume_html IS NOT NULL
             OR j.cover_letter_html IS NOT NULL
             OR j.resume_pdf_key IS NOT NULL
             OR j.cover_letter_pdf_key IS NOT NULL
             OR j.resume_pdf IS NOT NULL
             OR j.cover_letter_pdf IS NOT NULL
        ) AS last_tailored_at,
        (
          SELECT MAX(br.queued_at) FROM background_runs br WHERE br.user_id = u.id::text
        ) AS last_github_run_at
      FROM users u
      LEFT JOIN jobs j ON j.user_id = u.id
      GROUP BY u.id, u.name, u.email, u.created_at
      ORDER BY tailored_jobs DESC, jobs_count DESC, u.id DESC
    `,
    sql`
      WITH days AS (
        SELECT generate_series(
          (CURRENT_DATE - INTERVAL '13 days')::date,
          CURRENT_DATE,
          '1 day'::interval
        )::date AS day
      )
      SELECT
        d.day::text AS date,
        (
          SELECT COUNT(*)::int FROM users u
          WHERE u.created_at::date = d.day
        ) AS signups,
        (
          SELECT COUNT(*)::int FROM jobs j
          WHERE j.created_at::date = d.day
        ) AS jobs_added,
        (
          SELECT COUNT(*)::int FROM jobs j
          WHERE j.updated_at::date = d.day
            AND (
              j.resume_html IS NOT NULL
              OR j.cover_letter_html IS NOT NULL
              OR j.resume_pdf_key IS NOT NULL
              OR j.cover_letter_pdf_key IS NOT NULL
              OR j.resume_pdf IS NOT NULL
              OR j.cover_letter_pdf IS NOT NULL
            )
        ) AS tailored_jobs,
        (
          SELECT COUNT(*)::int FROM background_runs br
          WHERE br.queued_at::date = d.day
        ) AS github_runs,
        (
          SELECT COUNT(*)::int FROM applications a
          WHERE a.applied_at::date = d.day
        ) AS applications
      FROM days d
      ORDER BY d.day ASC
    `,
  ]);

  const s = summaryRows[0] || {};
  const tailorRuns = rowNum(s.tailor_runs);
  const tailoredJobs = rowNum(s.tailored_jobs);

  const summary: AnalyticsSummary = {
    total_users: rowNum(s.total_users),
    active_users_7d: rowNum(s.active_users_7d),
    total_jobs: rowNum(s.total_jobs),
    tailored_jobs: tailoredJobs,
    resume_pdf_r2: rowNum(s.resume_pdf_r2),
    total_applications: rowNum(s.total_applications),
    github_runs_total: rowNum(s.github_runs_total),
    github_runs_success: rowNum(s.github_runs_success),
    github_runs_failure: rowNum(s.github_runs_failure),
    tailor_runs: tailorRuns,
    tailor_runs_success: rowNum(s.tailor_runs_success),
    tailor_output_rate: tailorRuns > 0 ? Math.round((tailoredJobs / tailorRuns) * 1000) / 1000 : null,
    scan_runs: rowNum(s.scan_runs),
    apply_runs: rowNum(s.apply_runs),
    master_pdf_exports: rowNum(s.master_pdf_exports),
  };

  const users: UserAnalyticsRow[] = userRows.map((row: Record<string, unknown>) => ({
    id: rowNum(row.id),
    name: String(row.name || ''),
    email: String(row.email || ''),
    created_at: iso(row.created_at),
    jobs_count: rowNum(row.jobs_count),
    tailored_jobs: rowNum(row.tailored_jobs),
    resume_html_count: rowNum(row.resume_html_count),
    resume_pdf_r2_count: rowNum(row.resume_pdf_r2_count),
    cover_letter_count: rowNum(row.cover_letter_count),
    applications_count: rowNum(row.applications_count),
    master_pdf_exports: rowNum(row.master_pdf_exports),
    github_runs_total: rowNum(row.github_runs_total),
    github_runs_success: rowNum(row.github_runs_success),
    github_runs_failure: rowNum(row.github_runs_failure),
    tailor_runs: rowNum(row.tailor_runs),
    tailor_runs_success: rowNum(row.tailor_runs_success),
    scan_runs: rowNum(row.scan_runs),
    apply_runs: rowNum(row.apply_runs),
    last_job_at: iso(row.last_job_at),
    last_tailored_at: iso(row.last_tailored_at),
    last_github_run_at: iso(row.last_github_run_at),
  }));

  const daily: DailyActivityRow[] = dailyRows.map((row: Record<string, unknown>) => ({
    date: String(row.date),
    signups: rowNum(row.signups),
    jobs_added: rowNum(row.jobs_added),
    tailored_jobs: rowNum(row.tailored_jobs),
    github_runs: rowNum(row.github_runs),
    applications: rowNum(row.applications),
  }));

  return { summary, users, daily };
}
