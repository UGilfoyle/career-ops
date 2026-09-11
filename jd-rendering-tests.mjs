import assert from 'node:assert/strict';
import {
  cleanHtmlToStructuredJd,
  detectKnownTech,
  parseJdSections,
} from './lib/jd-formatter-core.mjs';
import { htmlToPlainJd } from './ashby-jd.mjs';

console.log('Testing JD Rendering and Parsing Engine...');

// Test 1: HTML bullet preservation
const rawHtml = `
  <h1>Staff Backend Engineer</h1>
  <p>About Landeed: We build land title verification systems.</p>
  <h3>Key Responsibilities</h3>
  <ul>
    <li>Design distributed transaction consensus protocols</li>
    <li>Scale PostgreSQL and Kafka event streaming clusters</li>
  </ul>
  <h3>Core Requirements</h3>
  <ul>
    <li>Strong proficiency in Go, Python, and TypeScript</li>
    <li>Deep experience with Docker, Kubernetes, and AWS</li>
  </ul>
`;

const plain = htmlToPlainJd(rawHtml);
assert.ok(plain.includes('• Design distributed transaction consensus protocols'), 'Bullet point missing in htmlToPlainJd');
assert.ok(plain.includes('### Key Responsibilities'), 'Section heading missing in htmlToPlainJd');
assert.ok(!plain.includes('<ul>'), 'HTML tag not stripped');
assert.ok(!plain.includes('<li>'), 'li tag not stripped');

// Test 2: HTML entity decoding
const entityHtml = '<p>Salary &amp; Perks: $150k &ndash; $200k &bull; Health &amp; Dental&#39;s coverage</p>';
const cleanedEntities = cleanHtmlToStructuredJd(entityHtml);
assert.ok(cleanedEntities.includes('&'), 'Entity &amp; not decoded');
assert.ok(cleanedEntities.includes('•'), 'Entity &bull; not decoded');
assert.ok(cleanedEntities.includes("'"), "Entity &#39; not decoded");

// Test 3: Structured Section Parser
const structured = parseJdSections(rawHtml);
assert.equal(structured.isBlockedOrThin, false);
assert.ok(structured.sections.length >= 2, 'Expected at least 2 detected sections');

const respSection = structured.sections.find((s) => s.type === 'responsibilities');
assert.ok(respSection, 'Responsibilities section not identified');
assert.ok(respSection.items.length >= 2, 'Bullets not extracted in responsibilities');
assert.ok(respSection.items[0].includes('Design distributed transaction consensus protocols'));

const reqSection = structured.sections.find((s) => s.type === 'requirements');
assert.ok(reqSection, 'Requirements section not identified');
assert.ok(reqSection.items.length >= 2, 'Bullets not extracted in requirements');

// Test 4: Tech Stack Detection
assert.ok(structured.techStack.includes('Go') || structured.techStack.includes('Golang'));
assert.ok(structured.techStack.includes('Python'));
assert.ok(structured.techStack.includes('TypeScript'));
assert.ok(structured.techStack.includes('Kafka'));
assert.ok(structured.techStack.includes('PostgreSQL'));
assert.ok(structured.techStack.includes('Kubernetes'));
assert.ok(structured.techStack.includes('AWS'));

// Test 5: Metrics calculation
assert.ok(structured.metrics.wordCount > 25);
assert.ok(structured.metrics.bulletCount >= 4);
assert.ok(structured.metrics.readingTimeMinutes >= 1);

// Test 6: Edge Case - Bot Block Detection
const blockedText = 'Access Denied - You do not have permission to access this page on edgesuite.net (Cloudflare ray id 89123)';
const blockedParsed = parseJdSections(blockedText);
assert.equal(blockedParsed.isBlockedOrThin, true);
assert.ok(blockedParsed.blockedReason?.includes('blocked'));

// Test 7: Edge Case - Null / Empty
const emptyParsed = parseJdSections('');
assert.equal(emptyParsed.isBlockedOrThin, true);
assert.equal(emptyParsed.metrics.wordCount, 0);

const nullParsed = parseJdSections(null);
assert.equal(nullParsed.isBlockedOrThin, true);
assert.equal(nullParsed.metrics.wordCount, 0);

// Test 8: Plain text JD without HTML tags
const plainTextJd = `
Role Overview:
Building resilient fintech infrastructure across Asia.

Responsibilities:
• Architect event sourcing models
• Lead incident postmortems

Requirements:
- 5+ years with distributed systems
- Production experience with Redis and Docker
`;

const plainParsed = parseJdSections(plainTextJd);
assert.equal(plainParsed.isBlockedOrThin, false);
assert.ok(plainParsed.sections.length >= 2);
assert.ok(plainParsed.techStack.includes('Redis'));
assert.ok(plainParsed.techStack.includes('Docker'));

console.log('✅ All JD rendering and parsing tests passed successfully!');
