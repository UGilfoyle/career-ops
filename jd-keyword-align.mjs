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
  'Jest', 'Cypress', 'Playwright', 'Webpack', 'Vite', 'Material UI', 'HTML5', 'CSS3',
  'Git', 'Agile', 'Scrum', 'Microservices', 'System Design', 'Unit Testing', 'Integration Testing',
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
  // Generic filler that must never become "skills" / "Core stacks"
  'software', 'application', 'applications', 'services', 'service', 'process', 'apply',
  'development', 'developer', 'engineer', 'engineering', 'technologies', 'technology',
  'systems', 'platform', 'solutions', 'business', 'projects', 'project', 'tools', 'tool',
  // Job-board / Indeed chrome — was leaking into summary as "systems in Find"
  'find', 'search', 'sign', 'save', 'share', 'report', 'view', 'click', 'learn', 'more',
  'home', 'careers', 'posting', 'indeed', 'linkedin', 'naukri', 'glassdoor', 'instahyre',
  'remote', 'hybrid', 'onsite', 'salary', 'benefits', 'privacy', 'cookie', 'cookies',
  'continue', 'skip', 'next', 'back', 'login', 'logout', 'register', 'upload', 'download',
  'filter', 'sort', 'results', 'jobs', 'hiring', 'candidates', 'candidate', 'employees',
  'employee', 'companies', 'reviews', 'review', 'follow', 'messages', 'notifications',
  'settings', 'help', 'terms', 'conditions', 'policy', 'policies', 'english', 'hindi',
  'india', 'pune', 'bengaluru', 'mumbai', 'delhi', 'bangalore', 'hyderabad', 'chennai',
  'posted', 'ago', 'today', 'yesterday', 'easily', 'urgent', 'sponsored', 'similar',
]);

/** UI / dictionary junk that must never be woven into bullets or skills. */
const JUNK_KEYWORD_RE =
  /^(find|apply|search|sign|join|save|share|report|view|click|learn|more|home|careers?|postings?|indeed|linkedin|naukri|glassdoor|remote|hybrid|onsite|jobs?|hiring|candidates?|reviews?|follow|login|logout|skip|next|back|filter|sort|results?|salary|benefits?|privacy|cookies?|continue|upload|download|settings?|help|terms?|policies?|english|hindi|india|pune|bengaluru|bangalore|mumbai|delhi|hyderabad|chennai|posted|ago|today|yesterday|easily|urgent|sponsored|similar|software|applications?|services?|development|technologies?|process)$/i;

/** Known tech only — preferred for ATS competency / skills lines. */
export function extractJdTechKeywords(jdText, limit = 20) {
  if (!jdText || String(jdText).length < 30) return [];
  return uniqueCasePreserved(findKnownTechInText(String(jdText))).slice(0, limit);
}

export function isJunkKeyword(kw) {
  const k = normalizeKeyword(kw).toLowerCase();
  if (!k || k.length < 2) return true;
  if (STOPWORDS.has(k)) return true;
  if (JUNK_KEYWORD_RE.test(k)) return true;
  // Multi-word phrases that still start with UI chrome ("Find candidates")
  if (/^(find|apply|search|sign|join|save|share|view|click)\b/.test(k)) return true;
  return false;
}

/** Only real tech / multi-word skills may be woven into bullets or summary leads. */
export function isWeavableKeyword(kw) {
  if (isJunkKeyword(kw)) return false;
  const k = normalizeKeyword(kw);
  if (!k) return false;
  if (findKnownTechInText(k).length > 0) return true;
  if (/[.#+/]/.test(k) || /\d/.test(k)) return true;
  if (k.split(/\s+/).length >= 2 && k.length >= 6) return true;
  // Lone dictionary words (Find, Strong, Fast…) are not skills
  if (k.split(/\s+/).length === 1 && k.length <= 8 && !/[A-Z].*[A-Z]/.test(String(kw))) {
    return false;
  }
  return k.length >= 3;
}

function normalizeKeyword(kw) {
  return String(kw || '').trim().replace(/\s+/g, ' ');
}

function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

    // Capitalized skills — prefer multi-word; single tokens only if known tech
    for (const m of line.matchAll(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/g)) {
      const phrase = m[1].trim();
      if (phrase.length < 3 || phrase.length > 40) continue;
      if (isJunkKeyword(phrase)) continue;
      const words = phrase.split(/\s+/);
      if (words.length === 1) {
        if (findKnownTechInText(phrase).length === 0) continue;
      }
      found.push(phrase);
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

  const deduped = uniqueCasePreserved(
    found.map(normalizeKeyword).filter((kw) => kw && !isJunkKeyword(kw))
  );
  // Drop partial tokens subsumed by a longer keyword (e.g. "PostgreS" when "PostgreSQL" exists)
  return deduped.filter((kw, i, arr) => {
    const lower = kw.toLowerCase();
    return !arr.some((other, j) => j !== i && other.toLowerCase().includes(lower) && other.length > kw.length);
  }).slice(0, limit);
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
  const kw = String(keyword || '').trim();
  if (!kw || !isWeavableKeyword(kw)) return b;
  const lower = b.toLowerCase();
  if (lower.includes(kw.toLowerCase())) return b;

  // Never spam "applying X in production" — integrate tech naturally once.
  if (/\b(using|with|via|on)\b/i.test(b) && b.length < 220) {
    return `${b.replace(/\.$/, '')} with ${kw}.`;
  }
  if (/^[A-Z]/.test(b) && !/^(I |Built|Led|Designed|Engineered|Architected|Developed|Implemented|Delivered|Shipped|Owned|Cut|Reduced)/i.test(b)) {
    return `${b.replace(/\.$/, '')} using ${kw}.`;
  }
  // Prefer a clean tool-clause over keyword stuffing
  return `${b.replace(/\.$/, '')} (${kw}).`;
}

function weaveKeywordsIntoSummary(summary, keywords, minCount = 4) {
  let text = String(summary || '').trim();
  if (!text) return text;
  const lower = text.toLowerCase();
  const toAdd = keywords
    .filter((kw) => isWeavableKeyword(kw) && !lower.includes(String(kw).toLowerCase()))
    .slice(0, minCount);
  if (toAdd.length === 0) return text;

  const lines = text.split('\n').filter(Boolean);
  if (lines.length === 0) lines.push(text);

  const inject = toAdd.slice(0, 5).join(', ');
  // Prefer natural weave into line 1 or 2 — avoid robotic "Tech stack:" spam lines
  if (lines[0].length < 170) {
    lines[0] = `${lines[0].replace(/\.$/, '')} — ${inject}.`;
  } else if (lines.length >= 2 && lines[1].length < 180) {
    lines[1] = `${lines[1].replace(/\.$/, '')} (${inject}).`;
  } else if (lines.length < 4) {
    lines.push(`Day-to-day stack includes ${inject}.`);
  }
  return lines.slice(0, 4).join('\n');
}

/**
 * Align resume to JD keywords for ATS.
 * Skills/competencies get the full JD tech list.
 * Experience bullets only weave lightly (≤1 keyword per role) — no spam.
 *
 * @param {object} [opts]
 * @param {string[]} [opts.bulletKeywords] — subset safe to weave into experience (default: all)
 * @param {boolean} [opts.weaveEveryBullet=false] — legacy spam mode; keep false
 */
export function alignResumeToJd(resume, jdKeywords, sourceExperience = [], opts = {}) {
  if (!resume || !jdKeywords?.length) {
    return { resume, stats: { competenciesAdded: 0, bulletsAligned: 0, summaryPatched: false } };
  }

  const cleanKws = jdKeywords.filter((kw) => isWeavableKeyword(kw));
  const bulletKws = (opts.bulletKeywords || cleanKws).filter((kw) => isWeavableKeyword(kw));
  const weaveEvery = opts.weaveEveryBullet === true;

  const copy = JSON.parse(JSON.stringify(resume));
  let competenciesAdded = 0;
  let bulletsAligned = 0;
  let summaryPatched = false;

  // Core competencies: JD tech first (ATS match)
  const comps = Array.isArray(copy.core_competencies) ? [...copy.core_competencies] : [];
  const compLower = comps.map((c) => String(c).toLowerCase());
  const priority = cleanKws.slice(0, 12);
  const newComps = [];
  for (const kw of priority) {
    if (!compLower.some((c) => c.includes(String(kw).toLowerCase()))) {
      newComps.push(kw);
      competenciesAdded += 1;
    }
  }
  copy.core_competencies = uniqueCasePreserved([...newComps, ...comps]).slice(0, 16);

  // Summary: weave top missing keywords (tech only)
  const beforeSummary = copy.summary;
  copy.summary = weaveKeywordsIntoSummary(copy.summary, cleanKws, 4);
  summaryPatched = beforeSummary !== copy.summary;

  const sourceBullets = (sourceExperience || []).flatMap((e) => e?.bullets || []);
  let kwIdx = 0;

  const alignGroup = (bullets, groupIdx) => {
    if (!Array.isArray(bullets) || bulletKws.length === 0) return bullets;
    let weavesThisRole = 0;
    return bullets.map((bullet, bi) => {
      if (!bulletMissingJd(bullet, bulletKws)) return bullet;
      // Default: only lightly touch the first bullet of each role (avoids "applying X" spam)
      if (!weaveEvery && (bi > 0 || weavesThisRole >= 1)) return bullet;
      const kw = bulletKws[kwIdx % bulletKws.length];
      kwIdx += 1;
      weavesThisRole += 1;
      bulletsAligned += 1;
      if (bi === 0 && sourceBullets[groupIdx]) {
        const src = String(sourceBullets[groupIdx] || bullet);
        if (!bulletMissingJd(src, bulletKws)) {
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
  if (!resume || !jdKeywords?.length) return resume;
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
      const kw = jdKeywords[kwIdx % jdKeywords.length];
      kwIdx += 1;
      return weaveKeywordIntoBullet(bullet, kw);
    });
  }

  resume.experience = out;
  return resume;
}
