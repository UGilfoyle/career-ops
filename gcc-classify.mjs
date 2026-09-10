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

const GCC_JD_PATTERNS = [
  { pattern: /\bglobal capability cent(?:er|re)s?\b/i, label: 'Global Capability Center' },
  { pattern: /\bgcc\b/i, label: 'GCC' },
  { pattern: /\bgdc\b/i, label: 'Global Development Center (GDC)' },
  { pattern: /\bglobal delivery cent(?:er|re)s?\b/i, label: 'Global Delivery Center' },
  { pattern: /\bodc\b/i, label: 'Offshore Development Center (ODC)' },
  { pattern: /\boffshore development cent(?:er|re)s?\b/i, label: 'Offshore Development Center' },
  { pattern: /\b(?:india|global) technology cent(?:er|re)s?\b/i, label: 'Technology Center' },
  { pattern: /\b(?:india|global) development cent(?:er|re)s?\b/i, label: 'Development Center' },
  { pattern: /\bcenter of excellence\b/i, label: 'Center of Excellence' },
  { pattern: /\bcentre of excellence\b/i, label: 'Centre of Excellence' },
  { pattern: /\bcaptive (?:tech(?:nology)?|engineering|center|centre|offshore)\b/i, label: 'Captive Engineering Center' },
  { pattern: /\bglobal in-?house cent(?:er|re)s?\b/i, label: 'Global In-House Center' },
  { pattern: /\bfortune (?:500|100|50)\b/i, label: 'Fortune 500 Captive' },
];

/**
 * Multi-signal classification for GCC vs IT Services vs Other.
 * Evaluates explicit override, company registry, URL domain, and JD captive signals.
 * @param {object} [params]
 * @param {string} [params.companyName]
 * @param {string} [params.jdText]
 * @param {string} [params.url]
 * @param {boolean} [params.requestedGcc]
 * @returns {{ isGcc: boolean, type: 'GCC' | 'Services' | 'Other', reason: string, company: string, signals: string[] }}
 */
export function classifyGccOpportunity(params = {}) {
  const { companyName, jdText, url, requestedGcc } = params;

  if (requestedGcc) {
    return {
      isGcc: true,
      type: 'GCC',
      reason: 'Explicit CLI flag override',
      company: companyName || 'GCC Employer',
      signals: ['cli_flag'],
    };
  }

  const { gcc, services } = loadCompanySets();
  const name = String(companyName || '').toLowerCase().trim();

  // 1. Direct company name check
  if (name) {
    if (matchesSet(name, gcc)) {
      return {
        isGcc: true,
        type: 'GCC',
        reason: `Company ${companyName} matched GCC registry`,
        company: companyName,
        signals: ['registry_match'],
      };
    }
  }

  // 2. URL Hostname check
  if (url) {
    try {
      const parsedUrl = new URL(url.startsWith('http') ? url : `https://${url}`);
      const host = parsedUrl.hostname.toLowerCase();
      for (const entry of gcc) {
        if (entry.length >= 3 && (host.includes(entry) || parsedUrl.pathname.toLowerCase().includes(entry))) {
          return {
            isGcc: true,
            type: 'GCC',
            reason: `URL hostname (${host}) matched GCC employer (${entry})`,
            company: companyName || entry,
            signals: ['domain_match'],
          };
        }
      }
    } catch {
      // ignore invalid URL
    }
  }

  // 3. JD text pattern signals
  if (jdText && typeof jdText === 'string') {
    const matchedSignals = [];
    for (const item of GCC_JD_PATTERNS) {
      if (item.pattern.test(jdText)) {
        matchedSignals.push(item.label);
      }
    }
    if (matchedSignals.length > 0) {
      if (name && matchesSet(name, services)) {
        return {
          isGcc: false,
          type: 'Services',
          reason: `Company ${companyName} identified as IT Services / Consulting`,
          company: companyName,
          signals: ['services_registry'],
        };
      }
      return {
        isGcc: true,
        type: 'GCC',
        reason: `JD contains captive GCC signals: ${matchedSignals.join(', ')}`,
        company: companyName || 'GCC Employer',
        signals: matchedSignals,
      };
    }
  }

  // 4. IT Services check
  if (name && matchesSet(name, services)) {
    return {
      isGcc: false,
      type: 'Services',
      reason: `Company ${companyName} identified as IT Services / Consulting`,
      company: companyName,
      signals: ['services_registry'],
    };
  }

  return {
    isGcc: false,
    type: 'Other',
    reason: 'No GCC or Services markers detected',
    company: companyName || '',
    signals: [],
  };
}

/**
 * Classify employer as GCC (captive), Services (IT consulting), or Other.
 * Backward compatible with single argument calls.
 * @param {string | null | undefined} companyName
 * @param {string | null | undefined} [jdText]
 * @param {string | null | undefined} [url]
 * @returns {'GCC' | 'Services' | 'Other'}
 */
export function classifyCompany(companyName, jdText, url) {
  const result = classifyGccOpportunity({ companyName, jdText, url });
  return result.type;
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
