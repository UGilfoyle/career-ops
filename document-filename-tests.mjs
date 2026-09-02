import assert from "node:assert/strict";
import {
  buildApplicationDocumentBasename,
  buildApplicationDocumentPaths,
  buildDownloadFilename,
  formatCandidateName,
  formatCompany,
  shortenRoleTitle,
} from "./document-filename.mjs";

const name = "Akash Kaintura";
const company = "Stripe";

assert.equal(shortenRoleTitle("Senior Backend Engineer"), "SrBEEng");
assert.equal(shortenRoleTitle("Staff Engineer"), "StaffEng");
assert.equal(shortenRoleTitle("Senior Software Engineer"), "SrSWEng");

assert.equal(formatCandidateName("Akash Kaintura"), "AKASH_KAINTURA");
assert.equal(formatCompany("Stripe Inc."), "STRIPE");
assert.equal(formatCompany("TCS Ltd"), "TCS");

const base = buildApplicationDocumentBasename({
  candidateName: name,
  company,
  roleTitle: "Senior Backend Engineer",
});
assert.equal(base, "AKASH_KAINTURA_STRIPE_CV");

const paths = buildApplicationDocumentPaths({
  candidateName: name,
  company,
  roleTitle: "Senior Backend Engineer",
});
assert.equal(paths.resumePdf, "output/AKASH_KAINTURA_STRIPE_CV.pdf");
assert.equal(paths.coverPdf, "output/AKASH_KAINTURA_STRIPE_CL.pdf");
assert.equal(paths.resumeHtml, "output/AKASH_KAINTURA_STRIPE_CV.html");
assert.equal(paths.coverHtml, "output/AKASH_KAINTURA_STRIPE_CL.html");

assert.equal(
  buildDownloadFilename({ candidateName: name, company, roleTitle: "Senior Backend Engineer", kind: "resume" }),
  "AKASH_KAINTURA_STRIPE_CV.pdf",
);
assert.equal(
  buildDownloadFilename({ candidateName: name, company, roleTitle: "Senior Backend Engineer", kind: "cover" }),
  "AKASH_KAINTURA_STRIPE_CL.pdf",
);

console.log("document-filename-tests: ok");
