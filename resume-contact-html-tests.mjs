#!/usr/bin/env node
/**
 * resume-contact-html-tests.mjs
 */
import assert from 'node:assert/strict';
import { renderContactBarHtml } from './resume-contact-html.mjs';

const html = renderContactBarHtml({
  full_name: 'Akash',
  location: 'Pune, India',
  email: 'akash@example.com',
  phone: '+91 8979594537',
  linkedin: 'linkedin.com/in/akashkaintura',
  github: 'github.com/UGilfoyle',
});

assert.match(html, /contact-bar/, 'renders contact bar');
assert.match(html, /contact-icon/, 'includes icons');
assert.match(html, /stroke="currentColor"/, 'outline stroke icons (B/W professional)');
assert.match(html, /fill="none"/, 'no filled colorful icons');
assert.match(html, /mailto:akash@example.com/, 'email mailto link');
assert.match(html, /tel:/, 'phone tel link');
assert.match(html, /linkedin\.com\/in\/akashkaintura/, 'linkedin link');
assert.match(html, /github\.com\/UGilfoyle/, 'github link');
assert.equal((html.match(/contact-item/g) || []).length, 5, 'five contact items');

console.log('resume-contact-html-tests: ok');
