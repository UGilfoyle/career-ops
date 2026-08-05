import assert from 'node:assert/strict';
import { resolvePlanForCountry, planSubtitle, COPILOT_FREE_LIMIT, COPILOT_FREE_WINDOW_MS } from './plans';
import { buildUpiPayUri, upiTransactionRef, qrCodeImageUrl } from './upi';
import { createProApproveToken, verifyProApproveToken } from './upi-approve-token';

process.env.AUTH_SECRET = process.env.AUTH_SECRET || 'unit-test-auth-secret';

function run() {
  const inPlan = resolvePlanForCountry('IN');
  assert.equal(inPlan.display, '₹99');
  assert.equal(inPlan.amountMinor, 9900);
  assert.ok(planSubtitle(inPlan).includes('₹99'));

  const us = resolvePlanForCountry('US');
  assert.equal(us.display, '$0.99');
  assert.equal(us.amountMinor, 99);
  assert.equal(resolvePlanForCountry('DE').display, '€0.89');
  assert.equal(resolvePlanForCountry('CA').display, 'C$1.39');
  assert.equal(resolvePlanForCountry('AU').display, 'A$1.49');
  assert.equal(resolvePlanForCountry('SG').display, 'S$1.29');
  assert.equal(resolvePlanForCountry('JP').display, '¥149');
  assert.equal(resolvePlanForCountry('AE').display, 'AED 3.69');
  assert.equal(COPILOT_FREE_LIMIT, 10);
  assert.equal(COPILOT_FREE_WINDOW_MS, 2 * 60 * 60 * 1000);

  const uri = buildUpiPayUri(
    { vpa: 'akashkaintura@icici', payeeName: 'Akash', amountInr: 99, note: 'Pro' },
    'CO1',
  );
  assert.ok(uri.startsWith('upi://pay?'));
  assert.ok(uri.includes('am=99.00'));
  assert.ok(upiTransactionRef(99).startsWith('CO'));
  assert.ok(qrCodeImageUrl(uri).includes('create-qr-code'));

  const tok = createProApproveToken('12');
  assert.equal(verifyProApproveToken('12', tok), true);
  assert.equal(verifyProApproveToken('13', tok), false);

  console.log('billing TS unit tests passed');
}

run();
