import type { ExperienceEntry } from './types';
import { isBulletAnachronisticForPeriod } from '@/lib/resume/bullet-pipeline';

/**
 * Common typo fixes and skill normalizations.
 */
function cleanKeywordToken(kw: string): string {
  let s = String(kw || '').trim();
  s = s.replace(/^using\s+/i, '').replace(/\btypescrip\b/i, 'TypeScript');
  if (/^golang$/i.test(s)) return 'Go (Golang)';
  if (/^reactjs$/i.test(s) || /^react\.js$/i.test(s)) return 'React';
  if (/^nextjs$/i.test(s) || /^next\.js$/i.test(s)) return 'Next.js';
  if (/^nodejs$/i.test(s) || /^node\.js$/i.test(s)) return 'Node.js';
  if (/^nestjs$/i.test(s) || /^nest\.js$/i.test(s)) return 'NestJS';
  return s;
}

function isWeavableSkill(kw: string): boolean {
  const s = String(kw || '').trim();
  if (!s || s.length < 2 || s.length > 35) return false;
  // Don't weave entire clauses or sentences
  if (s.split(/\s+/).length > 3) return false;
  if (/\b(management|environment|environments|initiative|initiatives|experience|proficient)\b/i.test(s)) return false;
  return true;
}

function sanitizeBulletParens(text: string): string {
  let clean = String(text || '').trim();
  // Remove empty or double parens
  clean = clean.replace(/\(\s*\)/g, '').replace(/\(\s*\(/g, '(').replace(/\)\s*\)/g, ')');
  // Fix unclosed trailing paren
  const opens = (clean.match(/\(/g) || []).length;
  const closes = (clean.match(/\)/g) || []).length;
  if (opens > closes) {
    clean = clean.replace(/\(\s*([^)]*)$/, '($1)');
  }
  return clean;
}

function bulletTopicScore(bullet: string, kw: string): number {
  const b = bullet.toLowerCase();
  const k = kw.toLowerCase();
  let score = 0;
  if (/(langgraph|langchain|llamaindex|mcp|openai|llm|rag|pytorch|tensorflow|vllm|evals?|rlhf|embeddings?|pgvector|vector)/.test(k)) {
    if (/(openai|llm|document|ingestion|python|validation|metadata|ai\b|pipeline)/.test(b)) score += 10;
  } else if (/(pyspark|databricks|snowflake|dbt|airflow|etl|sql|postgres|redis|mongodb)/.test(k)) {
    if (/(postgres|sql|pipeline|ingestion|query|index|cache|caching|schema|partition)/.test(b)) score += 10;
  } else if (/(kubernetes|terraform|docker|aws|ec2|ecs|lambda|iam|vpc|prometheus|grafana|opentelemetry|cloudwatch|linux|ci\/cd|github actions)/.test(k)) {
    if (/(aws|terraform|cloudformation|docker|container|ci\/cd|jenkins|linux|cloud|deploy|monitoring|rca|logging)/.test(b)) score += 10;
  } else if (/(stripe|adyen|webhook|mulesoft|workato|salesforce|netsuite|oauth|soap|kafka|rabbitmq|mqtt|grpc)/.test(k)) {
    if (/(integration|retry|backoff|kafka|rabbitmq|mqtt|fedex|ups|dhl|rate limit|messaging|queue|api)/.test(b)) score += 10;
  } else if (/(react|next\.js|typescript|redux|angular|vue|ui|frontend)/.test(k)) {
    if (/(react|ui|component|frontend|web|interface)/.test(b)) score += 10;
  }
  return score;
}

/**
 * Weave missing keywords into job experience bullets cleanly and naturally.
 * Prefers bullets with strong topical alignment before falling back round-robin.
 */
export function weaveKeywordsIntoExperience(
  experience: ExperienceEntry[] | undefined,
  keywords: string[]
): ExperienceEntry[] {
  if (!Array.isArray(experience) || !experience.length || !keywords.length) {
    return experience || [];
  }

  const cloned: ExperienceEntry[] = JSON.parse(JSON.stringify(experience));
  const modifiedBullets = new Set<string>(); // "roleIdx:bulletIdx"

  // Expand comma-separated keywords if any
  const expandedKeywords: string[] = [];
  for (const raw of keywords) {
    const s = String(raw || '').trim();
    if (s.includes(',') && s.length < 40) {
      expandedKeywords.push(...s.split(',').map((x) => x.trim()).filter(Boolean));
    } else {
      expandedKeywords.push(s);
    }
  }

  let targetRoleIdx = 0;
  let targetBulletIdx = 0;

  for (const rawKw of expandedKeywords) {
    const cleanKw = cleanKeywordToken(rawKw);
    if (!isWeavableSkill(cleanKw)) continue;
    const kwLower = cleanKw.toLowerCase();

    // 1. Check if already present anywhere in experience bullets
    let alreadyPresent = false;
    for (const role of cloned) {
      for (const b of role.bullets || []) {
        if (b.toLowerCase().includes(kwLower)) {
          alreadyPresent = true;
          break;
        }
      }
      if (alreadyPresent) break;
    }
    if (alreadyPresent) continue;

    // 2. Score all eligible bullets across top 3 roles by topic affinity + freshness
    const rolesToSearch = Math.min(cloned.length, 3);
    const candidates: Array<{ ri: number; bi: number; score: number }> = [];
    for (let rOff = 0; rOff < rolesToSearch; rOff++) {
      const ri = (targetRoleIdx + rOff) % rolesToSearch;
      const role = cloned[ri];
      if (!role.bullets || !role.bullets.length) continue;
      if (isBulletAnachronisticForPeriod(cleanKw, role.period)) continue;

      for (let bOff = 0; bOff < role.bullets.length; bOff++) {
        const bi = (targetBulletIdx + bOff) % role.bullets.length;
        const bullet = sanitizeBulletParens(role.bullets[bi]);
        if (/(?:%|\b\d+\s*(?:ms|s|x))\s*\.?$/i.test(bullet)) continue;
        if (/\b(?:and|the|to|for|with|by|or|,)\s*$/i.test(bullet.replace(/\.$/, ''))) continue;
        const bulletKey = `${ri}:${bi}`;
        const freshBonus = modifiedBullets.has(bulletKey) ? 0 : 100;
        const topic = bulletTopicScore(bullet, cleanKw);
        candidates.push({ ri, bi, score: freshBonus + topic });
      }
    }
    candidates.sort((a, b) => b.score - a.score);

    let weaved = false;
    for (const cand of candidates) {
      const { ri, bi } = cand;
      const role = cloned[ri];
      const roleBullets = role.bullets!;
      const bulletKey = `${ri}:${bi}`;
      const bullet = sanitizeBulletParens(roleBullets[bi]);

      // If bullet has a legacy trailing tools parenthetical e.g. "(CI/CD)." unwrap it into natural prose
      const parenMatch = bullet.match(/\s*\(([^)]{2,80})\)\s*\.?$/);
      if (parenMatch && !/\d{4}/.test(parenMatch[1])) {
        const items = parenMatch[1].split(',').map((s) => s.trim()).filter(Boolean);
        if (items.length < 5 && !items.some((i) => i.toLowerCase() === kwLower)) {
          items.push(cleanKw);
          const beforeParen = bullet.slice(0, parenMatch.index).replace(/\.$/, '').trim();
          const listStr = items.length <= 2 ? items.join(' and ') : `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
          const joiner = /\busing\b/i.test(beforeParen) ? 'with' : 'using';
          roleBullets[bi] = sanitizeBulletParens(`${beforeParen} ${joiner} ${listStr}.`);
          modifiedBullets.add(bulletKey);
          weaved = true;
          targetBulletIdx = (bi + 1) % roleBullets.length;
          targetRoleIdx = (ri + 1) % rolesToSearch;
          break;
        }
      }

      // If bullet already ends with "using X" or "using X and Y", extend the list smoothly instead of tagging parens
      const base = bullet.replace(/\.$/, '').trim();
      const usingTail = base.match(/\s+(using|with)\s+([A-Za-z0-9.+/#-]+(?:\s*,\s*[A-Za-z0-9.+/#-]+)*(?:\s*,?\s*and\s+[A-Za-z0-9.+/#-]+)?)$/i);
      if (base.length < 240 && usingTail && !base.endsWith(')')) {
        const prefix = base.slice(0, usingTail.index).trim();
        const prep = usingTail[1];
        const existingItems = usingTail[2]
          .split(/\s*,\s*and\s+|\s*,\s*|\s+and\s+/i)
          .map((s) => s.trim())
          .filter(Boolean);
        if (existingItems.length < 5 && !existingItems.some((x) => x.toLowerCase() === kwLower)) {
          existingItems.push(cleanKw);
          const listStr = existingItems.length <= 2
            ? existingItems.join(' and ')
            : `${existingItems.slice(0, -1).join(', ')}, and ${existingItems[existingItems.length - 1]}`;
          roleBullets[bi] = sanitizeBulletParens(`${prefix} ${prep} ${listStr}.`);
          modifiedBullets.add(bulletKey);
          weaved = true;
          targetBulletIdx = (bi + 1) % roleBullets.length;
          targetRoleIdx = (ri + 1) % rolesToSearch;
          break;
        }
      }

      // Otherwise weave naturally into prose before trailing period
      if (base.length < 240 && !base.endsWith(')')) {
        const joiner = /\busing\b/i.test(base) ? 'with' : 'using';
        roleBullets[bi] = sanitizeBulletParens(`${base} ${joiner} ${cleanKw}.`);
        modifiedBullets.add(bulletKey);
        weaved = true;
        targetBulletIdx = (bi + 1) % roleBullets.length;
        targetRoleIdx = (ri + 1) % rolesToSearch;
        break;
      }
    }

    // Fallback: if all had metrics/long, weave naturally on first bullet of role 0 (if not anachronistic)
    if (!weaved && cloned[0]?.bullets?.length) {
      if (!isBulletAnachronisticForPeriod(cleanKw, cloned[0].period)) {
        const b0 = sanitizeBulletParens(cloned[0].bullets[0]);
        const base = b0.replace(/\.$/, '').trim();
        if (!base.endsWith(')')) {
          const joiner = /\busing\b/i.test(base) ? 'with' : 'using';
          cloned[0].bullets[0] = sanitizeBulletParens(`${base} ${joiner} ${cleanKw}.`);
        }
      }
    }
  }

  return cloned;
}
