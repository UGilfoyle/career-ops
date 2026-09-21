import type { ExperienceEntry } from './types';

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

/**
 * Weave missing keywords into job experience bullets cleanly and naturally.
 * Spreads keywords across recent roles and bullets without piling everything into one place.
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

    // 2. Find a suitable bullet across recent roles (top 3 roles)
    let weaved = false;
    const rolesToSearch = Math.min(cloned.length, 3);

    for (let attempt = 0; attempt < rolesToSearch * 5; attempt++) {
      const ri = (targetRoleIdx + Math.floor(attempt / 5)) % rolesToSearch;
      const role = cloned[ri];
      if (!role.bullets || !role.bullets.length) continue;

      const bi = (targetBulletIdx + (attempt % 5)) % role.bullets.length;
      const bulletKey = `${ri}:${bi}`;

      if (modifiedBullets.has(bulletKey) && attempt < rolesToSearch * 4) continue;

      let bullet = sanitizeBulletParens(role.bullets[bi]);
      // Skip bullets ending with strict percentage or metric to keep stats crisp
      if (/(?:%|\b\d+\s*(?:ms|s|x))\s*\.?$/i.test(bullet)) continue;
      // Skip broken/truncated fragments
      if (/\b(?:and|the|to|for|with|by|or|,)\s*$/i.test(bullet.replace(/\.$/, ''))) continue;

      // If bullet has a tools parenthetical e.g. (WebSockets, RESTful API)
      const parenMatch = bullet.match(/\(([^)]{2,80})\)/);
      if (parenMatch && !/\d{4}/.test(parenMatch[1])) {
        const items = parenMatch[1].split(',').map((s) => s.trim()).filter(Boolean);
        if (items.length < 5 && !items.some((i) => i.toLowerCase() === kwLower)) {
          items.push(cleanKw);
          role.bullets[bi] = sanitizeBulletParens(
            bullet.replace(parenMatch[0], `(${items.join(', ')})`)
          );
          modifiedBullets.add(bulletKey);
          weaved = true;
          targetBulletIdx = (bi + 1) % role.bullets.length;
          targetRoleIdx = (ri + 1) % rolesToSearch;
          break;
        }
      }

      // Otherwise append tool/skill parenthetical before trailing period
      const base = bullet.replace(/\.$/, '').trim();
      if (base.length < 240 && !base.endsWith(')')) {
        role.bullets[bi] = sanitizeBulletParens(`${base} (${cleanKw}).`);
        modifiedBullets.add(bulletKey);
        weaved = true;
        targetBulletIdx = (bi + 1) % role.bullets.length;
        targetRoleIdx = (ri + 1) % rolesToSearch;
        break;
      }
    }

    // Fallback: if all had metrics/long, append to first bullet of role 0
    if (!weaved && cloned[0]?.bullets?.length) {
      let b0 = sanitizeBulletParens(cloned[0].bullets[0]);
      const base = b0.replace(/\.$/, '').trim();
      if (!base.endsWith(')')) {
        cloned[0].bullets[0] = sanitizeBulletParens(`${base} (${cleanKw}).`);
      }
    }
  }

  return cloned;
}
