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
  assert.ok(html.includes('akash@example.com'), 'email in contact line');
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

  const expHtml = renderExperienceHtml(sample.experience, 2);
  assert.ok(expHtml.includes('job-company'), 'experience markup');

  const skills = renderSkillsLines(sample.narrative?.superpowers);
  assert.ok(skills.includes('<ul class="skills-list">'), 'skills as bullet list');
  assert.ok(skills.includes('<li>TypeScript</li>'), 'skill as list item');
  assert.ok(!skills.includes('Core Competencies'), 'no Core Competencies label');

  assert.equal(calculateYearsOfExperience(sample.experience) >= 1, true);
  assert.ok(masterSummaryText(sample).includes('Senior engineer'));
  assert.ok(estimateMasterAtsScore(sample) >= 70);

  const empty = emptyResumeContext();
  const v = validateResumeDraft(empty);
  assert.equal(v.ok, false, 'empty draft fails validation');

  const good = validateResumeDraft(sample);
  assert.equal(good.ok, true, 'sample draft validates');

  console.log('fill-template tests passed');
}

run();
