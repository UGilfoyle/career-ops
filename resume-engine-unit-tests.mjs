#!/usr/bin/env node
/**
 * resume-engine-unit-tests.mjs — Comprehensive unit test suite for resume generation engine components.
 */

import assert from 'node:assert';
import {
  isDotnetAzureJd,
  extractJdPostedTitle,
  inferRoleTitleFromJd,
  inferJdWorkShapeLine,
} from './jd-profile-match.mjs';
import {
  classifyRoleFamily,
  stripGapMention,
  scrubInventedStackFromMutableRoles,
  measureMutableRoleCoverage,
} from './resume-tailoring-plan.mjs';
import {
  keywordTokens,
  keywordCoveredInText,
  keywordAppearsInJd,
  cleanSkillToken,
  endsWithMetricTail,
} from './jd-keyword-align.mjs';

console.log('🧪 Starting Resume Generation Engine Unit Tests...\n');

let passCount = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err);
    process.exit(1);
  }
}

// ============================================================================
// 1. isDotnetAzureJd Unit Tests
// ============================================================================
console.log('1. isDotnetAzureJd');

test('matches standard .NET and Azure', () => {
  assert.strictEqual(isDotnetAzureJd('Experience with .NET and Azure cloud services'), true);
});

test('matches C# and Azure Service Bus', () => {
  assert.strictEqual(isDotnetAzureJd('Building distributed microservices in C# with Azure Service Bus'), true);
});

test('matches C# followed by punctuation and Azure Functions', () => {
  assert.strictEqual(isDotnetAzureJd('Senior developer proficient in C#, ASP.NET Core, and Azure Functions.'), true);
});

test('matches dotnet variant with Azure Event Hub', () => {
  assert.strictEqual(isDotnetAzureJd('Modern dotnet 8 architecture hosted on Azure'), true);
});

test('rejects .NET alone without Azure ecosystem signals', () => {
  assert.strictEqual(isDotnetAzureJd('Developing desktop applications in .NET 8 on Windows Server'), false);
});

test('rejects Azure alone without .NET or C#', () => {
  assert.strictEqual(isDotnetAzureJd('Deploying Python machine learning services to Azure AKS'), false);
});

test('rejects non-tech occurrences of net and c', () => {
  assert.strictEqual(isDotnetAzureJd('The net revenue for company C in Azure region is high'), false);
});

test('handles null, undefined, empty string safely', () => {
  assert.strictEqual(isDotnetAzureJd(''), false);
  assert.strictEqual(isDotnetAzureJd(null), false);
  assert.strictEqual(isDotnetAzureJd(undefined), false);
});

// ============================================================================
// 2. extractJdPostedTitle & cleanExtractedTitle Unit Tests
// ============================================================================
console.log('\n2. extractJdPostedTitle & cleanExtractedTitle');

test('extracts title with explicit "Job Title:" label', () => {
  const jd = `Job Title: Senior Full Stack Engineer\nCompany: Acme Corp`;
  assert.strictEqual(extractJdPostedTitle(jd), 'Senior Full Stack Engineer');
});

test('extracts title with explicit "Position Title:" label', () => {
  const jd = `Position Title: Staff Platform Engineer\nLocation: Remote`;
  assert.strictEqual(extractJdPostedTitle(jd), 'Staff Platform Engineer');
});

test('extracts title with explicit "Role:" label', () => {
  const jd = `Role: Lead Backend Developer\nExperience: 7+ years`;
  assert.strictEqual(extractJdPostedTitle(jd), 'Lead Backend Developer');
});

test('extracts title from Markdown H1 with em-dash company separator', () => {
  const jd = `# Senior Software Engineer — Toyota Automated Logistics (Pune)\nOverview: ...`;
  assert.strictEqual(extractJdPostedTitle(jd), 'Senior Software Engineer');
});

test('extracts title from @ company separator line', () => {
  const jd = `Software Developer @ Interra Health\nLocation: Chicago, IL`;
  assert.strictEqual(extractJdPostedTitle(jd), 'Software Developer');
});

test('extracts title with pipe separator and trims trailing company/location', () => {
  const jd = `Title: Cloud Solutions Architect | TechCorp Global\nSalary: 150k`;
  assert.strictEqual(extractJdPostedTitle(jd), 'Cloud Solutions Architect');
});

test('cleans department hierarchy to keep senior role and specialty', () => {
  const jd = `Role: Technology & Transformation - Engineering - Senior Consultant - ETL Testing\nDeloitte is hiring...`;
  assert.strictEqual(extractJdPostedTitle(jd), 'Senior Consultant - ETL Testing');
});

test('strips trailing parentheses from title', () => {
  const jd = `# Senior Backend Engineer (Distributed Systems / Go)\nOverview:...`;
  assert.strictEqual(extractJdPostedTitle(jd), 'Senior Backend Engineer');
});

test('rejects prose lines like "Looking for a..." or "We are seeking..."', () => {
  const jd = `Looking for a Senior Backend Engineer to join our early team.\n- Python, Redis, AWS`;
  assert.strictEqual(extractJdPostedTitle(jd), '');
});

test('rejects URLs and headers that are not role titles', () => {
  const jd = `https://example.com/jobs/123\nAbout Us\nWe are a startup...`;
  assert.strictEqual(extractJdPostedTitle(jd), '');
});

test('handles empty or malformed inputs safely', () => {
  assert.strictEqual(extractJdPostedTitle(''), '');
  assert.strictEqual(extractJdPostedTitle(null), '');
  assert.strictEqual(extractJdPostedTitle(undefined), '');
});

// ============================================================================
// 3. inferRoleTitleFromJd Unit Tests
// ============================================================================
console.log('\n3. inferRoleTitleFromJd');

test('seniorizes clean posted title for experienced candidate (years >= 5)', () => {
  const jd = `Job Title: Software Developer\nExperience with Java and SQL`;
  assert.strictEqual(inferRoleTitleFromJd(jd, 7), 'Senior Software Developer');
});

test('preserves already senior/lead/staff posted title without double-seniorizing', () => {
  const jd = `Job Title: Senior Software Developer\nExperience with Java and SQL`;
  assert.strictEqual(inferRoleTitleFromJd(jd, 7), 'Senior Software Developer');
});

test('preserves Lead / Staff / Principal title from JD', () => {
  const jd = `Title: Lead Full-Stack Engineer\nBuilding web applications`;
  assert.strictEqual(inferRoleTitleFromJd(jd, 7), 'Lead Full-Stack Engineer');
});

test('extracts AWS Platform Engineer Principal cleanly', () => {
  const jd = `AWS Platform Engineer Principal\nRequirements: Kubernetes and Terraform`;
  assert.strictEqual(inferRoleTitleFromJd(jd, 8), 'AWS Platform Engineer Principal');
});

test('detects ETL testing role correctly', () => {
  const jd = `Senior Consultant - ETL Testing with Data Warehouse and SQL`;
  assert.strictEqual(inferRoleTitleFromJd(jd, 6), 'Senior Consultant - ETL Testing');
});

test('does not misname backend role mentioning scraping as Senior JavaScript Developer when full-stack is present', () => {
  const jd = `Title: Lead Full-Stack Engineer\nRequires web scraping with Puppeteer and React/Node full-stack`;
  assert.strictEqual(inferRoleTitleFromJd(jd, 7), 'Lead Full-Stack Engineer');
});

test('falls back gracefully to Senior Software Engineer when JD has no specific title', () => {
  assert.strictEqual(inferRoleTitleFromJd('Seeking an experienced engineer with good coding skills', 6), 'Senior Software Engineer');
  assert.strictEqual(inferRoleTitleFromJd('Seeking an experienced engineer with good coding skills', 0), 'Software Engineer');
});

// ============================================================================
// 4. classifyRoleFamily Unit Tests
// ============================================================================
console.log('\n4. classifyRoleFamily');

test('classifies pure data engineering / ETL role as data_etl', () => {
  const jd = `Senior Data Engineer with Databricks, PySpark, Snowflake, and ETL pipeline building.`;
  assert.strictEqual(classifyRoleFamily(jd), 'data_etl');
});

test('does NOT classify general backend role mentioning relational "data modeling" as data_etl', () => {
  const jd = `Senior Backend Engineer responsible for REST API design, data modeling in PostgreSQL, microservices, and Kafka.`;
  assert.strictEqual(classifyRoleFamily(jd), 'backend_platform');
});

test('classifies .NET + Azure posting as azure_dotnet', () => {
  const jd = `Software Developer with C#, .NET 8, and Azure Cloud Functions.`;
  assert.strictEqual(classifyRoleFamily(jd), 'azure_dotnet');
});

test('classifies Java microservices role with incidental frontend as backend_platform', () => {
  const jd = `Senior Software Engineer: Java, Spring Boot, microservices, Kafka, Docker. Front-end (Angular) advantageous.`;
  assert.strictEqual(classifyRoleFamily(jd), 'backend_platform');
});

test('classifies hybrid stack (React frontend + Java/Node backend) as fullstack', () => {
  const jd = `Full-featured web application development using React on frontend and Java / Spring Boot on backend.`;
  assert.strictEqual(classifyRoleFamily(jd), 'fullstack');
});

test('classifies web scraping specialist role as scraping_js', () => {
  const jd = `JavaScript Web Scraping Developer using Puppeteer, Cheerio, and Node.js proxy rotation.`;
  assert.strictEqual(classifyRoleFamily(jd), 'scraping_js');
});

test('classifies AI / LLM engineering role as ai_llm', () => {
  const jd = `AI Engineer developing RAG pipelines and LangChain agentic systems using LLM APIs.`;
  assert.strictEqual(classifyRoleFamily(jd), 'ai_llm');
});

test('classifies AWS platform / DevOps role as devops_sre', () => {
  const jd = `AWS Platform Engineer with Terraform, IAM, VPC, and Kubernetes cluster management.`;
  assert.strictEqual(classifyRoleFamily(jd), 'devops_sre');
});

// ============================================================================
// 5. keywordTokens & keywordCoveredInText Unit Tests
// ============================================================================
console.log('\n5. keywordTokens & keywordCoveredInText');

test('preserves critical 2-letter tokens (ci, cd, go, ai, db, os, s3)', () => {
  assert.deepStrictEqual(keywordTokens('CI/CD'), ['ci', 'cd']);
  assert.deepStrictEqual(keywordTokens('Go'), ['go']);
  assert.deepStrictEqual(keywordTokens('AI'), ['ai']);
  assert.deepStrictEqual(keywordTokens('AWS S3'), ['aws', 's3']);
});

test('drops 1-letter tokens except c and r', () => {
  assert.deepStrictEqual(keywordTokens('C++'), ['c++']);
  assert.deepStrictEqual(keywordTokens('C'), ['c']);
  assert.deepStrictEqual(keywordTokens('R language'), ['r', 'language']);
});

test('keywordCoveredInText matches multi-token phrases in text', () => {
  const text = 'Built automated CI/CD deployment pipelines using Jenkins and Docker.';
  assert.strictEqual(keywordCoveredInText(text, 'CI/CD'), true);
  assert.strictEqual(keywordCoveredInText(text, 'Docker'), true);
  assert.strictEqual(keywordCoveredInText(text, 'Kubernetes'), false);
});

// ============================================================================
// 6. keywordAppearsInJd Unit Tests
// ============================================================================
console.log('\n6. keywordAppearsInJd');

test('matches React.js when JD contains React and vice versa', () => {
  const jd = 'Modern web stack using React and TypeScript';
  assert.strictEqual(keywordAppearsInJd('React.js', jd), true);
  assert.strictEqual(keywordAppearsInJd('React', jd), true);
  assert.strictEqual(keywordAppearsInJd('react', jd), true);
});

test('matches Node.js when JD contains Node', () => {
  const jd = 'Backend microservices in Node and Express';
  assert.strictEqual(keywordAppearsInJd('Node.js', jd), true);
  assert.strictEqual(keywordAppearsInJd('NodeJS', jd), true);
});

test('matches PostgreSQL when JD contains Postgres', () => {
  const jd = 'Database schema design with Postgres and Redis';
  assert.strictEqual(keywordAppearsInJd('PostgreSQL', jd), true);
  assert.strictEqual(keywordAppearsInJd('Postgres', jd), true);
});

test('matches .NET and C# with exact boundary safety', () => {
  const jd = 'Building services in .NET Core and C#';
  assert.strictEqual(keywordAppearsInJd('.NET', jd), true);
  assert.strictEqual(keywordAppearsInJd('C#', jd), true);
  assert.strictEqual(keywordAppearsInJd('dotnet', jd), true);
  assert.strictEqual(keywordAppearsInJd('C++', jd), false);
});

test('matches CI/CD variations (continuous integration, ci/cd)', () => {
  assert.strictEqual(keywordAppearsInJd('CI/CD', 'Automate CI/CD pipelines'), true);
  assert.strictEqual(keywordAppearsInJd('CI/CD', 'Automate continuous integration pipelines'), true);
});

// ============================================================================
// 7. stripGapMention & Grammar Cleanup Unit Tests
// ============================================================================
console.log('\n7. stripGapMention & Grammar Cleanup');

test('cleans gap skill cleanly without leaving dangling prepositions before participles', () => {
  const raw = 'Engineered reusable UI components using React.js integrating custom frontend dashboards.';
  const cleaned = stripGapMention(raw, 'React.js');
  assert.strictEqual(cleaned.includes('using integrating'), false);
  assert.strictEqual(cleaned.includes('React.js'), false);
  assert.strictEqual(cleaned, 'Engineered reusable UI components integrating custom frontend dashboards.');
});

test('cleans gap skill without leaving double commas or trailing commas', () => {
  const raw = 'Shipped services using Python, FastAPI, and Docker to production.';
  const cleaned = stripGapMention(raw, 'FastAPI');
  assert.strictEqual(cleaned, 'Shipped services using Python and Docker to production.');
});

test('cleans .NET and C# gap skills cleanly without leaving ASP APIs fragments', () => {
  const raw = 'Designed cloud microservices using C# and .NET Core with REST APIs.';
  const cleaned = stripGapMention(raw, 'C#');
  assert.strictEqual(cleaned.includes('C#'), false);
});

console.log(`\n🎉 All ${passCount} unit tests passed successfully!`);
