/**
 * Deterministic resume text parser (PDF/DOCX → experience/education/candidate).
 * Shared by /api/resume/import and unit tests.
 */

export type ParsedExperience = {
  role: string;
  company: string;
  period: string;
  bullets: string[];
};

export type ParsedEducation = {
  degree: string;
  school: string;
  period: string;
};

export type ParsedCandidate = {
  full_name?: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  github?: string;
};

export type ParsedResume = {
  experience: ParsedExperience[];
  education: ParsedEducation[];
  candidate: ParsedCandidate;
  raw_text_preview: string;
};

const ROLE_KEYWORDS =
  /\b(?:Software|Engineer|Developer|Manager|Architect|Lead|Senior|Junior|Principal|Staff|Director|Head|VP|Analyst|Consultant|Specialist|Administrator|Intern|Trainee|Full-Stack|Full Stack|Back-End|Back End|Front-End|Front End|DevOps|Data|Machine Learning|Product|Project|QA|Test|Security|Cloud|Infrastructure|Support|Technician|Designer|Writer|Editor|Marketing|Sales|Business|Operations|Finance|HR|Recruiter|Coordinator|Assistant|Associate|Representative|Supervisor|Executive|Officer|Partner|Founder|Owner|Freelance)\b/i;

const MONTH_DATE =
  /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}\s*[-–—]\s*(?:Present|Current|Now|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|\d{4}))/i;

const YEAR_RANGE = /\b((?:19|20)\d{2})\s*[-–—]\s*((?:19|20)\d{2}|Present|Current|Now)\b/i;

const YEAR_TOKEN = /\b(20\d{2}|19\d{2})\b/;

const BULLET_STARTERS =
  /^(architected|spearhead|design|enforce|engineered|optimized|automated|developed|analyzed|configured|fortified|built|integrated|constructed|authored|formulated|provisioned|leading|owned|cut|reduced|improved)/i;

const SECTION_HEADING = /^\s*[A-Z][A-Z &/]{2,}\s*$/;

export function normalizeText(input: string) {
  return (input || '')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function extractSection(text: string, heading: RegExp) {
  const m = text.match(heading);
  if (!m || m.index === undefined) return null;
  const start = m.index + m[0].length;
  const rest = text.slice(start);
  // Stop at next ALL-CAPS section heading or markdown H1/H2 section — not ### job titles
  const nextHeading = rest.search(/^\s*[A-Z][A-Z &/]{2,}\s*$/m);
  const nextMdSection = rest.search(/^\s{0,3}#{1,2}\s+[A-Z]/m);
  let end = text.length;
  if (nextHeading >= 0) end = Math.min(end, start + nextHeading);
  if (nextMdSection >= 0) end = Math.min(end, start + nextMdSection);
  return text.slice(start, end).trim();
}

function extractPeriod(line: string): { period: string; rest: string } | null {
  const month = line.match(MONTH_DATE);
  if (month && month.index !== undefined) {
    return {
      period: month[0].trim(),
      rest: `${line.slice(0, month.index)}${line.slice(month.index + month[0].length)}`.trim(),
    };
  }
  const years = line.match(YEAR_RANGE);
  if (years && years.index !== undefined) {
    return {
      period: years[0].trim(),
      rest: `${line.slice(0, years.index)}${line.slice(years.index + years[0].length)}`.trim(),
    };
  }
  return null;
}

function splitRoleCompany(headerText: string): { role: string; company: string } {
  let role = '';
  let company = '';
  const separators = [' — ', ' – ', ' - ', ' | ', '—', '–', '|'];
  for (const sep of separators) {
    const idx = headerText.indexOf(sep);
    if (idx > 0) {
      const part1 = headerText.slice(0, idx).trim();
      const part2 = headerText.slice(idx + sep.length).trim();
      const part1Roles = ROLE_KEYWORDS.test(part1) ? 1 : 0;
      const part2Roles = ROLE_KEYWORDS.test(part2) ? 1 : 0;
      if (part1Roles >= part2Roles) {
        role = part1;
        company = part2;
      } else {
        role = part2;
        company = part1;
      }
      break;
    }
  }

  if (!role && !company) {
    const atMatch = headerText.match(/(.+?)\s+at\s+(.+)/i);
    if (atMatch) {
      role = atMatch[1].trim();
      company = atMatch[2].trim();
    } else if (ROLE_KEYWORDS.test(headerText)) {
      role = headerText;
    } else {
      company = headerText;
    }
  }

  const scrub = (s: string) =>
    s
      .replace(/\*\*/g, '')
      .replace(/\b\d{4}\b/g, '')
      .replace(/[|–—-]+$/g, '')
      .replace(/^[|–—-]+/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  return { role: scrub(role), company: scrub(company) };
}

function looksLikeBullet(line: string) {
  return /^[•\-▸*]\s+/.test(line) || BULLET_STARTERS.test(line.replace(/^[•\-▸*]\s*/, ''));
}

function looksLikeRoleOnly(line: string) {
  const cleaned = line.replace(/^#{1,3}\s*/, '').replace(/\*\*/g, '').trim();
  if (cleaned.length < 3 || cleaned.length > 120) return false;
  if (extractPeriod(cleaned)) return false;
  if (looksLikeBullet(cleaned)) return false;
  if (SECTION_HEADING.test(cleaned)) return false;
  if (/@/.test(cleaned) || /https?:\/\//i.test(cleaned)) return false;
  return ROLE_KEYWORDS.test(cleaned);
}

function looksLikeCompanyDateLine(line: string) {
  const period = extractPeriod(line);
  if (!period) return false;
  if (looksLikeBullet(line)) return false;
  const { rest } = period;
  if (!rest) return true;
  // Company (+ optional separators) without requiring role keywords — critical for
  // two-line CV formats: "Software Developer" then "Rubico IT | Sep 2019 – Sep 2021"
  if (ROLE_KEYWORDS.test(rest) && /[|–—-]/.test(line)) return true;
  if (!ROLE_KEYWORDS.test(rest) && rest.length >= 2 && rest.length < 100) return true;
  return false;
}

function looksLikeJobHeader(line: string) {
  if (!line || line.length < 3) return false;
  if (SECTION_HEADING.test(line)) return false;
  if (looksLikeBullet(line)) return false;

  const period = extractPeriod(line);
  if (period) {
    const { rest } = period;
    if (!rest) return false;
    // Single-line: Role — Company | dates  OR  Company | dates
    return true;
  }

  // Role line with year+keyword (e.g. "Senior Engineer 2020")
  if (YEAR_TOKEN.test(line) && line.length < 150 && ROLE_KEYWORDS.test(line)) {
    return true;
  }

  return looksLikeRoleOnly(line);
}

function isJobBoundary(line: string, nextLine?: string) {
  if (SECTION_HEADING.test(line)) return true;
  if (looksLikeCompanyDateLine(line)) return true;
  if (looksLikeRoleOnly(line) && nextLine && looksLikeCompanyDateLine(nextLine)) return true;
  if (extractPeriod(line) && ROLE_KEYWORDS.test(line)) return true;
  return false;
}

export function parseExperience(text: string): ParsedExperience[] {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const jobs: ParsedExperience[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const next = lines[i + 1];

    if (!looksLikeJobHeader(line) && !(looksLikeRoleOnly(line) && next && looksLikeCompanyDateLine(next))) {
      i += 1;
      continue;
    }

    let role = '';
    let company = '';
    let period = '';

    // Two-line header: Role \n Company | dates
    if (looksLikeRoleOnly(line) && next && looksLikeCompanyDateLine(next)) {
      role = line.replace(/^#{1,3}\s*/, '').replace(/\*\*/g, '').trim();
      const periodInfo = extractPeriod(next)!;
      period = periodInfo.period;
      const companyLine = (periodInfo.rest || next).replace(/\*\*/g, '').trim();
      // Second line is company (+ optional junk). Don't run role/company splitter that
      // mistakes "Software" inside a company name (e.g. Glidewell Software Services).
      const sepSplit = companyLine.split(/\s*[|–—]\s*/).map((s) => s.trim()).filter(Boolean);
      company = (sepSplit[0] || companyLine)
        .replace(/[|–—-]+$/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      i += 2;
    } else {
      const periodInfo = extractPeriod(line);
      let headerText = line;
      if (periodInfo) {
        period = periodInfo.period;
        headerText = periodInfo.rest;
      }
      const split = splitRoleCompany(headerText);
      role = split.role;
      company = split.company;

      // If this line was company+date only, peek previous was already consumed;
      // try next line only when role is empty and next is role-like without date.
      if (!role && company && next && looksLikeRoleOnly(next) && !extractPeriod(next)) {
        // Unusual order: company/date then role — swap by peeking is wrong here.
        // Keep company; leave role empty unless next is clearly the role for THIS job
        // (safer to leave as-is than steal next job's role).
      }

      if (BULLET_STARTERS.test(role) && !company) {
        i += 1;
        continue;
      }
      i += 1;
    }

    const bullets: string[] = [];
    while (i < lines.length) {
      const cur = lines[i];
      const nxt = lines[i + 1];
      if (isJobBoundary(cur, nxt)) break;
      if (SECTION_HEADING.test(cur)) break;

      const cleanBullet = cur.replace(/^[•\-▸*]\s*/, '').replace(/\*\*/g, '').trim();
      if (cleanBullet.length > 15) {
        bullets.push(cleanBullet);
      }
      i += 1;
    }

    if ((role || company) && bullets.length > 0) {
      jobs.push({ role, company, period: period || '', bullets });
    }
  }

  return jobs;
}

export function parseEducation(text: string): ParsedEducation[] {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const out: ParsedEducation[] = [];

  const degreePattern =
    /\b(?:Bachelor(?:'s)?|Master(?:'s)?|Doctor(?:ate)?|Diploma|Certificate|Ph\.?D\.?|M\.?B\.?A\.?|M\.?C\.?A\.?|B\.?C\.?A\.?|B\.?Sc\.?|M\.?Sc\.?|B\.?Tech\.?|M\.?Tech\.?|B\.?E\.?\b|M\.?E\.?\b)\b/i;
  const yearPattern = /(20\d{2}|19\d{2})/g;

  for (const line of lines) {
    const hasDegree = degreePattern.test(line);
    const years = line.match(yearPattern);

    if (hasDegree && years) {
      const uniqueYears = [...new Set(years.map((y) => parseInt(y, 10)))].sort((a, b) => a - b);
      const period =
        uniqueYears.length === 1
          ? String(uniqueYears[0])
          : `${uniqueYears[0]} – ${uniqueYears[uniqueYears.length - 1]}`;

      const cleanLine = line
        .replace(/\*\*/g, '')
        .replace(/\s*\([^)]*\d{4}[^)]*\)/g, '')
        .replace(/\s*\b(19|20)\d{2}\s*[—–-]\s*(19|20)\d{2}\b/g, '')
        .replace(/\s+\b(19|20)\d{2}\b/g, ' ')
        .trim();

      const parts = cleanLine.split(/\s*[-–—|]\s*/);
      out.push({
        degree: (parts[0] || '').trim(),
        school: (parts[1] || '').trim(),
        period,
      });
    }

    if (out.length >= 6) break;
  }

  return out;
}

export function parseCandidate(text: string): ParsedCandidate {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 12);

  const candidate: ParsedCandidate = {};
  const emailMatch = text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);
  if (emailMatch) candidate.email = emailMatch[0];

  const phoneMatch = text.match(
    /(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{2,5}\)?[\s-]?)?\d{3,5}[\s-]?\d{3,5}(?:[\s-]?\d{3,5})?/
  );
  if (phoneMatch) {
    const phone = phoneMatch[0].trim();
    // Avoid matching bare years / zip-like noise
    if ((phone.match(/\d/g) || []).length >= 10) candidate.phone = phone;
  }

  const linkedinMatch = text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[A-Za-z0-9_-]+\/?/i);
  if (linkedinMatch) candidate.linkedin = linkedinMatch[0].replace(/^https?:\/\//i, '');

  const githubMatch = text.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/[A-Za-z0-9_-]+\/?/i);
  if (githubMatch) candidate.github = githubMatch[0].replace(/^https?:\/\//i, '');

  // Name: first non-section, non-contact line near the top
  for (const line of lines) {
    if (SECTION_HEADING.test(line)) continue;
    if (/^(professional summary|summary|experience|education|skills)/i.test(line)) break;
    if (/@/.test(line) || /linkedin\.com|github\.com/i.test(line)) continue;
    if (extractPeriod(line)) continue;
    if (looksLikeBullet(line)) continue;
    if (ROLE_KEYWORDS.test(line) && line.length > 40) continue;

    const cleaned = line
      .replace(/\*\*/g, '')
      .replace(/^#+\s*/, '')
      .replace(/\s*[|•].*$/, '')
      .trim();

    // Prefer 2–4 capitalized tokens (typical person name)
    if (/^[A-Z][a-zA-Z'’.-]*(?:\s+[A-Z][a-zA-Z'’.-]*){1,3}$/.test(cleaned) && cleaned.length <= 60) {
      candidate.full_name = cleaned;
      break;
    }
  }

  // Location: line with city/country cues near header
  for (const line of lines.slice(0, 6)) {
    if (/@|linkedin|github/i.test(line)) continue;
    const loc = line.match(
      /\b([A-Z][a-zA-Z.]+(?:\s+[A-Z][a-zA-Z.]+)*,\s*(?:India|USA|UK|UAE|Canada|Germany|Remote|[A-Z]{2}))\b/
    );
    if (loc) {
      candidate.location = loc[1];
      break;
    }
  }

  return candidate;
}

export function parseResumeText(raw: string): ParsedResume {
  const text = normalizeText(raw);

  const expSection =
    extractSection(text, /^\s*(?:#{1,3}\s*)?(PROFESSIONAL EXPERIENCE|EXPERIENCE|WORK EXPERIENCE|CAREER HISTORY)\s*$/im) ||
    extractSection(text, /^\s*(?:#{1,3}\s*)?(EMPLOYMENT|WORK HISTORY)\s*$/im) ||
    '';
  const eduSection =
    extractSection(text, /^\s*(?:#{1,3}\s*)?(EDUCATION|ACADEMIC|QUALIFICATIONS)\s*$/im) || '';

  // Prefer section slices; fall back to full text only when a section heading is missing.
  const experience = expSection ? parseExperience(expSection) : [];
  const education = eduSection ? parseEducation(eduSection) : [];
  const experienceFinal = experience.length > 0 ? experience : parseExperience(text);
  const educationFinal = education.length > 0 ? education : parseEducation(
    // Avoid scanning the whole resume for degrees — too many false positives (e.g. "ba" in Global).
    extractSection(text, /^\s*(?:#{1,3}\s*)?(EDUCATION|ACADEMIC|QUALIFICATIONS)\s*$/im) || ''
  );
  const candidate = parseCandidate(text);

  return {
    experience: experienceFinal,
    education: educationFinal,
    candidate,
    raw_text_preview: text.slice(0, 2500),
  };
}
