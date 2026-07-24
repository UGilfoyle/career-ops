/**
 * profile-hydrate.mjs — Ensure resume_context has experience/education before tailoring.
 */

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { normalizeEducationList } from './education-format.mjs';

export { normalizeEducationEntry, formatEducationLine, normalizeEducationList } from './education-format.mjs';

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
  const candidate = {};

  const h1 = text.match(/^#\s+(.+)$/m);
  if (h1) candidate.full_name = h1[1].replace(/\*\*/g, '').trim();

  const email = text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);
  if (email) candidate.email = email[0];
  const phone = text.match(/\+\d{1,3}[\s-]?\d[\d\s-]{8,}\d/);
  if (phone) candidate.phone = phone[0].trim();
  const linkedin = text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[A-Za-z0-9_-]+/i);
  if (linkedin) candidate.linkedin = linkedin[0].replace(/^https?:\/\//i, '');
  const github = text.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/[A-Za-z0-9_-]+/i);
  if (github) candidate.github = github[0].replace(/^https?:\/\//i, '');

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

  return { experience, education, candidate };
}

function mergeCandidate(base, incoming) {
  const out = { ...(base || {}) };
  if (!incoming || typeof incoming !== 'object') return out;
  for (const key of Object.keys(incoming)) {
    const val = incoming[key];
    if (typeof val === 'string' && val.trim() && !(typeof out[key] === 'string' && out[key].trim())) {
      out[key] = val.trim();
    }
  }
  return out;
}

function experienceKey(job) {
  return `${String(job?.company || '').toLowerCase()}::${String(job?.role || '').toLowerCase()}`;
}

function mergeExperiencePreserveMissing(baseList, incomingList) {
  const base = Array.isArray(baseList) ? baseList : [];
  const incoming = Array.isArray(incomingList) ? incomingList : [];
  if (base.length === 0) return incoming;
  if (incoming.length === 0) return base;
  const seen = new Set(base.map(experienceKey).filter(Boolean));
  const merged = [...base];
  for (const job of incoming) {
    const key = experienceKey(job);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(job);
  }
  return merged;
}

function shouldBackfillExperience(baseList, incomingList) {
  const base = Array.isArray(baseList) ? baseList : [];
  const incoming = Array.isArray(incomingList) ? incomingList : [];
  if (base.length === 0 && incoming.length > 0) return true;
  if (incoming.length <= base.length) return false;
  const incomingCompanies = new Set(
    incoming.map((j) => String(j?.company || '').toLowerCase()).filter(Boolean)
  );
  // Only treat as a partial wipe when at least one current company still matches
  // the canonical yaml/cv list (avoids appending full CV onto unrelated drafts).
  return base.some((j) => incomingCompanies.has(String(j?.company || '').toLowerCase()));
}

function mergeProfile(base, incoming) {
  const out = { ...(base || {}) };
  if (!incoming || typeof incoming !== 'object') return out;

  if (incoming.candidate && typeof incoming.candidate === 'object') {
    out.candidate = mergeCandidate(out.candidate, incoming.candidate);
  }
  if (incoming.narrative && typeof incoming.narrative === 'object') {
    // Only fill blank narrative fields — don't overwrite user edits with yaml defaults.
    const narrative = { ...(out.narrative || {}) };
    for (const [key, val] of Object.entries(incoming.narrative)) {
      if (Array.isArray(val)) {
        if (!Array.isArray(narrative[key]) || narrative[key].length === 0) narrative[key] = val;
      } else if (typeof val === 'string' && val.trim() && !(typeof narrative[key] === 'string' && narrative[key].trim())) {
        narrative[key] = val;
      } else if (val && typeof val === 'object' && !narrative[key]) {
        narrative[key] = val;
      }
    }
    out.narrative = narrative;
  }
  if (Array.isArray(incoming.experience) && incoming.experience.length > 0) {
    if (!Array.isArray(out.experience) || out.experience.length === 0) {
      out.experience = incoming.experience;
    } else if (shouldBackfillExperience(out.experience, incoming.experience)) {
      out.experience = mergeExperiencePreserveMissing(out.experience, incoming.experience);
    }
  }
  if (Array.isArray(incoming.education) && incoming.education.length > 0) {
    if (!Array.isArray(out.education) || out.education.length === 0) {
      out.education = incoming.education;
    }
  }
  return out;
}

/**
 * Normalize resume_context values returned by different DB/client boundaries.
 * PostgreSQL JSONB normally arrives as an object, but older writes and proxies
 * may return JSON strings or wrap the payload in resume_context/profile.
 */
export function normalizeResumeContext(value) {
  let parsed = value;
  for (let depth = 0; depth < 3 && typeof parsed === 'string'; depth += 1) {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return {};
    }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

  let normalized = { ...parsed };
  for (const key of ['resume_context', 'profile']) {
    let nested = normalized[key];
    for (let depth = 0; depth < 2 && typeof nested === 'string'; depth += 1) {
      try {
        nested = JSON.parse(nested);
      } catch {
        nested = null;
      }
    }
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      const nestedRecord = { ...nested };
      normalized = {
        ...normalized,
        ...nestedRecord,
        candidate: {
          ...(normalized.candidate || {}),
          ...(nestedRecord.candidate || {}),
        },
        narrative: {
          ...(normalized.narrative || {}),
          ...(nestedRecord.narrative || {}),
        },
      };
      if (Array.isArray(nestedRecord.experience) && nestedRecord.experience.length > 0) {
        normalized.experience = nestedRecord.experience;
      }
      if (Array.isArray(nestedRecord.education) && nestedRecord.education.length > 0) {
        normalized.education = nestedRecord.education;
      }
    }
  }
  delete normalized.resume_context;
  delete normalized.profile;
  return normalized;
}

/**
 * @param {object} profile resume_context from DB
 * @returns {{ profile: object, hydrated: boolean, educationRepaired: boolean, sources: string[] }}
 */
export function hydrateResumeProfile(profile) {
  let next = normalizeResumeContext(profile);
  const sources = [];
  const hadExp = Array.isArray(next.experience) && next.experience.length > 0;
  const hadEdu = Array.isArray(next.education) && next.education.length > 0;
  const hadName = Boolean(String(next.candidate?.full_name || '').trim());
  const educationBefore = JSON.stringify(next.education || []);
  const expCountBefore = Array.isArray(next.experience) ? next.experience.length : 0;

  // Always attempt candidate + missing experience backfill from yaml/cv.
  // Previously we skipped entirely when ANY experience existed — that left
  // empty full_name and dropped companies (e.g. Rubico) after partial Replace.
  {
    const yamlPaths = [
      'config/profile.yml',
      'runtime-assets/config/profile.yml',
      '../config/profile.yml',
    ];
    // Committed anonymized fixture — CI only (personal profile.yml is gitignored there)
    if (process.env.CI || process.env.CAREER_OPS_USE_CI_FIXTURE === '1') {
      yamlPaths.push('examples/ci-resume-fixture/profile.yml');
    }
    for (const rel of yamlPaths) {
      const fromYaml = loadYamlAt(rel);
      if (fromYaml) {
        next = mergeProfile(next, fromYaml);
        sources.push(rel);
        break;
      }
    }

    const stillNoName = !String(next.candidate?.full_name || '').trim();
    const stillNoExp = !Array.isArray(next.experience) || next.experience.length === 0;
    const stillNoEdu = !Array.isArray(next.education) || next.education.length === 0;
    const maybeIncompleteExp = hadExp && Array.isArray(next.experience) && next.experience.length > 0;

    if (stillNoName || stillNoExp || stillNoEdu || maybeIncompleteExp) {
      let cvRaw = readFileAt('cv.md') || readFileAt('../cv.md');
      if (!cvRaw && (process.env.CI || process.env.CAREER_OPS_USE_CI_FIXTURE === '1')) {
        cvRaw = readFileAt('examples/ci-resume-fixture/cv.md');
      }
      if (cvRaw) {
        const parsed = parseCvMarkdown(cvRaw);
        if (stillNoName || stillNoExp || stillNoEdu || maybeIncompleteExp) {
          next = mergeProfile(next, parsed);
          if (!sources.includes('cv.md') && !sources.includes('examples/ci-resume-fixture/cv.md')) {
            sources.push(process.env.CI || process.env.CAREER_OPS_USE_CI_FIXTURE === '1' ? 'examples/ci-resume-fixture/cv.md' : 'cv.md');
          }
        }
      }
    }
  }

  if (Array.isArray(next.education) && next.education.length > 0) {
    next.education = normalizeEducationList(next.education);
  }

  const expCountAfter = Array.isArray(next.experience) ? next.experience.length : 0;
  const hydrated =
    (!hadExp && expCountAfter > 0)
    || (!hadEdu && Array.isArray(next.education) && next.education.length > 0)
    || (!hadName && Boolean(String(next.candidate?.full_name || '').trim()))
    || (expCountAfter > expCountBefore);
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
