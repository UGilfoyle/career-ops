/**
 * Application document filenames:
 *   Resume:  {name}_{company}_{role}.pdf
 *   Cover:   {name}_{company}_{role}_cover.pdf
 */

import fs from 'fs';
import path from 'path';

export function compactNamePart(str, maxLen = 32) {
  const joined = String(str || '')
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9]/gi, ''))
    .filter(Boolean)
    .join('');
  return (joined || 'Unknown').slice(0, maxLen);
}

export function shortenRoleTitle(title) {
  if (!title?.trim()) return 'Role';
  let t = String(title)
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const replacements = [
    [/\bsenior\b/gi, 'Sr'],
    [/\bstaff\b/gi, 'Staff'],
    [/\bprincipal\b/gi, 'Pr'],
    [/\bjunior\b/gi, 'Jr'],
    [/\bassociate\b/gi, 'Assoc'],
    [/\blead\b/gi, 'Lead'],
    [/\bsoftware\b/gi, 'SW'],
    [/\bbackend\b/gi, 'BE'],
    [/\bfront[\s-]?end\b/gi, 'FE'],
    [/\bfull[\s-]?stack\b/gi, 'FS'],
    [/\bengineer\b/gi, 'Eng'],
    [/\bdeveloper\b/gi, 'Dev'],
    [/\bmanager\b/gi, 'Mgr'],
    [/\barchitect\b/gi, 'Arch'],
    [/\bplatform\b/gi, 'Plat'],
    [/\binfrastructure\b/gi, 'Infra'],
    [/\bproject\b/gi, 'Proj'],
    [/\bdata\b/gi, 'Data'],
    [/\bthe\b/gi, ''],
    [/\band\b/gi, ''],
    [/\bor\b/gi, ''],
    [/\bof\b/gi, ''],
    [/\bat\b/gi, ''],
    [/\bfor\b/gi, ''],
  ];

  for (const [re, repl] of replacements) {
    t = t.replace(re, repl);
  }

  t = t.replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '');
  return t.slice(0, 28) || 'Role';
}

export function buildApplicationDocumentBasename({ candidateName, company, roleTitle }) {
  const name = compactNamePart(candidateName, 30);
  const co = compactNamePart(company, 24);
  const role = shortenRoleTitle(roleTitle);
  return `${name}_${co}_${role}`;
}

export function buildApplicationDocumentPaths({
  candidateName,
  company,
  roleTitle,
  outputDir = 'output',
}) {
  const basename = buildApplicationDocumentBasename({ candidateName, company, roleTitle });
  return {
    basename,
    resumeHtml: `${outputDir}/${basename}.html`,
    resumePdf: `${outputDir}/${basename}.pdf`,
    coverHtml: `${outputDir}/${basename}_cover.html`,
    coverPdf: `${outputDir}/${basename}_cover.pdf`,
  };
}

export function buildDownloadFilename({ candidateName, company, roleTitle, kind = 'resume' }) {
  const base = buildApplicationDocumentBasename({ candidateName, company, roleTitle });
  if (kind === 'cover') return `${base}_cover.pdf`;
  return `${base}.pdf`;
}

/** Locate tailored resume PDF in output/ (exact name first, then legacy patterns). */
export function findTailoredResumePdf(outputDir, { candidateName, company, roleTitle }) {
  if (!fs.existsSync(outputDir)) return null;

  const basename = buildApplicationDocumentBasename({ candidateName, company, roleTitle });
  const exact = path.join(outputDir, `${basename}.pdf`);
  if (fs.existsSync(exact)) return exact;

  const files = fs.readdirSync(outputDir);
  const companyKey = compactNamePart(company, 24).toLowerCase();
  const legacy = files.find((f) => {
    const lower = f.toLowerCase();
    if (!lower.endsWith('.pdf')) return false;
    if (lower.includes('cover') || lower.endsWith('cl.pdf')) return false;
    return lower.includes(companyKey) || lower.includes(String(company || '').replace(/\s+/g, '_').toLowerCase());
  });
  return legacy ? path.join(outputDir, legacy) : null;
}
