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
  'Jest', 'Cypress', 'Playwright', 'Puppeteer', 'Cheerio', 'Selenium',
  'WebSockets', 'WebSocket', 'ORM', 'TypeORM', 'Prisma', 'Sequelize',
  'Message Brokers', 'Web Scraping',
  'Webpack', 'Vite', 'Material UI', 'HTML5', 'CSS3',
  'Git', 'Agile', 'Scrum', 'Microservices', 'System Design', 'Unit Testing', 'Integration Testing',
  'Machine Learning', 'ML', 'LLM', 'RAG', 'LangChain', 'PyTorch', 'TensorFlow',
  'Cursor', 'Copilot', 'GitHub Copilot', 'Github Copilot',
  '.NET Core', '.NET', 'C#',
  'Snowflake', 'Spark', 'Airflow', 'dbt', 'Databricks',
  // ETL / data-validation stack
  'pandas', 'pyodbc', 'ETL', 'Oracle', 'Unix', 'Linux', 'JIRA', 'Rally', 'Qtest',
  'SCD', 'Mainframe',
  // Microsoft / Azure full-stack (Interra-style JDs)
  'SQL Server', 'Microsoft SQL Server', 'Telerik', 'DevExpress', 'jQuery', 'MVC',
];

/**
 * Seed domain / methodology phrases (not company-specific).
 * extractJdDomainPhrases ALSO pulls fresh multi-word requirements from any JD.
 */
const DOMAIN_PHRASES = [
  // Data / ETL
  'source-to-target validation',
  'source to target',
  'data reconciliation',
  'transformation logic',
  'data completeness',
  'ETL testing',
  'ETL validation',
  'data warehouse',
  'staging',
  'fact and dimension',
  'fact/dimension',
  'slowly changing dimensions',
  'SCD',
  'window functions',
  'analytical functions',
  'shell scripting',
  'log analysis',
  'job monitoring',
  'test management',
  // Scraping / automation
  'web scraping',
  'anti-bot',
  'proxy rotation',
  'browser automation',
  // Backend / platform (future JDs)
  'event-driven architecture',
  'event-driven',
  'microservices architecture',
  'distributed systems',
  'high-throughput',
  'low-latency',
  'rate limiting',
  'observability',
  'incident response',
  'system design',
  'API design',
  'RESTful APIs',
  'message queues',
  'message brokers',
  // Frontend / fullstack
  'state management',
  'component libraries',
  'responsive design',
  // DevOps / SRE
  'infrastructure as code',
  'continuous delivery',
  'container orchestration',
  'auto-scaling',
  // AI / LLM
  'retrieval augmented generation',
  'prompt engineering',
  'vector embeddings',
  'agentic workflows',
];

/**
 * Canonicalize spaced / informal JD tech spellings so extractors hit KNOWN_TECH.
 * e.g. "NEST JS", "Java script", "web sockets", "puppeteer" stay discoverable.
 */
export function normalizeJdTechAliases(text) {
  let t = String(text || '');
  const rules = [
    [/\bjava\s*script\b/gi, 'JavaScript'],
    [/\btype\s*script\b/gi, 'TypeScript'],
    [/\bnest\s*js\b/gi, 'NestJS'],
    [/\bnext\s*js\b/gi, 'Next.js'],
    [/\bnode\s*js\b/gi, 'Node.js'],
    [/\breact\s*js\b/gi, 'React'],
    [/\bvue\s*js\b/gi, 'Vue.js'],
    [/\bweb\s*sockets?\b/gi, 'WebSockets'],
    [/\brest\s*ful\s*apis?\b/gi, 'RESTful API'],
    [/\brest\s*apis?\b/gi, 'REST API'],
    [/\bci\s*\/\s*cd\b/gi, 'CI/CD'],
    [/\borm[- ]object\s*relational\s*mapping\b/gi, 'ORM'],
    [/\bobject\s*[- ]?relational\s*mapping\b/gi, 'ORM'],
    [/\bmessage\s*brokers?\b/gi, 'Message Brokers'],
    [/\bweb\s*scraping\b/gi, 'Web Scraping'],
  ];
  for (const [re, rep] of rules) t = t.replace(re, rep);
  return t;
}

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
  'telangana', 'karnataka', 'maharashtra', 'interaslabs',
  'posted', 'ago', 'today', 'yesterday', 'easily', 'urgent', 'sponsored', 'similar',
  // JD fluff adjectives / verbs that were landing in skills (Interaslabs Indeed)
  'demonstrable', 'proven', 'hands', 'building', 'cloud', 'large', 'scale', 'masters',
  'preferably', 'includes', 'writing', 'queries', 'knowledge', 'must', 'opening',
  'pay', 'year', 'flexible', 'schedule', 'district', 'preference', 'based',
  // Section chrome / education prose (Interra / Ashby JDs)
  'what', 'you', 'youll', "you'll", 'bring', 'bachelor', 'bachelors', 'degree',
  'equivalent', 'field', 'related', 'hands-on', 'handson',
]);

/** UI / dictionary junk that must never be woven into bullets or skills. */
const JUNK_KEYWORD_RE =
  /^(find|apply|search|sign|join|save|share|report|view|click|learn|more|home|careers?|postings?|indeed|linkedin|naukri|glassdoor|remote|hybrid|onsite|jobs?|hiring|candidates?|reviews?|follow|login|logout|skip|next|back|filter|sort|results?|salary|benefits?|privacy|cookies?|continue|upload|download|settings?|help|terms?|policies?|english|hindi|india|pune|bengaluru|bangalore|mumbai|delhi|hyderabad|chennai|telangana|posted|ago|today|yesterday|easily|urgent|sponsored|similar|software|applications?|services?|development|technologies?|process|demonstrable|proven|hands|building|cloud|masters|what|you|bring|bachelor|degree|equivalent|field|related)$/i;

/** Soft JD prose that looks like a "skill" but is education/section chrome. */
const JD_CHROME_PHRASE_RE =
  /\b(what you|what you.?ll|you.?ll (do|bring)|who we are|the role|computer science|technology-related|related field|bachelor.?s?( degree)?|equivalent experience|full[-\s]?stack experience|hands-?on experience|years of (full[-\s]?stack )?experience|degree in|components and implement|user-friendly|providing technical guidance|cross-functional teams to gather|and ensure best practices|frameworks like|manage time|responsive and user|cloud migration and modernization)\b/i;

/** Known tech only — preferred for ATS competency / skills lines. */
export function extractJdTechKeywords(jdText, limit = 20) {
  if (!jdText || String(jdText).length < 30) return [];
  const text = normalizeJdTechAliases(String(jdText));
  const found = uniqueCasePreserved(findKnownTechInText(text));
  return suppressFalsePositiveLanguages(found, text).slice(0, limit);
}

/**
 * Pull fresh multi-word requirement phrases from any JD (not limited to seed list).
 * Mines must-have / responsibility / bullet lines so tomorrow's vocabulary still lands in the plan.
 */
export function extractDynamicRequirementPhrases(jdText, limit = 14) {
  if (!jdText || String(jdText).length < 30) return [];
  const text = normalizeJdTechAliases(String(jdText));
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const found = [];

  for (const line of lines) {
    const isReqLine = JD_SECTION_HINTS.some((re) => re.test(line))
      || /^[-•*]\s/.test(line)
      || /^\d+\.\s/.test(line)
      || /\b(must have|required|responsibilit|qualification|key skills|experience with)\b/i.test(line);
    if (!isReqLine) continue;

    const cleanedLine = line.replace(/^[-•*\d.]+\s*/, '');

    // "… in/with/using/including X"
    for (const m of cleanedLine.matchAll(
      /\b(?:in|with|using|including|via|across)\s+([A-Za-z][A-Za-z0-9+.#/][A-Za-z0-9+.#/\s-]{2,48}?)(?=[,.;:()]|$)/gi,
    )) {
      let phrase = normalizeKeyword(m[1]);
      phrase = phrase.split(/\band\b/i)[0].trim();
      if (phrase.split(/\s+/).length < 2 && !/-/.test(phrase)) continue;
      if (phrase.length < 6 || phrase.length > 48) continue;
      if (isJunkKeyword(phrase)) continue;
      if (isWeavableKeyword(phrase) || phrase.split(/\s+/).length >= 2) found.push(phrase);
    }

    // Hyphenated compounds: event-driven, auto-scaling, source-to-target
    for (const m of cleanedLine.matchAll(/\b([A-Za-z][A-Za-z0-9]*(?:-[A-Za-z0-9]+){1,3})\b/g)) {
      const phrase = normalizeKeyword(m[1]);
      if (phrase.length < 7 || isJunkKeyword(phrase)) continue;
      found.push(phrase);
    }

    // Lowercase multi-word skill-ish phrases
    for (const m of cleanedLine.matchAll(
      /\b((?:[a-z][a-z0-9+#.]{2,})(?:\s+[a-z][a-z0-9+#.]{2,}){1,3})\b/g,
    )) {
      const phrase = normalizeKeyword(m[1]);
      if (phrase.length < 10 || phrase.length > 48) continue;
      if (isJunkKeyword(phrase)) continue;
      const contentWords = phrase.split(/\s+/).filter((w) => !STOPWORDS.has(w) && w.length >= 4);
      if (contentWords.length < 2) continue;
      found.push(phrase);
    }
  }

  return uniqueCasePreserved(found).slice(0, limit);
}

/**
 * Extract multi-word domain / methodology phrases from a JD.
 * Seed list + dynamic requirement mining so any future JD vocabulary is captured.
 */
export function extractJdDomainPhrases(jdText, limit = 16) {
  if (!jdText || String(jdText).length < 30) return [];
  const text = normalizeJdTechAliases(String(jdText));
  const lower = text.toLowerCase();
  const found = [];
  const sorted = [...DOMAIN_PHRASES].sort((a, b) => b.length - a.length);
  for (const phrase of sorted) {
    if (lower.includes(phrase.toLowerCase())) {
      found.push(phrase);
    }
  }
  found.push(...extractDynamicRequirementPhrases(text, 14));

  return uniqueCasePreserved(found.map((p) => {
    if (/^scd$/i.test(p)) return 'SCD';
    if (/^etl testing$/i.test(p)) return 'ETL Testing';
    if (/^etl validation$/i.test(p)) return 'ETL Validation';
    if (/source.?to.?target/i.test(p)) return 'source-to-target validation';
    if (/data reconcil/i.test(p)) return 'data reconciliation';
    if (/transformation logic/i.test(p)) return 'transformation logic';
    if (/data completeness/i.test(p)) return 'data completeness';
    if (/data warehouse/i.test(p)) return 'data warehouse';
    if (/window functions/i.test(p)) return 'window functions';
    if (/web scraping/i.test(p)) return 'Web Scraping';
    if (/event-?driven/i.test(p)) return 'event-driven architecture';
    if (/observability/i.test(p)) return 'observability';
    if (/message brokers?/i.test(p)) return 'message brokers';
    return p;
  })).slice(0, limit);
}

/**
 * Split JD lines into must-have vs preferred keyword buckets.
 */
export function extractMustHavePreferred(jdText) {
  const text = normalizeJdTechAliases(String(jdText || ''));
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const mustHave = [];
  const preferred = [];
  let mode = 'must'; // default until a preferred section appears

  for (const line of lines) {
    if (/nice\s*to\s*have|good\s*to\s*have|preferred|bonus|plus:/i.test(line)) {
      mode = 'preferred';
    } else if (/must\s*have|required|minimum|qualifications?|key skills|responsibilities/i.test(line)) {
      mode = 'must';
    }
    const techs = findKnownTechInText(line);
    const domains = [
      ...DOMAIN_PHRASES.filter((p) => line.toLowerCase().includes(p.toLowerCase())),
      ...extractDynamicRequirementPhrases(line, 6),
    ];
    const bucket = mode === 'preferred' ? preferred : mustHave;
    for (const t of [...techs, ...domains]) {
      if (!isJunkKeyword(t)) bucket.push(t);
    }
  }

  return {
    mustHave: uniqueCasePreserved(mustHave.map(normalizeKeyword).filter(Boolean)).slice(0, 20),
    preferred: uniqueCasePreserved(preferred.map(normalizeKeyword).filter(Boolean)).slice(0, 16),
  };
}

export function isJunkKeyword(kw) {
  const k = normalizeKeyword(kw).toLowerCase();
  if (!k || k.length < 2) return true;
  if (STOPWORDS.has(k)) return true;
  if (JUNK_KEYWORD_RE.test(k)) return true;
  if (JD_CHROME_PHRASE_RE.test(k)) return true;
  // Multi-word phrases that still start with UI chrome ("Find candidates")
  if (/^(find|apply|search|sign|join|save|share|view|click|what|who|the)\b/.test(k)) return true;
  return false;
}

/** Only real tech / multi-word skills may be woven into bullets or summary leads. */
export function isWeavableKeyword(kw) {
  if (isJunkKeyword(kw)) return false;
  const k = normalizeKeyword(kw);
  if (!k) return false;
  if (findKnownTechInText(normalizeJdTechAliases(k)).length > 0) return true;
  if (/[.#+/]/.test(k) || /\d/.test(k)) return true;
  // Multi-word skill phrases only (e.g. "Design Patterns") — never company/place names
  if (k.split(/\s+/).length >= 2 && k.length >= 6) return true;
  // Lone dictionary / proper nouns (Find, Interaslabs, demonstrable…) are not skills
  return false;
}

/** Drop bare "Java" when the JD clearly means JavaScript (common Indeed spacing). */
function suppressFalsePositiveLanguages(found, text) {
  const lower = String(text || '').toLowerCase();
  const hasJavaScript = lower.includes('javascript');
  const bareJava = /\bjava\b/.test(lower.replace(/javascript/g, ''));
  return found.filter((kw) => {
    const k = String(kw).toLowerCase();
    if (k === 'java' && hasJavaScript && !bareJava) return false;
    return true;
  });
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

  const text = normalizeJdTechAliases(String(jdText));
  const found = [...suppressFalsePositiveLanguages(findKnownTechInText(text), text)];
  // Domain / methodology phrases (ETL, scraping, etc.)
  found.push(...extractJdDomainPhrases(text, 12));

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
  // Prefer natural weave into line 1 or 2 (comma clause; no em-dash spam)
  if (lines[0].length < 170) {
    lines[0] = `${lines[0].replace(/\.$/, '')}, including ${inject}.`;
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
 * @param {number[]} [opts.weaveRoleIndices] — only weave into these role indices (default: all)
 */
export function alignResumeToJd(resume, jdKeywords, sourceExperience = [], opts = {}) {
  if (!resume || !jdKeywords?.length) {
    return { resume, stats: { competenciesAdded: 0, bulletsAligned: 0, summaryPatched: false } };
  }

  const cleanKws = jdKeywords.filter((kw) => isWeavableKeyword(kw));
  const bulletKws = (opts.bulletKeywords || cleanKws).filter((kw) => isWeavableKeyword(kw));
  const weaveEvery = opts.weaveEveryBullet === true;
  const weaveRoles = Array.isArray(opts.weaveRoleIndices) ? new Set(opts.weaveRoleIndices.map(Number)) : null;

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

  // Summary: weave top missing keywords (prefer opts.summaryKeywords to avoid gap-tool stuffing)
  const summaryKws = (opts.summaryKeywords || cleanKws).filter((kw) => isWeavableKeyword(kw));
  const beforeSummary = copy.summary;
  copy.summary = weaveKeywordsIntoSummary(copy.summary, summaryKws, 4);
  summaryPatched = beforeSummary !== copy.summary;

  const sourceBullets = (sourceExperience || []).flatMap((e) => e?.bullets || []);
  let kwIdx = 0;

  const alignGroup = (bullets, groupIdx) => {
    if (!Array.isArray(bullets) || bulletKws.length === 0) return bullets;
    if (weaveRoles && !weaveRoles.has(Number(groupIdx))) return bullets;
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
      copy.experience[key] = alignGroup(copy.experience[key], Number.isFinite(Number(key)) ? Number(key) : i);
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
 * @param {number} [rolesCount=4]
 * @param {object} [opts]
 * @param {number[]} [opts.tailorIndices] — only fill these indices (default: 0..rolesCount-1)
 */
export function ensureAllRolesTailored(resume, profileExperience, jdKeywords, rolesCount = 4, opts = {}) {
  if (!resume || !jdKeywords?.length) return resume;
  const exp = resume.experience;
  const profile = Array.isArray(profileExperience) ? profileExperience : [];
  const count = Math.min(rolesCount, profile.length);
  if (count === 0) return resume;

  if (Array.isArray(exp)) return resume;

  const out = exp && typeof exp === 'object' ? { ...exp } : {};
  let kwIdx = 0;
  const indices = Array.isArray(opts.tailorIndices) && opts.tailorIndices.length
    ? opts.tailorIndices.filter((i) => i >= 0 && i < profile.length)
    : [...Array(count).keys()];

  for (const i of indices) {
    const key = String(i);
    const existing = Array.isArray(out[key]) ? out[key] : [];
    // Only skip when role already has 3+ bullets that touch at least one JD keyword
    const hasJdSignal = existing.some((b) => jdKeywords.some((kw) =>
      String(b || '').toLowerCase().includes(String(kw).toLowerCase())
    ));
    if (existing.length >= 3 && hasJdSignal) continue;

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
