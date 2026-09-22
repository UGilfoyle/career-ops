import assert from 'node:assert/strict';
import { parseTailoredResumeHtml } from './parse-tailored-html';

const html = `<!DOCTYPE html><html><body>
<h1>Akash Kaintura</h1>
<p class="summary-block">Senior Backend Engineer with 7+ years owning production Python services.
Design and ship Python backend services with Django and Flask.</p>
<div class="section-title">Technical Skills</div>
<div class="skill-line"><span class="skill-label">Languages:</span> Python, SQL</div>
<div class="section-title">Professional Experience</div>
<div class="job">
  <div class="job-header">
    <div><span class="job-company">Quest Global Engineering Services</span> - <span class="job-title">Senior Software Engineer</span></div>
    <div class="job-dates">Jul 2025 - Present</div>
  </div>
  <ul><li>Architected event-driven microservices for industrial telemetry.</li></ul>
</div>
<div class="job">
  <div class="job-header">
    <div><span class="job-company">INTVERSE IT Services</span> - <span class="job-title">Senior Full-Stack Developer</span></div>
    <div class="job-dates">Feb 2025 - Jun 2025</div>
  </div>
  <ul><li>Engineered a document ingestion pipeline using Python and ChromaDB.</li></ul>
</div>
<div class="section-title">Education</div>
<div>Master of Computer Applications (MCA), STEM, Uttaranchal University (2016 - 2018)</div>
</body></html>`;

const parsed = parseTailoredResumeHtml(html, {
  candidate: { full_name: 'Other', email: 'akash@example.com' },
  narrative: { headline: 'Master headline', exit_story: 'Master story' },
  experience: [{ company: 'Other Co', role: 'Other', bullets: ['Master bullet that must not win.'] }],
  education: [],
});

assert.ok(parsed);
assert.equal(parsed!.candidate?.email, 'akash@example.com');
assert.equal(parsed!.candidate?.full_name, 'Akash Kaintura');
assert.match(parsed!.narrative?.headline || '', /Python services/);
assert.match(parsed!.narrative?.exit_story || '', /Django and Flask/);
assert.equal(parsed!.experience?.length, 2);
assert.equal(parsed!.experience?.[0]?.company, 'Quest Global Engineering Services');
assert.match(parsed!.experience?.[0]?.bullets?.[0] || '', /telemetry/);
assert.match(parsed!.experience?.[1]?.bullets?.[0] || '', /ChromaDB/);
assert.equal(parsed!.narrative?.superpowers?.[0], 'Python');
assert.match(parsed!.education?.[0]?.school || '', /Uttaranchal/);
assert.equal(parseTailoredResumeHtml('<p>no jobs</p>'), null);

console.log('parse-tailored-html tests passed');
