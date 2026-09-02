#!/usr/bin/env node
/**
 * ==============================================================================
 * 🧪 MC/DC (Modified Condition / Decision Coverage) Test Suite
 *    for Career-Ops Resume Generation Engine
 * ==============================================================================
 *
 * Verifies that each independent condition in every compound boolean decision branch
 * can independently alter the outcome of that decision:
 *
 * Decision 1: isDotnetAzureJd(jdText)
 *   Decision: (C_net) && (C_cloud)
 *   - Vector 1.1 (C_dotnet): .NET toggles D1 (T vs F) with Cloud held fixed.
 *   - Vector 1.2 (C_csharp): C# toggles D1 (T vs F) with Cloud held fixed.
 *   - Vector 1.3 (C_azure): Azure keyword toggles D1 (T vs F) with Net held fixed.
 *   - Vector 1.4 (C_servicebus): Service Bus fallback toggles D1 (T vs F) when bare Azure is absent.
 *   - Vector 1.5 (C_azurefuncs): Azure Functions fallback toggles D1 (T vs F) when bare Azure is absent.
 *
 * Decision 2: classifyRoleFamily(jdText) -> data_etl
 *   Decision: (C_title) || (C_etlkw && !C_backendkw) || (C_modeling && C_warehouse)
 *   - Vector 2.1 (C_title): Data Engineer in title forces data_etl even if backend terms exist.
 *   - Vector 2.2 (C_etlkw): Databricks/Snowflake/ETL triggers data_etl in absence of backend terms.
 *   - Vector 2.3 (C_backendkw): Backend microservice terms block data_etl and redirect to backend_platform.
 *   - Vector 2.4 (C_modeling): Data modeling alone is backend_platform; data modeling + warehouse is data_etl.
 *
 * Decision 3: classifyRoleFamily(jdText) -> fullstack
 *   Decision: C_fullstack || (C_frontend && C_backend)
 *   - Vector 3.1 (C_fullstack): "full-stack" keyword independently triggers fullstack.
 *   - Vector 3.2 (C_frontend && C_backend): Frontend UI + Backend services co-occurrence triggers fullstack.
 *
 * Decision 4: keywordAppearsInJd(kw, jdText) -> Alias & Boundary Resolution
 *   - Vector 4.1 (React alias): React in JD satisfies React.js query.
 *   - Vector 4.2 (Postgres alias): Postgres in JD satisfies PostgreSQL query.
 *   - Vector 4.3 (CI/CD alias): Continuous integration in JD satisfies CI/CD query.
 *   - Vector 4.4 (.NET Boundary): .NET matches valid token and rejects "internet".
 *   - Vector 4.5 (C# Boundary): C# matches with trailing punctuation and rejects C++.
 *
 * Decision 5: extractJdPostedTitle(jdText) -> Specialty vs Company Separator
 *   - Vector 5.1 (Specialty hyphen): Role specialty after hyphen keeps compound title; company name truncates.
 *   - Vector 5.2 (Prose filter): "Looking for a..." prose heading is rejected; pure title is accepted.
 * ==============================================================================
 */

import assert from 'node:assert';
import {
  isDotnetAzureJd,
  extractJdPostedTitle,
} from './jd-profile-match.mjs';
import {
  classifyRoleFamily,
} from './resume-tailoring-plan.mjs';
import {
  keywordAppearsInJd,
} from './jd-keyword-align.mjs';

console.log('═══════════════════════════════════════════════════════════');
console.log('  🔬 MC/DC (Modified Condition / Decision Coverage) Suite');
console.log('═══════════════════════════════════════════════════════════\n');

let mcdcPassCount = 0;
function assertMcdc(vectorId, description, actual, expected) {
  assert.strictEqual(actual, expected, `[${vectorId}] FAILED: ${description}`);
  console.log(`  ✅ [${vectorId}] ${description}`);
  mcdcPassCount++;
}

// ============================================================================
// DECISION 1: isDotnetAzureJd(jdText)
// Decision: (C_net) && (C_cloud)
// ============================================================================
console.log('🔹 DECISION 1: isDotnetAzureJd Independence Testing');

// Vector 1.1: C_dotnet independence (Cloud=T, other net=F)
{
  const resA = isDotnetAzureJd('Experience with .NET in cloud Azure infrastructure.');
  const resB = isDotnetAzureJd('Experience with Python in cloud Azure infrastructure.');
  assertMcdc('Vector 1.1A', 'C_dotnet=T, C_cloud=T -> Outcome: TRUE', resA, true);
  assertMcdc('Vector 1.1B', 'C_dotnet=F, C_cloud=T -> Outcome: FALSE', resB, false);
}

// Vector 1.2: C_csharp independence (Cloud=T, other net=F)
{
  const resA = isDotnetAzureJd('Experience with C# in cloud Azure infrastructure.');
  const resB = isDotnetAzureJd('Experience with Go in cloud Azure infrastructure.');
  assertMcdc('Vector 1.2A', 'C_csharp=T, C_cloud=T -> Outcome: TRUE', resA, true);
  assertMcdc('Vector 1.2B', 'C_csharp=F, C_cloud=T -> Outcome: FALSE', resB, false);
}

// Vector 1.3: C_azure independence (Net=T, other cloud=F)
{
  const resA = isDotnetAzureJd('Experience with .NET in cloud Azure infrastructure.');
  const resB = isDotnetAzureJd('Experience with .NET in cloud AWS infrastructure.');
  assertMcdc('Vector 1.3A', 'C_net=T, C_azure=T -> Outcome: TRUE', resA, true);
  assertMcdc('Vector 1.3B', 'C_net=T, C_azure=F -> Outcome: FALSE', resB, false);
}

// Vector 1.4: C_servicebus fallback independence (bare Azure=F)
{
  const resA = isDotnetAzureJd('C# microservices with Service Bus messaging.');
  const resB = isDotnetAzureJd('C# microservices with RabbitMQ messaging.');
  assertMcdc('Vector 1.4A', 'C_net=T, C_azure=F, C_servicebus=T -> Outcome: TRUE', resA, true);
  assertMcdc('Vector 1.4B', 'C_net=T, C_azure=F, C_servicebus=F -> Outcome: FALSE', resB, false);
}

// Vector 1.5: C_azurefuncs fallback independence (bare Azure=F)
{
  const resA = isDotnetAzureJd('.NET microservices deployed on Azure Functions.');
  const resB = isDotnetAzureJd('.NET microservices deployed on AWS Lambda.');
  assertMcdc('Vector 1.5A', 'C_net=T, C_azure=F, C_azurefuncs=T -> Outcome: TRUE', resA, true);
  assertMcdc('Vector 1.5B', 'C_net=T, C_azure=F, C_azurefuncs=F -> Outcome: FALSE', resB, false);
}

// ============================================================================
// DECISION 2: classifyRoleFamily(jdText) -> data_etl Branch
// Decision: (C_title) || (C_etlkw && !C_backendkw) || (C_modeling && C_warehouse)
// ============================================================================
console.log('\n🔹 DECISION 2: classifyRoleFamily [data_etl] Independence Testing');

// Vector 2.1: C_title independence (forces data_etl even if backend terms are present)
{
  const resA = classifyRoleFamily('Role: Senior Data Engineer. Working on backend microservices and APIs.');
  const resB = classifyRoleFamily('Role: Senior Software Engineer. Working on backend microservices and APIs.');
  assertMcdc('Vector 2.1A', 'C_title=T, C_backend=T -> Outcome: data_etl', resA, 'data_etl');
  assertMcdc('Vector 2.1B', 'C_title=F, C_backend=T -> Outcome: backend_platform', resB, 'backend_platform');
}

// Vector 2.2: C_etlkw independence in absence of backend keywords
{
  const resA = classifyRoleFamily('Building Databricks PySpark pipelines for analytics.');
  const resB = classifyRoleFamily('Building generic software systems for analytics.');
  assertMcdc('Vector 2.2A', 'C_etlkw=T, C_backendkw=F -> Outcome: data_etl', resA, 'data_etl');
  assertMcdc('Vector 2.2B', 'C_etlkw=F, C_backendkw=F -> Outcome: unknown', resB, 'unknown');
}

// Vector 2.3: C_backendkw blocks data_etl when based solely on ETL stack keywords
{
  const resA = classifyRoleFamily('ETL pipelines using SQL and data processing tools.');
  const resB = classifyRoleFamily('ETL pipelines using SQL, REST APIs, and backend microservices.');
  assertMcdc('Vector 2.3A', 'C_etlkw=T, C_backendkw=F -> Outcome: data_etl', resA, 'data_etl');
  assertMcdc('Vector 2.3B', 'C_etlkw=T, C_backendkw=T -> Outcome: backend_platform', resB, 'backend_platform');
}

// Vector 2.4: C_modeling requires C_warehouse to trigger data_etl
{
  const resA = classifyRoleFamily('Relational data modeling for data warehouse architecture.');
  const resB = classifyRoleFamily('Relational data modeling for backend microservices architecture.');
  assertMcdc('Vector 2.4A', 'C_modeling=T, C_warehouse=T -> Outcome: data_etl', resA, 'data_etl');
  assertMcdc('Vector 2.4B', 'C_modeling=T, C_warehouse=F -> Outcome: backend_platform', resB, 'backend_platform');
}

// ============================================================================
// DECISION 3: classifyRoleFamily(jdText) -> fullstack Branch
// Decision: C_fullstack || (C_frontend && C_backend)
// ============================================================================
console.log('\n🔹 DECISION 3: classifyRoleFamily [fullstack] Independence Testing');

// Vector 3.1: C_fullstack keyword independence
{
  const resA = classifyRoleFamily('Hiring a Full-Stack Engineer to build web products.');
  const resB = classifyRoleFamily('Hiring an Engineer to build web products.');
  assertMcdc('Vector 3.1A', 'C_fullstack=T -> Outcome: fullstack', resA, 'fullstack');
  assertMcdc('Vector 3.1B', 'C_fullstack=F -> Outcome: unknown', resB, 'unknown');
}

// Vector 3.2: Conjunction of C_frontend AND C_backend
{
  const resA = classifyRoleFamily('Developing frontend components and backend services.');
  const resB = classifyRoleFamily('Developing frontend components and UI design systems.');
  const resC = classifyRoleFamily('Developing backend services and distributed databases.');
  assertMcdc('Vector 3.2A', 'C_frontend=T, C_backend=T -> Outcome: fullstack', resA, 'fullstack');
  assertMcdc('Vector 3.2B', 'C_frontend=T, C_backend=F -> Outcome: frontend', resB, 'frontend');
  assertMcdc('Vector 3.2C', 'C_frontend=F, C_backend=T -> Outcome: backend_platform', resC, 'backend_platform');
}

// ============================================================================
// DECISION 4: keywordAppearsInJd(kw, jdText) -> Alias & Boundary Testing
// ============================================================================
console.log('\n🔹 DECISION 4: keywordAppearsInJd Independence Testing');

// Vector 4.1: React alias resolution
{
  const resA = keywordAppearsInJd('React.js', 'Building interactive interfaces with React and Redux.');
  const resB = keywordAppearsInJd('React.js', 'Building interactive interfaces with Angular and RxJS.');
  assertMcdc('Vector 4.1A', 'kw=React.js, jd=React -> Outcome: TRUE', resA, true);
  assertMcdc('Vector 4.1B', 'kw=React.js, jd=Angular -> Outcome: FALSE', resB, false);
}

// Vector 4.2: PostgreSQL alias resolution
{
  const resA = keywordAppearsInJd('PostgreSQL', 'Query optimization in Postgres databases.');
  const resB = keywordAppearsInJd('PostgreSQL', 'Query optimization in SQLite databases.');
  assertMcdc('Vector 4.2A', 'kw=PostgreSQL, jd=Postgres -> Outcome: TRUE', resA, true);
  assertMcdc('Vector 4.2B', 'kw=PostgreSQL, jd=SQLite -> Outcome: FALSE', resB, false);
}

// Vector 4.3: CI/CD alias resolution
{
  const resA = keywordAppearsInJd('CI/CD', 'Automating continuous integration and deployment pipelines.');
  const resB = keywordAppearsInJd('CI/CD', 'Performing manual deployments and code reviews.');
  assertMcdc('Vector 4.3A', 'kw=CI/CD, jd=continuous integration -> Outcome: TRUE', resA, true);
  assertMcdc('Vector 4.3B', 'kw=CI/CD, jd=manual deployments -> Outcome: FALSE', resB, false);
}

// Vector 4.4: .NET word boundary independence
{
  const resA = keywordAppearsInJd('.NET', 'Enterprise backend services built on .NET Core.');
  const resB = keywordAppearsInJd('.NET', 'Enterprise backend services with high-speed internet connection.');
  assertMcdc('Vector 4.4A', 'kw=.NET, jd=.NET -> Outcome: TRUE', resA, true);
  assertMcdc('Vector 4.4B', 'kw=.NET, jd=internet -> Outcome: FALSE', resB, false);
}

// Vector 4.5: C# boundary independence
{
  const resA = keywordAppearsInJd('C#', 'Proficient in C#, Java, and Go.');
  const resB = keywordAppearsInJd('C#', 'Proficient in C++, Java, and Go.');
  assertMcdc('Vector 4.5A', 'kw=C#, jd=C# -> Outcome: TRUE', resA, true);
  assertMcdc('Vector 4.5B', 'kw=C#, jd=C++ -> Outcome: FALSE', resB, false);
}

// ============================================================================
// DECISION 5: extractJdPostedTitle(jdText) -> Specialty vs Company Separator
// ============================================================================
console.log('\n🔹 DECISION 5: extractJdPostedTitle Independence Testing');

// Vector 5.1: Specialty hyphen vs company hyphen
{
  const resA = extractJdPostedTitle('# Senior Consultant - ETL Testing\nDeloitte');
  const resB = extractJdPostedTitle('# Senior Consultant - Deloitte\nOverview');
  assertMcdc('Vector 5.1A', 'splitMatch[2]=role -> Outcome: Senior Consultant - ETL Testing', resA, 'Senior Consultant - ETL Testing');
  assertMcdc('Vector 5.1B', 'splitMatch[2]=company -> Outcome: Senior Consultant', resB, 'Senior Consultant');
}

// Vector 5.2: Recruiting prose filter independence
{
  const resA = extractJdPostedTitle('Senior Software Engineer\nRequirements: 5+ years');
  const resB = extractJdPostedTitle('Looking for a Senior Software Engineer\nRequirements: 5+ years');
  assertMcdc('Vector 5.2A', 'Heading=role title -> Outcome: Senior Software Engineer', resA, 'Senior Software Engineer');
  assertMcdc('Vector 5.2B', 'Heading=looking for prose -> Outcome: "" (rejected)', resB, '');
}

console.log('\n═══════════════════════════════════════════════════════════');
console.log(`🏆 MC/DC SUMMARY: All ${mcdcPassCount} formal condition pairs passed with 100% independence!`);
console.log('═══════════════════════════════════════════════════════════');
