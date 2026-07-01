import fs from 'fs';
import path from 'path';

const TARGET_MAP = 'data/current_eval.json';
const index = process.argv[2];

if (!index) {
  console.error("Usage: node prepare-pdf.mjs <index>");
  process.exit(1);
}

if (!fs.existsSync(TARGET_MAP)) {
  console.error("❌ No active ranking mapping found. Run 'ofertas' first.");
  process.exit(1);
}

const mapping = JSON.parse(fs.readFileSync(TARGET_MAP, 'utf8'));
const entry = mapping[index];

if (!entry) {
  console.error(`❌ Index ${index} not found in recent 'ofertas' results.`);
  process.exit(1);
}

const company = entry.company;
const url = entry.url;

console.log('═══════════════════════════════════════════');
console.log(`  📄 Tailoring Resume for ${company}`);
console.log('═══════════════════════════════════════════');

const companyClean = company.replace(/[^a-z0-9]/gi, '_').replace(/_{2,}/g, '_').toLowerCase();
const outDir = 'output';
let tailoredFile = '';
if (fs.existsSync(outDir)) {
  const files = fs.readdirSync(outDir);
  const match = files.find(f => f.toLowerCase().includes(companyClean) && (f.includes('Resume') || f.includes('SSE') || f.includes('Tailored')) && f.endsWith('.pdf'));
  if (match) {
    tailoredFile = path.join(outDir, match);
  }
}
if (!tailoredFile) {
  tailoredFile = `output/Akash_Kaintura_${company.replace(/\s/g, '_')}_Resume.pdf`;
}

if (fs.existsSync(tailoredFile)) {
  console.log(`✅ Tailored PDF already exists: ${tailoredFile}`);
  console.log(`   You can now run "apply ${index}" safely.`);
} else {
  console.log(`⚠️  Tailored PDF NOT found: ${tailoredFile}`);
  console.log('\n  Please COPY the prompt below into the AI chat to generate it:');
  console.log('───────────────────────────────────────────');
  console.log(`"Antigravity, please tailor my resume for ${company}.`);
  console.log(`Job URL: ${url}`);
  console.log(`Use the general resume data and fit it exactly for this role."`);
  console.log('───────────────────────────────────────────');
}
console.log('═══════════════════════════════════════════');
