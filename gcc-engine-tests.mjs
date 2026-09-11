import assert from 'assert';
import { classifyCompany, classifyGccOpportunity } from './gcc-classify.mjs';

console.log('🧪 Running GCC Engine unit tests...');

// 1. Direct Company Name Matching
{
  const targetRes = classifyGccOpportunity({ companyName: 'Target Corporation' });
  assert.strictEqual(targetRes.isGcc, true, 'Target Corporation should be classified as GCC');
  assert.strictEqual(targetRes.type, 'GCC');

  const walmartRes = classifyGccOpportunity({ companyName: 'Walmart Global Tech India' });
  assert.strictEqual(walmartRes.isGcc, true, 'Walmart Global Tech India should be classified as GCC');

  const lowesRes = classifyGccOpportunity({ companyName: "Lowe's India" });
  assert.strictEqual(lowesRes.isGcc, true, "Lowe's India should be classified as GCC");

  const jpmcRes = classifyGccOpportunity({ companyName: 'JPMorgan Chase & Co' });
  assert.strictEqual(jpmcRes.isGcc, true, 'JPMorgan Chase should be classified as GCC');

  const tcsRes = classifyGccOpportunity({ companyName: 'Tata Consultancy Services' });
  assert.strictEqual(tcsRes.isGcc, false, 'TCS should not be classified as GCC');
  assert.strictEqual(tcsRes.type, 'Services');

  const startupRes = classifyGccOpportunity({ companyName: 'Landeed' });
  assert.strictEqual(startupRes.isGcc, false, 'Landeed should not be classified as GCC');
  assert.strictEqual(startupRes.type, 'Other');

  console.log('  ✅ Company name registry matching passed');
}

// 2. URL Domain Matching
{
  const urlRes = classifyGccOpportunity({
    companyName: 'Unknown Tech',
    url: 'https://jobs.target.com/career/backend-engineer-india',
  });
  assert.strictEqual(urlRes.isGcc, true, 'Target URL should trigger GCC detection');
  assert.strictEqual(urlRes.type, 'GCC');

  const workdayRes = classifyGccOpportunity({
    companyName: '',
    url: 'https://nike.wd1.myworkdayjobs.com/en-US/Careers/job/Bengaluru/Software-Engineer',
  });
  assert.strictEqual(workdayRes.isGcc, true, 'Nike Workday URL should trigger GCC detection');

  console.log('  ✅ URL domain detection passed');
}

// 3. JD Text Captive Pattern Signals
{
  const jdWithGcc = `
    About the Role:
    Join our Global Capability Center in Bengaluru. You will work directly with our US engineering team
    to build high-scale inventory platforms.
  `;
  const jdRes = classifyGccOpportunity({
    companyName: 'Global Retailer',
    jdText: jdWithGcc,
  });
  assert.strictEqual(jdRes.isGcc, true, 'JD with Global Capability Center mention should be GCC');
  assert.strictEqual(jdRes.type, 'GCC');

  const jdWithIdc = `
    We are expanding our India Development Center (IDC) for our core payment rails.
  `;
  const idcRes = classifyGccOpportunity({
    companyName: 'Fintech Hub',
    jdText: jdWithIdc,
  });
  assert.strictEqual(idcRes.isGcc, true, 'JD with India Development Center mention should be GCC');

  const jdWithCoE = `
    Looking for a Senior Backend Engineer to join our cloud Center of Excellence.
  `;
  const coeRes = classifyGccOpportunity({
    companyName: 'Logistics Group',
    jdText: jdWithCoE,
  });
  assert.strictEqual(coeRes.isGcc, true, 'JD with Center of Excellence mention should be GCC');

  const jdWithOdc = `
    Our ODC in Pune operates as an extended engineering arm for our enterprise platform.
  `;
  const odcRes = classifyGccOpportunity({
    companyName: 'Tech Enterprise',
    jdText: jdWithOdc,
  });
  assert.strictEqual(odcRes.isGcc, true, 'JD with ODC mention should be GCC');

  const jdWithGdc = `
    Join our GDC team building next-generation financial systems.
  `;
  const gdcRes = classifyGccOpportunity({
    companyName: 'Bank Systems',
    jdText: jdWithGdc,
  });
  assert.strictEqual(gdcRes.isGcc, true, 'JD with GDC mention should be GCC');

  console.log('  ✅ JD text captive pattern signals passed (GCC, IDC, CoE, ODC, GDC)');
}

// 4. Explicit CLI Flag Override
{
  const flagRes = classifyGccOpportunity({
    companyName: 'Small Startup',
    requestedGcc: true,
  });
  assert.strictEqual(flagRes.isGcc, true, 'CLI flag should force GCC activation');
  assert.strictEqual(flagRes.type, 'GCC');

  console.log('  ✅ Explicit CLI flag override passed');
}

// 5. Backward Compatibility for classifyCompany
{
  assert.strictEqual(classifyCompany('Target'), 'GCC');
  assert.strictEqual(classifyCompany('Infosys'), 'Services');
  assert.strictEqual(classifyCompany('Random Seed Startup'), 'Other');

  // Multi-arg signature
  assert.strictEqual(classifyCompany('Random Corp', 'Welcome to our Global Capability Center'), 'GCC');

  console.log('  ✅ Backward compatibility passed');
}

console.log('🟢 All GCC Engine unit tests passed successfully!');
