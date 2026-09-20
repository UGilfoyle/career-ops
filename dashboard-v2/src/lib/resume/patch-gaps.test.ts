import assert from 'node:assert/strict';
import { getCompetencies, setCompetencies, emptyResumeContext } from './types';

console.log('Testing Surgical Gap-Patching logic...');

// 1. Test empty profile competencies
const ctx = emptyResumeContext();
assert.deepEqual(getCompetencies(ctx), []);

// 2. Test setting competencies
const withSkills = setCompetencies(ctx, ['TypeScript', 'Node.js']);
assert.deepEqual(getCompetencies(withSkills), ['TypeScript', 'Node.js']);

// 3. Test surgical deduplication & weaving logic
const currentCompetencies = getCompetencies(withSkills);
const existingLower = new Set(currentCompetencies.map((k) => k.toLowerCase()));
const keywordsToPatch = ['typescript', 'Kafka', 'PostgreSQL', 'KAFKA'];

const newlyAdded: string[] = [];
for (const kw of keywordsToPatch) {
  if (!existingLower.has(kw.toLowerCase())) {
    newlyAdded.push(kw);
    existingLower.add(kw.toLowerCase());
  }
}

assert.deepEqual(newlyAdded, ['Kafka', 'PostgreSQL']);
const updated = setCompetencies(withSkills, [...currentCompetencies, ...newlyAdded]);
assert.deepEqual(getCompetencies(updated), ['TypeScript', 'Node.js', 'Kafka', 'PostgreSQL']);

console.log('✔ All Surgical Gap-Patching unit tests passed successfully!');
