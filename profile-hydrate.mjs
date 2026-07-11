/**
 * profile-hydrate.mjs — Ensure resume_context has experience/education before tailoring.
 */

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

function candidateRoots() {
  const roots = new Set([
    process.cwd(),
    process.env.APP_ROOT || '',
    path.join(process.cwd(), '..'),
    path.join(process.cwd(), 'runtime-assets'),
    path.join(process.env.APP_ROOT || '', 'runtime-assets'),
    path.join(process.cwd(), '..', 'runtime-assets'),
  ]);
  return [...roots].filter(Boolean);
}

function readFileAt(relPath) {
  for (const root of candidateRoots()) {
    const full = path.join(root, relPath);
    if (fs.existsSync(full)) return fs.readFileSync(full, 'utf8');
  }
  return null;
}

function loadYamlAt(relPath) {
  const raw = readFileAt(relPath);
  if (!raw) return null;
  try {
    return yaml.load(raw);
  } catch {
    return null;
  }
}

function parseCvMarkdown(text) {
  const experience = [];
  const education = [];

  const expSection = text.match(/## Professional Experience\s*([\s\S]*?)(?=\n## |\n---|$)/i);
  if (expSection) {
    const blocks = expSection[1].split(/\n### /).filter(Boolean);
    for (const block of blocks) {
      const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
      if (lines.length === 0) continue;
      const role = lines[0].replace(/^#+\s*/, '').trim();
      let company = '';
      let period = '';
      const header = lines[1] || '';
      const companyMatch = header.match(/^\*\*(.+?)\*\*\s*\|\s*(.+)$/);
      if (companyMatch) {
        company = companyMatch[1].trim();
        period = companyMatch[2].trim();
      }
      const bullets = lines
        .slice(2)
        .map((l) => l.replace(/^[-•*▸]\s*/, '').replace(/\*\*([^*]+)\*\*:\s*/g, '$1: ').trim())
        .filter((l) => l.length > 10);
      if ((role || company) && bullets.length > 0) {
        experience.push({ role, company, period, bullets });
      }
    }
  }

  const eduSection = text.match(/## Education\s*([\s\S]*?)(?=\n## |\n---|$)/i);
  if (eduSection) {
    for (const line of eduSection[1].split('\n').map((l) => l.trim()).filter(Boolean)) {
      const m = line.match(/^\*\*(.+?)\*\*\s*\(([^)]+)\)\s*\|\s*(.+)$/);
      if (m) {
        education.push({ degree: m[1].trim(), period: m[2].trim(), school: m[3].trim() });
      }
    }
  }

  return { experience, education };
}

function extractEducationYears(text) {
  const years = [...String(text || '').matchAll(/\b(19|20)\d{2}\b/g)].map((m) => parseInt(m[0], 10));
  const unique = [...new Set(years)].sort((a, b) => a - b);
  if (unique.length === 0) return '';
  if (unique.length === 1) return String(unique[0]);
  return `${unique[0]} – ${unique[unique.length - 1]}`;
}

function stripEducationDateNoise(text) {
  let s = String(text || '');
  // Repeat until stable — strips nested "(2016, 2018) (2016 – 2018)" chunks
  for (let i = 0; i < 6; i++) {
    const next = s
      .replace(/\s*\([^)]*\d{4}[^)]*\)\s*/g, ' ')
      .replace(/\s*\b(19|20)\d{2}\s*[,/]\s*(19|20)\d{2}\b/g, '')
      .replace(/\s*\b(19|20)\d{2}\s*[—–-]\s*(19|20)\d{2}\b/g, '')
      .replace(/\s+\b(19|20)\d{2}\b\s*$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (next === s) break;
    s = next;
  }
  return s;
}

/** Normalize one education row — fixes duplicated years in school/period fields. */
export function normalizeEducationEntry(entry) {
  const raw = entry && typeof entry === 'object' ? entry : {};
  let degree = stripEducationDateNoise(raw.degree);
  let school = stripEducationDateNoise(raw.school);
  const combined = `${raw.degree || ''} ${raw.school || ''} ${raw.period || ''}`;
  let period = extractEducationYears(combined);

  // Degree field sometimes embeds "Degree, School 2016 (2016, 2018)" — split out school
  if (degree.includes(',')) {
    const idx = degree.indexOf(',');
    const degreePart = stripEducationDateNoise(degree.slice(0, idx));
    const schoolPart = stripEducationDateNoise(degree.slice(idx + 1));
    if (schoolPart.length > 2) {
      degree = degreePart;
      if (!school || schoolPart.length >= school.length) school = schoolPart;
    }
  }

  // Drop duplicate school token if still embedded in degree
  if (school && degree.toLowerCase().includes(school.toLowerCase())) {
    degree = stripEducationDateNoise(
      degree.replace(new RegExp(`,?\\s*${school.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'), '')
    );
  }

  // Prefer longer clean school name when both fields mention university
  if (school && degree && degree.toLowerCase() === school.toLowerCase()) {
    degree = '';
  }

  return {
    degree,
    school,
    period,
    ...(raw.location ? { location: String(raw.location).trim() } : {}),
  };
}

/** Plain-text education line for resume/PDF. */
export function formatEducationLine(entry) {
  const n = normalizeEducationEntry(entry);
  const left = n.school ? `${n.degree}, ${n.school}` : n.degree;
  return n.period ? `${left} (${n.period})` : left;
}

export function normalizeEducationList(education) {
  if (!Array.isArray(education)) return [];
  return education
    .map(normalizeEducationEntry)
    .filter((e) => e.degree || e.school);
}

function mergeProfile(base, incoming) {
  const out = { ...(base || {}) };
  if (!incoming || typeof incoming !== 'object') return out;

  if (incoming.candidate && typeof incoming.candidate === 'object') {
    out.candidate = { ...(out.candidate || {}), ...incoming.candidate };
  }
  if (incoming.narrative && typeof incoming.narrative === 'object') {
    out.narrative = { ...(out.narrative || {}), ...incoming.narrative };
  }
  if (Array.isArray(incoming.experience) && incoming.experience.length > 0) {
    out.experience = incoming.experience;
  }
  if (Array.isArray(incoming.education) && incoming.education.length > 0) {
    out.education = incoming.education;
  }
  return out;
}

/**
 * @param {object} profile resume_context from DB
 * @returns {{ profile: object, hydrated: boolean, educationRepaired: boolean, sources: string[] }}
 */
export function hydrateResumeProfile(profile) {
  let next = profile && typeof profile === 'object' ? { ...profile } : {};
  const sources = [];
  const hadExp = Array.isArray(next.experience) && next.experience.length > 0;
  const hadEdu = Array.isArray(next.education) && next.education.length > 0;
  const educationBefore = JSON.stringify(next.education || []);

  if (!(hadExp && hadEdu)) {
    const yamlPaths = [
      'config/profile.yml',
      'runtime-assets/config/profile.yml',
      '../config/profile.yml',
    ];
    for (const rel of yamlPaths) {
      const fromYaml = loadYamlAt(rel);
      if (fromYaml) {
        next = mergeProfile(next, fromYaml);
        sources.push(rel);
        break;
      }
    }

    const stillNoExp = !Array.isArray(next.experience) || next.experience.length === 0;
    const stillNoEdu = !Array.isArray(next.education) || next.education.length === 0;

    if (stillNoExp || stillNoEdu) {
      const cvRaw = readFileAt('cv.md') || readFileAt('../cv.md');
      if (cvRaw) {
        const parsed = parseCvMarkdown(cvRaw);
        if (stillNoExp && parsed.experience.length > 0) {
          next.experience = parsed.experience;
          sources.push('cv.md');
        }
        if (stillNoEdu && parsed.education.length > 0) {
          next.education = parsed.education;
          sources.push('cv.md');
        }
      }
    }
  }

  if (Array.isArray(next.education) && next.education.length > 0) {
    next.education = normalizeEducationList(next.education);
  }

  const hydrated =
    (!hadExp && Array.isArray(next.experience) && next.experience.length > 0)
    || (!hadEdu && Array.isArray(next.education) && next.education.length > 0);
  const educationRepaired = educationBefore !== JSON.stringify(next.education || []);

  return { profile: next, hydrated, educationRepaired, sources };
}

/**
 * Merge incoming settings payload without wiping experience/education with empty arrays.
 */
export function mergeResumeContext(existing, incoming) {
  const base = existing && typeof existing === 'object' ? { ...existing } : {};
  const next = incoming && typeof incoming === 'object' ? { ...incoming } : {};

  const merged = {
    ...base,
    ...next,
    candidate: { ...(base.candidate || {}), ...(next.candidate || {}) },
    narrative: { ...(base.narrative || {}), ...(next.narrative || {}) },
    search: { ...(base.search || {}), ...(next.search || {}) },
    github_settings: { ...(base.github_settings || {}), ...(next.github_settings || {}) },
    gcc_campaign: next.gcc_campaign || base.gcc_campaign,
  };

  if (Array.isArray(next.experience) && next.experience.length > 0) {
    merged.experience = next.experience;
  } else if (Array.isArray(base.experience) && base.experience.length > 0) {
    merged.experience = base.experience;
  } else {
    merged.experience = next.experience || [];
  }

  if (Array.isArray(next.education) && next.education.length > 0) {
    merged.education = normalizeEducationList(next.education);
  } else if (Array.isArray(base.education) && base.education.length > 0) {
    merged.education = normalizeEducationList(base.education);
  } else {
    merged.education = next.education || [];
  }

  return merged;
}
