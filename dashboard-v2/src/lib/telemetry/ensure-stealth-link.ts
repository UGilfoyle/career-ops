import type postgres from 'postgres';
import { ensureApplicationTelemetrySchema } from '@/lib/ops-schema';
import { buildTrackingSlug } from '@/lib/telemetry/urls';
import { invalidateTrackingCache, setCachedTracking } from '@/lib/telemetry/cache';
import { loadCompanionProfile } from '@/lib/telemetry/companion-profile';

export type StealthLinkResult = {
  ok: true;
  applicationId: number;
  slug: string;
  url: string;
  view_count: number;
  click_count: number;
  total_dwell_sec: number;
  last_engaged_at: string | null;
  created: boolean;
  applicationCreated: boolean;
  profile_name: string;
};

export type StealthLinkError = { ok: false; error: string; status: number };

/**
 * Ensure an application row exists for this job (EVALUATED, no applied_at)
 * then ensure a stealth companion tracking link. Safe to call before Apply.
 */
export async function ensureStealthLinkForJob(
  sql: postgres.Sql,
  opts: { userId: string; jobId: number; origin: string }
): Promise<StealthLinkResult | StealthLinkError> {
  const { userId, jobId, origin } = opts;
  if (!Number.isFinite(jobId) || jobId <= 0) {
    return { ok: false, error: 'Invalid job id', status: 400 };
  }

  await ensureApplicationTelemetrySchema(sql);

  const [job] = await sql`
    SELECT id, company, title
    FROM jobs
    WHERE id = ${jobId} AND user_id = ${userId}
    LIMIT 1
  `;
  if (!job) {
    return { ok: false, error: 'Job not found', status: 404 };
  }

  let applicationCreated = false;
  let [app] = await sql`
    SELECT id, status, applied_at
    FROM applications
    WHERE job_id = ${jobId} AND user_id = ${userId}
    LIMIT 1
  `;

  if (!app) {
    const inserted = await sql`
      INSERT INTO applications (job_id, user_id, status)
      VALUES (${jobId}, ${userId}, 'EVALUATED')
      RETURNING id, status, applied_at
    `;
    app = inserted[0];
    applicationCreated = true;
  }

  return ensureStealthLinkForApplication(sql, {
    userId,
    applicationId: Number(app.id),
    company: String(job.company || 'Company'),
    role: String(job.title || ''),
    origin,
    applicationCreated,
  });
}

export async function ensureStealthLinkForApplication(
  sql: postgres.Sql,
  opts: {
    userId: string;
    applicationId: number;
    company: string;
    role: string;
    origin: string;
    applicationCreated?: boolean;
  }
): Promise<StealthLinkResult | StealthLinkError> {
  const {
    userId,
    applicationId,
    company,
    role,
    origin,
    applicationCreated = false,
  } = opts;

  await ensureApplicationTelemetrySchema(sql);

  const profile = await loadCompanionProfile(sql, userId);
  const githubUrl = profile.githubUrl;
  const linkedinUrl = profile.linkedinUrl;
  const portfolioUrl = profile.portfolioUrl;

  const [existing] = await sql`
    SELECT id, slug, view_count, click_count, total_dwell_sec, last_engaged_at
    FROM application_tracking
    WHERE application_id = ${applicationId} AND user_id = ${userId}
    LIMIT 1
  `;

  if (existing) {
    await sql`
      UPDATE application_tracking
      SET
        github_url = ${githubUrl},
        linkedin_url = ${linkedinUrl},
        portfolio_url = ${portfolioUrl},
        company = ${company},
        role = ${role}
      WHERE id = ${existing.id}
    `;
    await invalidateTrackingCache(String(existing.slug));
    void setCachedTracking(String(existing.slug), {
      id: Number(existing.id),
      github_url: githubUrl,
      linkedin_url: linkedinUrl,
      portfolio_url: portfolioUrl,
    });
    const personalUrl = portfolioUrl && /^https?:\/\//i.test(portfolioUrl)
      ? `${portfolioUrl.replace(/\/+$/, '')}/?ref=${existing.slug}`
      : `${origin}/v/${existing.slug}`;

    return {
      ok: true,
      applicationId,
      slug: String(existing.slug),
      url: personalUrl,
      view_count: Number(existing.view_count ?? 0),
      click_count: Number(existing.click_count ?? 0),
      total_dwell_sec: Number(existing.total_dwell_sec ?? 0),
      last_engaged_at: existing.last_engaged_at
        ? String(existing.last_engaged_at)
        : null,
      created: false,
      applicationCreated,
      profile_name: profile.name,
    };
  }

  let slug = buildTrackingSlug(company, role);
  let insertedId: number | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const rows = await sql`
        INSERT INTO application_tracking (
          user_id, application_id, slug, company, role,
          github_url, linkedin_url, portfolio_url
        )
        VALUES (
          ${userId}, ${applicationId}, ${slug},
          ${company}, ${role},
          ${githubUrl}, ${linkedinUrl}, ${portfolioUrl}
        )
        RETURNING id
      `;
      insertedId = Number(rows[0]?.id);
      break;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('unique') || msg.includes('duplicate')) {
        slug = buildTrackingSlug(company, role);
        continue;
      }
      throw err;
    }
  }

  if (insertedId) {
    await invalidateTrackingCache(slug);
    void setCachedTracking(slug, {
      id: insertedId,
      github_url: githubUrl,
      linkedin_url: linkedinUrl,
      portfolio_url: portfolioUrl,
    });
  }

  const personalUrl = portfolioUrl && /^https?:\/\//i.test(portfolioUrl)
    ? `${portfolioUrl.replace(/\/+$/, '')}/?ref=${slug}`
    : `${origin}/v/${slug}`;

  return {
    ok: true,
    applicationId,
    slug,
    url: personalUrl,
    view_count: 0,
    click_count: 0,
    total_dwell_sec: 0,
    last_engaged_at: null,
    created: true,
    applicationCreated,
    profile_name: profile.name,
  };
}
