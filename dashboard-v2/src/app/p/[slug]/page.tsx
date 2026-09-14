import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getDossierBySlug } from '@/lib/dossier/dossier-service';
import { DossierView } from './DossierView';

export const revalidate = 300; // 5-minute Incremental Static Regeneration

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const dossier = await getDossierBySlug(slug);

  if (!dossier) {
    return {
      title: 'Candidate Not Found | Career-Ops',
    };
  }

  const title = `${dossier.name} — Engineering Dossier`;
  const description = `${dossier.headline} | Verified ATS Match, System Architecture & Proof of Work.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'profile',
      url: `https://careerops.dpdns.org/p/${dossier.slug}`,
      siteName: 'Career-Ops',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

export default async function DossierPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const dossier = await getDossierBySlug(slug);

  if (!dossier) {
    notFound();
  }

  return <DossierView dossier={dossier} />;
}
