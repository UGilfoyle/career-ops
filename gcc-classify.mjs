import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, 'templates', 'gcc-companies.yml');

let cached = null;

function loadCompanySets() {
  if (cached) return cached;
  const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
  const doc = yaml.parse(raw) || {};
  cached = {
    gcc: new Set((doc.gcc || []).map((s) => String(s).toLowerCase().trim()).filter(Boolean)),
    services: new Set((doc.it_services || []).map((s) => String(s).toLowerCase().trim()).filter(Boolean)),
    scan: doc.gcc_scan || {},
  };
  return cached;
}

function matchesSet(name, set) {
  if (set.has(name)) return true;
  for (const entry of set) {
    if (name.includes(entry) || entry.includes(name)) return true;
  }
  return false;
}

/**
 * Classify employer as GCC (captive), Services (IT consulting), or Other.
 * @param {string | null | undefined} companyName
 * @returns {'GCC' | 'Services' | 'Other'}
 */
export function classifyCompany(companyName) {
  if (!companyName) return 'Other';
  const name = String(companyName).toLowerCase().trim();
  const { gcc, services } = loadCompanySets();
  if (matchesSet(name, gcc)) return 'GCC';
  if (matchesSet(name, services)) return 'Services';
  return 'Other';
}

export function getGccCompanyList() {
  return [...loadCompanySets().gcc];
}

export function getItServicesCompanyList() {
  return [...loadCompanySets().services];
}

/** Config for `gcc-scan` — batch size, India hubs, priority employers. */
export function getGccScanConfig() {
  const { scan } = loadCompanySets();
  return {
    batchSize: Number(scan.batch_size) > 0 ? Number(scan.batch_size) : 18,
    locations: Array.isArray(scan.locations) && scan.locations.length > 0
      ? scan.locations.map((s) => String(s).trim()).filter(Boolean)
      : ['Pune', 'Bengaluru', 'Bangalore', 'Hyderabad'],
    priority: (scan.priority || []).map((s) => String(s).toLowerCase().trim()).filter(Boolean),
  };
}

/** Employers for one gcc-scan batch (priority first, then rotating alphabetical slice). */
export function getGccScanBatch({ offset = 0, batchSize } = {}) {
  const cfg = getGccScanConfig();
  const size = batchSize ?? cfg.batchSize;
  const all = getGccCompanyList().map((s) => s.toLowerCase().trim()).filter(Boolean);
  const priority = cfg.priority.filter((p) => all.includes(p) || all.some((a) => a.includes(p) || p.includes(a)));
  const rest = all.filter((name) => !priority.some((p) => name.includes(p) || p.includes(name))).sort();
  const merged = [...new Set([...priority, ...rest])];
  const start = Math.abs(offset) % Math.max(merged.length, 1);
  const batch = [];
  for (let i = 0; i < size && i < merged.length; i++) {
    batch.push(merged[(start + i) % merged.length]);
  }
  return { batch, total: merged.length, start, batchSize: size, locations: cfg.locations };
}
