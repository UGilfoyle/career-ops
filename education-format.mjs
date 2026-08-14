/**
 * education-format.mjs — Normalize education rows (zero deps; safe for Next.js API routes).
 */

function extractEducationYears(text) {
  const years = [...String(text || '').matchAll(/\b(19|20)\d{2}\b/g)].map((m) => parseInt(m[0], 10));
  const unique = [...new Set(years)].sort((a, b) => a - b);
  if (unique.length === 0) return '';
  if (unique.length === 1) return String(unique[0]);
  return `${unique[0]} - ${unique[unique.length - 1]}`;
}

function stripEducationDateNoise(text) {
  let s = String(text || '');
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
  const period = extractEducationYears(combined);

  if (degree.includes(',')) {
    const idx = degree.indexOf(',');
    const degreePart = stripEducationDateNoise(degree.slice(0, idx));
    const schoolPart = stripEducationDateNoise(degree.slice(idx + 1));
    if (schoolPart.length > 2) {
      degree = degreePart;
      if (!school || schoolPart.length >= school.length) school = schoolPart;
    }
  }

  if (school && degree.toLowerCase().includes(school.toLowerCase())) {
    degree = stripEducationDateNoise(
      degree.replace(new RegExp(`,?\\s*${school.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'), '')
    );
  }

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
