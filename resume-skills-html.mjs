/**
 * resume-skills-html.mjs — Technical Skills HTML as bullet list.
 * IDE assistants (Cursor, Claude Code, ChatGPT, Copilot) are NEVER skills.
 */

import {
  isEditorIdeTool,
  isJunkKeyword,
  isWeavableKeyword,
} from './jd-keyword-align.mjs';

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
  const s = String(text || '').trim();
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
  const t = String(text || '').trim();
  if (!t || isEditorIdeTool(t) || isJunkKeyword(t) || !isWeavableKeyword(t)) return false;
  if (isNarrativeSuperpower(t)) return false;
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

function skillsBulletList(items) {
  const seen = new Set();
  const unique = [];
  for (const raw of items) {
    const label = normalizeSkillLabel(String(raw || '').trim());
    if (!label || isNarrativeSuperpower(label)) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(label);
  }
  if (!unique.length) return '';
  return `<ul class="skills-list">${unique
    .map((s) => `<li>${escapeHtml(s)}</li>`)
    .join('')}</ul>`;
}

/**
 * Build Technical Skills as a bullet list (no "Core Competencies:" label —
 * the section heading already says Technical Skills).
 * Never unpacks IDE assistants from parentheticals like "(Cursor, Claude Code, GPTs)".
 */
export function renderCategorizedSkills(profileSuperpowers, tailoredCompetencies) {
  const superpowers = expandSkillTokens(Array.isArray(profileSuperpowers) ? profileSuperpowers : []);
  const competencies = expandSkillTokens(Array.isArray(tailoredCompetencies) ? tailoredCompetencies : []);
  if (superpowers.length === 0 && competencies.length === 0) return '';

  const techSkills = [];

  for (const item of competencies) {
    const s = String(item || '').trim();
    if (!s || isEditorIdeTool(s) || isJunkKeyword(s) || isNarrativeSuperpower(s)) continue;
    if (isTechStackSkill(s)) techSkills.push(s);
  }

  const existingLower = new Set(techSkills.map((x) => x.toLowerCase()));
  for (const sp of superpowers) {
    const s = String(sp || '').trim();
    if (!s || existingLower.has(s.toLowerCase()) || isNarrativeSuperpower(s)) continue;
    if (isEditorIdeTool(s)) continue;
    const parenMatch = s.match(/\(([^)]+)\)/);
    if (parenMatch) {
      for (const tech of parenMatch[1].split(',').map((t) => t.trim()).filter(Boolean)) {
        if (isEditorIdeTool(tech) || isJunkKeyword(tech)) continue;
        if (!existingLower.has(tech.toLowerCase()) && isTechStackSkill(tech)) {
          techSkills.push(tech);
          existingLower.add(tech.toLowerCase());
        }
      }
    }
    const cleanedSp = s.replace(/\s*\([^)]*\)\s*/g, '').trim();
    if (
      cleanedSp
      && !isEditorIdeTool(cleanedSp)
      && !existingLower.has(cleanedSp.toLowerCase())
      && !/^ai-?native tool integration$/i.test(cleanedSp)
      && isTechStackSkill(cleanedSp)
    ) {
      techSkills.push(cleanedSp);
      existingLower.add(cleanedSp.toLowerCase());
    }
  }

  const uniqueTech = [...new Set(techSkills)]
    .filter((x) => !isEditorIdeTool(x) && isTechStackSkill(x))
    .slice(0, 16);
  if (uniqueTech.length) return skillsBulletList(uniqueTech);

  // Last resort: only real tech-stack tokens — never dump JD prose
  const fallback = [...competencies, ...superpowers]
    .map((x) => String(x || '').replace(/\s*\([^)]*\)\s*/g, '').trim())
    .filter(
      (x) =>
        x
        && !isEditorIdeTool(x)
        && !isJunkKeyword(x)
        && !isNarrativeSuperpower(x)
        && isTechStackSkill(x)
        && !/^ai-?native tool integration$/i.test(x)
    )
    .slice(0, 16);
  return skillsBulletList(fallback);
}
