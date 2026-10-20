#!/usr/bin/env node

/**
 * ats-diagnostic-engine.mjs — Granular 0-100 ATS Diagnostic Engine
 * Inspired by LoopCV CV-Checker parity with CareerOps strict anti-hallucination.
 *
 * Usage:
 *   node ats-diagnostic-engine.mjs
 *   node ats-diagnostic-engine.mjs --jd "path/to/jd.txt"
 *   node ats-diagnostic-engine.mjs --json
 */

import fs from 'fs';
import path from 'path';
import { parse as parseYaml } from 'yaml';
import { extractJdKeywords } from './jd-keyword-align.mjs';

const ACTION_VERBS = new Set([
  'accelerated', 'achieved', 'administered', 'analyzed', 'architected', 'automated',
  'built', 'championed', 'consolidated', 'constructed', 'coordinated', 'created',
  'decreased', 'delivered', 'deployed', 'designed', 'developed', 'devised',
  'eliminated', 'engineered', 'enhanced', 'established', 'executed', 'expanded',
  'expedited', 'formulated', 'generated', 'guided', 'implemented', 'improved',
  'increased', 'initiated', 'instituted', 'integrated', 'introduced', 'invented',
  'launched', 'led', 'maximized', 'mentored', 'minimized', 'modernized',
  'negotiated', 'optimized', 'orchestrated', 'overhauled', 'pioneered', 'produced',
  'reduced', 'refactored', 'restructured', 'revamped', 'scaled', 'simplified',
  'spearheaded', 'standardized', 'streamlined', 'strengthened', 'supervised',
  'transformed', 'unified', 'upgraded',
]);

const METRICS_REGEX = /\b(\d+(?:\.\d+)?%|\$\d+(?:,\d+)*(?:\.\d+)?[kKmMbB]?|\b\d+\+\b|\b\d+x\b|\b\d+\s*(?:ms|seconds|users|requests|tps|qps|tb|gb|million|billion|k|lpa|cr)\b)/i;

export function runAtsDiagnostic(profile, jdText = '') {
  const c = profile?.candidate || {};
  const n = profile?.narrative || {};
  const exp = Array.isArray(profile?.experience) ? profile.experience : [];
  const edu = Array.isArray(profile?.education) ? profile.education : [];
  const skills = Array.isArray(n?.superpowers) ? n.superpowers : [];
  const summary = (n?.exit_story || n?.headline || '').trim();

  // 1. Formatting & Structure Checks
  const checks = [];
  checks.push({ name: 'Candidate Name', ok: Boolean(c.full_name && c.full_name.trim().length >= 3) });
  checks.push({ name: 'Valid Email', ok: Boolean(c.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email.trim())) });
  checks.push({ name: 'Direct Phone', ok: Boolean(c.phone && c.phone.trim().length >= 7) });
  checks.push({ name: 'Location / Residency', ok: Boolean(c.location && c.location.trim().length >= 2) });
  checks.push({ name: 'Professional Links (LinkedIn/GitHub)', ok: Boolean(c.linkedin || c.github || c.portfolio_url) });
  checks.push({ name: 'Summary Section', ok: summary.length >= 40 });
  checks.push({ name: 'Work Experience History', ok: exp.length > 0 });
  checks.push({ name: 'Core Competencies (>=6)', ok: skills.length >= 6 });
  checks.push({ name: 'Education Credentials', ok: edu.length > 0 });

  const passedChecks = checks.filter(ch => ch.ok);
  const formattingScore = Math.round((passedChecks.length / checks.length) * 100);

  // 2. Metrics & Impact Checks
  const allBullets = exp.flatMap(r => (Array.isArray(r.bullets) ? r.bullets.map(b => String(b).trim()) : [])).filter(Boolean);
  let bulletsWithMetrics = 0;
  let bulletsWithVerbs = 0;

  for (const b of allBullets) {
    if (METRICS_REGEX.test(b)) bulletsWithMetrics++;
    const firstWord = (b.split(/\s+/)[0] || '').toLowerCase().replace(/[^a-z]/g, '');
    if (ACTION_VERBS.has(firstWord)) bulletsWithVerbs++;
  }

  const totalBullets = allBullets.length || 1;
  const metricsPct = Math.round((bulletsWithMetrics / totalBullets) * 100);
  const strongVerbsPct = Math.round((bulletsWithVerbs / totalBullets) * 100);
  const impactScore = Math.round(metricsPct * 0.5 + strongVerbsPct * 0.5);

  // 3. Section Health
  const sectionScore = Math.round(
    ((summary.length >= 40 ? 1 : 0) +
     (exp.length >= 1 ? 1 : 0) +
     (skills.length >= 6 ? 1 : 0) +
     (edu.length >= 1 ? 1 : 0) +
     (c.email && c.phone ? 1 : 0)) / 5 * 100
  );

  // 4. Keyword Match
  let keywordScore = 80;
  let matchedKw = [];
  let missingKw = [];
  let jdKeywords = [];

  if (jdText && jdText.trim().length >= 40) {
    jdKeywords = extractJdKeywords(jdText);
    const resumeFullText = `${summary} ${skills.join(' ')} ${allBullets.join(' ')}`.toLowerCase();
    matchedKw = jdKeywords.filter(k => resumeFullText.includes(k.toLowerCase()));
    missingKw = jdKeywords.filter(k => !resumeFullText.includes(k.toLowerCase()));
    keywordScore = jdKeywords.length > 0 ? Math.round((matchedKw.length / jdKeywords.length) * 100) : 100;
  }

  const hasJd = jdKeywords.length > 0;
  const overallScore = hasJd
    ? Math.round(keywordScore * 0.40 + formattingScore * 0.25 + impactScore * 0.20 + sectionScore * 0.15)
    : Math.round(formattingScore * 0.35 + impactScore * 0.35 + sectionScore * 0.30);

  let tier = 'At Risk (Filters Likely)';
  if (overallScore >= 88) tier = 'Elite (Top 5% ATS Cleared)';
  else if (overallScore >= 75) tier = 'Strong (Competitive)';
  else if (overallScore >= 60) tier = 'Moderate (Polish Needed)';

  const findings = [];
  if (!c.email || !c.phone) {
    findings.push({ severity: 'CRITICAL', msg: 'Missing direct phone or email. Enterprise ATS systems reject without parsing.' });
  }
  if (hasJd && missingKw.length > 0) {
    findings.push({ severity: 'WARNING', msg: `${missingKw.length} JD keywords missing: ${missingKw.slice(0, 5).join(', ')}...` });
  }
  if (metricsPct < 40) {
    findings.push({ severity: 'WARNING', msg: `Only ${metricsPct}% of bullets contain quantified metrics (%, $, scale). LoopCV and Taleo/Workday score higher on measurable impact.` });
  }
  if (strongVerbsPct < 60) {
    findings.push({ severity: 'TIP', msg: `${100 - strongVerbsPct}% of bullets lack strong active leadership verbs.` });
  }

  return {
    overallScore,
    tier,
    categories: {
      keywordMatch: { score: keywordScore, matched: matchedKw, missing: missingKw, total: jdKeywords.length },
      formattingLayout: { score: formattingScore, passed: passedChecks.map(c => c.name), failed: checks.filter(c => !c.ok).map(c => c.name) },
      impactMetrics: { score: impactScore, metricsPct, strongVerbsPct, totalBullets: allBullets.length },
      sectionCompleteness: { score: sectionScore },
    },
    findings,
  };
}

function renderBar(score, width = 20) {
  const filled = Math.round((score / 100) * width);
  const empty = width - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

// CLI Execution
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  let profile = {};
  if (fs.existsSync('config/profile.yml')) {
    profile = parseYaml(fs.readFileSync('config/profile.yml', 'utf8'));
  } else {
    console.error('config/profile.yml not found.');
    process.exit(1);
  }

  let jdText = '';
  const jdArgIdx = process.argv.indexOf('--jd');
  if (jdArgIdx !== -1 && process.argv[jdArgIdx + 1]) {
    const jdPathOrText = process.argv[jdArgIdx + 1];
    jdText = fs.existsSync(jdPathOrText) ? fs.readFileSync(jdPathOrText, 'utf8') : jdPathOrText;
  }

  const result = runAtsDiagnostic(profile, jdText);

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  }

  console.log('\n======================================================');
  console.log('       🎯 CAREEROPS 0-100 ATS DIAGNOSTIC ENGINE       ');
  console.log('======================================================\n');
  console.log(`  OVERALL ATS SCORE:  [${renderBar(result.overallScore, 24)}]  ${result.overallScore}/100`);
  console.log(`  ATS TIER:           ${result.tier}\n`);
  console.log('  CATEGORY BREAKDOWN:');
  console.log(`    • Keyword Alignment:    [${renderBar(result.categories.keywordMatch.score, 14)}] ${result.categories.keywordMatch.score}%`);
  console.log(`    • Layout & ATS Hygiene: [${renderBar(result.categories.formattingLayout.score, 14)}] ${result.categories.formattingLayout.score}%`);
  console.log(`    • Quantified Impact:    [${renderBar(result.categories.impactMetrics.score, 14)}] ${result.categories.impactMetrics.score}% (${result.categories.impactMetrics.metricsPct}% metrics, ${result.categories.impactMetrics.strongVerbsPct}% verbs)`);
  console.log(`    • Section Health:       [${renderBar(result.categories.sectionCompleteness.score, 14)}] ${result.categories.sectionCompleteness.score}%\n`);

  if (result.findings.length > 0) {
    console.log('  ACTIONABLE FIXES:');
    result.findings.forEach(f => {
      const tag = f.severity === 'CRITICAL' ? '🔴 CRITICAL' : f.severity === 'WARNING' ? '🟡 WARNING ' : '🔵 TIP     ';
      console.log(`    ${tag}: ${f.msg}`);
    });
    console.log();
  }
}
