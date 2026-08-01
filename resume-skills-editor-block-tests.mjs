/**
 * Regression: IDE assistants must never appear as Technical Skills / competencies.
 */
import assert from 'node:assert/strict';
import { isEditorIdeTool, isJunkKeyword } from './jd-keyword-align.mjs';
import { renderCategorizedSkills } from './resume-skills-html.mjs';

const editors = ['Cursor', 'Claude Code', 'GPTs', 'ChatGPT', 'Copilot', 'GitHub Copilot', 'Claude'];
for (const e of editors) {
  assert.equal(isEditorIdeTool(e), true, `${e} is editor tool`);
  assert.equal(isJunkKeyword(e), true, `${e} is junk keyword`);
}

const sp = ['AI-native tool integration (Cursor, Claude Code, GPTs)', 'AWS platform engineering (ECS, Lambda, Aurora)'];
const comps = ['Node.js', 'PostgreSQL', 'Cursor', 'Claude Code'];
const html = renderCategorizedSkills(sp, comps);

assert(!/\bCursor\b/i.test(html), 'HTML must not contain Cursor');
assert(!/\bClaude\b/i.test(html), 'HTML must not contain Claude');
assert(!/\bGPTs?\b/i.test(html), 'HTML must not contain GPTs');
assert(!/\bChatGPT\b/i.test(html), 'HTML must not contain ChatGPT');
assert(!/\bCopilot\b/i.test(html), 'HTML must not contain Copilot');
assert(!/AI-native tool integration/i.test(html), 'HTML must not contain AI-native tool integration filler');
assert(/Technical Skills:/i.test(html), 'keeps Technical Skills row');
assert(/ECS/i.test(html) || /Lambda/i.test(html) || /Node\.js/i.test(html), 'keeps real tech stacks');
assert(!/Technical Skills:[^<]*Cursor/i.test(html), 'Technical Skills must not list Cursor');

console.log('resume-skills-editor-block-tests: ok');
