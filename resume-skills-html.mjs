/**
 * resume-skills-html.mjs — Core Competencies / Technical Skills HTML.
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
  /\b(kafka|rabbitmq|nats|pulsar|flink|spark|airflow|dbt|snowflake|redshift|databricks|mlflow|sagemaker|pytorch|tensorflow|langchain|openai|hugging\s?face|llm|rag|vector\s?db|pinecone|weaviate|qdrant|milvus|chromadb)\b/i,
  /\b(jest|mocha|pytest|cypress|playwright|selenium|postman|swagger|openapi|storybook|webpack|vite|esbuild|turbopack|rollup|parcel|pnpm|yarn|npm|git|jira|confluence|linear|notion|figma|slack)\b/i,
  /\b(rest\s?api|grpc|websocket|oauth|jwt|saml|sso|rbac|rls|cors|cdn|dns|tls|ssl|http\/2|http\/3|protobuf|avro|parquet)\b/i,
];

export function isTechStackSkill(text) {
  const t = String(text || '').trim();
  if (!t || isEditorIdeTool(t) || isJunkKeyword(t) || !isWeavableKeyword(t)) return false;
  if (t.length <= 30 && t.split(/\s+/).length <= 3) {
    return TECH_PATTERNS.some((p) => p.test(t));
  }
  return TECH_PATTERNS.some((p) => p.test(t));
}

/**
 * Split profile superpowers + tailored competencies into Core / Technical Skills HTML.
 * Never unpacks IDE assistants from parentheticals like "(Cursor, Claude Code, GPTs)".
 */
export function renderCategorizedSkills(profileSuperpowers, tailoredCompetencies) {
  const superpowers = Array.isArray(profileSuperpowers) ? profileSuperpowers : [];
  const competencies = Array.isArray(tailoredCompetencies) ? tailoredCompetencies : [];
  if (superpowers.length === 0 && competencies.length === 0) return '';

  const coreComp = [];
  const techSkills = [];

  for (const item of competencies) {
    const s = String(item || '').trim();
    if (!s || isEditorIdeTool(s) || isJunkKeyword(s)) continue;
    if (isTechStackSkill(s)) techSkills.push(s);
    else if (isWeavableKeyword(s) || s.split(/\s+/).length >= 2) coreComp.push(s);
  }

  const existingLower = new Set([...coreComp, ...techSkills].map((x) => x.toLowerCase()));
  for (const sp of superpowers) {
    const s = String(sp || '').trim();
    if (!s || existingLower.has(s.toLowerCase())) continue;
    // Block entire superpower that names IDE assistants — do not unpack parentheses
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
    ) {
      coreComp.push(cleanedSp);
      existingLower.add(cleanedSp.toLowerCase());
    }
  }

  const uniqueCore = [...new Set(coreComp)]
    .filter((x) => !isEditorIdeTool(x) && !isJunkKeyword(x))
    .slice(0, 12);
  const uniqueTech = [...new Set(techSkills)]
    .filter((x) => !isEditorIdeTool(x) && isTechStackSkill(x))
    .slice(0, 16);

  let html = '';
  if (uniqueCore.length > 0) {
    html += `<div class="skill-line"><span class="skill-label">Core Competencies:</span> ${uniqueCore.join(', ')}</div>`;
  }
  if (uniqueTech.length > 0) {
    html += `<div class="skill-line"><span class="skill-label">Technical Skills:</span> ${uniqueTech.join(', ')}</div>`;
  }
  if (!html) {
    const allItems = [...competencies, ...superpowers]
      .map((x) => String(x || '').replace(/\s*\([^)]*\)\s*/g, '').trim())
      .filter((x) => x && !isEditorIdeTool(x) && !isJunkKeyword(x) && !/^ai-?native tool integration$/i.test(x))
      .slice(0, 12);
    if (allItems.length) {
      html = `<div class="skill-line"><span class="skill-label">Skills:</span> ${allItems.join(', ')}</div>`;
    }
  }
  return html;
}
