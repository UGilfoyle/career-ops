import assert from 'node:assert/strict';
import {
  parseCandidate,
  parseExperience,
  parseResumeText,
} from './parse-resume-text';

const cvLike = `# Akash Kaintura

**Senior Software Engineer**
Pune, India | akash.k96.official@gmail.com | +91 8979594537
linkedin.com/in/akashkaintura | github.com/UGilfoyle

## Professional Summary

Senior Software Engineer specializing in scalable backends.

## PROFESSIONAL EXPERIENCE

### Senior Software Engineer
**Quest Global Engineering Services** | Jul 2025 – Present

- Architecture: Architect mission-critical enterprise features utilizing Python and Node.js.
- AWS Cluster Optimization: Spearhead comprehensive AWS cluster optimization initiatives.

### Full-Stack Developer
**KOCO Schools** | Oct 2021 – Jul 2022

- Backend Architecture: Authored the complete backend architecture for a multi-tenant platform.

### Software Developer
**Rubico IT Pvt Ltd** | Sep 2019 – Sep 2021

- Core Infrastructure: Developed comprehensive backend web systems spanning from MongoDB schema design.
- AWS Deployments: Provisioned fundamental Amazon Web Services infrastructure (EC2, S3).

### Associate Developer
**Artisanssoft** | Feb 2019 – Jul 2019

- API & Integrations: Developed and deployed backend endpoints using Node.js/Express.

## EDUCATION

**Master of Computer Applications (MCA)** (2016 – 2018) | Uttaranchal University
**Bachelor of Computer Applications (BCA)** (2013 – 2016) | Uttaranchal University
`;

function run() {
  const parsed = parseResumeText(cvLike);

  assert.equal(parsed.candidate.full_name, 'Akash Kaintura');
  assert.equal(parsed.candidate.email, 'akash.k96.official@gmail.com');
  assert.match(String(parsed.candidate.linkedin || ''), /linkedin\.com\/in\/akashkaintura/i);
  assert.match(String(parsed.candidate.github || ''), /github\.com\/UGilfoyle/i);

  const companies = parsed.experience.map((j) => j.company);
  assert.ok(companies.some((c) => /Rubico/i.test(c)), `expected Rubico in ${JSON.stringify(companies)}`);
  assert.ok(companies.some((c) => /Quest Global/i.test(c)), 'expected Quest Global');
  assert.ok(companies.some((c) => /KOCO/i.test(c)), 'expected KOCO');
  assert.ok(companies.some((c) => /Artisanssoft/i.test(c)), 'expected Artisanssoft');
  assert.ok(parsed.experience.length >= 4, `expected >=4 jobs, got ${parsed.experience.length}`);

  const rubico = parsed.experience.find((j) => /Rubico/i.test(j.company));
  assert.ok(rubico);
  assert.match(rubico!.role, /Software Developer/i);
  assert.match(rubico!.period, /2019/);
  assert.ok(rubico!.bullets.length >= 1);

  assert.ok(parsed.education.length >= 1);
  assert.match(parsed.education[0].degree, /MCA|Master/i);

  // Plain two-line PDF-ish text (no markdown)
  const plainExp = parseExperience(`Software Developer
Rubico IT Pvt Ltd | Sep 2019 – Sep 2021
Developed comprehensive backend web systems spanning MongoDB schema design to REST APIs.
Provisioned fundamental Amazon Web Services infrastructure on EC2 and S3.

Associate Developer
Artisanssoft | Feb 2019 – Jul 2019
Developed and deployed backend endpoints using Node.js and Express with payment gateways.`);

  assert.equal(plainExp.length, 2);
  assert.match(plainExp[0].company, /Rubico/i);
  assert.match(plainExp[0].role, /Software Developer/i);
  assert.match(plainExp[1].company, /Artisanssoft/i);

  const nameOnly = parseCandidate('Jane Q Public\nEngineer\njane@example.com');
  assert.equal(nameOnly.full_name, 'Jane Q Public');
  assert.equal(nameOnly.email, 'jane@example.com');

  console.log('parse-resume-text tests: all passed');
}

run();
