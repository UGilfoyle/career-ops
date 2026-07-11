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
