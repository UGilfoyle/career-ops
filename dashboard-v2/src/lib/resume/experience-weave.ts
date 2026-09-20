import type { ExperienceEntry } from './types';

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

  let targetRoleIdx = 0;
  let targetBulletIdx = 0;

  for (const rawKw of keywords) {
    const cleanKw = String(rawKw || '').trim();
    if (!cleanKw) continue;
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

      // Avoid double-weaving the same bullet in the same session if other bullets are available
      if (modifiedBullets.has(bulletKey) && attempt < rolesToSearch * 4) continue;

      const bullet = role.bullets[bi];
      // Skip bullets ending with strict percentage or metric to keep stats crisp
      if (/(?:%|\b\d+\s*(?:ms|s|x))\s*\.?$/i.test(bullet)) continue;

      // If bullet has a tools parenthetical e.g. (WebSockets, RESTful API)
      const parenMatch = bullet.match(/\(([^)]{2,80})\)/);
      if (parenMatch && !/\d{4}/.test(parenMatch[1])) {
        const items = parenMatch[1].split(',').map((s) => s.trim()).filter(Boolean);
        if (items.length < 5 && !items.some((i) => i.toLowerCase() === kwLower)) {
          items.push(cleanKw);
          role.bullets[bi] = bullet.replace(parenMatch[0], `(${items.join(', ')})`);
          modifiedBullets.add(bulletKey);
          weaved = true;
          targetBulletIdx = (bi + 1) % role.bullets.length;
          targetRoleIdx = (ri + 1) % rolesToSearch;
          break;
        }
      }

      // Otherwise append tool/skill parenthetical before trailing period
      const base = bullet.replace(/\.$/, '').trim();
      if (base.length < 240) {
        role.bullets[bi] = `${base} (${cleanKw}).`;
        modifiedBullets.add(bulletKey);
        weaved = true;
        targetBulletIdx = (bi + 1) % role.bullets.length;
        targetRoleIdx = (ri + 1) % rolesToSearch;
        break;
      }
    }

    // Fallback: if all had metrics/long, append to first bullet of role 0
    if (!weaved && cloned[0]?.bullets?.length) {
      const base = cloned[0].bullets[0].replace(/\.$/, '').trim();
      cloned[0].bullets[0] = `${base} (${cleanKw}).`;
    }
  }

  return cloned;
}
