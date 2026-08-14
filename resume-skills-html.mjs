/**
 * resume-skills-html.mjs — Technical Skills HTML as bullet list.
 * IDE assistants (Cursor, Claude Code, ChatGPT, Copilot) are NEVER skills.
 */

import {
  cleanSkillToken,
  extractJdTechKeywords,
  isEditorIdeTool,
  isEmployerBrandKeyword,
  isJunkKeyword,
  isWeavableKeyword,
} from './jd-keyword-align.mjs';

export { cleanSkillToken };

/** AWS product crumbs — never list beside a top-level AWS skill. */
const AWS_SERVICE_CRUMBS = new Set([
  'iam', 'lambda', 'aurora', 'vpc', 'sqs', 'sns', 's3', 'ec2', 'ecs', 'fargate',
  'cloudfront', 'cloudformation', 'route 53', 'route53', 'api gateway',
]);

/** Languages we only list when the profile actually proves them. */
const UNPROVEN_LANGUAGE_RE =
  /^(ruby|java|php|go|golang|go \(golang\)|c#|c\+\+|swift|kotlin|scala|perl|elixir|haskell)$/i;

export function isAwsServiceCrumb(text) {
  const k = cleanSkillToken(text).toLowerCase();
  return AWS_SERVICE_CRUMBS.has(k);
}

export function isUnprovenLanguageSkill(text) {
  return UNPROVEN_LANGUAGE_RE.test(cleanSkillToken(text));
}

const TECH_PATTERNS = [
  /\b(java(?:script)?|python|typescript|go(?:lang)?|rust|ruby|c\+\+|c#|\.net|kotlin|swift|scala|php|perl|elixir|haskell|dart|r\b|sql|graphql|html|css|sass|less)\b/i,
  /\b(react|angular|vue|svelte|next\.?js|nuxt|nest\.?js|express|fastapi|flask|django|spring|rails|laravel|gin|echo|fiber|fastify|hono|remix|gatsby|astro|node\.?js|deno|bun)\b/i,
  /\b(postgres|postgresql|mysql|mariadb|mongo(?:db)?|redis|dynamodb|aurora|cockroach|cassandra|elastic|opensearch|sqlite|supabase|neon|firebase|firestore|couchdb|neo4j|memcached|influxdb)\b/i,
  /\b(aws|gcp|azure|cloudflare|vercel|heroku|digital\s?ocean|ecs|ec2|lambda|fargate|s3|cloudfront|route\s?53|iam|vpc|sqs|sns|step\s?functions|api\s?gateway|cloud\s?run|cloud\s?functions|bigquery|pubsub|terraform|pulumi|cdk|cloudformation|ansible)\b/i,
  /\b(docker|kubernetes|k8s|helm|istio|envoy|nginx|haproxy|traefik|ci\/cd|jenkins|github\s?actions|gitlab\s?ci|circle\s?ci|argo\s?cd|flux|buildkite|drone|prometheus|grafana|datadog|new\s?relic|pagerduty|splunk|elk|loki|jaeger|opentelemetry)\b/i,
  /\b(kafka|rabbitmq|nats|pulsar|flink|spark|pyspark|airflow|dbt|snowflake|redshift|bigquery|databricks|azure\s?data\s?factory|\badf\b|mlflow|sagemaker|pytorch|tensorflow|langchain|openai|hugging\s?face|llm|rag|vector\s?db|pinecone|weaviate|qdrant|milvus|chromadb)\b/i,
  /\b(jest|mocha|pytest|cypress|playwright|selenium|postman|swagger|openapi|storybook|webpack|vite|esbuild|turbopack|rollup|parcel|pnpm|yarn|npm|git|jira|confluence|linear|notion|figma|slack)\b/i,
  /\b(rest\s?api|grpc|websocket|oauth|jwt|saml|sso|rbac|rls|cors|cdn|dns|tls|ssl|http\/2|http\/3|protobuf|avro|parquet)\b/i,
  /\b(microservices?|system\s?design|event-?driven(?:\s+architecture)?|distributed\s+systems|observability|ci\/cd|devops|sre|etl|orm|scd|unit\s+testing|integration\s+testing)\b/i,
];

/** Narrative / superpower phrases — not Technical Skills bullets. */
const NARRATIVE_SKILL_RE =
  /\b(monolith-to-microservices|cost optimization|cluster optimization|high-throughput|tool integration|ai-native|superpower|ownership bar|delivery excellence|engineering velocity|transition|optimisation|optimization)\b/i;

export function isNarrativeSuperpower(text) {
  const t = String(text || '').trim();
  if (!t) return true;
  if (NARRATIVE_SKILL_RE.test(t)) return true;
  if (t.includes(',') && t.split(',').length >= 2 && t.length > 38) return true;
  const words = t.split(/\s+/);
  if (words.length >= 6 && !TECH_PATTERNS.some((p) => p.test(t))) return true;
  return false;
}

/** Split comma-joined skill blobs into individual tokens. */
export function expandSkillTokens(items) {
  const out = [];
  for (const item of Array.isArray(items) ? items : []) {
    const s = String(item || '').trim();
    if (!s) continue;
    if (s.includes(',') && s.length > 28) {
      for (const part of s.split(',').map((x) => x.trim()).filter(Boolean)) {
        out.push(part);
      }
    } else {
      out.push(s);
    }
  }
  return out;
}

const SKILL_CANONICAL = new Map([
  ['postgresql', 'PostgreSQL'],
  ['postgres', 'PostgreSQL'],
  ['javascript', 'JavaScript'],
  ['typescript', 'TypeScript'],
  ['nodejs', 'Node.js'],
  ['node.js', 'Node.js'],
  ['bun', 'Bun'],
  ['mongodb', 'MongoDB'],
  ['graphql', 'GraphQL'],
  ['kubernetes', 'Kubernetes'],
  ['docker', 'Docker'],
  ['aws', 'AWS'],
  ['azure', 'Azure'],
  ['gcp', 'GCP'],
  ['cicd', 'CI/CD'],
  ['ci/cd', 'CI/CD'],
  ['dotnet', '.NET'],
  ['.net', '.NET'],
  ['kotlin', 'Kotlin'],
  ['java', 'Java'],
  ['python', 'Python'],
  ['redis', 'Redis'],
  ['kafka', 'Kafka'],
  ['microservices', 'Microservices'],
  ['system design', 'System Design'],
  ['restful api', 'RESTful APIs'],
  ['restful apis', 'RESTful APIs'],
  ['api design', 'API Design'],
  ['agile', 'Agile'],
  ['sql server', 'SQL Server'],
  ['postgresql', 'PostgreSQL'],
]);

export function normalizeSkillLabel(text) {
  const s = cleanSkillToken(text);
  if (!s) return '';
  const lower = s.toLowerCase();
  if (SKILL_CANONICAL.has(lower)) return SKILL_CANONICAL.get(lower);
  if (s.split(/\s+/).length <= 4 && !/[A-Z]{2,}/.test(s.slice(1))) {
    return s
      .split(/\s+/)
      .map((w) => {
        const wl = w.toLowerCase();
        if (SKILL_CANONICAL.has(wl)) return SKILL_CANONICAL.get(wl);
        if (wl === 'api') return 'API';
        if (wl === 'apis') return 'APIs';
        return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
      })
      .join(' ');
  }
  return s;
}

export function isTechStackSkill(text) {
  const t = cleanSkillToken(text);
  if (!t || isEditorIdeTool(t) || isJunkKeyword(t) || !isWeavableKeyword(t)) return false;
  if (isEmployerBrandKeyword(t)) return false;
  if (isNarrativeSuperpower(t)) return false;
  // Company chrome falsely matching Express inside "American Express"
  if (/\bamerican\s+express\b/i.test(t)) return false;
  if (/^express$/i.test(t) === false && /\bexpress\b/i.test(t) && /\bamerican\b/i.test(t)) return false;
  // .NET / C# — leading punctuation breaks \b in TECH_PATTERNS
  if (/^\.?net(?:\s*core)?$/i.test(t) || /^c#$/i.test(t)) return true;
  if (t.length > 42 && /\b(transition|optimization|optimisation|integration|ownership|design)\b/i.test(t)) {
    return false;
  }
  if (t.length <= 30 && t.split(/\s+/).length <= 3) {
    return TECH_PATTERNS.some((p) => p.test(t));
  }
  return TECH_PATTERNS.some((p) => p.test(t));
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function collapseAwsCrumbs(items) {
  const hasAws = items.some((s) => /^aws\b/i.test(String(s)));
  if (!hasAws) return items;
  return items.filter((s) => !isAwsServiceCrumb(s));
}

function skillsCategoryLines(items) {
  const seen = new Set();
  const unique = [];
  for (const raw of collapseAwsCrumbs(items)) {
    const label = normalizeSkillLabel(raw);
    if (!label || isNarrativeSuperpower(label)) continue;
    if (/[()[\]{}]/.test(label) && ((label.match(/[([{]/g) || []).length !== (label.match(/[)\]}]/g) || []).length)) {
      continue;
    }
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(label);
  }
  if (!unique.length) return '';

  const buckets = {
    Languages: [],
    Frameworks: [],
    Databases: [],
    Cloud: [],
    Other: [],
  };
  for (const label of unique) {
    buckets[skillCategory(label)].push(label);
  }

  const order = ['Languages', 'Frameworks', 'Databases', 'Cloud', 'Other'];
  return order
    .filter((name) => buckets[name].length)
    .map(
      (name) =>
        `<div class="skill-line"><span class="skill-label">${name}:</span> ${escapeHtml(buckets[name].join(', '))}</div>`,
    )
    .join('');
}

function skillCategory(label) {
  const k = String(label || '').toLowerCase().replace(/\.js$/i, 'js');
  if (
    /^(javascript|typescript|python|java|go|golang|rust|ruby|php|c\+\+|c#|\.net|kotlin|swift|scala|sql|html|css|sass|less)$/i.test(k)
    || /^(javascript|typescript|python|java)\b/.test(k)
  ) {
    return 'Languages';
  }
  if (
    /^(nodejs|node\.js|react|reactjs|react\.js|express|fastapi|flask|django|nextjs|next\.js|nestjs|nest\.js|vue|angular|spring|rails|laravel|fastify|hono|remix)$/i.test(k)
    || /^(node\.?js|react|express|fastapi|django|flask|next|nest)/i.test(k)
  ) {
    return 'Frameworks';
  }
  if (
    /^(postgres|postgresql|mysql|mariadb|mongo|mongodb|redis|oracle|dynamodb|sqlite|chromadb|cassandra|elasticsearch|opensearch|supabase|firestore)$/i.test(k)
  ) {
    return 'Databases';
  }
  if (
    /^(aws|gcp|azure|docker|kubernetes|k8s|terraform|linux|ci\/cd|ecs|ec2|lambda)$/i.test(k)
    || /^(aws|azure|gcp|docker|kubernetes)\b/.test(k)
  ) {
    return 'Cloud';
  }
  return 'Other';
}

/**
 * Build Technical Skills as labeled category rows (Languages / Frameworks / Databases / Cloud).
 * Never unpacks IDE assistants from parentheticals like "(Cursor, Claude Code, GPTs)".
 * Never emits employer brands (American Express → Express).
 */
export function sanitizeCompetencyList(items, jdText = '') {
  const out = [];
  const seen = new Set();
  for (const raw of expandSkillTokens(Array.isArray(items) ? items : [])) {
    const s = cleanSkillToken(raw);
    if (!s) continue;
    if (isEditorIdeTool(s) || isJunkKeyword(s) || isEmployerBrandKeyword(s, jdText)) continue;
    if (isNarrativeSuperpower(s) || !isTechStackSkill(s)) continue;
    const label = normalizeSkillLabel(s);
    const key = label.toLowerCase();
    if (!label || seen.has(key)) continue;
    seen.add(key);
    out.push(label);
  }
  return out;
}

/** Pull real tech tokens from CV/profile text so master resumes aren't empty or JD-junk. */
export function extractTechFromTexts(texts, limit = 16) {
  const blob = (Array.isArray(texts) ? texts : [texts])
    .map((t) => String(t || '').trim())
    .filter(Boolean)
    .join('\n');
  if (blob.length < 30) return [];
  return sanitizeCompetencyList(extractJdTechKeywords(blob, limit), blob);
}

export function renderCategorizedSkills(profileSuperpowers, tailoredCompetencies, jdText = '') {
  const superpowers = expandSkillTokens(Array.isArray(profileSuperpowers) ? profileSuperpowers : []);
  const competencies = sanitizeCompetencyList(
    Array.isArray(tailoredCompetencies) ? tailoredCompetencies : [],
    jdText,
  );
  if (superpowers.length === 0 && competencies.length === 0) return '';

  const fromProfile = [];
  const existingLower = new Set();
  for (const sp of superpowers) {
    const s = String(sp || '').trim();
    if (!s || existingLower.has(s.toLowerCase()) || isNarrativeSuperpower(s)) continue;
    if (isEditorIdeTool(s) || isEmployerBrandKeyword(s, jdText)) continue;
    const parenMatch = s.match(/\(([^)]+)\)/);
    if (parenMatch) {
      for (const tech of parenMatch[1].split(',').map((t) => t.trim()).filter(Boolean)) {
        if (isEditorIdeTool(tech) || isJunkKeyword(tech) || isEmployerBrandKeyword(tech, jdText)) continue;
        if (!existingLower.has(tech.toLowerCase()) && isTechStackSkill(tech)) {
          fromProfile.push(tech);
          existingLower.add(tech.toLowerCase());
        }
      }
    }
    const cleanedSp = s.replace(/\s*\([^)]*\)\s*/g, '').trim();
    if (
      cleanedSp
      && !isEditorIdeTool(cleanedSp)
      && !isEmployerBrandKeyword(cleanedSp, jdText)
      && !existingLower.has(cleanedSp.toLowerCase())
      && !/^ai-?native tool integration$/i.test(cleanedSp)
      && isTechStackSkill(cleanedSp)
    ) {
      fromProfile.push(cleanedSp);
      existingLower.add(cleanedSp.toLowerCase());
    }
  }

  const uniqueTech = sanitizeCompetencyList([...fromProfile, ...competencies], jdText).slice(0, 18);
  if (uniqueTech.length) return skillsCategoryLines(uniqueTech);

  const fallback = sanitizeCompetencyList([...fromProfile, ...competencies, ...superpowers], jdText).slice(0, 18);
  return skillsCategoryLines(fallback);
}
