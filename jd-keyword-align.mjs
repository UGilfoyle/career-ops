/**
 * jd-keyword-align.mjs — Extract JD keywords and align tailored resume content.
 */

const KNOWN_TECH = [
  'JavaScript', 'TypeScript', 'Python', 'Java', 'Go', 'Golang', 'Rust', 'C#', '.NET', 'Ruby', 'PHP', 'Kotlin', 'Swift', 'Scala',
  'React', 'React.js', 'Redux', 'Angular', 'Vue.js', 'Next.js', 'NestJS', 'Express', 'FastAPI', 'Django', 'Spring Boot', 'Node.js',
  'PostgreSQL', 'Postgres', 'MySQL', 'MongoDB', 'Redis', 'DynamoDB', 'Elasticsearch', 'Aurora',
  'AWS', 'GCP', 'Azure', 'Docker', 'Kubernetes', 'Terraform', 'CI/CD',
  'ECS', 'Lambda', 'S3', 'EC2', 'CloudFormation', 'IAM', 'VPC', 'SQS', 'SNS',
  'Kafka', 'RabbitMQ', 'GraphQL', 'REST API', 'RESTful API', 'gRPC',
  'Jenkins', 'GitHub Actions', 'GitLab CI', 'Prometheus', 'Grafana', 'Datadog',
  'Jest', 'Cypress', 'Playwright', 'Webpack', 'Vite',
  'Git', 'Agile', 'Scrum', 'Microservices', 'System Design',
  'Machine Learning', 'ML', 'LLM', 'RAG', 'LangChain', 'PyTorch', 'TensorFlow',
  'Cursor', 'Copilot', 'GitHub Copilot', 'Github Copilot',
  '.NET Core', '.NET', 'C#',
  'Snowflake', 'Spark', 'Airflow', 'dbt', 'Databricks',
];

const JD_SECTION_HINTS = [
  /requirements?:/i,
  /qualifications?:/i,
  /must have/i,
  /nice to have/i,
  /skills?:/i,
  /responsibilities?:/i,
  /what you.ll bring/i,
  /you have/i,
  /experience with/i,
];

const STOPWORDS = new Set([
  'with', 'that', 'this', 'from', 'have', 'will', 'your', 'team', 'work', 'role', 'join',
  'about', 'their', 'they', 'them', 'such', 'than', 'then', 'when', 'where', 'which', 'while',
  'years', 'year', 'experience', 'required', 'preferred', 'ability', 'strong', 'good', 'great',
  'including', 'within', 'across', 'using', 'other', 'well', 'also', 'able', 'both', 'each',
  'job', 'title', 'company', 'description', 'location', 'department',
  'requirements', 'qualifications', 'responsibilities', 'skills',
  'build', 'own', 'design', 'develop', 'implement', 'support', 'ensure', 'drive',
  // Generic JD filler — never put these on a resume as "skills"
  'software', 'application', 'applications', 'system', 'systems', 'platform', 'platforms',
  'service', 'services', 'product', 'products', 'solution', 'solutions', 'tool', 'tools',
  'engineer', 'engineering', 'developer', 'development', 'technology', 'technologies',
  'computer', 'code', 'coding', 'project', 'projects', 'business', 'process', 'processes',
  'quality', 'delivery', 'deliver', 'maintain', 'create', 'manage', 'leading', 'senior',
  'junior', 'level', 'knowledge', 'understanding', 'familiar', 'proficient', 'expertise',
]);

const KNOWN_TECH_LOWER = new Set(KNOWN_TECH.map((t) => t.toLowerCase()));

function normalizeKeyword(kw) {
  return String(kw || '').trim().replace(/\s+/g, ' ');
}

function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** True when a token is a real tech/skill worth putting on a resume. */
export function isWeaveableKeyword(kw) {
  const raw = normalizeKeyword(kw);
  if (!raw || raw.length < 2) return false;
  const lower = raw.toLowerCase();
  if (STOPWORDS.has(lower)) return false;
  if (KNOWN_TECH_LOWER.has(lower)) return true;
  // Allow known-tech aliases with loose punctuation (node js → node.js)
  const compact = lower.replace(/[.\s]/g, '');
  for (const tech of KNOWN_TECH_LOWER) {
    const techCompact = tech.replace(/[.\s]/g, '');
    if (techCompact === compact) return true;
  }
  // Multi-word Title Case skill phrases (e.g. "System Design") — not single junk nouns
  if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}$/.test(raw)) {
    const words = lower.split(/\s+/);
    if (words.every((w) => !STOPWORDS.has(w))) return true;
  }
  return false;
}

/** Keep only resume-worthy JD keywords (drops "Software", "applications", etc.). */
export function filterWeaveableKeywords(keywords) {
  return uniqueCasePreserved((keywords || []).map(normalizeKeyword).filter(isWeaveableKeyword));
}

/** Canonical casing for known tech when available. */
export function canonicalizeTechKeyword(kw) {
  const raw = normalizeKeyword(kw);
  if (!raw) return raw;
  const lower = raw.toLowerCase();
  const exact = KNOWN_TECH.find((t) => t.toLowerCase() === lower);
  if (exact) return exact;
  const compact = lower.replace(/[.\s]/g, '');
  const loose = KNOWN_TECH.find((t) => t.toLowerCase().replace(/[.\s]/g, '') === compact);
  return loose || raw;
}

function findKnownTechInText(text) {
  const found = [];
  const occupied = [];
  const sorted = [...KNOWN_TECH].sort((a, b) => b.length - a.length);

  for (const tech of sorted) {
    const escaped = escapeRe(tech);
    const pattern = tech.includes(' ') || tech.includes('/')
      ? escaped
      : /[#.]/.test(tech)
        ? `(?<![A-Za-z0-9])${escaped}(?![A-Za-z0-9])`
        : `\\b${escaped}\\b`;
    const re = new RegExp(pattern, 'gi');
    let m;
    while ((m = re.exec(text)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      const overlaps = occupied.some(([s, e]) => start < e && end > s);
      if (!overlaps) {
        found.push(m[0]);
        occupied.push([start, end]);
      }
    }
  }
  return found;
}

function uniqueCasePreserved(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = item.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/**
 * Extract prioritized keywords from a job description.
 * @param {string} jdText
 * @param {number} [limit=20]
 */
export function extractJdKeywords(jdText, limit = 20) {
  if (!jdText || String(jdText).length < 30) return [];

  const text = String(jdText);
  const found = [...findKnownTechInText(text)];

  // 2. Bullet lines and requirement-like phrases
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const isReqLine = JD_SECTION_HINTS.some((re) => re.test(line))
      || /^[-•*]\s/.test(line)
      || /^\d+\.\s/.test(line);
    if (!isReqLine) continue;

    for (const t of findKnownTechInText(line)) {
      found.push(t);
    }

    // Capitalized multi-word skills (e.g. "Platform Engineering")
    for (const m of line.matchAll(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/g)) {
      const phrase = m[1].trim();
      if (phrase.length >= 4 && phrase.length <= 40 && !STOPWORDS.has(phrase.toLowerCase())) {
        found.push(phrase);
      }
    }
  }

  // 3. Frequent meaningful tokens (4+ chars) in JD
  const lower = text.toLowerCase();
  const freq = {};
  for (const m of lower.matchAll(/\b[a-z][a-z0-9+#.]{3,}\b/g)) {
    const w = m[0];
    if (STOPWORDS.has(w)) continue;
    freq[w] = (freq[w] || 0) + 1;
  }
  const frequent = Object.entries(freq)
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([w]) => {
      const re = new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      const match = text.match(re);
      return match ? match[0] : w;
    });

  found.push(...frequent);

  const deduped = uniqueCasePreserved(found.map(normalizeKeyword).filter(Boolean));
  // Drop partial tokens subsumed by a longer keyword (e.g. "PostgreS" when "PostgreSQL" exists)
  const collapsed = deduped.filter((kw, i, arr) => {
    const lower = kw.toLowerCase();
    return !arr.some((other, j) => j !== i && other.toLowerCase().includes(lower) && other.length > kw.length);
  });
  // Prefer real tech / skill phrases — never ship "Software", "applications", etc.
  return filterWeaveableKeywords(collapsed).map(canonicalizeTechKeyword).slice(0, limit);
}

function resumeTexts(resume) {
  const texts = [];
  if (resume?.summary) texts.push(String(resume.summary));
  if (Array.isArray(resume?.core_competencies)) texts.push(...resume.core_competencies.map(String));
  const groups = collectExperienceArrays(resume?.experience);
  for (const g of groups) texts.push(...g.map(String));
  return texts.filter(Boolean);
}

function collectExperienceArrays(experience) {
  if (!experience) return [];
  if (Array.isArray(experience)) return [experience];
  if (typeof experience === 'object') {
    return Object.keys(experience)
      .sort((a, b) => Number(a) - Number(b))
      .map((k) => (Array.isArray(experience[k]) ? experience[k] : []));
  }
  return [];
}

/**
 * Measure how many JD keywords appear in resume content.
 */
export function measureJdAlignment(resume, jdKeywords) {
  if (!jdKeywords?.length) {
    return { score: 0, matched: [], missing: [], matchRatio: 0 };
  }
  const corpus = resumeTexts(resume).join(' ').toLowerCase();
  const matched = [];
  const missing = [];

  for (const kw of jdKeywords) {
    const k = String(kw).toLowerCase();
    if (corpus.includes(k)) matched.push(kw);
    else missing.push(kw);
  }

  const matchRatio = matched.length / jdKeywords.length;
  const score = Math.round(matchRatio * 100);
  return { score, matched, missing, matchRatio };
}

function bulletMissingJd(bullet, jdKeywords) {
  const b = String(bullet || '').toLowerCase();
  return !jdKeywords.some((kw) => b.includes(String(kw).toLowerCase()));
}

function weaveKeywordIntoBullet(bullet, keyword) {
  const b = String(bullet || '').trim();
  if (!b) return b;
  const kw = canonicalizeTechKeyword(keyword);
  if (!isWeaveableKeyword(kw)) return b;
  const lower = b.toLowerCase();
  if (lower.includes(kw.toLowerCase())) return b;

  // Natural integration — never ", applying X in production"
  const base = b.replace(/\.$/, '');
  if (/\b(using|with|via|on)\b/i.test(base.slice(-48))) {
    return `${base} and ${kw}.`;
  }
  if (/\b(API|APIs|service|services|pipeline|pipelines|platform|backend|frontend|microservice)/i.test(base)) {
    return `${base} with ${kw}.`;
  }
  return `${base} using ${kw}.`;
}

function weaveKeywordsIntoSummary(summary, keywords, minCount = 4) {
  let text = String(summary || '').trim();
  if (!text) return text;
  const weaveable = filterWeaveableKeywords(keywords).map(canonicalizeTechKeyword);
  const lower = text.toLowerCase();
  const toAdd = weaveable.filter((kw) => !lower.includes(String(kw).toLowerCase())).slice(0, minCount);
  if (toAdd.length === 0) return text;

  const lines = text.split('\n').filter(Boolean);
  if (lines.length === 0) lines.push(text);

  const inject = toAdd.slice(0, 5).join(', ');
  // Fold into the opening sentence — never append junk like "Core stacks: Software"
  lines[0] = `${lines[0].replace(/\.$/, '')} Core stack: ${inject}.`;
  return lines.slice(0, 4).join('\n');
}

/**
 * Surgically align resume to JD keywords (no fabrication — weave terms into existing content).
 */
export function alignResumeToJd(resume, jdKeywords, sourceExperience = []) {
  if (!resume || !jdKeywords?.length) {
    return { resume, stats: { competenciesAdded: 0, bulletsAligned: 0, summaryPatched: false } };
  }

  const copy = JSON.parse(JSON.stringify(resume));
  let competenciesAdded = 0;
  let bulletsAligned = 0;
  let summaryPatched = false;

  const keywords = filterWeaveableKeywords(jdKeywords).map(canonicalizeTechKeyword);
  if (!keywords.length) {
    return { resume: copy, stats: { competenciesAdded: 0, bulletsAligned: 0, summaryPatched: false } };
  }

  // Core competencies: ensure top JD keywords appear first
  const comps = Array.isArray(copy.core_competencies) ? [...copy.core_competencies] : [];
  const compLower = comps.map((c) => String(c).toLowerCase());
  const priority = keywords.slice(0, 10);
  const newComps = [];
  for (const kw of priority) {
    if (!compLower.some((c) => c.includes(String(kw).toLowerCase()))) {
      newComps.push(kw);
      competenciesAdded += 1;
    }
  }
  copy.core_competencies = uniqueCasePreserved([...newComps, ...comps]).slice(0, 14);

  // Summary: weave top missing keywords
  const beforeSummary = copy.summary;
  copy.summary = weaveKeywordsIntoSummary(copy.summary, keywords, 3);
  summaryPatched = beforeSummary !== copy.summary;

  // Experience bullets: ensure each bullet references at least one JD keyword
  const sourceBullets = (sourceExperience || []).flatMap((e) => e?.bullets || []);

  let kwIdx = 0;
  const alignGroup = (bullets, groupIdx) => {
    if (!Array.isArray(bullets)) return bullets;
    return bullets.map((bullet, bi) => {
      if (!bulletMissingJd(bullet, keywords)) return bullet;
      const kw = keywords[kwIdx % keywords.length];
      kwIdx += 1;
      bulletsAligned += 1;
      // Prefer weaving into first bullet of each role
      if (bi === 0 && sourceBullets[groupIdx]) {
        const src = String(sourceBullets[groupIdx] || bullet);
        if (!bulletMissingJd(src, keywords)) {
          return weaveKeywordIntoBullet(src, kw);
        }
      }
      return weaveKeywordIntoBullet(bullet, kw);
    });
  };

  if (Array.isArray(copy.experience)) {
    copy.experience = alignGroup(copy.experience, 0);
  } else if (copy.experience && typeof copy.experience === 'object') {
    const keys = Object.keys(copy.experience).sort((a, b) => Number(a) - Number(b));
    keys.forEach((key, i) => {
      copy.experience[key] = alignGroup(copy.experience[key], i);
    });
  }

  return { resume: copy, stats: { competenciesAdded, bulletsAligned, summaryPatched } };
}

export function formatJdKeywordBlock(jdKeywords) {
  if (!jdKeywords?.length) return '(No JD keywords extracted — scrape may have failed)';
  return jdKeywords.map((k, i) => `${i + 1}. ${k}`).join('\n');
}

/**
 * Fill missing per-role tailored bullets from profile + JD keywords (avoids untailored fallback).
 */
export function ensureAllRolesTailored(resume, profileExperience, jdKeywords, rolesCount = 4) {
  const keywords = filterWeaveableKeywords(jdKeywords).map(canonicalizeTechKeyword);
  if (!resume || !keywords.length) return resume;
  const exp = resume.experience;
  const profile = Array.isArray(profileExperience) ? profileExperience : [];
  const count = Math.min(rolesCount, profile.length);
  if (count === 0) return resume;

  if (Array.isArray(exp)) return resume;

  const out = exp && typeof exp === 'object' ? { ...exp } : {};
  let kwIdx = 0;

  for (let i = 0; i < count; i++) {
    const key = String(i);
    const existing = Array.isArray(out[key]) ? out[key] : [];
    if (existing.length >= 3) continue;

    const srcBullets = (profile[i]?.bullets || []).slice(0, 4);
    if (srcBullets.length === 0) continue;

    out[key] = srcBullets.map((bullet) => {
      const kw = keywords[kwIdx % keywords.length];
      kwIdx += 1;
      return weaveKeywordIntoBullet(bullet, kw);
    });
  }

  resume.experience = out;
  return resume;
}
