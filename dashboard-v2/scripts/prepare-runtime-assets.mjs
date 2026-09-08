import fs from 'fs';
import path from 'path';

const appRoot = process.cwd();
const repoRoot = path.join(appRoot, '..');
const runtimeRoot = path.join(appRoot, 'runtime-assets');

const copyFileIfExists = (src, dest) => {
  if (!fs.existsSync(src)) return false;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  return true;
};

const copyDirIfExists = (src, dest) => {
  if (!fs.existsSync(src)) return false;
  if (fs.existsSync(dest)) {
    try {
      fs.rmSync(dest, { recursive: true, force: true });
    } catch {}
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(src, dest, { recursive: true, dereference: true });
  return true;
};

fs.mkdirSync(runtimeRoot, { recursive: true });

copyFileIfExists(path.join(repoRoot, 'portals.yml'), path.join(runtimeRoot, 'portals.yml'));
copyDirIfExists(path.join(repoRoot, 'portals', 'scrapers'), path.join(runtimeRoot, 'portals', 'scrapers'));
copyFileIfExists(path.join(repoRoot, 'jd-keyword-align.mjs'), path.join(runtimeRoot, 'jd-keyword-align.mjs'));
copyFileIfExists(path.join(repoRoot, 'jd-profile-match.mjs'), path.join(runtimeRoot, 'jd-profile-match.mjs'));
copyFileIfExists(path.join(repoRoot, 'resume-tailoring-plan.mjs'), path.join(runtimeRoot, 'resume-tailoring-plan.mjs'));
copyFileIfExists(path.join(repoRoot, 'resume-quality.mjs'), path.join(runtimeRoot, 'resume-quality.mjs'));
copyFileIfExists(path.join(repoRoot, 'resume-skills-html.mjs'), path.join(runtimeRoot, 'resume-skills-html.mjs'));
copyFileIfExists(path.join(repoRoot, 'profile-hydrate.mjs'), path.join(runtimeRoot, 'profile-hydrate.mjs'));
copyFileIfExists(path.join(repoRoot, 'generate-pdf.mjs'), path.join(runtimeRoot, 'generate-pdf.mjs'));
copyDirIfExists(
  path.join(repoRoot, 'templates'),
  path.join(runtimeRoot, 'templates')
);
copyFileIfExists(path.join(repoRoot, 'config', 'profile.yml'), path.join(runtimeRoot, 'config', 'profile.yml'));
copyFileIfExists(path.join(repoRoot, 'cv.md'), path.join(runtimeRoot, 'cv.md'));

// Ensure node_modules/postgres is present for standalone scripts spawned via /api/exec
const postgresCandidates = [
  path.join(appRoot, 'node_modules', 'postgres'),
  path.join(repoRoot, 'node_modules', 'postgres'),
];
const foundPostgres = postgresCandidates.find((p) => fs.existsSync(p));
if (foundPostgres) {
  copyDirIfExists(foundPostgres, path.join(appRoot, 'scripts', 'node_modules', 'postgres'));
  copyDirIfExists(foundPostgres, path.join(runtimeRoot, 'node_modules', 'postgres'));
  console.log(`✓ Copied postgres package from ${foundPostgres} for standalone script execution.`);
}

console.log('Prepared runtime-assets bundle for serverless execution.');
