#!/usr/bin/env node
/**
 * simulate-jd-align.mjs — Local offline harness for the Resume–JD alignment gate.
 *
 * Usage:
 *   node simulate-jd-align.mjs
 *   node simulate-jd-align.mjs --jd path/to/jd.md
 *   node simulate-jd-align.mjs --json
 *   node simulate-jd-align.mjs --llm   # optional: real tailor via GitHub Models, then gate
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { hydrateResumeProfile } from './profile-hydrate.mjs';
import {
  buildSourceResumeFromProfile,
  buildAlignedResumeFromProfile,
  validateResumeAlignment,
  printAlignmentConfirmation,
  writeAlignmentReport,
} from './resume-alignment-validator.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = path.join(__dirname, 'examples', 'jd-align-fixtures');
const ARGS = process.argv.slice(2);
const WANT_JSON = ARGS.includes('--json');
const WANT_LLM = ARGS.includes('--llm');
const jdIdx = ARGS.indexOf('--jd');
const customJdPath = jdIdx >= 0 ? ARGS[jdIdx + 1] : null;

function loadFixtures() {
  if (customJdPath) {
    const abs = path.resolve(customJdPath);
    if (!fs.existsSync(abs)) throw new Error(`JD not found: ${abs}`);
    return [{ name: path.basename(abs), text: fs.readFileSync(abs, 'utf8') }];
  }
  if (!fs.existsSync(FIXTURE_DIR)) {
    throw new Error(`Missing fixtures dir: ${FIXTURE_DIR}`);
  }
  return fs
    .readdirSync(FIXTURE_DIR)
    .filter((f) => f.endsWith('.md'))
    .sort()
    .map((f) => ({
      name: f,
      text: fs.readFileSync(path.join(FIXTURE_DIR, f), 'utf8'),
    }));
}

async function maybeLlmDraft(jdText, profile, company = 'Fixture Co') {
  if (!WANT_LLM) return null;

  const key =
    process.env.FALLBACK_API_KEY
    || process.env.GITHUB_PAT
    || process.env.GITHUB_TOKEN
    || '';
  if (!key || key.toLowerCase().includes('your_')) {
    throw new Error('--llm requires FALLBACK_API_KEY / GITHUB_PAT with models:read');
  }

  let base = (process.env.FALLBACK_BASE_URL || 'https://models.github.ai/inference').replace(/\/$/, '');
  base = base.replace(/\/v1$/, '');
  const url = base.endsWith('/chat/completions') ? base : `${base}/chat/completions`;
  let model = process.env.FALLBACK_MODEL || 'openai/gpt-4o-mini';
  if (!model.includes('/')) model = `openai/${model}`;

  const prompt = `Return ONLY JSON: {"resume":{"summary":"...","core_competencies":["..."],"experience":{"0":["bullet",...]}}}.
Use ONLY skills proven in the profile. Never claim .NET, C#, or Redux unless present in profile.
JD:\n${jdText.slice(0, 4000)}\n\nPROFILE:\n${JSON.stringify({
    narrative: profile.narrative,
    experience: (profile.experience || []).slice(0, 3),
  }).slice(0, 6000)}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: 'system', content: 'You are a precise resume tailor. Output valid JSON only.' },
        { role: 'user', content: prompt },
      ],
    }),
  });
  if (!response.ok) {
    throw new Error(`GitHub Models failed ${response.status}: ${await response.text()}`);
  }
  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content || '';
  const jsonStr = content.substring(content.indexOf('{'), content.lastIndexOf('}') + 1);
  const parsed = JSON.parse(jsonStr);
  if (!parsed?.resume) throw new Error('LLM response missing resume object');
  console.log(`🤖 LLM draft via GitHub Models (${model}) for ${company}`);
  return parsed.resume;
}

function assertFixtureExpectations(name, result) {
  const fails = [];
  if (result.verdict !== 'PASS') {
    fails.push(`expected PASS, got ${result.verdict}: ${(result.reasons || []).join('; ')}`);
  }
  if ((result.selected?.ats ?? 0) < 50) {
    fails.push(`ATS ${result.selected?.ats} < 50`);
  }
  // Trap fixture: experience must not invent .NET / C# / Redux project history
  // (competencies may list JD target stack for ATS)
  if (name.includes('partial-traps') || name.includes('02-')) {
    const exp = result.selectedResume?.experience;
    const bullets = Array.isArray(exp)
      ? exp
      : Object.values(exp || {}).flat();
    const corpus = bullets.join(' ').toLowerCase();
    for (const bad of ['.net', 'c#', 'redux']) {
      if (corpus.includes(bad)) fails.push(`fabrication leaked into experience: ${bad}`);
    }
    const gaps = (result.fit?.gaps || []).map((g) => g.toLowerCase());
    if (!gaps.some((g) => g.includes('.net') || g === 'c#' || g.includes('redux'))) {
      fails.push('expected .NET/C#/Redux in gaps');
    }
  }
  if ((result.fit?.honest || []).length < 2) {
    fails.push('too few honest keywords');
  }
  return fails;
}

async function runOne(fixture, profile) {
  const { resume: aligned } = buildAlignedResumeFromProfile(profile, fixture.text);
  const source = buildSourceResumeFromProfile(profile, fixture.text);
  let llmDraft = JSON.parse(JSON.stringify(aligned));
  try {
    const fromLlm = await maybeLlmDraft(fixture.text, profile, fixture.name);
    if (fromLlm) llmDraft = fromLlm;
  } catch (e) {
    if (WANT_LLM) throw e;
  }

  const result = validateResumeAlignment({
    jdText: fixture.text,
    profile,
    sourceResume: source,
    llmDraft,
    finalResume: aligned,
    meta: { company: 'Fixture', role: fixture.name },
  });

  printAlignmentConfirmation(result);

  if (!WANT_JSON) {
    console.log(`JD: ${fixture.name}`);
    console.log('─'.repeat(48));
    console.log(
      `Before coverage:  ${result.scores.source.honestCoverage}%  (source CV)`
    );
    console.log(
      `After coverage:   ${result.selected?.honestCoverage ?? '—'}%  (${result.selected?.label || 'none'})`
    );
    console.log(`Honest: ${(result.fit.honest || []).slice(0, 10).join(', ') || '(none)'}`);
    console.log(`Gaps (NOT claimed): ${(result.fit.gaps || []).slice(0, 10).join(', ') || '(none)'}`);
    console.log(`Fabrication check: ${(result.scores.aligned?.unsupported || []).length === 0 ? 'PASS' : 'FAIL'}`);
    console.log(`ATS content: ${result.selected?.ats ?? '—'}`);
    console.log(
      `VERDICT: ${result.verdict}${result.verdict === 'PASS' ? ' — resume is JD-aligned without lying' : ''}`
    );
    console.log('');
  }

  const outDir = path.join(__dirname, 'output', 'align-sim');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const base = path.join(outDir, fixture.name.replace(/\.md$/i, ''));
  writeAlignmentReport(result, base);

  const expectationFails = assertFixtureExpectations(fixture.name, result);
  return { name: fixture.name, result, expectationFails };
}

async function main() {
  const { profile } = hydrateResumeProfile({});
  if (!profile?.experience?.length && !profile?.narrative) {
    console.warn('⚠ Profile looks empty — hydrate from cv.md / config/profile.yml');
  }

  const fixtures = loadFixtures();
  const reports = [];
  let failed = 0;

  for (const fixture of fixtures) {
    const row = await runOne(fixture, profile);
    reports.push(row);
    if (row.expectationFails.length || row.result.verdict !== 'PASS') {
      failed += 1;
      for (const f of row.expectationFails) console.error(`  ✗ ${fixture.name}: ${f}`);
    } else {
      console.log(`  ✅ ${fixture.name}`);
    }
  }

  if (WANT_JSON) {
    console.log(JSON.stringify({
      ok: failed === 0,
      failed,
      reports: reports.map((r) => ({
        name: r.name,
        verdict: r.result.verdict,
        selected: r.result.selected,
        scores: r.result.scores,
        reasons: r.result.reasons,
        expectationFails: r.expectationFails,
      })),
    }, null, 2));
  } else {
    console.log('='.repeat(48));
    console.log(`simulate-jd-align: ${fixtures.length - failed}/${fixtures.length} passed`);
  }

  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
