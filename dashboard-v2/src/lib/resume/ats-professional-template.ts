/**
 * ATS-safe resume templates for Studio + tailor.
 * Same placeholders; CSS variants only. Single-column for ATS parseability.
 */

const BODY = `
    <div class="container">
        <header>
            <h1>{{NAME}}</h1>
            <div class="contact">{{CONTACT_LINE}}</div>
            <div class="contact">{{LINKS_LINE}}</div>
            <div class="top-rule"></div>
        </header>
        <section>
            <h2>Professional Summary</h2>
            <div class="rule"></div>
            <p class="summary-block">{{SUMMARY_TEXT}}</p>
        </section>
        <section style="display: {{SKILLS_DISPLAY}};">
            <h2>Technical Skills</h2>
            <div class="rule"></div>
            <div class="skills-lines">{{SKILLS_LINES}}</div>
        </section>
        <section style="display: {{EXPERIENCE_DISPLAY}};">
            <h2>Professional Experience</h2>
            <div class="rule"></div>
            {{EXPERIENCE}}
        </section>
        <section style="display: {{ACHIEVEMENTS_DISPLAY}};">
            <h2>Selected Achievements</h2>
            <div class="rule"></div>
            <div class="edu">{{ACHIEVEMENTS}}</div>
        </section>
        <section style="display: {{EDUCATION_DISPLAY}};">
            <h2>Education</h2>
            <div class="rule"></div>
            <div class="edu">{{EDUCATION}}</div>
        </section>
    </div>
`;

function wrap(css: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{NAME}} - Resume</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @page { size: A4; margin: 0.55in; }
        html, body { background: #fff; }
        @media print {
            body { padding: 0 !important; }
            a { color: #111; text-decoration: none; }
        }
        .contact:empty { display: none; }
        .contact a { color: #111; text-decoration: none; }
        .job { page-break-inside: avoid; }
        .job-header > div:first-child { flex: 1; min-width: 0; }
        .job-dates { white-space: nowrap; flex-shrink: 0; }
        ${css}
    </style>
</head>
<body>
${BODY}
</body>
</html>`;
}

const CLASSIC_CSS = `
        body {
            font-family: Calibri, "Segoe UI", Arial, Helvetica, sans-serif;
            font-size: 10.5pt;
            line-height: 1.38;
            color: #1a1a1a;
            padding: 0.55in;
            -webkit-font-smoothing: antialiased;
        }
        .container { max-width: 100%; margin: 0 auto; }
        header { text-align: center; margin-bottom: 14px; }
        h1 {
            font-size: 20pt; font-weight: 700; letter-spacing: 1.2px;
            text-transform: uppercase; margin-bottom: 6px; line-height: 1.15;
            color: #0f172a;
        }
        .contact { font-size: 9pt; color: #334155; line-height: 1.45; margin-bottom: 2px; }
        .top-rule { margin-top: 10px; border-top: 2.5px solid #1e3a5f; }
        section { margin-top: 13px; }
        h2 {
            font-size: 10pt; font-weight: 700; letter-spacing: 1.1px;
            text-transform: uppercase; margin-bottom: 4px; color: #1e3a5f;
        }
        .rule { border-top: 1px solid #94a3b8; margin-bottom: 7px; }
        .skills-lines { font-size: 9.5pt; line-height: 1.42; color: #1e293b; }
        .skill-line { margin-bottom: 3px; }
        .skill-label { font-weight: 700; color: #0f172a; }
        .job { margin-bottom: 11px; }
        .job-header {
            display: flex; justify-content: space-between; align-items: baseline;
            gap: 12px; font-size: 9.5pt; margin-bottom: 3px;
        }
        .job-title { font-weight: 700; color: #0f172a; }
        .job-company { font-weight: 600; color: #334155; }
        .job-dates { font-weight: 600; color: #475569; font-size: 9pt; }
        .job ul { list-style-type: disc; margin: 3px 0 0 1.15em; padding: 0; }
        .job li { margin-bottom: 2.5px; padding-left: 2px; line-height: 1.4; color: #1e293b; }
        .summary-block { font-size: 9.5pt; line-height: 1.48; color: #1e293b; white-space: pre-line; }
        .edu { font-size: 9.5pt; line-height: 1.4; color: #1e293b; }
        .edu > div { margin-bottom: 4px; }
`;

const MODERN_COMPACT_CSS = `
        body {
            font-family: Calibri, "Segoe UI", Arial, Helvetica, sans-serif;
            font-size: 9.5pt;
            line-height: 1.32;
            color: #1a1a1a;
            padding: 0.45in;
            -webkit-font-smoothing: antialiased;
        }
        .container { max-width: 100%; margin: 0 auto; }
        header { text-align: left; margin-bottom: 11px; }
        h1 {
            font-size: 16.5pt; font-weight: 700; letter-spacing: 0.3px;
            text-transform: none; margin-bottom: 4px; line-height: 1.2;
            color: #0f172a;
        }
        .contact { font-size: 8.5pt; color: #475569; line-height: 1.4; margin-bottom: 2px; }
        .top-rule { margin-top: 8px; border-top: 2px solid #1e3a5f; }
        section { margin-top: 10px; }
        h2 {
            font-size: 9pt; font-weight: 700; letter-spacing: 0.7px;
            text-transform: uppercase; margin-bottom: 3px; color: #1e3a5f;
        }
        .rule { border-top: 1px solid #cbd5e1; margin-bottom: 5px; }
        .skills-lines { font-size: 8.5pt; line-height: 1.38; }
        .skill-line { margin-bottom: 2px; }
        .skill-label { font-weight: 700; color: #0f172a; }
        .job { margin-bottom: 8px; }
        .job-header {
            display: flex; justify-content: space-between; align-items: baseline;
            gap: 10px; font-size: 9pt; margin-bottom: 2px;
        }
        .job-title { font-weight: 700; color: #0f172a; }
        .job-company { font-weight: 600; color: #334155; }
        .job-dates { font-weight: 600; color: #64748b; font-size: 8.5pt; }
        .job ul { list-style-type: disc; margin: 2px 0 0 1em; padding: 0; }
        .job li { margin-bottom: 2px; line-height: 1.34; }
        .summary-block { font-size: 9pt; line-height: 1.4; color: #1e293b; white-space: pre-line; }
        .edu { font-size: 9pt; line-height: 1.35; }
        .edu > div { margin-bottom: 2px; }
`;

const TECHNICAL_CSS = `
        body {
            font-family: Arial, Helvetica, sans-serif;
            font-size: 10pt;
            line-height: 1.33;
            color: #111;
            padding: 0.5in;
            -webkit-font-smoothing: antialiased;
        }
        .container { max-width: 100%; margin: 0 auto; }
        header { text-align: left; margin-bottom: 14px; border-left: 3px solid #111; padding-left: 10px; }
        h1 {
            font-size: 17pt; font-weight: 800; letter-spacing: 0.4px;
            text-transform: uppercase; margin-bottom: 6px; line-height: 1.15;
            font-family: "Courier New", Courier, monospace;
        }
        .contact { font-size: 8.5pt; color: #222; line-height: 1.4; margin-bottom: 2px;
            font-family: "Courier New", Courier, monospace; }
        .top-rule { margin-top: 10px; border-top: 2px solid #111; }
        section { margin-top: 12px; }
        h2 {
            font-size: 9pt; font-weight: 800; letter-spacing: 1.2px;
            text-transform: uppercase; margin-bottom: 4px;
            font-family: "Courier New", Courier, monospace;
        }
        .rule { border-top: 1px solid #111; margin-bottom: 7px; }
        .skills-lines { font-size: 9pt; line-height: 1.4;
            font-family: "Courier New", Courier, monospace; }
        .skill-line { margin-bottom: 3px; }
        .skill-label { font-weight: 800; }
        .job { margin-bottom: 10px; }
        .job-header {
            display: flex; justify-content: space-between; align-items: baseline;
            gap: 12px; font-size: 9.5pt; margin-bottom: 3px;
        }
        .job-title { font-weight: 800; }
        .job-company { font-weight: 600; }
        .job-dates { font-weight: 700; font-family: "Courier New", Courier, monospace; font-size: 8.5pt; }
        .job ul { list-style-type: square; margin: 3px 0 0 1.1em; padding: 0; }
        .job li { margin-bottom: 3px; line-height: 1.36; }
        .summary-block { font-size: 9.5pt; line-height: 1.42; color: #222; white-space: pre-line; }
        .edu { font-size: 9.5pt; line-height: 1.35; }
        .edu > div { margin-bottom: 3px; }
`;

const MINIMAL_CSS = `
        body {
            font-family: Arial, Helvetica, sans-serif;
            font-size: 10.5pt;
            line-height: 1.42;
            color: #111;
            padding: 0.7in;
            -webkit-font-smoothing: antialiased;
        }
        .container { max-width: 100%; margin: 0 auto; }
        header { text-align: center; margin-bottom: 22px; }
        h1 {
            font-size: 20pt; font-weight: 700; letter-spacing: 1.5px;
            text-transform: uppercase; margin-bottom: 10px; line-height: 1.2;
        }
        .contact { font-size: 9pt; color: #444; line-height: 1.5; margin-bottom: 4px; }
        .top-rule { margin-top: 14px; border-top: 1px solid #ccc; }
        section { margin-top: 18px; }
        h2 {
            font-size: 9.5pt; font-weight: 700; letter-spacing: 1.4px;
            text-transform: uppercase; margin-bottom: 6px; color: #333;
        }
        .rule { border-top: 1px solid #ddd; margin-bottom: 10px; }
        .skills-lines { font-size: 9.5pt; line-height: 1.5; }
        .skill-line { margin-bottom: 5px; }
        .skill-label { font-weight: 700; }
        .job { margin-bottom: 16px; }
        .job-header {
            display: flex; justify-content: space-between; align-items: baseline;
            gap: 14px; font-size: 10pt; margin-bottom: 6px;
        }
        .job-title { font-weight: 700; }
        .job-company { font-weight: 500; }
        .job-dates { font-weight: 500; color: #555; }
        .job ul { list-style-type: disc; margin: 6px 0 0 1.2em; padding: 0; }
        .job li { margin-bottom: 5px; line-height: 1.45; }
        .summary-block { font-size: 10pt; line-height: 1.5; color: #222; white-space: pre-line; }
        .edu { font-size: 10pt; line-height: 1.45; }
        .edu > div { margin-bottom: 6px; }
`;

/** resume.io Prime ATS–inspired: streamlined, navy accent, strong readability */
const PRIME_CSS = `
        body {
            font-family: Calibri, "Segoe UI", Arial, Helvetica, sans-serif;
            font-size: 10.5pt;
            line-height: 1.4;
            color: #1a1a1a;
            padding: 0.6in;
            -webkit-font-smoothing: antialiased;
        }
        .container { max-width: 100%; margin: 0 auto; }
        header { text-align: left; margin-bottom: 16px; }
        h1 {
            font-size: 22pt; font-weight: 700; letter-spacing: 0.5px;
            text-transform: none; margin-bottom: 6px; line-height: 1.15;
            color: #0f172a;
        }
        .contact { font-size: 9.5pt; color: #475569; line-height: 1.5; margin-bottom: 2px; }
        .top-rule { margin-top: 12px; border-top: 3px solid #1e40af; }
        section { margin-top: 15px; }
        h2 {
            font-size: 10.5pt; font-weight: 700; letter-spacing: 0.8px;
            text-transform: uppercase; margin-bottom: 5px; color: #1e40af;
        }
        .rule { border-top: 1.5px solid #93c5fd; margin-bottom: 8px; }
        .skills-lines { font-size: 10pt; line-height: 1.45; color: #1e293b; }
        .skill-line { margin-bottom: 4px; }
        .skill-label { font-weight: 700; color: #0f172a; }
        .job { margin-bottom: 14px; }
        .job-header {
            display: flex; justify-content: space-between; align-items: baseline;
            gap: 12px; font-size: 10.5pt; margin-bottom: 4px;
        }
        .job-title { font-weight: 700; color: #0f172a; }
        .job-company { font-weight: 600; color: #1e40af; }
        .job-dates { font-weight: 600; color: #64748b; font-size: 9.5pt; }
        .job ul { list-style-type: disc; margin: 4px 0 0 1.15em; padding: 0; }
        .job li { margin-bottom: 4px; line-height: 1.42; color: #1e293b; }
        .summary-block { font-size: 10.5pt; line-height: 1.5; color: #1e293b; white-space: pre-line; }
        .edu { font-size: 10pt; line-height: 1.45; color: #1e293b; }
        .edu > div { margin-bottom: 5px; }
`;

/** resume.io Precision ATS–inspired: skills band highlighted for keyword scan */
const PRECISION_CSS = `
        body {
            font-family: Calibri, "Segoe UI", Arial, Helvetica, sans-serif;
            font-size: 10.5pt;
            line-height: 1.38;
            color: #1a1a1a;
            padding: 0.55in;
            -webkit-font-smoothing: antialiased;
        }
        .container { max-width: 100%; margin: 0 auto; }
        header { text-align: center; margin-bottom: 14px; }
        h1 {
            font-size: 20pt; font-weight: 700; letter-spacing: 1px;
            text-transform: uppercase; margin-bottom: 6px; line-height: 1.15;
            color: #0f172a;
        }
        .contact { font-size: 9pt; color: #475569; line-height: 1.45; margin-bottom: 2px; }
        .top-rule { margin-top: 10px; border-top: 2px solid #0f766e; }
        section { margin-top: 14px; }
        h2 {
            font-size: 10pt; font-weight: 700; letter-spacing: 1px;
            text-transform: uppercase; margin-bottom: 4px; color: #0f766e;
        }
        .rule { border-top: 1px solid #99f6e4; margin-bottom: 7px; }
        .skills-lines {
            font-size: 10pt; line-height: 1.48; color: #134e4a;
            background: #f0fdfa; border: 1px solid #99f6e4;
            border-radius: 4px; padding: 10px 12px;
        }
        .skill-line { margin-bottom: 4px; }
        .skill-label { font-weight: 700; color: #0f766e; }
        .job { margin-bottom: 12px; }
        .job-header {
            display: flex; justify-content: space-between; align-items: baseline;
            gap: 12px; font-size: 10pt; margin-bottom: 3px;
        }
        .job-title { font-weight: 700; color: #0f172a; }
        .job-company { font-weight: 600; color: #334155; }
        .job-dates { font-weight: 600; color: #64748b; font-size: 9pt; }
        .job ul { list-style-type: disc; margin: 3px 0 0 1.15em; padding: 0; }
        .job li { margin-bottom: 3.5px; line-height: 1.4; }
        .summary-block { font-size: 10pt; line-height: 1.48; color: #1e293b; white-space: pre-line; }
        .edu { font-size: 10pt; line-height: 1.4; }
        .edu > div { margin-bottom: 4px; }
`;

/** resume.io Header ATS–inspired: bold name band, achievements-friendly */
const HEADER_ATS_CSS = `
        body {
            font-family: Calibri, "Segoe UI", Arial, Helvetica, sans-serif;
            font-size: 10.5pt;
            line-height: 1.4;
            color: #1a1a1a;
            padding: 0.5in;
            -webkit-font-smoothing: antialiased;
        }
        .container { max-width: 100%; margin: 0 auto; }
        header {
            text-align: left; margin-bottom: 16px;
            background: #0f172a; color: #fff; padding: 16px 18px; border-radius: 2px;
        }
        h1 {
            font-size: 21pt; font-weight: 700; letter-spacing: 0.8px;
            text-transform: uppercase; margin-bottom: 6px; line-height: 1.15;
            color: #fff;
        }
        .contact { font-size: 9pt; color: #cbd5e1; line-height: 1.45; margin-bottom: 2px; }
        .contact a { color: #e2e8f0 !important; }
        .top-rule { display: none; }
        section { margin-top: 14px; }
        h2 {
            font-size: 10pt; font-weight: 700; letter-spacing: 1.1px;
            text-transform: uppercase; margin-bottom: 4px; color: #0f172a;
            border-bottom: 2px solid #0f172a; padding-bottom: 3px;
        }
        .rule { display: none; }
        .skills-lines { font-size: 10pt; line-height: 1.45; }
        .skill-line { margin-bottom: 3px; }
        .skill-label { font-weight: 700; }
        .job { margin-bottom: 13px; }
        .job-header {
            display: flex; justify-content: space-between; align-items: baseline;
            gap: 12px; font-size: 10.5pt; margin-bottom: 4px;
        }
        .job-title { font-weight: 700; }
        .job-company { font-weight: 600; color: #334155; }
        .job-dates { font-weight: 600; color: #64748b; font-size: 9.5pt; }
        .job ul { list-style-type: disc; margin: 4px 0 0 1.15em; padding: 0; }
        .job li { margin-bottom: 4px; line-height: 1.42; }
        .summary-block { font-size: 10.5pt; line-height: 1.5; white-space: pre-line; }
        .edu { font-size: 10pt; line-height: 1.42; }
        .edu > div { margin-bottom: 5px; }
`;

/** resume.io Traditional–inspired: sizable sections for robust career history (7+ yrs) */
const TRADITIONAL_CSS = `
        body {
            font-family: Georgia, "Times New Roman", Times, serif;
            font-size: 11pt;
            line-height: 1.45;
            color: #1a1a1a;
            padding: 0.65in;
            -webkit-font-smoothing: antialiased;
        }
        .container { max-width: 100%; margin: 0 auto; }
        header { text-align: center; margin-bottom: 20px; }
        h1 {
            font-size: 22pt; font-weight: 700; letter-spacing: 1.5px;
            text-transform: uppercase; margin-bottom: 8px; line-height: 1.2;
            font-family: Calibri, "Segoe UI", Arial, Helvetica, sans-serif;
        }
        .contact {
            font-size: 9.5pt; color: #444; line-height: 1.5; margin-bottom: 3px;
            font-family: Calibri, "Segoe UI", Arial, Helvetica, sans-serif;
        }
        .top-rule { margin-top: 12px; border-top: 2px solid #111; }
        section { margin-top: 18px; }
        h2 {
            font-size: 11pt; font-weight: 700; letter-spacing: 1.2px;
            text-transform: uppercase; margin-bottom: 6px;
            font-family: Calibri, "Segoe UI", Arial, Helvetica, sans-serif;
        }
        .rule { border-top: 1px solid #999; margin-bottom: 10px; }
        .skills-lines {
            font-size: 10.5pt; line-height: 1.5;
            font-family: Calibri, "Segoe UI", Arial, Helvetica, sans-serif;
        }
        .skill-line { margin-bottom: 5px; }
        .skill-label { font-weight: 700; }
        .job { margin-bottom: 16px; }
        .job-header {
            display: flex; justify-content: space-between; align-items: baseline;
            gap: 14px; font-size: 11pt; margin-bottom: 6px;
            font-family: Calibri, "Segoe UI", Arial, Helvetica, sans-serif;
        }
        .job-title { font-weight: 700; }
        .job-company { font-weight: 600; }
        .job-dates { font-weight: 600; color: #555; font-size: 10pt; }
        .job ul { list-style-type: disc; margin: 5px 0 0 1.2em; padding: 0; }
        .job li { margin-bottom: 5px; line-height: 1.48; }
        .summary-block { font-size: 11pt; line-height: 1.52; white-space: pre-line; }
        .edu {
            font-size: 10.5pt; line-height: 1.45;
            font-family: Calibri, "Segoe UI", Arial, Helvetica, sans-serif;
        }
        .edu > div { margin-bottom: 6px; }
`;

export type TemplateMeta = {
  id: string;
  name: string;
  badge?: string;
  description: string;
  file: string;
};

export const TEMPLATE_CATALOG: TemplateMeta[] = [
  {
    id: 'ats-professional',
    name: 'ATS Classic',
    badge: 'Recommended',
    description: 'Single-column with strong rules — safest for Greenhouse, Workday, Ashby.',
    file: 'templates/ats-template-professional.html',
  },
  {
    id: 'ats-prime',
    name: 'Prime ATS',
    badge: 'resume.io style',
    description: 'Streamlined navy accent layout — optimized for ATS parse + recruiter skim.',
    file: 'templates/ats-template-prime.html',
  },
  {
    id: 'ats-traditional',
    name: 'Traditional',
    badge: '7+ years',
    description: 'Sizable sections and serif body — fills 2 pages for senior career history.',
    file: 'templates/ats-template-traditional.html',
  },
  {
    id: 'ats-precision',
    name: 'Precision ATS',
    description: 'Highlighted skills band for keyword density — clean single-column body.',
    file: 'templates/ats-template-precision.html',
  },
  {
    id: 'ats-header',
    name: 'Header ATS',
    description: 'Bold dark name band — achievements and experience stay ATS-readable.',
    file: 'templates/ats-template-header.html',
  },
  {
    id: 'ats-modern-compact',
    name: 'Modern Compact',
    description: 'Tighter spacing — more content per page (better for mid-level, not 7+ yrs).',
    file: 'templates/ats-template-modern-compact.html',
  },
  {
    id: 'ats-technical',
    name: 'Technical',
    description: 'Monospace accents for skills and dates — reads well for engineering roles.',
    file: 'templates/ats-template-technical.html',
  },
  {
    id: 'ats-minimal',
    name: 'Minimal',
    description: 'Extra whitespace and lighter rules — clean executive-friendly ATS layout.',
    file: 'templates/ats-template-minimal.html',
  },
];

export const ATS_PROFESSIONAL_TEMPLATE = wrap(CLASSIC_CSS);
export const ATS_MODERN_COMPACT_TEMPLATE = wrap(MODERN_COMPACT_CSS);
export const ATS_TECHNICAL_TEMPLATE = wrap(TECHNICAL_CSS);
export const ATS_MINIMAL_TEMPLATE = wrap(MINIMAL_CSS);
export const ATS_PRIME_TEMPLATE = wrap(PRIME_CSS);
export const ATS_PRECISION_TEMPLATE = wrap(PRECISION_CSS);
export const ATS_HEADER_TEMPLATE = wrap(HEADER_ATS_CSS);
export const ATS_TRADITIONAL_TEMPLATE = wrap(TRADITIONAL_CSS);

export const TEMPLATE_REGISTRY: Record<string, string> = {
  'ats-professional': ATS_PROFESSIONAL_TEMPLATE,
  'ats-modern-compact': ATS_MODERN_COMPACT_TEMPLATE,
  'ats-technical': ATS_TECHNICAL_TEMPLATE,
  'ats-minimal': ATS_MINIMAL_TEMPLATE,
  'ats-prime': ATS_PRIME_TEMPLATE,
  'ats-precision': ATS_PRECISION_TEMPLATE,
  'ats-header': ATS_HEADER_TEMPLATE,
  'ats-traditional': ATS_TRADITIONAL_TEMPLATE,
};

export const DEFAULT_TEMPLATE_ID = 'ats-professional';

export function getTemplateHtml(templateId?: string): string {
  const id = templateId || DEFAULT_TEMPLATE_ID;
  return TEMPLATE_REGISTRY[id] || ATS_PROFESSIONAL_TEMPLATE;
}

export function getTemplateMeta(templateId?: string): TemplateMeta {
  const id = templateId || DEFAULT_TEMPLATE_ID;
  return TEMPLATE_CATALOG.find((t) => t.id === id) || TEMPLATE_CATALOG[0];
}

export function resolveTemplateFile(templateId?: string): string {
  return getTemplateMeta(templateId).file;
}
