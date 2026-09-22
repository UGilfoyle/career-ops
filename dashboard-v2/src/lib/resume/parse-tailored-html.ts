import { emptyResumeContext, type ExperienceEntry, type ResumeContext } from './types';

function decode(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function sectionAfter(html: string, headings: string): string {
  const re = new RegExp(
    `(?:class="[^"]*section-title[^"]*"[^>]*>\\s*(?:${headings})\\s*</div>|<h2[^>]*>\\s*(?:${headings})\\s*</h2>)`,
    'i',
  );
  const m = html.match(re);
  if (!m || m.index == null) return '';
  const rest = html.slice(m.index + m[0].length);
  const next = rest.search(/<div class="[^"]*section-title|<h2[\s>]/i);
  return next >= 0 ? rest.slice(0, next) : rest;
}

function parseEducationLine(line: string): { degree: string; school: string; period: string } {
  const period = line.match(/\(([^)]+)\)\s*$/)?.[1]?.trim() || '';
  const rest = line.replace(/\s*\([^)]*\)\s*$/, '').trim();
  const comma = rest.lastIndexOf(',');
  if (comma > 0) {
    return {
      degree: rest.slice(0, comma).trim(),
      school: rest.slice(comma + 1).trim(),
      period,
    };
  }
  return { degree: rest, school: '', period };
}

/**
 * Turn a saved tailor HTML file into the same fields the Studio editor edits.
 * Returns null when the file has no job blocks, so the master draft stays put.
 */
export function parseTailoredResumeHtml(html: string, base?: ResumeContext | null): ResumeContext | null {
  const raw = String(html || '');
  if (!/<div class="job"/i.test(raw)) return null;

  const summaryHtml =
    raw.match(/class="[^"]*summary-(?:block|text)[^"]*"[^>]*>([\s\S]*?)<\/(?:p|div)>/i)?.[1] || '';
  const summaryLines = decode(summaryHtml).split(/\n+/).map((l) => l.trim()).filter(Boolean);

  const experience: ExperienceEntry[] = [];
  for (const piece of raw.split(/<div class="job"/i).slice(1)) {
    const chunk = piece.split(/<div class="[^"]*section-title/i)[0];
    const company = decode(chunk.match(/class="[^"]*job-company[^"]*"[^>]*>([\s\S]*?)<\/span>/i)?.[1] || '');
    const role = decode(chunk.match(/class="[^"]*job-title[^"]*"[^>]*>([\s\S]*?)<\/span>/i)?.[1] || '');
    const period = decode(chunk.match(/class="[^"]*job-dates[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1] || '');
    const bullets = [...chunk.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
      .map((m) => decode(m[1]))
      .filter((b) => b.length > 8);
    if (!company && !role && bullets.length === 0) continue;
    experience.push({ company, role, period, bullets });
  }
  if (experience.length === 0) return null;

  const eduBlock = sectionAfter(raw, 'Education');
  const education = eduBlock
    .split(/<div[^>]*>/i)
    .map((part) => decode(part.split(/<\/div>/i)[0] || ''))
    .filter((line) => line.length > 6 && !/^education$/i.test(line))
    .map(parseEducationLine);

  const skillBlock = sectionAfter(raw, 'Technical Skills|Skills|Core Competencies');
  const skills = [...skillBlock.matchAll(/class="[^"]*skill-label[^"]*"[^>]*>[\s\S]*?<\/span>\s*([^<]+)/gi)]
    .flatMap((m) => m[1].split(',').map((s) => decode(s)).filter(Boolean));

  const achievementBlock = sectionAfter(raw, 'Selected Achievements|Achievements');
  const proof_points = [...achievementBlock.matchAll(/<li[^>]*>[\s\S]*?<strong>([\s\S]*?)<\/strong>\s*([\s\S]*?)<\/li>/gi)]
    .map((m) => ({
      name: decode(m[1]).replace(/:$/, ''),
      hero_metric: decode(m[2]),
    }))
    .filter((p) => p.hero_metric);

  const name = decode(raw.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '');
  const root = base && Object.keys(base).length ? base : emptyResumeContext();

  return {
    ...root,
    candidate: {
      ...(root.candidate || {}),
      ...(name ? { full_name: name } : {}),
    },
    narrative: {
      ...(root.narrative || {}),
      headline: summaryLines[0] || root.narrative?.headline || '',
      exit_story: summaryLines.slice(1).join('\n'),
      ...(skills.length ? { superpowers: skills } : {}),
      ...(proof_points.length ? { proof_points } : {}),
    },
    experience,
    ...(education.length ? { education } : {}),
  };
}
