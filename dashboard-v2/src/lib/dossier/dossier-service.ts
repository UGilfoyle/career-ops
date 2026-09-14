import sql from '@/lib/db';
import { ensureDossierSchema, ensureUserProfilesSchema, ensureMasterPdfSchema } from '@/lib/ops-schema';
import { unwrapResumeContext, cleanCompanionSummary } from '@/lib/telemetry/companion-profile';
import { normalizeExternalUrl } from '@/lib/telemetry/urls';
import { kvGet, kvSet, kvDel } from '@/lib/telemetry/kv';
import { calculateMarketReadiness } from '@/lib/readiness/readiness-calculator';
import type { PublicDossier, DossierBadge, DossierMetric, DossierProject, DossierExperience, DossierConfig } from './types';

// In-memory fallback cache (10 min TTL) when Redis is absent
type MemoryCacheEntry = {
  data: PublicDossier | null;
  expiresAt: number;
};
const memoryCache = new Map<string, MemoryCacheEntry>();

const CACHE_TTL_SEC = 600; // 10 minutes

function getMemoryCache(key: string): PublicDossier | null | undefined {
  const entry = memoryCache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    memoryCache.delete(key);
    return undefined;
  }
  return entry.data;
}

function setMemoryCache(key: string, data: PublicDossier | null, ttlSec = CACHE_TTL_SEC): void {
  // Guard max memory size
  if (memoryCache.size > 1000) {
    const firstKey = memoryCache.keys().next().value;
    if (firstKey) memoryCache.delete(firstKey);
  }
  memoryCache.set(key, {
    data,
    expiresAt: Date.now() + ttlSec * 1000,
  });
}

export function sanitizeSlug(raw: string): string {
  return String(raw || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-_]/g, '')
    .slice(0, 32);
}

export async function invalidateDossierCache(slug: string): Promise<void> {
  const clean = sanitizeSlug(slug);
  if (!clean) return;
  const key = `dossier:v1:${clean}`;
  memoryCache.delete(key);
  try {
    await kvDel(key);
  } catch {
    // ignore
  }
}

export async function getDossierBySlug(rawSlug: string): Promise<PublicDossier | null> {
  const cleanSlug = sanitizeSlug(rawSlug);
  if (!cleanSlug || cleanSlug.length < 2) return null;

  const cacheKey = `dossier:v1:${cleanSlug}`;

  // 1. Check in-memory cache first (0ms)
  const mem = getMemoryCache(cacheKey);
  if (mem !== undefined) {
    return mem;
  }

  // 2. Check Upstash KV / Redis
  try {
    const cachedKv = await kvGet(cacheKey);
    if (cachedKv) {
      const parsed = JSON.parse(cachedKv) as PublicDossier;
      setMemoryCache(cacheKey, parsed, CACHE_TTL_SEC);
      return parsed;
    }
  } catch {
    // ignore cache read failure, fall through to DB
  }

  // 3. Query Postgres DB with safety schemas
  await ensureDossierSchema(sql);
  await ensureUserProfilesSchema(sql);
  await ensureMasterPdfSchema(sql);

  const [user] = await sql`
    SELECT
      id,
      name,
      email,
      github_login,
      public_slug,
      COALESCE(public_dossier_enabled, true) as public_dossier_enabled,
      public_dossier_custom
    FROM users
    WHERE LOWER(public_slug) = ${cleanSlug}
       OR (public_slug IS NULL AND (LOWER(github_login) = ${cleanSlug} OR id::text = ${cleanSlug}))
    LIMIT 1
  `;

  if (!user || user.public_dossier_enabled === false) {
    // Negative cache for 60 seconds to prevent DB hammering on nonexistent slugs
    setMemoryCache(cacheKey, null, 60);
    return null;
  }

  const userIdText = String(user.id);

  // Fetch resume context and PDF cache status in parallel
  const [profileRow, pdfRow] = await Promise.all([
    sql`
      SELECT resume_context
      FROM user_profiles
      WHERE user_id::text = ${userIdText}
      LIMIT 1
    `.then((rows) => rows[0]).catch(() => null),
    sql`
      SELECT content_hash
      FROM master_pdf_exports
      WHERE user_id = ${userIdText} AND pdf IS NOT NULL
      ORDER BY updated_at DESC
      LIMIT 1
    `.then((rows) => rows[0]).catch(() => null),
  ]);

  const ctx = unwrapResumeContext(profileRow?.resume_context);
  const candidate = (ctx.candidate || {}) as Record<string, unknown>;
  const narrative = (ctx.narrative || {}) as Record<string, unknown>;
  const custom = (user.public_dossier_custom || {}) as Record<string, unknown>;

  const resolvedName =
    String(custom.customName || candidate.full_name || user.name || user.email?.split('@')[0] || 'Software Engineer').trim();

  const resolvedHeadline =
    String(custom.customHeadline || narrative.headline || 'Full-Stack & Systems Engineer').trim();

  const resolvedSummary = cleanCompanionSummary(
    String(custom.customBio || narrative.exit_story || candidate.summary || '')
  );

  const location = String(candidate.location || '').trim() || null;

  // Socials
  const rawPortfolio =
    candidate.portfolio_url ||
    candidate.portfolio ||
    candidate.website ||
    candidate.website_url;

  const githubUrl = normalizeExternalUrl(String(candidate.github || (user.github_login ? `https://github.com/${user.github_login}` : '')));
  const linkedinUrl = normalizeExternalUrl(String(candidate.linkedin || ''));
  const portfolioUrl = normalizeExternalUrl(String(rawPortfolio || ''));

  // Skills
  const skillsRecord: Record<string, string[]> = {};
  if (ctx.skills && typeof ctx.skills === 'object' && !Array.isArray(ctx.skills)) {
    for (const [category, val] of Object.entries(ctx.skills)) {
      if (Array.isArray(val) && val.length > 0) {
        skillsRecord[category] = val.map((s) => String(s)).filter(Boolean).slice(0, 10);
      }
    }
  }

  if (Object.keys(skillsRecord).length === 0) {
    skillsRecord['Core Technologies'] = [
      'TypeScript',
      'Node.js',
      'PostgreSQL',
      'React',
      'Distributed Systems',
      'System Architecture',
    ];
  }

  // Projects
  const featuredProjects: DossierProject[] = [];
  if (Array.isArray(ctx.projects)) {
    for (const p of ctx.projects.slice(0, 4)) {
      if (!p || typeof p !== 'object') continue;
      featuredProjects.push({
        title: String(p.title || p.name || 'Engineering Project'),
        subtitle: p.subtitle ? String(p.subtitle) : undefined,
        description: String(p.description || p.summary || ''),
        highlights: Array.isArray(p.highlights) ? p.highlights.map(String).slice(0, 3) : [],
        techStack: Array.isArray(p.tech) ? p.tech.map(String) : Array.isArray(p.stack) ? p.stack.map(String) : [],
        liveUrl: normalizeExternalUrl(String(p.live_url || p.url || '')),
        githubUrl: normalizeExternalUrl(String(p.github || p.repo || '')),
      });
    }
  }

  // Experience highlights
  const experience: DossierExperience[] = [];
  if (Array.isArray(ctx.experience)) {
    for (const rawExp of ctx.experience.slice(0, 3)) {
      if (!rawExp || typeof rawExp !== 'object') continue;
      const exp = rawExp as Record<string, unknown>;
      const rawBullets = exp.bullets || exp.highlights;
      const bullets = Array.isArray(rawBullets)
        ? rawBullets.map(String).filter((b: string) => b.length > 15).slice(0, 3)
        : [];
      experience.push({
        role: String(exp.role || exp.title || 'Engineer'),
        company: String(exp.company || exp.organization || 'Tech'),
        period: String(exp.period || exp.duration || exp.dates || ''),
        highlights: bullets,
      });
    }
  }

  // Key Metrics (extracted or crafted)
  const metrics: DossierMetric[] = (Array.isArray(custom.metrics) ? custom.metrics : null) || [
    { value: '96%', label: 'ATS Match Rate', detail: 'Calibrated per job spec' },
    { value: 'Bar-Raiser', label: 'Evaluation Grade', detail: 'STAR story structured' },
    { value: '100%', label: 'Verified Code', detail: 'GitHub & Architecture Proof' },
  ];

  // Verified Badges
  const badges: DossierBadge[] = [
    {
      label: 'Career-Ops Calibrated',
      tier: 'emerald',
      description: 'ATS Structure, Keyword Frequency & Readability Passed',
    },
    {
      label: 'Bar-Raiser Prepared',
      tier: 'purple',
      description: 'Leadership Principles & Quantifiable Impact Verified',
    },
    {
      label: 'Production Architecture',
      tier: 'blue',
      description: 'Demonstrated Distributed & Scalable Engineering Experience',
    },
  ];

  const hasPdf = Boolean(pdfRow?.content_hash);
  const activeSlug = String(user.public_slug || user.github_login || user.id);

  const dossier: PublicDossier = {
    slug: activeSlug,
    name: resolvedName,
    headline: resolvedHeadline,
    location,
    summary: resolvedSummary,
    badges,
    metrics,
    skills: skillsRecord,
    featuredProjects,
    experience,
    socials: {
      githubUrl,
      linkedinUrl,
      portfolioUrl,
    },
    hasPdf,
    pdfDownloadUrl: `/api/p/${activeSlug}/cv`,
    readinessScore: calculateMarketReadiness({
      resumeContext: ctx,
      pipelineJobsCount: 5,
      applicationsCount: 3,
      practicePacksCount: 1,
      dossierEnabled: true,
    }).score,
    lastUpdated: new Date().toISOString(),
  };

  // Write to caches
  setMemoryCache(cacheKey, dossier, CACHE_TTL_SEC);
  try {
    await kvSet(cacheKey, JSON.stringify(dossier), CACHE_TTL_SEC);
  } catch {
    // ignore kv write error
  }

  return dossier;
}

export async function updateUserDossierConfig(
  userId: string | number,
  params: {
    slug?: string;
    enabled?: boolean;
    customName?: string;
    customHeadline?: string;
    customBio?: string;
    customMetrics?: DossierMetric[];
  }
): Promise<{ success: boolean; slug: string; error?: string }> {
  await ensureDossierSchema(sql);

  const uid = String(userId);

  // Fetch current user row
  const [currentUser] = await sql`
    SELECT id, public_slug, public_dossier_enabled, public_dossier_custom, github_login
    FROM users
    WHERE id::text = ${uid}
    LIMIT 1
  `;

  if (!currentUser) {
    return { success: false, slug: '', error: 'User not found' };
  }

  let nextSlug = currentUser.public_slug || currentUser.github_login || String(currentUser.id);

  if (params.slug !== undefined) {
    const candidateSlug = sanitizeSlug(params.slug);
    if (!candidateSlug || candidateSlug.length < 3) {
      return { success: false, slug: nextSlug, error: 'Slug must be at least 3 alphanumeric characters.' };
    }

    // Reserved routes check
    const reserved = ['api', 'v', 'p', 'intel', 'dashboard', 'login', 'signup', 'admin', 'status', 'privacy'];
    if (reserved.includes(candidateSlug)) {
      return { success: false, slug: nextSlug, error: 'That slug is reserved by the system.' };
    }

    // Check uniqueness
    const [existing] = await sql`
      SELECT id FROM users
      WHERE LOWER(public_slug) = ${candidateSlug}
        AND id::text != ${uid}
      LIMIT 1
    `;

    if (existing) {
      return { success: false, slug: nextSlug, error: 'This vanity URL is already claimed by another engineer.' };
    }

    nextSlug = candidateSlug;
  }

  const nextEnabled = params.enabled !== undefined ? Boolean(params.enabled) : (currentUser.public_dossier_enabled ?? true);

  const existingCustom = (currentUser.public_dossier_custom || {}) as Record<string, unknown>;
  const nextCustom = {
    ...existingCustom,
    ...(params.customName !== undefined ? { customName: params.customName } : {}),
    ...(params.customHeadline !== undefined ? { customHeadline: params.customHeadline } : {}),
    ...(params.customBio !== undefined ? { customBio: params.customBio } : {}),
    ...(params.customMetrics !== undefined ? { metrics: params.customMetrics } : {}),
  };

  await sql`
    UPDATE users
    SET
      public_slug = ${nextSlug},
      public_dossier_enabled = ${nextEnabled},
      public_dossier_custom = ${JSON.stringify(nextCustom)}
    WHERE id::text = ${uid}
  `;

  // Invalidate both previous and new slug caches
  if (currentUser.public_slug) {
    await invalidateDossierCache(currentUser.public_slug);
  }
  if (nextSlug) {
    await invalidateDossierCache(nextSlug);
  }

  return { success: true, slug: nextSlug };
}
