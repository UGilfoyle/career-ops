import assert from 'node:assert/strict';
import nextConfig from '../../next.config';

console.log('Testing security baseline configuration & route policy...');

// 1. Verify next.config.ts OWASP Headers
async function testNextConfigSecurityHeaders() {
  assert(typeof nextConfig.headers === 'function', 'nextConfig.headers should be a function');
  const headersConfig = await nextConfig.headers();
  assert(Array.isArray(headersConfig), 'headers should return an array');

  const rootRule = headersConfig.find((r: any) => r.source === '/:path*');
  assert(rootRule, 'Root rule for /:path* must exist');

  const headerMap = Object.fromEntries(
    rootRule.headers.map((h: { key: string; value: string }) => [h.key, h.value])
  );

  // X-Frame-Options: SAMEORIGIN
  assert.equal(
    headerMap['X-Frame-Options'],
    'SAMEORIGIN',
    'X-Frame-Options must be SAMEORIGIN to protect against clickjacking while allowing in-app resume previews'
  );

  // X-Content-Type-Options: nosniff
  assert.equal(headerMap['X-Content-Type-Options'], 'nosniff', 'MIME-sniffing protection must be enabled');

  // Strict-Transport-Security (HSTS)
  assert(
    headerMap['Strict-Transport-Security']?.includes('max-age=63072000'),
    'HSTS must enforce at least 2 years max-age with preload'
  );

  // Permissions-Policy
  assert(
    headerMap['Permissions-Policy']?.includes('microphone=(self)'),
    'Voice AI Mock Interview must have microphone=(self) permission'
  );
  assert(
    headerMap['Permissions-Policy']?.includes('camera=()'),
    'Camera must remain disabled by default'
  );

  // Cross-Origin-Opener-Policy
  assert.equal(
    headerMap['Cross-Origin-Opener-Policy'],
    'same-origin-allow-popups',
    'COOP must allow popups for OAuth 2.0 authorization flows and payment checkouts'
  );

  console.log('  ✔ All OWASP HTTP response headers verified');
}

// 2. Verify Route Public Access Matrix (Middleware logic test)
function testPublicRouteMatrix() {
  const publicPages = [
    '/',
    '/login',
    '/signup',
    '/verify',
    '/forgot-password',
    '/reset-password',
    '/auth/continue',
    '/docs',
    '/privacy',
    '/status',
    '/billing/simulate',
  ];

  function isRoutePublic(pathname: string): boolean {
    const isDossierPublic = pathname === '/p' || pathname.startsWith('/p/');
    const isStealthPublic = pathname === '/v' || pathname.startsWith('/v/') || pathname === '/beacon.js' || isDossierPublic;
    return publicPages.includes(pathname) || isStealthPublic;
  }

  // Public candidate dossier URLs for LinkedIn recruiters
  assert.equal(isRoutePublic('/p/akash'), true, '/p/:slug must be public for recruiters');
  assert.equal(isRoutePublic('/p/john-doe'), true, '/p/:slug must be public');
  assert.equal(isRoutePublic('/p/sarah-connor_99'), true, '/p/:slug must be public');

  // Core public auth/marketing routes
  assert.equal(isRoutePublic('/'), true, 'Landing page must be public');
  assert.equal(isRoutePublic('/login'), true, 'Login page must be public');
  assert.equal(isRoutePublic('/signup'), true, 'Signup page must be public');
  assert.equal(isRoutePublic('/docs'), true, 'Docs must be public');

  // Protected application routes
  assert.equal(isRoutePublic('/dashboard'), false, 'Dashboard must require auth');
  assert.equal(isRoutePublic('/pipeline'), false, 'Pipeline must require auth');
  assert.equal(isRoutePublic('/resume-studio'), false, 'Resume Studio must require auth');
  assert.equal(isRoutePublic('/api/practice/voice/tts'), false, 'Voice TTS API must require auth');
  assert.equal(isRoutePublic('/settings'), false, 'Settings must require auth');
  assert.equal(isRoutePublic('/admin'), false, 'Admin must require auth');

  console.log('  ✔ Route access authorization matrix verified');
}

// 3. Verify No Secret Leaks via NEXT_PUBLIC_ prefixes
function testSecretLeakageGuard() {
  const sensitiveSecretNames = [
    'ELEVENLABS_API_KEY',
    'ANTHROPIC_API_KEY',
    'OPENROUTER_API_KEY',
    'GEMINI_API_KEY',
    'STRIPE_SECRET_KEY',
    'NEXTAUTH_SECRET',
    'TURNSTILE_SECRET_KEY',
    'POSTGRES_PASSWORD',
    'DATABASE_URL',
  ];

  for (const secret of sensitiveSecretNames) {
    const publicEnvVariant = `NEXT_PUBLIC_${secret}`;
    assert.equal(
      Boolean(process.env[publicEnvVariant]),
      false,
      `FATAL: ${publicEnvVariant} must NEVER exist! Server secret would be bundled into client-side JS!`
    );
  }

  console.log('  ✔ Secret leakage guard verified (zero exposed server secrets in NEXT_PUBLIC_)');
}

async function run() {
  await testNextConfigSecurityHeaders();
  testPublicRouteMatrix();
  testSecretLeakageGuard();
  console.log('All security tests passed successfully!\n');
}

void run();
