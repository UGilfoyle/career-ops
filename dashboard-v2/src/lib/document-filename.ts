/**
 * Application document filenames (mirror of ../../document-filename.mjs):
 *   Resume:  {CANDIDATE}_{COMPANY}_CV.pdf (e.g. AKASH_KAINTURA_TCS_CV.pdf)
 *   Cover:   {CANDIDATE}_{COMPANY}_CL.pdf (e.g. AKASH_KAINTURA_TCS_CL.pdf)
 */

export function formatCandidateName(str?: string | null, maxLen = 36): string {
  const joined = String(str || "AKASH_KAINTURA")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return (joined || "AKASH_KAINTURA").slice(0, maxLen);
}

export function formatCompany(str?: string | null, maxLen = 32): string {
  let co = String(str || "COMPANY")
    .trim()
    .toUpperCase()
    .replace(/\b(INC|LLC|LTD|LIMITED|CORP|CORPORATION|SERVICES|PVT|PRIVATE)\b/g, "")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return (co || "COMPANY").slice(0, maxLen);
}

// Legacy helper preserved for backward compatibility
export function compactNamePart(str: string, maxLen = 32): string {
  const joined = String(str || "")
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9]/gi, ""))
    .filter(Boolean)
    .join("");
  return (joined || "Unknown").slice(0, maxLen);
}

// Legacy helper preserved for backward compatibility
export function shortenRoleTitle(title?: string | null): string {
  if (!title?.trim()) return "Role";
  let t = String(title)
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const replacements: [RegExp, string][] = [
    [/\bsenior\b/gi, "Sr"],
    [/\bstaff\b/gi, "Staff"],
    [/\bprincipal\b/gi, "Pr"],
    [/\bjunior\b/gi, "Jr"],
    [/\bassociate\b/gi, "Assoc"],
    [/\blead\b/gi, "Lead"],
    [/\bsoftware\b/gi, "SW"],
    [/\bbackend\b/gi, "BE"],
    [/\bfront[\s-]?end\b/gi, "FE"],
    [/\bfull[\s-]?stack\b/gi, "FS"],
    [/\bengineer\b/gi, "Eng"],
    [/\bdeveloper\b/gi, "Dev"],
    [/\bmanager\b/gi, "Mgr"],
    [/\barchitect\b/gi, "Arch"],
    [/\bplatform\b/gi, "Plat"],
    [/\binfrastructure\b/gi, "Infra"],
    [/\bproject\b/gi, "Proj"],
    [/\bdata\b/gi, "Data"],
    [/\bthe\b/gi, ""],
    [/\band\b/gi, ""],
    [/\bor\b/gi, ""],
    [/\bof\b/gi, ""],
    [/\bat\b/gi, ""],
    [/\bfor\b/gi, ""],
  ];

  for (const [re, repl] of replacements) {
    t = t.replace(re, repl);
  }

  t = t.replace(/\s+/g, "").replace(/[^a-zA-Z0-9]/g, "");
  return t.slice(0, 28) || "Role";
}

export function buildApplicationDocumentBasename({
  candidateName,
  company,
  roleTitle,
  kind = "resume",
}: {
  candidateName?: string | null;
  company?: string | null;
  roleTitle?: string | null;
  kind?: "resume" | "cover";
}): string {
  const name = formatCandidateName(candidateName);
  const co = formatCompany(company);
  const docType = kind === "cover" ? "CL" : "CV";
  return `${name}_${co}_${docType}`;
}

export function buildDownloadFilename({
  candidateName,
  company,
  roleTitle,
  kind = "resume",
}: {
  candidateName?: string | null;
  company?: string | null;
  roleTitle?: string | null;
  kind?: "resume" | "cover";
}): string {
  const base = buildApplicationDocumentBasename({ candidateName, company, roleTitle, kind });
  return `${base}.pdf`;
}
