import { notFound } from 'next/navigation';
import sql from '@/lib/db';
import { ensureApplicationTelemetrySchema } from '@/lib/ops-schema';
import { loadCompanionProfile } from '@/lib/telemetry/companion-profile';
import { invalidateTrackingCache, setCachedTracking } from '@/lib/telemetry/cache';
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
      a.id,
      a.slug,
      a.company,
      a.role,
      a.user_id,
      a.github_url,
      a.linkedin_url,
      a.portfolio_url
    FROM application_tracking a
    WHERE a.slug = ${slug}
    LIMIT 1
  `;

  if (!track) {
    notFound();
  }

  const profile = await loadCompanionProfile(sql, track.user_id);

  const githubDest = track.github_url || profile.githubUrl;
  const linkedinDest = track.linkedin_url || profile.linkedinUrl;
  const portfolioDest = track.portfolio_url || profile.portfolioUrl;

  if (
    (!track.github_url && githubDest) ||
    (!track.linkedin_url && linkedinDest) ||
    (!track.portfolio_url && portfolioDest)
  ) {
    try {
      await sql`
        UPDATE application_tracking
        SET
          github_url = COALESCE(github_url, ${githubDest}),
          linkedin_url = COALESCE(linkedin_url, ${linkedinDest}),
          portfolio_url = COALESCE(portfolio_url, ${portfolioDest})
        WHERE id = ${track.id}
      `;
      await invalidateTrackingCache(String(track.slug));
      void setCachedTracking(String(track.slug), {
        id: Number(track.id),
        github_url: githubDest,
        linkedin_url: linkedinDest,
        portfolio_url: portfolioDest,
      });
    } catch {
      // non-fatal
    }
  }

  return (
    <CompanionViewerClient
      slug={track.slug}
      name={profile.name}
      headline={profile.headline}
      summary={profile.summary}
      company={track.company}
      role={track.role}
      githubUrl={githubDest ? `/v/${track.slug}/gh` : null}
      linkedinUrl={linkedinDest ? `/v/${track.slug}/li` : null}
      location={profile.location}
    />
  );
}
