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
assert(/skill-label/i.test(html), 'renders skills as categorized rows');
assert(/Node\.js/i.test(html), 'keeps real tech stacks');
assert(!/Core Competencies/i.test(html), 'no Core Competencies label');
assert(!/Technical Skills:/i.test(html), 'no nested Technical Skills label under section');
assert(!/Technical Skills:[^<]*Cursor/i.test(html), 'Technical Skills must not list Cursor');

const narrative = renderCategorizedSkills(
  ['Monolith-to-microservices transition, AWS cluster and cost optimization, High-throughput RESTful API design'],
  ['Java', 'PostgreSQL', 'microservices', 'system design', '.Net']
);
assert(!/Monolith-to-microservices/i.test(narrative), 'narrative superpower blob excluded');
assert(!/cost optimization/i.test(narrative), 'optimization phrase excluded');
assert(/\bJava\b/.test(narrative), 'Java kept');
assert(/\bPostgreSQL\b/.test(narrative), 'PostgreSQL canonical casing');
assert(/\bMicroservices\b/.test(narrative), 'microservices title-cased');
assert(/System Design/.test(narrative), 'system design title-cased');
assert(/\.NET/.test(narrative), '.Net normalized to .NET');
assert(/Languages:/.test(narrative), 'Java lands in Languages');
assert(/Databases:/.test(narrative), 'PostgreSQL lands in Databases');

const broken = renderCategorizedSkills(
  ['AWS platform engineering (ECS, Lambda, Aurora)'],
  ['TypeScript)', 'IAM)', 'Ruby', 'AWS', 'Node.js', 'PostgreSQL', 'Redis'],
);
assert(!/TypeScript\)/i.test(broken), 'no trailing paren on TypeScript');
assert(!/IAM\)/i.test(broken), 'no trailing paren on IAM');
assert(/\bTypeScript\b/.test(broken), 'TypeScript cleaned');
assert(/\bAWS\b/.test(broken), 'AWS kept');
assert(!/\bIAM\b/.test(broken), 'IAM crumb dropped when AWS present');
assert(!/\bLambda\b/.test(broken), 'Lambda crumb dropped when AWS present');
assert(!/\bAurora\b/.test(broken), 'Aurora crumb dropped when AWS present');

const awsJd = 'AWS Platform Engineer. Must have IAM, VPC, CloudWatch, CloudFormation, Terraform, Jenkins.';
const awsHtml = renderCategorizedSkills(
  ['Event-driven microservices & high-throughput APIs', 'Bun / Node.js runtime performance for telemetry'],
  ['Terraform', 'CloudWatch', 'IAM', 'VPC', 'AWS', 'Jenkins', 'Python', 'CloudFormation'],
  awsJd,
);
assert(/Terraform/i.test(awsHtml), 'JD-named Terraform stays in skills');
assert(/CloudWatch/i.test(awsHtml), 'JD-named CloudWatch stays in skills');
assert(/IAM/i.test(awsHtml), 'JD-named IAM stays when AWS is present');
assert(/Jenkins/i.test(awsHtml), 'JD-named Jenkins stays in skills');
assert(/Cloud:/.test(awsHtml), 'AWS platform tools land in Cloud');

console.log('resume-skills-editor-block-tests: ok');
