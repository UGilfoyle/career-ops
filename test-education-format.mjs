#!/usr/bin/env node
import { formatEducationLine } from './education-format.mjs';
import { hydrateResumeProfile } from './profile-hydrate.mjs';

const corrupted = {
  degree: 'Master of Computer Applications (MCA)',
  school: 'Uttaranchal University 2016 (2016, 2018)',
  period: '2016 – 2018',
};

const line = formatEducationLine(corrupted);
const expected = 'Master of Computer Applications (MCA), Uttaranchal University (2016 – 2018)';

if (line !== expected) {
  console.error('FAIL education format');
  console.error(' got:', line);
  console.error('want:', expected);
  process.exit(1);
}

const bca = formatEducationLine({
  degree: 'Bachelor of Computer Applications (BCA)',
  school: 'Uttaranchal University 2013 (2013, 2016)',
  period: '2013 – 2016',
});

if (!bca.includes('(2013 – 2016)') || bca.includes('2013 – 2013')) {
  console.error('FAIL BCA format:', bca);
  process.exit(1);
}

const { educationRepaired } = hydrateResumeProfile({
  experience: [{ role: 'x', company: 'y', period: 'Jan 2020 - Present', bullets: ['did stuff'] }],
  education: [corrupted, {
    degree: 'Bachelor of Computer Applications (BCA)',
    school: 'Uttaranchal University 2013 (2013, 2016)',
    period: '2013 – 2016',
  }],
});

if (!educationRepaired) {
  console.error('FAIL: educationRepaired should be true for corrupted input');
  process.exit(1);
}

console.log('OK: education formatting');
console.log(' ', line);
console.log(' ', bca);
