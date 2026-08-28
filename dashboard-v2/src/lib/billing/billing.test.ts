import assert from 'node:assert/strict';
import { resolvePlanForCountry, planSubtitle, COPILOT_FREE_LIMIT, COPILOT_FREE_WINDOW_MS } from './plans';
import { buildUpiPayUri, upiTransactionRef, qrCodeImageUrl, maskVpa } from './upi';
import { stripeBillingEnabled, shouldUseUpiCheckout } from './provider';
import { createProApproveToken, UPI_APPROVE_TTL_MS, verifyProApproveToken } from './upi-approve-token';
import { blocksNewPayment, decideClaimSubmission, normalizeUtr } from './claims';
import {
  canAccessPracticeBeta,
  isLifetimeProEmail,
  isLifetimeProGithub,
} from '@/lib/lifetime-access';

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
  assert.ok(planSubtitle(inPlan).includes('Interview Practice'));
  assert.ok(planSubtitle(us).includes('Resume Studio'));


  const uri = buildUpiPayUri(
    { vpa: 'testpayee@examplebank', payeeName: 'Test', amountInr: 99, note: 'Pro' },
    'CO1',
  );
  assert.ok(uri.startsWith('upi://pay?'));
  assert.ok(uri.includes('am=99.00'));
  assert.ok(upiTransactionRef(99).startsWith('CO'));
  assert.ok(qrCodeImageUrl(uri).includes('create-qr-code'));

  // The QR/deep link must still carry the real VPA; only the display is masked.
  assert.ok(uri.includes('testpayee'));
  const masked = maskVpa('testpayee@examplebank');
  assert.ok(!masked.includes('testpayee'));
  assert.ok(masked.endsWith('@examplebank'));
  assert.equal(maskVpa(''), '••••');

  const now = 1_700_000_000_000;
  const tok = createProApproveToken('12', now);
  assert.equal(verifyProApproveToken('12', tok, now), true);
  assert.equal(verifyProApproveToken('13', tok, now), false);
  assert.equal(verifyProApproveToken('12', tok, now + UPI_APPROVE_TTL_MS + 1), false);
  assert.equal(verifyProApproveToken('12', 'deadbeefdeadbeefdeadbeef', now), false);
  const tampered = tok.replace(/^\d+/, String(now + UPI_APPROVE_TTL_MS * 10));
  assert.equal(verifyProApproveToken('12', tampered, now), false);

  assert.equal(normalizeUtr(' ab cd 1234 '), 'ABCD1234');
  assert.equal(
    decideClaimSubmission({ userId: '5', hasPro: true, utr: '123456789012' }).action,
    'already_pro',
  );
  assert.equal(
    decideClaimSubmission({ userId: '5', hasPro: false, utr: 'xx' }).action,
    'invalid_utr',
  );
  assert.equal(
    decideClaimSubmission({
      userId: 5,
      hasPro: false,
      utr: '123456789012',
      sameUtrClaim: { id: 1, userId: '5', status: 'pending', utr: '123456789012' },
    }).action,
    'reuse_own_claim',
  );
  assert.equal(
    decideClaimSubmission({
      userId: '5',
      hasPro: false,
      utr: '123456789012',
      sameUtrClaim: { id: 1, userId: '6', status: 'pending', utr: '123456789012' },
    }).action,
    'utr_taken_by_other_user',
  );
  assert.equal(
    decideClaimSubmission({
      userId: '5',
      hasPro: false,
      utr: '555444333222',
      openClaim: { id: 1, userId: '5', status: 'pending', utr: '123456789012' },
    }).action,
    'awaiting_review',
  );
  assert.equal(
    decideClaimSubmission({
      userId: '5',
      hasPro: false,
      utr: '555444333222',
      openClaim: { id: 1, userId: '5', status: 'rejected', utr: '123456789012' },
    }).action,
    'create',
  );
  assert.equal(blocksNewPayment('pending'), true);
  assert.equal(blocksNewPayment('rejected'), false);

  assert.equal(isLifetimeProGithub('UGilfoyle'), true);
  assert.equal(isLifetimeProGithub('Gilfoyle'), true);
  assert.equal(isLifetimeProGithub('ugilfoyle'), true);
  assert.equal(isLifetimeProGithub('random'), false);
  assert.equal(isLifetimeProEmail('akashkaintura.ak@gmail.com'), true);
  assert.equal(isLifetimeProEmail('AKASHKAINTURA.AK@GMAIL.COM'), true);
  assert.equal(isLifetimeProEmail('akash.k96.official@gmail.com'), true);
  assert.equal(isLifetimeProEmail('AKASH.K96.OFFICIAL@GMAIL.COM'), true);
  assert.equal(isLifetimeProEmail('akash.k96.official+dev@gmail.com'), true);
  assert.equal(isLifetimeProEmail('akashk96official@gmail.com'), true); // Gmail dots ignored
  assert.equal(isLifetimeProEmail('someone@else.com'), false);

  // Interview Practice beta: Akash & admin access by default.
  assert.equal(canAccessPracticeBeta('akash.k96.official@gmail.com'), true);
  assert.equal(canAccessPracticeBeta('akash.k96.official+dev@gmail.com'), true);
  assert.equal(canAccessPracticeBeta('akashkaintura.ak@gmail.com'), true);
  assert.equal(canAccessPracticeBeta('someone@else.com'), process.env.NODE_ENV !== 'production');

  const prevVpa = process.env.UPI_VPA;
  const prevStripeFlag = process.env.BILLING_STRIPE_ENABLED;
  const prevStripeKey = process.env.STRIPE_SECRET_KEY;
  const prevUpiGlobal = process.env.BILLING_UPI_GLOBAL;
  process.env.UPI_VPA = 'merchant@okicici';
  process.env.BILLING_UPI_ENABLED = '1';
  process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
  delete process.env.BILLING_STRIPE_ENABLED;
  delete process.env.BILLING_UPI_GLOBAL;
  assert.equal(shouldUseUpiCheckout('IN'), true);
  assert.equal(shouldUseUpiCheckout('US'), false);
  assert.equal(stripeBillingEnabled(), false, 'UPI configured → Stripe off by default');
  process.env.BILLING_STRIPE_ENABLED = '1';
  assert.equal(stripeBillingEnabled(), true, 'explicit opt-in enables Stripe');
  process.env.BILLING_STRIPE_ENABLED = '0';
  assert.equal(stripeBillingEnabled(), false);
  if (prevVpa === undefined) delete process.env.UPI_VPA;
  else process.env.UPI_VPA = prevVpa;
  if (prevStripeFlag === undefined) delete process.env.BILLING_STRIPE_ENABLED;
  else process.env.BILLING_STRIPE_ENABLED = prevStripeFlag;
  if (prevStripeKey === undefined) delete process.env.STRIPE_SECRET_KEY;
  else process.env.STRIPE_SECRET_KEY = prevStripeKey;
  if (prevUpiGlobal === undefined) delete process.env.BILLING_UPI_GLOBAL;
  else process.env.BILLING_UPI_GLOBAL = prevUpiGlobal;

  console.log('billing TS unit tests passed');
}

run();
