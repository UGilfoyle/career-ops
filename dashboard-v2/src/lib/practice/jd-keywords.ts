/**
 * Load root jd-keyword-align.mjs (same pattern as resume/jd-match).
 */
import { pathToFileURL } from 'url';
import { join } from 'path';

type JdKeywordMod = {
  extractJdKeywords: (jdText: string, limit?: number) => string[];
};

async function importJdKeywordAlign(): Promise<JdKeywordMod> {
  const candidates = [
    join(/* turbopackIgnore: true */ process.cwd(), '..', 'jd-keyword-align.mjs'),
    join(/* turbopackIgnore: true */ process.cwd(), 'runtime-assets', '..', '..', 'jd-keyword-align.mjs'),
  ];
  let lastErr: unknown;
  for (const file of candidates) {
    try {
      return (await import(/* webpackIgnore: true */ pathToFileURL(file).href)) as JdKeywordMod;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('jd-keyword-align.mjs not found');
}

export async function extractPracticeKeywords(jdText: string, limit = 20): Promise<string[]> {
  try {
    const mod = await importJdKeywordAlign();
    return (mod.extractJdKeywords(jdText || '', limit) || []).map(String).filter(Boolean);
  } catch (e) {
    console.warn('[practice] jd-keyword-align failed, using fallback extract:', e);
    return fallbackKeywords(jdText, limit);
  }
}

/** Lightweight fallback if mjs cannot load in the test/dev environment. */
function fallbackKeywords(jdText: string, limit: number): string[] {
  const known =
    /\b(TypeScript|JavaScript|Python|Java|Go|Node\.js|React|AWS|GCP|Azure|Docker|Kubernetes|PostgreSQL|Redis|Kafka|GraphQL|SQL|Microservices|System Design|Lambda|S3|Terraform)\b/gi;
  const found = new Set<string>();
  for (const m of String(jdText || '').matchAll(known)) {
    found.add(m[0]);
    if (found.size >= limit) break;
  }
  return [...found];
}

/**
 * Detect functional / vendor stacks where we should not invent deep vendor quizzes
 * for a backend/platform candidate.
 */
export function assessJdPracticeFit(
  jdText: string,
  keywords: string[],
): { tier: 'strong' | 'partial' | 'low'; note: string } {
  const text = String(jdText || '');
  const lower = text.toLowerCase();
  const kw = keywords.map((k) => k.toLowerCase()).join(' ');

  const functionalSignals = [
    /oracle\s+hcm/i,
    /\bhcm\s+cloud\b/i,
    /\bfusion\s+hcm\b/i,
    /\bbi\s*publisher\b/i,
    /\botbi\b/i,
    /peoplesoft/i,
    /workday\s+(hcm|functional)/i,
    /sap\s+(successfactors|functional\s+consultant)/i,
    /salesforce\s+admin/i,
    /functional\s+consultant/i,
  ];

  const backendSignals =
    /\b(api|backend|platform|distributed|microservices|kubernetes|node\.?js|typescript|java|golang|python|aws|system design)\b/i.test(
      `${lower} ${kw}`,
    );

  if (functionalSignals.some((re) => re.test(text))) {
    return {
      tier: 'low',
      note:
        'This JD looks functional/vendor-admin heavy. Practice pack stays general backend/platform — do not invent deep Fusion/BIP/HCM configuration quizzes.',
    };
  }

  if (backendSignals && keywords.length >= 4) {
    return {
      tier: 'strong',
      note: 'JD stack aligns with backend/platform practice themes.',
    };
  }

  if (keywords.length >= 2) {
    return {
      tier: 'partial',
      note: 'Partial stack overlap — pack emphasizes transferable backend, APIs, and system design.',
    };
  }

  return {
    tier: 'partial',
    note: 'Limited tech keywords extracted — generating a general senior backend practice pack.',
  };
}
