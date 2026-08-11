import assert from 'node:assert/strict';
import {
  PRACTICE_FREE_LIMIT,
  PRACTICE_FREE_WINDOW_MS,
  planSubtitle,
  resolvePlanForCountry,
} from '../billing/plans';
import { evaluatePracticeQuota } from './quota-math';
import { buildOfflinePracticePack, hashJdText } from './generate-pack';
import { assessJdPracticeFit } from './jd-keywords';
import { validatePracticePackJson } from './schema';
import { coercePracticePack, isLowFitFunctionalJd } from './validate-pack';
import { ONLINECOMPILER_COMPILER, runWithOnlineCompiler } from './runner/onlinecompiler';
import {
  resolvePracticeRunnerProvider,
  validatePracticeRunInput,
} from './runner';

async function run() {
  assert.equal(PRACTICE_FREE_LIMIT, 1);
  assert.equal(PRACTICE_FREE_WINDOW_MS, 7 * 24 * 60 * 60 * 1000);
  assert.ok(planSubtitle(resolvePlanForCountry('US')).includes('Interview Practice'));

  const pro = evaluatePracticeQuota({
    pro: true,
    packsInWindow: 99,
    oldestPackAt: new Date(),
  });
  assert.equal(pro.allowed, true);
  assert.equal(pro.remaining, -1);
  assert.equal(pro.pro, true);

  const freeOk = evaluatePracticeQuota({
    pro: false,
    packsInWindow: 0,
    oldestPackAt: null,
  });
  assert.equal(freeOk.allowed, true);
  assert.equal(freeOk.remaining, 1);

  const oldest = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  const freeBlocked = evaluatePracticeQuota({
    pro: false,
    packsInWindow: 1,
    oldestPackAt: oldest,
  });
  assert.equal(freeBlocked.allowed, false);
  assert.equal(freeBlocked.remaining, 0);
  assert.ok(freeBlocked.resetAt);

  const rolled = evaluatePracticeQuota({
    pro: false,
    packsInWindow: 1,
    oldestPackAt: new Date(Date.now() - PRACTICE_FREE_WINDOW_MS - 1000),
  });
  assert.equal(rolled.allowed, true);
  assert.equal(rolled.remaining, PRACTICE_FREE_LIMIT);

  const keywords = ['Node.js', 'TypeScript', 'AWS', 'PostgreSQL', 'Kafka'];
  const pack = buildOfflinePracticePack({
    company: 'Acme',
    role: 'Senior Backend Engineer',
    keywords,
    fit: assessJdPracticeFit('Build APIs with Node.js TypeScript AWS Kafka', keywords),
  });
  const validated = validatePracticePackJson(pack);
  assert.equal(validated.ok, true, validated.errors?.join('; '));
  assert.ok((validated.data?.coding.length || 0) >= 5);
  assert.ok((validated.data?.systemDesign.length || 0) >= 3);
  assert.ok((validated.data?.behavioral.length || 0) >= 4);

  const bad = validatePracticePackJson({ coding: [], systemDesign: [], behavioral: [] });
  assert.equal(bad.ok, false);

  const hcm = assessJdPracticeFit(
    'Oracle HCM Functional Engineer BIP Alert Composer Journeys DFF EFF',
    ['Oracle', 'Agile'],
  );
  assert.equal(hcm.tier, 'low');
  assert.ok(/general backend/i.test(hcm.note));

  assert.equal(
    isLowFitFunctionalJd('Oracle HCM Cloud BIP Alert Composer functional consultant'),
    true,
  );
  assert.equal(
    isLowFitFunctionalJd('Senior Backend Engineer Node.js TypeScript AWS microservices'),
    false,
  );

  const coerced = coercePracticePack({
    company: 'X',
    role: 'Y',
    keywords: ['Node.js'],
    coding: pack.coding.map((c, i) =>
      i === 0 ? { ...c, difficulty: 'Medium' } : c,
    ),
    systemDesign: pack.systemDesign,
    behavioral: pack.behavioral,
    fit: { tier: 'strong', note: 'ok' },
  });
  assert.ok(coerced);
  assert.ok(coerced.coding.length >= 5);
  assert.equal(coerced.coding[0].difficulty, 'medium');

  assert.equal(hashJdText('abc').length, 32);
  assert.equal(hashJdText('abc'), hashJdText('abc'));
  assert.notEqual(hashJdText('abc'), hashJdText('abcd'));

  assert.equal(resolvePracticeRunnerProvider('onlinecompiler'), 'onlinecompiler');
  assert.equal(resolvePracticeRunnerProvider('piston'), 'piston');
  assert.equal(resolvePracticeRunnerProvider(''), 'onlinecompiler');
  assert.equal(ONLINECOMPILER_COMPILER.python, 'python-3.14');
  assert.equal(ONLINECOMPILER_COMPILER.javascript, 'typescript-deno');

  const badLang = validatePracticeRunInput({ language: 'nodejs', code: 'x' });
  assert.equal(badLang.ok, false);
  const emptyCode = validatePracticeRunInput({ language: 'python', code: '  ' });
  assert.equal(emptyCode.ok, false);
  const goodRun = validatePracticeRunInput({
    language: 'python',
    code: 'print(1)',
    stdin: 'a',
  });
  assert.equal(goodRun.ok, true);

  // unit-test OnlineCompiler client without network
  const mis = await runWithOnlineCompiler(
    { language: 'python', code: 'print(1)' },
    { apiKey: '', fetchImpl: async () => new Response('nope') },
  );
  assert.equal(mis.status, 'misconfigured');

  const ok = await runWithOnlineCompiler(
    { language: 'python', code: 'print(1)' },
    {
      apiKey: 'test-key',
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            output: '1\n',
            error: '',
            status: 'success',
            exit_code: 0,
            time: '0.01',
            memory: '1000',
          }),
          { status: 200 },
        ),
    },
  );
  assert.equal(ok.ok, true);
  assert.equal(ok.stdout, '1\n');
  assert.equal(ok.provider, 'onlinecompiler');

  console.log('practice tests passed');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
