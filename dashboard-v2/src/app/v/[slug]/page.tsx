import { notFound } from 'next/navigation';
import sql from '@/lib/db';
import { ensureApplicationTelemetrySchema } from '@/lib/ops-schema';
import type { ResumeContext } from '@/lib/resume/types';
import { CompanionViewerClient } from './CompanionViewerClient';

export const dynamic = 'force-dynamic';

export default async function WebCompanionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await ensureApplicationTelemetrySchema(sql);
  const { slug } = await params;

  const [track] = await sql`
    SELECT
      a.slug,
      a.company,
      a.role,
      a.user_id,
      a.github_url,
      a.linkedin_url
    FROM application_tracking a
    WHERE a.slug = ${slug}
    LIMIT 1
  `;

  if (!track) {
    notFound();
  }

  let name = 'Candidate';
  let headline = '';
  let location: string | null = null;

  try {
    const [profileRow] = await sql`
      SELECT resume_context
      FROM user_profiles
      WHERE user_id = ${Number(track.user_id)}
      LIMIT 1
    `;
    const ctx = (profileRow?.resume_context || {}) as ResumeContext;
    name = String(ctx.candidate?.full_name || '').trim() || name;
    headline = String(ctx.narrative?.headline || '').trim();
    location = String(ctx.candidate?.location || '').trim() || null;
  } catch {
    // Profile optional — companion still renders
  }

  return (
    <CompanionViewerClient
      slug={track.slug}
      name={name}
      headline={headline}
      company={track.company}
      role={track.role}
      githubUrl={track.github_url ? `/v/${track.slug}/gh` : null}
      linkedinUrl={track.linkedin_url ? `/v/${track.slug}/li` : null}
      location={location}
    />
  );
}
