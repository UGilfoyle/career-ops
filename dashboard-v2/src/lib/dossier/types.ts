export type DossierBadge = {
  label: string;
  tier: 'emerald' | 'amber' | 'blue' | 'purple' | 'zinc';
  description?: string;
};

export type DossierMetric = {
  value: string;
  label: string;
  detail?: string;
};

export type DossierProject = {
  title: string;
  subtitle?: string;
  description: string;
  highlights?: string[];
  techStack?: string[];
  liveUrl?: string | null;
  githubUrl?: string | null;
};

export type DossierExperience = {
  role: string;
  company: string;
  period: string;
  highlights: string[];
};

export type PublicDossier = {
  slug: string;
  name: string;
  headline: string;
  location: string | null;
  summary: string | null;
  badges: DossierBadge[];
  metrics: DossierMetric[];
  skills: Record<string, string[]>;
  featuredProjects: DossierProject[];
  experience: DossierExperience[];
  socials: {
    githubUrl: string | null;
    linkedinUrl: string | null;
    portfolioUrl: string | null;
  };
  hasPdf: boolean;
  pdfDownloadUrl: string;
  readinessScore?: number;
  lastUpdated: string;
};

export type DossierConfig = {
  slug: string;
  enabled: boolean;
  customBadges?: string[];
  customBio?: string;
  customMetrics?: DossierMetric[];
  highlightProjects?: string[];
};
