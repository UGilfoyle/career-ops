/**
 * Application document filenames (mirror of ../../document-filename.mjs):
 *   Resume:  {name}_{company}_{role}.pdf
 *   Cover:   {name}_{company}_{role}_cover.pdf
 */

export function compactNamePart(str: string, maxLen = 32): string {
  const joined = String(str || '')
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9]/gi, ''))
    .filter(Boolean)
    .join('');
  return (joined || 'Unknown').slice(0, maxLen);
}

export function shortenRoleTitle(title?: string | null): string {
  if (!title?.trim()) return 'Role';
  let t = String(title)
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const replacements: [RegExp, string][] = [
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

export function buildApplicationDocumentBasename({
  candidateName,
  company,
  roleTitle,
}: {
  candidateName?: string | null;
  company?: string | null;
  roleTitle?: string | null;
}): string {
  const name = compactNamePart(candidateName || '', 30);
  const co = compactNamePart(company || '', 24);
  const role = shortenRoleTitle(roleTitle);
  return `${name}_${co}_${role}`;
}

export function buildDownloadFilename({
  candidateName,
  company,
  roleTitle,
  kind = 'resume',
}: {
  candidateName?: string | null;
  company?: string | null;
  roleTitle?: string | null;
  kind?: 'resume' | 'cover';
}): string {
  const base = buildApplicationDocumentBasename({ candidateName, company, roleTitle });
  if (kind === 'cover') return `${base}_cover.pdf`;
  return `${base}.pdf`;
}
