/**
 * jd-keyword-align.mjs — Extract JD keywords and align tailored resume content.
 */

const KNOWN_TECH = [
  'JavaScript', 'TypeScript', 'Python', 'Java', 'Go', 'Golang', 'Rust', 'C#', '.NET', 'Ruby', 'PHP', 'Kotlin', 'Swift', 'Scala',
  'React', 'React.js', 'Redux', 'Angular', 'Vue.js', 'Next.js', 'NestJS', 'Express', 'FastAPI', 'Django', 'Spring Boot', 'Node.js', 'Bun',
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
  // NOTE: never list Cursor / Copilot / ChatGPT / Claude Code here — IDE assistants are not tech-stack skills
  '.NET Core', '.NET', 'C#',
  'Snowflake', 'Spark', 'Apache Spark', 'PySpark', 'Airflow', 'dbt', 'Databricks', 'Azure Databricks',
  'Azure Data Factory', 'ADF', 'ELT', 'SQL', 'Redshift', 'BigQuery', 'Synapse', 'Delta Lake',
  // ETL / data-validation stack
  'pandas', 'pyodbc', 'ETL', 'Oracle', 'Unix', 'Linux', 'JIRA', 'Rally', 'Qtest',
  'SCD', 'Mainframe', 'Data Modeling',
  // Microsoft / Azure full-stack (Interra-style JDs)
  'SQL Server', 'Microsoft SQL Server', 'Telerik', 'DevExpress', 'jQuery', 'MVC',
];

/**
 * IDE / chat assistants — never emit as Technical Skills or Core Competencies.
 * These come from profile superpowers like "AI-native tool integration (Cursor, Claude Code, GPTs)".
 */
export function isEditorIdeTool(raw) {
  const t = String(raw || '').trim();
  if (!t) return false;
  return /\b(cursor|windsurf|antigravity|copilot|github\s*copilot|chatgpt|chat\s*gpt|claude(?:\s*code)?|gpts?)\b/i.test(t);
}
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
  'data modeling',
  'ETL/ELT',
  'ELT',
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
    [/\bpy\s*spark\b/gi, 'PySpark'],
    [/\bapache\s*spark\b/gi, 'Apache Spark'],
    [/\bazure\s*data\s*factory\b/gi, 'Azure Data Factory'],
    [/\b\(\s*adf\s*\)/gi, ' ADF '],
    [/\badf\b/gi, 'ADF'],
    [/\bazure\s*databricks\b/gi, 'Azure Databricks'],
    [/\bbig\s*query\b/gi, 'BigQuery'],
    [/\bdata\s*modeling\b/gi, 'Data Modeling'],
    [/\betl\s*\/\s*elt\b/gi, 'ETL ELT'],
    [/\belt\b/gi, 'ELT'],
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
  /\b(what you|what you.?ll|you.?ll (do|bring)|who we are|the role|key skills|computer science|technology-related|related field|bachelor.?s?( degree)?|equivalent experience|full[-\s]?stack experience|hands-?on experience|years of (full[-\s]?stack )?experience|degree in|components and implement|user-friendly|providing technical guidance|cross-functional teams to gather|and ensure best practices|frameworks like|manage time|responsive and user|cloud migration and modernization)\b/i;

/** Equipment / WFH hardware boilerplate — not a candidate skill. */
const JD_EQUIPMENT_PHRASE_RE =
  /\b(provide your own|your own dual|dual monitors?|hd webcam|webcam|headset|internet connection|stable internet|dsl, cable|fiber wired|work-from-home setup|laptop system|system requirements?|operating system|mac osx|windows 10|processor;?|ram;?)\b/i;

/** Known tech only — preferred for ATS competency / skills lines. */
export function extractJdTechKeywords(jdText, limit = 20) {
  if (!jdText || String(jdText).length < 30) return [];
  const text = normalizeJdTechAliases(String(jdText));
  const found = uniqueCasePreserved(findKnownTechInText(text));
  return suppressFalsePositiveLanguages(found, text).slice(0, limit);
}

/** True when phrase is a seeded domain/methodology skill (not free-form JD prose). */
export function isDomainSkillPhrase(kw) {
  const lower = normalizeKeyword(kw).toLowerCase().replace(/-/g, ' ');
  if (!lower || lower.length < 4) return false;
  return DOMAIN_PHRASES.some((p) => {
    const pl = String(p).toLowerCase().replace(/-/g, ' ');
    return lower === pl;
  });
}

/** True when phrase is real tech or an approved domain skill — never arbitrary JD prose. */
export function isApprovedSkillPhrase(kw) {
  if (isJunkKeyword(kw)) return false;
  const k = normalizeKeyword(kw);
  if (!k) return false;
  if (/[()[\]{}]/.test(k) && ((k.match(/[([{]/g) || []).length !== (k.match(/[)\]}]/g) || []).length)) {
    return false;
  }
  if (isDomainSkillPhrase(k)) return true;
  // Compact tool tokens: C#, .NET, CI/CD, Node.js
  if (/[.#+/]/.test(k) && k.length <= 24 && k.split(/\s+/).length <= 3) return true;

  const techHits = findKnownTechInText(normalizeJdTechAliases(k));
  if (techHits.length === 0) return false;

  const lower = k.toLowerCase();
  // Exact tech token or short alias
  if (techHits.some((t) => lower === String(t).toLowerCase())) return true;
  if (k.split(/\s+/).length <= 2 && k.length <= 28) return true;

  // Allow "NestJS Backend Development" / "Azure Cloud Services" — must lead with the tech
  if (
    techHits.some((t) => {
      const tl = String(t).toLowerCase();
      return lower.startsWith(`${tl} `) || lower.startsWith(`${tl}/`) || lower.startsWith(`${tl} /`);
    })
  ) {
    return k.split(/\s+/).length <= 5 && k.length <= 48;
  }

  // Reject narrative wrappers that merely embed a tech token
  // e.g. "Monolith-to-microservices transition"
  return false;
}

/**
 * Pull fresh multi-word requirement phrases from any JD (not limited to seed list).
 * Only keeps known tech / seeded domain phrases — never free-form JD prose crumbs.
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

    // Known tech tokens embedded in the requirement line
    for (const tech of findKnownTechInText(cleanedLine)) {
      found.push(normalizeKeyword(tech));
    }

    // "… in/with/using/including X" — keep only approved skill phrases
    for (const m of cleanedLine.matchAll(
      /\b(?:in|with|using|including|via|across)\s+([A-Za-z][A-Za-z0-9+.#/][A-Za-z0-9+.#/\s-]{2,48}?)(?=[,.;:()]|$)/gi,
    )) {
      let phrase = normalizeKeyword(m[1]);
      phrase = phrase.split(/\band\b/i)[0].trim();
      if (phrase.length < 3 || phrase.length > 48) continue;
      if (isJunkKeyword(phrase)) continue;
      if (isApprovedSkillPhrase(phrase)) found.push(phrase);
    }

    // Hyphenated compounds: event-driven, auto-scaling, source-to-target
    for (const m of cleanedLine.matchAll(/\b([A-Za-z][A-Za-z0-9]*(?:-[A-Za-z0-9]+){1,3})\b/g)) {
      const phrase = normalizeKeyword(m[1]);
      if (phrase.length < 7 || isJunkKeyword(phrase)) continue;
      if (isApprovedSkillPhrase(phrase)) found.push(phrase);
    }
  }

  return uniqueCasePreserved(found.filter((p) => isApprovedSkillPhrase(p))).slice(0, limit);
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
    const techs = suppressFalsePositiveLanguages(findKnownTechInText(line), text);
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

/**
 * Verbs that mark a full clause, not a skill noun-phrase.
 * ("engineers can review quickly", "designs are clear" — never weave these.)
 */
const PROSE_VERB_RE = /\b(review|reviews|reviewed|reviewing|leveling|level|levelled|onboard|onboarding|are|were|was|being|become|becomes|ship|shipping|shipped|looks|look|seems|feels|reads|say|says|tell|means|wants|likes|hopes|trusts?|speaks?|writes?|reads?|grows?|growing|learns?|learning|teaches?|helps?|helping|works?|working|plays?|runs?|makes?|making|takes?|taking|gets?|getting|keeps?|keeping|comes?|coming|goes?|going|sees?|seeing|knows?|finding|finds?|align|aligns|aligned|aligning)\b/i;

/** Trailing words that signal a mid-sentence fragment, not a skill phrase. */
const FRAGMENT_END_WORDS = new Set([
  'and', 'or', 'but', 'nor', 'so', 'yet', 'as', 'if', 'than', 'then', 'when', 'while',
  'the', 'a', 'an', 'to', 'of', 'for', 'in', 'on', 'at', 'by', 'with', 'from', 'via',
  'into', 'onto', 'upon', 'toward', 'towards', 'through', 'over', 'under', 'about',
  'that', 'this', 'these', 'those', 'it', 'its', 'you', 'your', 'we', 'our', 'they', 'their',
  'are', 'is', 'be', 'being', 'been', 'can', 'will', 'would', 'should', 'could', 'may', 'might',
  'do', 'does', 'did', 'has', 'have', 'had',
]);

/** Job titles / people-role labels — never skills. */
const JOB_TITLE_PHRASE_RE =
  /\b((engineering|hiring|product|project|program)\s+manager|tech(?:nical)?\s+lead|team\s+lead|staff\s+engineer|principal\s+engineer|software\s+engineer|engineering\s+manager|director|vp|cto|ceo)\b/i;

/** True when a phrase ends like a sentence fragment (cut before a verb/adjective). */
export function isSentenceFragment(kw) {
  const words = String(kw || '').trim().toLowerCase().split(/\s+/);
  if (!words.length) return true;
  const last = words[words.length - 1];
  // Ends on a connective/preposition/auxiliary → fragment ("area through automation and")
  if (FRAGMENT_END_WORDS.has(last)) return true;
  return false;
}

/** True when a phrase reads like prose, not a skill — leading words + stopword density + verbs. */
function isProseLikePhrase(kw) {
  const words = String(kw || '').trim().toLowerCase().split(/\s+/);
  if (words.length < 2) return false;
  const first = words[0];
  // Phrases starting with pronouns / conjunctions / prepositions are sentence, not skills
  if (/^(your|you|we|our|they|their|it|its|this|that|these|those|because|when|while|if|as|through|and|or|but|with|from|into|onto|upon|toward|towards)\b/.test(first)) return true;
  // Any clause verb anywhere → prose ("engineers can review quickly", "designs are clear")
  if (PROSE_VERB_RE.test(String(kw))) return true;
  // 3+ word phrases where >40% words are stopwords are prose ("area through automation and")
  if (words.length >= 3) {
    const stopCount = words.filter((w) => STOPWORDS.has(w)).length;
    if (stopCount / words.length > 0.4) return true;
  }
  return false;
}

/** Mid-phrase cut: "X and Y" / "X or Y" where Y continues a clause → fragment. */
const MID_CLAUSE_RE = /\b(?:and|or|but|so|yet)\s+(?:the|a|an|that|this|these|those|your|you|we|they|their|it|its|staff|senior|new|more|other|technical|design|docs?|engineers?|team|workstream|components?|clients?|areas?)\b/i;

/** Employer / brand names that appear in JD chrome — never skills. */
const EMPLOYER_BRAND_RE =
  /^(american express|amex|american|oracle cloud|oracle hcm|google|microsoft|amazon|meta|facebook|apple|netflix|salesforce|ibm|uber|airbnb|spotify|twitter|linkedin|indeed|naukri|glassdoor|quest global|intverse|glidewell|srijan|nec|nec india|supersourcing)$/i;

/**
 * Pull employer-looking names from JD chrome ("@ Acme", "at Acme Corp", "Job at Acme").
 * Used so random company brands never become Technical Skills.
 */
export function extractEmployerNamesFromJd(jdText) {
  const text = String(jdText || '');
  const names = [];
  const patterns = [
    // "@ Acme" / "at Acme Corp" — do not require \b before @ (punctuation is non-word)
    /(?:^|[\s(|])(?:at|@)\s+([A-Z][A-Za-z0-9&.,'’\-]+(?:\s+[A-Z][A-Za-z0-9&.,'’\-]+){0,4})/g,
    /\bJob(?:s)?\s+(?:Opening\s+)?at\s+([A-Z][A-Za-z0-9&.,'’\-]+(?:\s+[A-Z][A-Za-z0-9&.,'’\-]+){0,4})/gi,
    /\bTeam\s+(Amex|Amazon|Google|Microsoft|Meta|Apple)\b/g,
    /\b(?:future of|backing of|powered by)\s+([A-Z][A-Za-z0-9&.,'’\-]+(?:\s+[A-Z][A-Za-z0-9&.,'’\-]+){0,3})/gi,
  ];
  for (const re of patterns) {
    for (const m of text.matchAll(re)) {
      let name = String(m[1] || '').trim();
      // Stop at sentence / clause boundaries so we don't swallow "American Express. Future…"
      name = name.split(/[.\n:;|]/)[0].trim().replace(/[.,;:]+$/g, '');
      if (name.length >= 2 && name.length <= 60) names.push(name);
    }
  }
  return uniqueCasePreserved(names);
}

export function isEmployerBrandKeyword(kw, jdText = '') {
  const k = normalizeKeyword(kw);
  if (!k) return false;
  if (EMPLOYER_BRAND_RE.test(k)) return true;
  // Multi-word brands containing "Express" that are not the Node framework
  if (/\bamerican\s+express\b/i.test(k)) return true;
  if (jdText) {
    const employers = extractEmployerNamesFromJd(jdText);
    const lower = k.toLowerCase();
    const jdLower = String(jdText).toLowerCase();
    // Standalone framework token that only appears inside an employer brand in the JD
    if (
      /^express$/i.test(k)
      && /\bamerican\s+express\b/i.test(jdLower)
      && !jdMeansNodeExpress(jdText)
    ) {
      return true;
    }
    for (const emp of employers) {
      const e = emp.toLowerCase();
      if (lower === e) return true;
      // Token of employer name alone ("American", "Express" from American Express)
      if (e.includes(lower) && lower.length >= 4 && e.split(/\s+/).length >= 2) {
        const techHit = findKnownTechInText(normalizeJdTechAliases(k));
        if (techHit.length === 1 && /^express$/i.test(techHit[0]) && /\bamerican\s+express\b/i.test(e)) {
          return true;
        }
        if (techHit.length === 0 && e.split(/\s+/).includes(lower)) return true;
      }
    }
  }
  return false;
}

export function isJunkKeyword(kw) {
  const k = normalizeKeyword(kw).toLowerCase();
  if (!k || k.length < 2) return true;
  // IDE assistants / "AI-assisted coding" productivity fluff — never ATS skills
  if (isEditorIdeTool(k)) return true;
  if (/^(ai[-\s]?assisted(\s+coding)?|agentic(\s+development)?(\s+techniques)?|github copilot|cursor ai)$/i.test(k)) {
    return true;
  }
  // Junk AWS phrase crumbs (never skills)
  if (/^aws[-\s]?based$/i.test(k) || /^aws\s+serverless(\s+architectures?)?$/i.test(k)) return true;
  if (/^aws\s+cloud\s+infrastructure$/i.test(k)) return true;
  if (isEmployerBrandKeyword(k)) return true;
  // Bare version fragments split from model names ("3-large" from text-embedding-3-large)
  if (/^\d+-[a-z0-9-]+$/.test(k)) return true;
  if (STOPWORDS.has(k)) return true;
  if (WEAK_SKILL_TOKENS.has(k)) return true;
  if (JOB_TITLE_PHRASE_RE.test(k)) return true;
  if (NON_CAPABILITY_PHRASE_RE.test(k)) return true;
  if (MID_CLAUSE_RE.test(k)) return true;
  if (JUNK_KEYWORD_RE.test(k)) return true;
  if (JD_CHROME_PHRASE_RE.test(k)) return true;
  if (JD_EQUIPMENT_PHRASE_RE.test(k)) return true;
  if (isSentenceFragment(k)) return true;
  if (isProseLikePhrase(k)) return true;
  // Mid-sentence crumbs: "down ambiguous problems", "engineers and data"
  // Mid-sentence crumbs / incomplete JD cuts
  if (/^(down|break|flag|bring|partner|act|run|set|raise|own|handling|driven|cutting|rewriting|ensuring|guiding|raising|backed|strong|clear|able|for|with)\b/.test(k) && k.includes(' ')) return true;
  if (/^(engineers?|developers?|staff|seniors?)\s+and\b/.test(k)) return true;
  if (/\b(domain|area)$/.test(k) && k.includes(' ')) return true;
  if (/^(tracking|handling|reducing|ensuring|guiding|raising|models|pipelines with|cost and)\b/.test(k) && k.includes(' ')) return true;
  // Incomplete tails cut mid-phrase from JD prose
  if (/\b(and|with|for|into|onto|from|the|a|an|high|query|retry|quality|logic|overall|async)$/.test(k) && k.includes(' ')) return true;
  // "Design Kafka" style crumbs — real skill is "Kafka" / "Design Patterns" stays
  {
    const m = k.match(/^design\s+(.+)$/i);
    if (m) {
      const rest = m[1];
      const techs = findKnownTechInText(normalizeJdTechAliases(rest));
      if (techs.some((t) => normalizeKeyword(t).toLowerCase() === rest)) return true;
    }
  }
  // Soft non-skill pairs ("cost and performance", "reliability and performance")
  if (/^(cost|quality|reliability|performance|speed|scale)\s+and\s+\w+$/.test(k)) return true;
  // Multi-word phrases that still start with UI chrome ("Find candidates")
  if (/^(find|apply|search|sign|join|save|share|view|click|what|who|the)\b/.test(k)) return true;
  return false;
}

/** Only real tech / seeded domain skills may be woven into bullets or summary leads. */
export function isWeavableKeyword(kw) {
  if (isJunkKeyword(kw)) return false;
  const k = normalizeKeyword(kw);
  if (!k) return false;
  // Never treat arbitrary multi-word JD prose as a skill ("not just tickets", etc.)
  return isApprovedSkillPhrase(k);
}

/** Evidence stems that justify weaving a JD domain phrase. Family-agnostic — any future JD. */
export const DOMAIN_EVIDENCE_STEMS = [
  { match: /source-to-target|data completeness|etl validat|transformation logic|etl testing/i, stems: ['validat', 'etl', 'migrat', 'schema', 'data integrity', 'compar', 'python'] },
  { match: /data reconcil/i, stems: ['reconcil', 'etl', 'kafka', 'payment', 'data integrity', 'validat'] },
  { match: /data warehouse|staging|slowly changing|\bscd\b|fact.?dimension/i, stems: ['oracle', 'postgresql', 'schema', 'etl', 'warehouse', 'dimension', 'sql'] },
  { match: /window functions|analytical functions/i, stems: ['sql', 'oracle', 'query', 'postgresql', 'aggregat'] },
  { match: /shell scripting|job monitoring|log analysis/i, stems: ['linux', 'unix', 'shell', 'script', 'aws', 'deploy', 'ci/cd'] },
  { match: /web scrap|puppeteer|playwright|cheerio|browser automation|anti-bot|proxy/i, stems: ['scrap', 'puppeteer', 'playwright', 'cheerio', 'javascript', 'node'] },
  { match: /event-?driven|message (queue|broker)|kafka|microservices?/i, stems: ['event-driven', 'microservice', 'kafka', 'queue', 'broker', 'node', 'api'] },
  { match: /observability|incident response|distributed tracing/i, stems: ['grafana', 'prometheus', 'datadog', 'tracing', 'logging', 'elk', 'incident'] },
  { match: /auto-?scaling|container orchestration|infrastructure as code|continuous delivery/i, stems: ['aws', 'docker', 'kubernetes', 'ecs', 'lambda', 'terraform', 'ci/cd', 'deploy'] },
  { match: /restful|api design|high-throughput|low-latency|rate limit/i, stems: ['api', 'rest', 'fastapi', 'express', 'throughput', 'latency', 'node'] },
  { match: /state management|component librar|responsive design|react|typescript/i, stems: ['react', 'typescript', 'redux', 'frontend', 'ui'] },
  { match: /vector|embedding|rag|prompt engineering|agentic|langchain|llm/i, stems: ['llm', 'embedding', 'rag', 'openai', 'langchain', 'vector', 'chromadb'] },
];

/** Outcome/problem prose — what the JD wants reduced, never a candidate skill. */
const NON_CAPABILITY_PHRASE_RE =
  /\b(manual intervention|technical debt|operational toil|\btoil\b|overhead|churn|judgment calls?|direct reports?|formal authority|people-management)\b/i;

/** Leading outcome participles/adverbs turn a phrase into a fragment, not a skill. */
const OUTCOME_LEAD_RE =
  /^(assisted|aligned|reduced|reducing|improved|improving|enhanced|enhancing|increased|increasing|decreased|faster|slower|leveling|growing)\b/i;

/** Trailing adverbs/junk words mark sentence fragments, not skill phrases. */
const FRAGMENT_TAIL_RE = /\b(well|quickly|confidently|automatically|early)$/i;

/**
 * True when a JD phrase can be woven into a bullet as a grammatical noun phrase
 * (skill, tool, or capability). Rejects problem phrases, adjective fragments,
 * and prose crumbs that read as broken English when appended to a bullet.
 */
export function isWeaveableNounPhrase(kw) {
  if (!isWeavableKeyword(kw)) return false;
  const k = normalizeKeyword(kw);
  if (!k) return false;
  if (findKnownTechInText(normalizeJdTechAliases(k)).length > 0) return true;
  const lower = k.toLowerCase();
  if (/\w+-\w*(?:ed|ing)$/i.test(k)) return false;
  if (OUTCOME_LEAD_RE.test(lower)) return false;
  if (/^well-\w+$/i.test(k)) return false;
  if (/^multi-\w+$/i.test(k) && !/^multi-(tenant|cloud|region|threaded)$/i.test(k)) return false;
  if (/\b(domain|area)$/i.test(lower)) return false;
  if (NON_CAPABILITY_PHRASE_RE.test(lower)) return false;
  if (FRAGMENT_TAIL_RE.test(lower)) return false;
  if (PROSE_VERB_RE.test(k)) return false;
  return true;
}

/** Significant tokens of a keyword phrase (used for token-level coverage checks). */
export function keywordTokens(kw) {
  return normalizeKeyword(kw)
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .filter((t) => t.length >= 3);
}

/** True when text already carries the keyword — exact phrase or all tokens co-occur. */
export function keywordCoveredInText(text, kw) {
  const t = String(text || '').toLowerCase();
  const k = normalizeKeyword(kw).toLowerCase();
  if (!k) return true;
  if (t.includes(k)) return true;
  const tokens = keywordTokens(kw);
  return tokens.length > 0 && tokens.every((tok) => t.includes(tok));
}

/** Bullets ending in a quantified result must never get a weave suffix appended. */
export function endsWithMetricTail(bullet) {
  const t = String(bullet || '').trim().replace(/[.!?]+$/, '');
  return /(?:%|\b\d[\d,]*(?:\.\d+)?\s*(?:x|ms|s|hours?|minutes?|seconds?|days?|weeks?|months?|years?|users?|requests?|events?|transactions?|records?|queries?)|\b(?:month|week|day|year|monthly|daily|weekly|yearly|uptime|zero))$/i.test(t);
}

/** Tech/stack context that makes a tool parenthetical ("(PostgreSQL)") read naturally. */
const TECH_CONTEXT_RE =
  /etl|sql|oracle|validat|reconcil|schema|migrat|data integrity|python|postgresql|pipeline|api|microservice|kafka|aws|linux|node|react|observ|deploy|ci\/cd|scrap|puppeteer|database|query|cloud|server|backend|frontend/i;

export function bulletHasTechContext(bullet) {
  return TECH_CONTEXT_RE.test(String(bullet || '').toLowerCase());
}

/**
 * How strongly a bullet already neighbors a keyword:
 * 2 = keyword's leading token present, 1 = family stems / other token, 0 = none.
 */
export function weaveAdjacencyScore(bullet, kw) {
  const b = String(bullet || '').toLowerCase();
  const tokens = keywordTokens(kw);
  if (tokens.length && b.includes(tokens[0])) return 2;
  for (const rule of DOMAIN_EVIDENCE_STEMS) {
    if (rule.match.test(kw) && rule.stems.some((s) => b.includes(s))) return 1;
  }
  if (tokens.some((t) => b.includes(t))) return 1;
  return 0;
}

/** Host nouns that accept a trailing architecture/systems upgrade ("event-driven microservices" → "… microservices architecture"). */
const WEAVE_HOST_NOUNS = new Set([
  'microservices', 'microservice', 'services', 'service', 'systems', 'system',
  'platform', 'platforms', 'pipelines', 'pipeline', 'workflows', 'workflow',
  'apis', 'api', 'components', 'component', 'engines', 'engine', 'modules', 'module',
]);

/**
 * Extend an existing partial mention into the full keyword phrase:
 * "scalable, event-driven microservices" + "event-driven architecture"
 *   → "scalable, event-driven microservices architecture".
 * Returns null when no safe in-place upgrade exists.
 */
export function upgradePartialMention(base, kw) {
  const tokens = normalizeKeyword(kw).split(/\s+/);
  if (tokens.length < 2) return null;
  const mod = tokens[0];
  const target = tokens[tokens.length - 1];
  if (!mod || !target || mod.toLowerCase() === target.toLowerCase()) return null;
  const re = new RegExp(`\\b${escapeRe(mod)}\\s+([A-Za-z]+)\\b`, 'i');
  const m = String(base || '').match(re);
  if (!m) return null;
  const host = m[1].toLowerCase();
  if (!WEAVE_HOST_NOUNS.has(host) || host === target.toLowerCase()) return null;
  const already = new RegExp(`\\b${escapeRe(mod)}\\s+${escapeRe(m[1])}\\s+${escapeRe(target)}\\b`, 'i');
  if (already.test(base)) return null;
  return String(base).replace(re, (match) => `${match} ${target}`);
}

/**
 * Grammatical weave suffix for a keyword, or null when none reads naturally.
 * Tools/short tech → parenthetical; "X architecture" → "in a/an X".
 * Everything else must be handled by upgradePartialMention or skipped.
 */
export function weaveSuffixForm(kw) {
  const k = normalizeKeyword(kw);
  if (!k) return null;
  if (findKnownTechInText(normalizeJdTechAliases(k)).length > 0 && k.split(/\s+/).length <= 2) {
    return `(${k})`;
  }
  if (/\barchitecture$/i.test(k)) {
    return `in ${/^[aeiou]/i.test(k) ? 'an' : 'a'} ${k}`;
  }
  return null;
}

/** Bare abbreviations / filler nouns that read as junk on an ATS skills line. */
const WEAK_SKILL_TOKENS = new Set([
  'ml', 'ai', 'it', 'go',
  // Frequent JD English that inflated "JD ATS %" without being skills
  'days', 'day', 'current', 'product', 'code', 'codes', 'management', 'operations',
  'using', 'with', 'from', 'into', 'over', 'under', 'about', 'team', 'teams',
  'work', 'works', 'role', 'roles', 'year', 'years', 'experience', 'strong',
  'ability', 'skills', 'knowledge', 'understanding', 'excellent', 'good',
  'based', 'related', 'driven', 'oriented', 'native',
]);

/** True only when the JD clearly means Go-the-language, not "go-to" prose. */
function jdMeansGoLanguage(text) {
  const t = String(text || '');
  return /\bgolang\b/i.test(t)
    || /\bgo\s*[(/]\s*golang/i.test(t)
    || /\b(?:in|with|using|know)\s+go\b/i.test(t)
    || /\bgo\s+(?:services|microservices|development|programming|backend|engineer)/i.test(t);
}

/**
 * True when "Express" in the JD is American Express (or DevExpress already occupied),
 * not the Node.js Express framework.
 */
function jdMeansNodeExpress(text) {
  const t = String(text || '');
  const lower = t.toLowerCase();
  // Explicit Node/Express stack signal
  if (/\b(?:node\.?js|nodejs).{0,40}\bexpress\b|\bexpress(?:\.js)?\b.{0,40}\b(?:node\.?js|nodejs|middleware|router)\b/i.test(t)) {
    return true;
  }
  if (/\bexpress\.js\b/i.test(t)) return true;
  // "Express" only appears as American Express / company chrome
  const expressHits = [...lower.matchAll(/\bexpress\b/g)];
  if (expressHits.length === 0) return false;
  let realHits = 0;
  for (const m of expressHits) {
    const start = m.index ?? 0;
    const before = lower.slice(Math.max(0, start - 12), start);
    if (/american\s*$/.test(before)) continue;
    if (/dev$/.test(before)) continue;
    realHits += 1;
  }
  return realHits > 0;
}

/** Drop weak single tokens: bare "Java" from "Java script", "go" from "go-to", "ML"/"AI"/"IT". */
function suppressFalsePositiveLanguages(found, text) {
  const lower = String(text || '').toLowerCase();
  const hasJavaScript = lower.includes('javascript');
  const bareJava = /\bjava\b/.test(lower.replace(/javascript/g, ''));
  const goIsLanguage = jdMeansGoLanguage(text);
  const nodeExpress = jdMeansNodeExpress(text);
  const out = [];
  for (const kw of found) {
    const k = String(kw).toLowerCase();
    if (k === 'java' && hasJavaScript && !bareJava) continue;
    if (k === 'express' && !nodeExpress) continue;
    if (isEmployerBrandKeyword(kw)) continue;
    if (k === 'go' || k === 'golang') {
      if (!goIsLanguage) continue;
      if (!out.some((x) => /^go \(golang\)$/i.test(x))) out.push('Go (Golang)');
      continue;
    }
    if (WEAK_SKILL_TOKENS.has(k)) continue;
    out.push(kw);
  }
  return out;
}

/**
 * Strip unmatched / trailing punctuation so "TypeScript)" and "IAM)" never land on the resume.
 * Keeps balanced forms like "Go (Golang)" and tokens like Node.js / C# / CI/CD.
 */
export function cleanSkillToken(text) {
  let s = String(text || '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  s = s.replace(/^[\s<"']+/u, '').replace(/[\s"'.,;:]+$/u, '').trim();
  const count = (str, re) => (str.match(re) || []).length;
  while (/[)\]}>]$/.test(s) && count(s, /[)\]}]/g) > count(s, /[([{]/g)) {
    s = s.slice(0, -1).trim();
  }
  while (/^[([{<]/.test(s) && count(s, /[([{]/g) > count(s, /[)\]}]/g)) {
    s = s.slice(1).trim();
  }
  return s;
}

function normalizeKeyword(kw) {
  return cleanSkillToken(kw);
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
      if (overlaps) continue;
      // Never treat "Express" inside "American Express" as Node Express
      if (/^express$/i.test(tech)) {
        const before = text.slice(Math.max(0, start - 12), start);
        if (/american\s*$/i.test(before)) continue;
        if (/dev$/i.test(before)) continue;
      }
        found.push(m[0]);
        occupied.push([start, end]);
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

    for (const t of suppressFalsePositiveLanguages(findKnownTechInText(line), text)) {
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

  // 3. Frequent meaningful tokens — ONLY known tech / approved skills (never "days"/"product"/"code")
  const lower = text.toLowerCase();
  const freq = {};
  for (const m of lower.matchAll(/\b[a-z][a-z0-9+#.]{3,}\b/g)) {
    const w = m[0];
    if (STOPWORDS.has(w)) continue;
    if (WEAK_SKILL_TOKENS.has(w)) continue;
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
    })
    .filter((w) => {
      if (isJunkKeyword(w)) return false;
      // Frequency alone never promotes bare English nouns into ATS skills
      if (findKnownTechInText(normalizeJdTechAliases(w)).length > 0) return true;
      if (isApprovedSkillPhrase(w)) return true;
      return false;
    });

  found.push(...suppressFalsePositiveLanguages(frequent, text));

  const deduped = uniqueCasePreserved(
    found
      .map(normalizeKeyword)
      .filter((kw) => kw && !isJunkKeyword(kw) && !isEmployerBrandKeyword(kw, text))
  );
  // Drop partial tokens subsumed by a longer keyword (e.g. "PostgreS" when "PostgreSQL" exists)
  const ranked = deduped.filter((kw, i, arr) => {
    const lower = kw.toLowerCase();
    return !arr.some((other, j) => j !== i && other.toLowerCase().includes(lower) && other.length > kw.length);
  });
  // Final pass: Express / Go / Java false-positives against full JD context
  return suppressFalsePositiveLanguages(ranked, text).slice(0, limit);
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
  return !jdKeywords.some((kw) => keywordCoveredInText(bullet, kw));
}

function weaveKeywordIntoBullet(bullet, keyword) {
  const b = String(bullet || '').trim();
  if (!b) return b;
  const kw = String(keyword || '').trim();
  if (!kw || !isWeaveableNounPhrase(kw)) return b;
  if (keywordCoveredInText(b, kw)) return b;
  const base = b.replace(/\.$/, '');
  // Never append anything after a quantified result ("… by 85%.")
  if (endsWithMetricTail(base)) return b;

  const upgraded = upgradePartialMention(base, kw);
  if (upgraded) return `${upgraded.replace(/\.$/, '')}.`;

  const form = weaveSuffixForm(kw);
  if (!form) return b;
  if (form.startsWith('(')) {
    // Tool parenthetical only where real stack context exists
    if (!bulletHasTechContext(base)) return b;
    return `${base} ${form}.`;
  }
  // Clause forms must not stack onto a trailing prepositional phrase
  if (/\b(with|in|across|via|on)\s+[^,.]{2,40}$/i.test(base)) return b;
  if (base.length > 190) return b;
  return `${base}, ${form}.`;
}

function weaveKeywordsIntoSummary(summary, keywords, minCount = 4) {
  let text = String(summary || '').trim();
  if (!text) return text;
  const lower = text.toLowerCase();
  // JD-first: inject missing known-tech terms (up to 4)
  const toAdd = keywords
    .filter((kw) => {
      if (!isWeavableKeyword(kw)) return false;
      if (findKnownTechInText(normalizeJdTechAliases(String(kw))).length === 0) return false;
      return !lower.includes(String(kw).toLowerCase());
    })
    .slice(0, Math.min(4, Math.max(2, minCount)));
  if (toAdd.length === 0) return text;

  const lines = text.split('\n').filter(Boolean);
  if (lines.length === 0) lines.push(text);

  const inject = toAdd.join(', ');
  if (lines.length >= 2 && lines[1].length < 180) {
    lines[1] = `${lines[1].replace(/\.$/, '')} (${inject}).`;
  } else if (lines[0].length < 160) {
    lines[0] = `${lines[0].replace(/\.$/, '')} (${inject}).`;
  } else if (lines.length < 4) {
    lines.push(`Core stack: ${inject}.`);
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

  const cleanKws = jdKeywords.filter((kw) => isWeaveableNounPhrase(kw));
  const bulletKws = (opts.bulletKeywords || cleanKws).filter((kw) => isWeaveableNounPhrase(kw));
  const weaveEvery = opts.weaveEveryBullet === true;
  const weaveRoles = Array.isArray(opts.weaveRoleIndices) ? new Set(opts.weaveRoleIndices.map(Number)) : null;

  const copy = JSON.parse(JSON.stringify(resume));
  let competenciesAdded = 0;
  let bulletsAligned = 0;
  let summaryPatched = false;

  // Core competencies: real JD tech / domain skills only (never prose crumbs)
  const comps = Array.isArray(copy.core_competencies) ? [...copy.core_competencies] : [];
  const compLower = comps.map((c) => String(c).toLowerCase());
  const priority = cleanKws.filter((kw) => isApprovedSkillPhrase(kw)).slice(0, 12);
  const newComps = [];
  for (const kw of priority) {
    if (!compLower.some((c) => c.includes(String(kw).toLowerCase()))) {
      newComps.push(kw);
      competenciesAdded += 1;
    }
  }
  copy.core_competencies = uniqueCasePreserved(
    [...newComps, ...comps].filter((c) => {
      if (isEmployerBrandKeyword(c) || isJunkKeyword(c)) return false;
      if (isApprovedSkillPhrase(c)) return true;
      const hits = suppressFalsePositiveLanguages(
        findKnownTechInText(normalizeJdTechAliases(String(c))),
        String(c),
      );
      return hits.length > 0;
    }),
  ).slice(0, 16);

  // Summary: weave top missing keywords (prefer opts.summaryKeywords to avoid gap-tool stuffing)
  const summaryKws = (opts.summaryKeywords || cleanKws).filter((kw) => isWeavableKeyword(kw));
  const beforeSummary = copy.summary;
  copy.summary = weaveKeywordsIntoSummary(copy.summary, summaryKws, 4);
  summaryPatched = beforeSummary !== copy.summary;

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

/** Target JD keyword coverage (94–96 band; 100 looks fake). */
export const JD_ALIGNMENT_TARGET = 95;
/** Soft ceiling — stop pushing once we hit this (avoid perfect 100). */
export const JD_ALIGNMENT_SOFT_MAX = 96;

/**
 * Push resume text until ≥target% of JD keywords appear (competencies + summary + light weave).
 * Skills section may list the JD stack for ATS; experience weave stays weavable phrases only.
 * Stops at target (default 95) — does not force 100% (perfect scores look fake).
 * Soft-caps near JD_ALIGNMENT_SOFT_MAX (96).
 */
export function forceJdKeywordCoverage(resume, jdKeywords, opts = {}) {
  const target = Number.isFinite(opts.target) ? opts.target : JD_ALIGNMENT_TARGET;
  const softMax = Number.isFinite(opts.softMax) ? opts.softMax : JD_ALIGNMENT_SOFT_MAX;
  const maxPasses = Number.isFinite(opts.maxPasses) ? opts.maxPasses : 5;
  const sourceExperience = opts.sourceExperience || [];
  const weaveRoleIndices = opts.weaveRoleIndices;
  const bulletKeywords = (opts.bulletKeywords || jdKeywords || []).filter((kw) => isWeaveableNounPhrase(kw));

  if (!resume || !jdKeywords?.length) {
    return {
      resume,
      alignment: { score: 0, matched: [], missing: [], matchRatio: 0 },
      passes: 0,
    };
  }

  const total = jdKeywords.length;
  const neededMatches = Math.min(total, Math.ceil((target / 100) * total));
  const maxMatches = Math.min(total, Math.floor((softMax / 100) * total));

  let working = JSON.parse(JSON.stringify(resume));
  let alignment = measureJdAlignment(working, jdKeywords);
  let passes = 0;

  while (passes < maxPasses && alignment.score < target) {
    passes += 1;
    const comps = Array.isArray(working.core_competencies) ? [...working.core_competencies] : [];
    const compLower = comps.map((c) => String(c).toLowerCase());
    const matchCap = Math.max(neededMatches, Math.min(maxMatches, neededMatches));
    const stillNeeded = Math.max(0, matchCap - (alignment.matched?.length || 0));

    let added = 0;
    const justAdded = [];
    for (const kw of alignment.missing) {
      if (added >= stillNeeded) break;
      const raw = String(kw || '').trim();
      if (!raw || isJunkKeyword(raw) || isEmployerBrandKeyword(raw)) continue;
      // Skills section = ATS mirror: any real JD term (not only "approved" weave forms).
      // Bullet weave still stays conservative via alignResumeToJd / isWeaveableNounPhrase.
      if (compLower.some((c) => c.includes(raw.toLowerCase()) || raw.toLowerCase().includes(c))) continue;
      comps.unshift(raw);
      compLower.unshift(raw.toLowerCase());
      justAdded.push(raw);
      added += 1;
    }
    working.core_competencies = uniqueCasePreserved(comps).slice(0, 22);

    // Only weave what we just mirrored — avoid dumping leftover JD terms into summary (keeps ~94–96, not 100)
    working.summary = weaveKeywordsIntoSummary(
      working.summary,
      justAdded.filter((kw) => isWeavableKeyword(kw)).slice(0, 4),
      3,
    );

    alignment = measureJdAlignment(working, jdKeywords);
    if (alignment.score >= target) break;

    const remaining = Math.max(0, neededMatches - (alignment.matched?.length || 0));
    const limitedBullets = bulletKeywords.slice(0, Math.max(remaining, 3));
    const aligned = alignResumeToJd(working, jdKeywords, sourceExperience, {
      weaveEveryBullet: passes >= 2,
      bulletKeywords: limitedBullets,
      summaryKeywords: limitedBullets,
      weaveRoleIndices,
    });
    working = aligned.resume;
    alignment = measureJdAlignment(working, jdKeywords);
  }

  return { resume: working, alignment, passes };
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
