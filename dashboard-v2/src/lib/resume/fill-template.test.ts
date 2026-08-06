import assert from 'node:assert/strict';
import {
  calculateYearsOfExperience,
  estimateMasterAtsScore,
  fillAtsTemplate,
  masterSummaryText,
  renderExperienceHtml,
  renderSkillsLines,
} from './fill-template';
import { validateResumeDraft } from './schema';
import { emptyResumeContext, type ResumeContext } from './types';

const sample: ResumeContext = {
  ...emptyResumeContext(),
  candidate: {
    full_name: 'Akash Kaintura',
    email: 'akash@example.com',
    phone: '+91 99999 99999',
    location: 'Bengaluru, IN',
    linkedin: 'linkedin.com/in/akash',
    github: 'github.com/akash',
  },
  narrative: {
    headline: 'Senior engineer building reliable platforms.',
    exit_story: 'Owns APIs, data pipelines, and incident response.',
    superpowers: ['TypeScript', 'PostgreSQL', 'AWS'],
    proof_points: [{ name: 'Latency', hero_metric: 'Cut p99 by 40%' }],
  },
  experience: [
    {
      role: 'Senior Software Engineer',
      company: 'Example Corp',
      period: 'Jan 2022 – Present',
      bullets: ['Shipped multi-tenant SaaS APIs', 'Led on-call rotations'],
    },
  ],
  education: [{ degree: 'B.Tech', school: 'Example University', period: '2018' }],
};

function run() {
  const html = fillAtsTemplate(sample);
  assert.ok(html.includes('Akash Kaintura'), 'name rendered');
  assert.ok(html.includes('Bengaluru'), 'location in contact line');
  assert.ok(html.includes('akash@example.com'), 'email in contact bar');
  assert.ok(html.includes('contact-bar'), 'icon contact bar rendered');
  assert.ok(html.includes('contact-icon'), 'contact icons present');
  assert.ok(html.includes('linkedin.com/in/akash'), 'linkedin in contact bar');
  assert.ok(!html.includes(' ·  · '), 'no empty contact separators');
  assert.ok(html.includes('Example Corp'), 'company rendered');
  assert.ok(html.includes('TypeScript'), 'skills rendered');
  assert.ok(html.includes('Professional Summary'), 'summary section');
  assert.ok(!html.includes('{{NAME}}'), 'no leftover NAME placeholder');
  assert.ok(!html.includes('{{EXPERIENCE}}'), 'no leftover EXPERIENCE placeholder');
  assert.ok(!html.includes('{{CONTACT_LINE}}'), 'contact line filled');

  const emptyContact: ResumeContext = {
    ...emptyResumeContext(),
    candidate: { full_name: 'Only Name' },
  };
  const emptyContactHtml = fillAtsTemplate(emptyContact);
  assert.ok(!emptyContactHtml.includes('LinkedIn'), 'no LinkedIn placeholder when empty');
  assert.ok(!emptyContactHtml.includes(' · '), 'no stray separators when contact empty');

  const expHtml = renderExperienceHtml(
    [
      {
        role: 'Full-Stack Developer',
        company: 'KOCO Schools',
        period: 'Oct 2021 – Jul 2022',
        bullets: [
          'Authored backend architecture for multi-tenant platform.',
          'Rubico IT Pvt Ltd - Software Developer Sep 2019 - Sep 2021',
        ],
      },
    ],
    2
  );
  assert.ok(!expHtml.includes('Rubico IT Pvt Ltd - Software Developer'), 'nested job header stripped from experience HTML');
  assert.ok(expHtml.includes('KOCO Schools'), 'KOCO job still rendered');

  const expHtml2 = renderExperienceHtml(sample.experience, 2);
  assert.ok(expHtml2.includes('job-company'), 'experience markup');

  const skills = renderSkillsLines([
    'Monolith-to-microservices transition',
    'PostgreSQL',
    'microservices',
    'Java',
  ]);
  assert.ok(skills.includes('PostgreSQL'), 'PostgreSQL in skills');
  assert.ok(!skills.includes('Monolith-to-microservices'), 'narrative superpower excluded');
  assert.ok(!skills.includes('monolith'), 'no raw monolith phrase');
  assert.ok(skills.includes('Microservices') || skills.includes('microservices'), 'microservices present');

  const htmlOrder = fillAtsTemplate(sample);
  const summaryIdx = htmlOrder.indexOf('Professional Summary');
  const expIdx = htmlOrder.indexOf('Professional Experience');
  const eduIdx = htmlOrder.indexOf('Education');
  const skillsIdx = htmlOrder.indexOf('Technical Skills');
  assert.ok(summaryIdx < expIdx && expIdx < eduIdx && eduIdx < skillsIdx, 'Technical Skills section is last');

  assert.equal(calculateYearsOfExperience(sample.experience) >= 1, true);
  assert.ok(masterSummaryText(sample).includes('Senior engineer'));
  assert.ok(estimateMasterAtsScore(sample) >= 70);

  // Long summary must not be mid-word truncated with ellipsis
  const longSummary: ResumeContext = {
    ...sample,
    narrative: {
      ...sample.narrative,
      headline:
        'Senior Full-Stack Engineer with 7+ years owning production backends, cloud platforms, and API systems including React, CI/CD, Agile, microservices, Docker, Kubernetes, and Node.js across enterprise SaaS products.',
      exit_story:
        'Lead LLM-backed features and AI-assisted delivery with focus on reliability, observability, and incident response.',
    },
  };
  const longHtml = fillAtsTemplate(longSummary);
  assert.ok(!longHtml.includes('microservi…'), 'no mid-word ellipsis in summary');
  assert.ok(longHtml.includes('microservices'), 'full microservices word kept');
  assert.ok(longHtml.includes('Kubernetes') || longHtml.includes('Node.js'), 'summary keeps later keywords');

  const empty = emptyResumeContext();
  const v = validateResumeDraft(empty);
  assert.equal(v.ok, false, 'empty draft fails validation');

  const good = validateResumeDraft(sample);
  assert.equal(good.ok, true, 'sample draft validates');

  console.log('fill-template tests passed');
}

run();
