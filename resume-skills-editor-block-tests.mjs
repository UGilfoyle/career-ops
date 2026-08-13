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
assert(/skills-list/i.test(html), 'renders skills as bullet list');
assert(/<li>[^<]*Node\.js/i.test(html) || /<li>Node\.js<\/li>/i.test(html), 'keeps real tech stacks as bullets');
assert(!/Core Competencies/i.test(html), 'no Core Competencies label');
assert(!/Technical Skills:/i.test(html), 'no nested Technical Skills label under section');
assert(!/Technical Skills:[^<]*Cursor/i.test(html), 'Technical Skills must not list Cursor');

const narrative = renderCategorizedSkills(
  ['Monolith-to-microservices transition, AWS cluster and cost optimization, High-throughput RESTful API design'],
  ['Java', 'PostgreSQL', 'microservices', 'system design', '.Net']
);
assert(!/Monolith-to-microservices/i.test(narrative), 'narrative superpower blob excluded');
assert(!/cost optimization/i.test(narrative), 'optimization phrase excluded');
assert(/<li>Java<\/li>/i.test(narrative), 'Java kept');
assert(/<li>PostgreSQL<\/li>/i.test(narrative), 'PostgreSQL canonical casing');
assert(/<li>Microservices<\/li>/i.test(narrative), 'microservices title-cased');
assert(/<li>System Design<\/li>/i.test(narrative), 'system design title-cased');
assert(/<li>\.NET<\/li>/i.test(narrative), '.Net normalized to .NET');

const broken = renderCategorizedSkills(
  ['AWS platform engineering (ECS, Lambda, Aurora)'],
  ['TypeScript)', 'IAM)', 'Ruby', 'AWS', 'Node.js', 'PostgreSQL', 'Redis'],
);
assert(!/TypeScript\)/i.test(broken), 'no trailing paren on TypeScript');
assert(!/IAM\)/i.test(broken), 'no trailing paren on IAM');
assert(/<li>TypeScript<\/li>/i.test(broken), 'TypeScript cleaned');
assert(/<li>AWS<\/li>/i.test(broken), 'AWS kept');
assert(!/<li>IAM<\/li>/i.test(broken), 'IAM crumb dropped when AWS present');
assert(!/<li>Lambda<\/li>/i.test(broken), 'Lambda crumb dropped when AWS present');
assert(!/<li>Aurora<\/li>/i.test(broken), 'Aurora crumb dropped when AWS present');

console.log('resume-skills-editor-block-tests: ok');
