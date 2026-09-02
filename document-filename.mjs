/**
 * Application document filenames:
 *   Resume:  {CANDIDATE}_{COMPANY}_CV.pdf (e.g. AKASH_KAINTURA_TCS_CV.pdf)
 *   Cover:   {CANDIDATE}_{COMPANY}_CL.pdf (e.g. AKASH_KAINTURA_TCS_CL.pdf)
 */

import fs from "fs";
import path from "path";

export function formatCandidateName(str, maxLen = 36) {
  const joined = String(str || "AKASH_KAINTURA")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return (joined || "AKASH_KAINTURA").slice(0, maxLen);
}

export function formatCompany(str, maxLen = 32) {
  let co = String(str || "COMPANY")
    .trim()
    .toUpperCase()
    .replace(/\b(INC|LLC|LTD|LIMITED|CORP|CORPORATION|SERVICES|PVT|PRIVATE)\b/g, "")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return (co || "COMPANY").slice(0, maxLen);
}

// Legacy helper preserved for backward compatibility
export function compactNamePart(str, maxLen = 32) {
  const joined = String(str || "")
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9]/gi, ""))
    .filter(Boolean)
    .join("");
  return (joined || "Unknown").slice(0, maxLen);
}

// Legacy helper preserved for backward compatibility
export function shortenRoleTitle(title) {
  if (!title?.trim()) return "Role";
  let t = String(title)
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const replacements = [
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

export function buildApplicationDocumentBasename({ candidateName, company, roleTitle, kind = "resume" }) {
  const name = formatCandidateName(candidateName);
  const co = formatCompany(company);
  const docType = kind === "cover" ? "CL" : "CV";
  return `${name}_${co}_${docType}`;
}

export function buildApplicationDocumentPaths({
  candidateName,
  company,
  roleTitle,
  outputDir = "output",
}) {
  const resumeBasename = buildApplicationDocumentBasename({ candidateName, company, roleTitle, kind: "resume" });
  const coverBasename = buildApplicationDocumentBasename({ candidateName, company, roleTitle, kind: "cover" });
  return {
    basename: resumeBasename,
    resumeHtml: `${outputDir}/${resumeBasename}.html`,
    resumePdf: `${outputDir}/${resumeBasename}.pdf`,
    coverHtml: `${outputDir}/${coverBasename}.html`,
    coverPdf: `${outputDir}/${coverBasename}.pdf`,
  };
}

export function buildDownloadFilename({ candidateName, company, roleTitle, kind = "resume" }) {
  const base = buildApplicationDocumentBasename({ candidateName, company, roleTitle, kind });
  return `${base}.pdf`;
}

/** Locate tailored resume PDF in output/ (exact standard name first, then legacy patterns). */
export function findTailoredResumePdf(outputDir, { candidateName, company, roleTitle }) {
  if (!fs.existsSync(outputDir)) return null;

  // 1. Exact standard name (e.g. AKASH_KAINTURA_TCS_CV.pdf)
  const basename = buildApplicationDocumentBasename({ candidateName, company, roleTitle, kind: "resume" });
  const exact = path.join(outputDir, `${basename}.pdf`);
  if (fs.existsSync(exact)) return exact;

  // 2. Legacy exact format (e.g. AkashKaintura_TCS_SrSWEng.pdf)
  const legacyName = compactNamePart(candidateName, 30);
  const legacyCo = compactNamePart(company, 24);
  const legacyRole = shortenRoleTitle(roleTitle);
  const legacyExact = path.join(outputDir, `${legacyName}_${legacyCo}_${legacyRole}.pdf`);
  if (fs.existsSync(legacyExact)) return legacyExact;

  // 3. Fallback: match by company token
  const files = fs.readdirSync(outputDir);
  const companyKey = formatCompany(company).toLowerCase();
  const legacyCoKey = compactNamePart(company, 24).toLowerCase();
  const legacy = files.find((f) => {
    const lower = f.toLowerCase();
    if (!lower.endsWith(".pdf")) return false;
    if (lower.includes("cover") || lower.endsWith("cl.pdf")) return false;
    return lower.includes(companyKey) || lower.includes(legacyCoKey);
  });
  return legacy ? path.join(outputDir, legacy) : null;
}
