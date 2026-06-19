import fs from 'fs';
import path from 'path';
import sql from './db/client.mjs';

const REPORTS_DIR = './reports';
const DATA_DIR = './data';
const OUT_FILE = path.join(DATA_DIR, 'skill-gaps.json');

const rawUserId = process.env.SCAN_USER_ID || 1;
const userId = Number.parseInt(String(rawUserId), 10);
if (!Number.isFinite(userId)) {
  throw new Error(`Invalid SCAN_USER_ID: ${rawUserId}`);
}

function parseReportGaps(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const fileName = path.basename(filePath);
  
  // Extract report metadata from filename (e.g., "001-acme-ai-2026-04-01.md")
  const fileRegex = /^(\d+)-([a-z0-9-]+)-(\d{4}-\d{2}-\d{2})\.md$/i;
  const match = fileName.match(fileRegex);
  
  let reportId = '000';
  let companySlug = 'unknown';
  let date = new Date().toISOString().split('T')[0];
  
  if (match) {
    reportId = match[1];
    companySlug = match[2];
    date = match[3];
  }

  // Extract Company Name and Role from Title
  const lines = content.split('\n');
  let companyName = companySlug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  let roleName = 'Software Engineer';
  
  const titleLine = lines.find(l => l.startsWith('# '));
  if (titleLine) {
    const titleClean = titleLine.replace(/^#\s+(Evaluation:|Evaluación:)\s*/i, '').trim();
    if (titleClean.includes('--')) {
      const parts = titleClean.split('--');
      companyName = parts[0].trim();
      roleName = parts[1].trim();
    } else {
      companyName = titleClean;
    }
  }

  // Look for the "Gaps" or "Brechas" header and find the table under it
  let inGapsSection = false;
  let inTable = false;
  let headers = [];
  let colIndexMap = {};
  const gaps = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Check for gaps section header
    if (line.startsWith('##') && /gap|brecha/i.test(line)) {
      inGapsSection = true;
      continue;
    } else if (line.startsWith('##') && !/gap|brecha/i.test(line)) {
      // Entered another section
      if (inGapsSection) {
        inGapsSection = false;
        inTable = false;
      }
    }

    if (inGapsSection) {
      if (line.startsWith('|')) {
        const cols = line.split('|').map(c => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
        
        if (!inTable) {
          const hasGap = cols.some(c => /gap|brecha/i.test(c));
          const hasSeverity = cols.some(c => /severity|severidad|importancia/i.test(c));
          
          if (hasGap || hasSeverity) {
            inTable = true;
            headers = cols;
            headers.forEach((h, idx) => {
              const hLower = h.toLowerCase();
              if (/gap|brecha/i.test(hLower)) colIndexMap.gap = idx;
              else if (/severity|severidad|importancia/i.test(hLower)) colIndexMap.severity = idx;
              else if (/mitigation|mitigaci/i.test(hLower)) colIndexMap.mitigation = idx;
            });
            // Skip the divider line (|---|---|...)
            i++;
          }
        } else {
          if (line.includes('---')) continue;
          
          const row = cols;
          if (row.length < headers.length) {
            inTable = false;
            continue;
          }

          let gapText = row[colIndexMap.gap] || '';
          // Clean quotes
          gapText = gapText.replace(/^["'“”‘]/, '').replace(/["'“”’]$/, '').trim();
          
          if (gapText && gapText !== '...' && !gapText.startsWith('---')) {
            gaps.push({
              gap: gapText,
              severity: (row[colIndexMap.severity] || 'Medium').trim(),
              mitigation: (row[colIndexMap.mitigation] || '').trim(),
              reportId,
              company: companyName,
              role: roleName,
              date
            });
          }
        }
      } else if (line === '') {
        if (inTable) inTable = false;
      }
    }
  }

  return gaps;
}

async function run() {
  console.log('🔍 Running Skill Gap Analysis...');
  
  if (!fs.existsSync(REPORTS_DIR)) {
    console.log(`❌ Reports directory "${REPORTS_DIR}" does not exist.`);
    process.exit(0);
  }

  const files = fs.readdirSync(REPORTS_DIR)
    .filter(f => f.endsWith('.md') && f !== '.gitkeep')
    .sort();

  if (files.length === 0) {
    console.log('ℹ️ No evaluation reports found. Run some evaluations first.');
    process.exit(0);
  }

  console.log(`📂 Scanning ${files.length} reports for skill gaps...`);
  const allGaps = [];

  files.forEach(file => {
    const filePath = path.join(REPORTS_DIR, file);
    try {
      const gaps = parseReportGaps(filePath);
      allGaps.push(...gaps);
    } catch (err) {
      console.error(`⚠️ Error parsing ${file}:`, err.message);
    }
  });

  if (allGaps.length === 0) {
    console.log('✅ No skill gaps detected in your reports.');
    process.exit(0);
  }

  // Aggregate skill gaps (case-insensitive key)
  const aggregated = {};
  allGaps.forEach(g => {
    const key = g.gap.toLowerCase().trim();
    if (!aggregated[key]) {
      aggregated[key] = {
        name: g.gap, // Keep original case of first match
        count: 0,
        severity: g.severity,
        occurrences: [],
        mitigations: []
      };
    }

    const item = aggregated[key];
    item.count++;
    
    // Upgrade severity if this one is higher
    const sevMap = { 'low': 1, 'baja': 1, 'medium': 2, 'media': 2, 'high': 3, 'alta': 3 };
    const currentWeight = sevMap[item.severity.toLowerCase()] || 2;
    const newWeight = sevMap[g.severity.toLowerCase()] || 2;
    if (newWeight > currentWeight) {
      item.severity = g.severity;
    }

    item.occurrences.push({
      reportId: g.reportId,
      company: g.company,
      role: g.role,
      date: g.date
    });

    if (g.mitigation && g.mitigation !== '...' && !item.mitigations.includes(g.mitigation)) {
      item.mitigations.push(g.mitigation);
    }
  });

  // Sort by count descending, then alphabetical
  const sortedGaps = Object.values(aggregated).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.name.localeCompare(b.name);
  });

  // Write to console
  console.log('\n=======================================');
  console.log('🎯 SKILL GAP HEATMAP (Ranked by Frequency)');
  console.log('=======================================');
  console.log(`${'Skill / Gap'.padEnd(28)} | ${'Count'.padEnd(5)} | ${'Severity'.padEnd(8)} | ${'Impacted Companies'}`);
  console.log('---------------------------------------------------------------------------------');
  sortedGaps.forEach(g => {
    const companies = g.occurrences.map(o => o.company).slice(0, 3).join(', ') + (g.occurrences.length > 3 ? '...' : '');
    console.log(`${g.name.substring(0, 27).padEnd(28)} | ${String(g.count).padEnd(5)} | ${g.severity.padEnd(8)} | ${companies}`);
  });
  console.log('=======================================\n');

  // Save local JSON backup
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(OUT_FILE, JSON.stringify(sortedGaps, null, 2), 'utf-8');
  console.log(`✓ Saved heatmap JSON to ${OUT_FILE}`);

  // Save to Neon PostgreSQL if DATABASE_URL is active
  if (process.env.DATABASE_URL) {
    try {
      console.log('💾 Syncing skill gap heatmap to Neon database...');
      // Merge with resume_context under 'skill_gaps'
      await sql`
        UPDATE user_profiles 
        SET resume_context = jsonb_set(COALESCE(resume_context, '{}'::jsonb), '{skill_gaps}', ${JSON.stringify(sortedGaps)}::jsonb)
        WHERE user_id = ${userId}
      `;
      console.log('✓ Database sync complete.');
    } catch (dbErr) {
      console.error('⚠️ Database sync failed:', dbErr.message);
    }
  }

  process.exit(0);
}

run();
