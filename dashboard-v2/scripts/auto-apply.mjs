import fs from 'fs';
import path from 'path';
import sql from './db/client.mjs';

let hf = null;
const TARGET_MAP = 'data/current_eval.json';

let urlOrIdx = process.argv[2];
let company = process.argv[3] || '';
const rawUserId = process.env.SCAN_USER_ID || 1;
const userId = Number.parseInt(String(rawUserId), 10);
if (!Number.isFinite(userId)) {
  throw new Error(`Invalid SCAN_USER_ID: ${rawUserId}`);
}

async function getHfClient() {
  if (hf) return hf;
  try {
    const mod = await import('@huggingface/inference');
    hf = new mod.HfInference(process.env.HUGGINGFACE_TOKEN);
    return hf;
  } catch (e) {
    console.warn('⚠ HuggingFace SDK unavailable in this runtime. Falling back to static field mapping.');
    return null;
  }
}

async function getChromium() {
  try {
    const mod = await import('playwright');
    return mod.chromium;
  } catch {
    return null;
  }
}

function writeApplicationPack({ companyName, targetUrl, profile, resumePath, note }) {
  if (!fs.existsSync('output')) fs.mkdirSync('output');
  const safe = (s) => String(s || '').replace(/[^a-z0-9]/gi, '_').replace(/_{2,}/g, '_').slice(0, 60);
  const companySlug = safe(companyName || 'Company');
  const outPath = path.join('output', `Application_Pack_${companySlug}.md`);

  const c = profile?.candidate || {};
  const n = profile?.narrative || {};
  const l = profile?.legal || {};
  const comp = profile?.compensation || {};

  const content = `# Application Pack — ${companyName || 'Unknown'}

- **Target URL:** ${targetUrl}
- **Generated:** ${new Date().toISOString()}
- **Mode:** Draft (no browser automation available)

## Candidate details
- Name: ${c.full_name || ''}
- Email: ${c.email || ''}
- Phone: ${c.phone || ''}
- Location: ${c.location || ''}
- LinkedIn: ${c.linkedin || ''}
- GitHub/Portfolio: ${c.github || c.portfolio_url || ''}

## Attachments
- Resume: ${resumePath || '(not found — run tailor first or upload manually)'}

## Quick answers (copy/paste)
- Why are you interested in this role?
  - ${n.exit_story || 'I focus on shipping reliable software with measurable outcomes, and I’m excited to contribute in a role that values strong engineering fundamentals and ownership.'}
- What’s your strongest skill?
  - ${(Array.isArray(n.superpowers) && n.superpowers.length > 0) ? n.superpowers.slice(0, 3).join(', ') : 'Backend engineering, reliability, and product-minded execution.'}
- Notice period
  - ${l.notice_period || ''}
- Work authorization
  - ${l.work_authorization || ''}
- Sponsorship required
  - ${l.sponsorship_required || ''}
- Compensation expectations
  - ${l.salary_expectations || comp.target_range || ''}

## Notes
${note || ''}
`;

  fs.writeFileSync(outPath, content);
  return outPath;
}

// Load profile for auto-filling from user-scoped DB context.
let profile = { candidate: {}, narrative: {}, legal: {}, compensation: {} };

function findTailoredCV(companyName) {
  if (!companyName) return null;
  const outDir = path.join(process.cwd(), 'output');
  if (!fs.existsSync(outDir)) return null;
  
  const files = fs.readdirSync(outDir);
  // Matches "Akash_Kaintura_SSE_CompanyName.pdf" or "Akash_Kaintura_CompanyName_Resume.pdf"
  const match = files.find(f => f.toLowerCase().includes(companyName.toLowerCase()) && (f.includes('Resume') || f.includes('SSE') || f.includes('Tailored')) && f.endsWith('.pdf'));
  return match ? path.join('output', match) : null;
}

if (!urlOrIdx) {
  console.error("Usage: node auto-apply.mjs <url_or_index> [company]");
  process.exit(1);
}

// ── RESOLVE TARGET ──
let targetUrl = urlOrIdx;
if (/^\d+$/.test(urlOrIdx)) {
  // 1) Try rank-index mapping (from `rank` output)
  if (fs.existsSync(TARGET_MAP)) {
    try {
      const mapping = JSON.parse(fs.readFileSync(TARGET_MAP, 'utf8'));
      if (mapping[urlOrIdx]) {
        targetUrl = mapping[urlOrIdx].url;
        company = mapping[urlOrIdx].company;
      }
    } catch {}
  }

  // 2) If still not a URL, interpret as a real DB job id
  if (/^\d+$/.test(targetUrl)) {
    const jobId = Number.parseInt(urlOrIdx, 10);
    if (Number.isFinite(jobId)) {
      try {
        const [job] = await sql`
          SELECT url, company
          FROM jobs
          WHERE id = ${jobId} AND user_id = ${userId}
          LIMIT 1
        `;
        if (job?.url) {
          targetUrl = job.url;
          company = company || job.company || '';
        }
      } catch {}
    }
  }
}

function normalizeUrl(value) {
  if (!value) return value;
  let next = String(value).trim();
  if (next.startsWith('//')) next = `https:${next}`;
  try {
    const u = new URL(next);
    if (u.hostname.includes('duckduckgo.com') && u.pathname.startsWith('/l/')) {
      const ud = u.searchParams.get('uddg');
      if (ud) {
        try {
          next = decodeURIComponent(ud);
        } catch {
          next = ud;
        }
      }
    }
  } catch {}
  return next;
}

function shouldForceGuided(target) {
  try {
    const u = new URL(String(target));
    const host = u.hostname.toLowerCase();
    if (host.includes('linkedin.com')) return { guided: true, reason: 'LinkedIn requires interactive login; generating guided pack.' };
    if (host.includes('duckduckgo.com')) return { guided: true, reason: 'Redirect wrapper detected; generating guided pack.' };
    return { guided: false, reason: '' };
  } catch {
    return { guided: true, reason: 'Invalid URL; generating guided pack.' };
  }
}

async function runGuidedPack(reason) {
  console.warn(`⚠ ${reason}`);
  // Load profile from DB if possible.
  try {
    const [profileRow] = await sql`SELECT resume_context FROM user_profiles WHERE user_id = ${userId} LIMIT 1`;
    if (profileRow?.resume_context) profile = profileRow.resume_context;
  } catch {}

  const tailoredPdf = findTailoredCV(company);
  const packPath = writeApplicationPack({
    companyName: company || 'Unknown',
    targetUrl,
    profile,
    resumePath: tailoredPdf,
    note: "Open the target link, upload the resume, paste answers from this pack, and submit manually.",
  });

  console.log('─────────────────────────────────────────────────────');
  console.log('✅ DRAFT PACK READY (manual submit):');
  console.log(`   ${path.resolve(packPath)}`);
  console.log('─────────────────────────────────────────────────────');

  await recordApplication(targetUrl, 'DRAFT', tailoredPdf || 'pending');
  process.exit(0);
}

async function recordApplication(url, status, resume) {
  try {
    let job = await sql`SELECT id FROM jobs WHERE url = ${url} AND user_id = ${userId} LIMIT 1`;
    
    if (job.length === 0) {
      // Create a manual job entry if it doesn't exist
      job = await sql`
        INSERT INTO jobs (user_id, url, company, title, source, score)
        VALUES (${userId}, ${url}, ${company || 'Manual Entry'}, 'Job via Direct URL', 'manual', 0)
        RETURNING id
      `;
    }

    if (job.length > 0) {
      await sql`
        INSERT INTO applications (job_id, user_id, status, resume_file, applied_at)
        VALUES (${job[0].id}, ${userId}, ${status}, ${resume}, CURRENT_TIMESTAMP)
        ON CONFLICT (job_id) DO UPDATE SET
          status = ${status},
          resume_file = ${resume},
          applied_at = CURRENT_TIMESTAMP
      `;
      console.log(`✓ Status '${status}' recorded for ${company} in DB.`);
    }
  } catch (e) {
    console.error("⚠ Failed to record status in DB:", e.message);
  }
}

async function scanFormFields(frame) {
  console.log("🔍 Scanning form structural metadata...");
  const fields = [];
  
  // Find all label-like elements
  const labelNodes = await frame.$$('label, span.label, div.label, .question-label');
  for (const node of labelNodes) {
    const labelText = (await node.textContent()).trim();
    if (!labelText || labelText.length < 2) continue;

    // Find description/hint if it exists
    const contextText = await node.evaluate(el => {
      const parent = el.closest('div, .field, .question, fieldset');
      if (!parent) return '';
      const desc = parent.querySelector('.description, .hint, .help-block, [id*="description"]');
      return desc ? desc.textContent.trim() : '';
    });

    const hasFor = await node.getAttribute('for');
    let input = null;
    
    if (hasFor) {
      // Use attribute selector for ID to handle special characters like []
      input = await frame.$(`[id="${hasFor}"], [name="${hasFor}"]`);
    }
    
    if (!input) {
      input = await node.evaluateHandle(el => {
        const parent = el.closest('div, .field, .question, fieldset');
        if (!parent) return null;
        // Check for common inputs
        const found = parent.querySelector('input:not([type="hidden"]), select, textarea');
        if (found) return found;
        // Check for specific radio/checkbox containers
        return parent.querySelector('[role="radio"], [role="checkbox"]');
      });
      input = input.asElement();
    }

    if (input) {
      const tag = await input.evaluate(i => i.tagName.toLowerCase());
      const type = tag === 'input' ? await input.getAttribute('type') : tag;
      const name = await input.getAttribute('name') || '';
      const isRequired = labelText.includes('*') || await input.getAttribute('aria-required') === 'true';
      
      fields.push({ label: labelText, context: contextText, type, name, element: input, required: isRequired });
    }
  }
  return fields;
}

async function reasonFieldMappings(fields, profile, companyName) {
  const hfClient = await getHfClient();
  if (!hfClient) return null;

  console.log(`🤖 Consulting MiniMax-M2.7 for form reasoning...`);
  
  const fieldList = fields.map((f, i) => `${i}: "${f.label}" (Context: ${f.context}) [Type: ${f.type}]`).join('\n');
  const profileSummary = `Name: ${profile.candidate.full_name}\nHeadline: ${profile.narrative.headline}\nSummary: ${profile.narrative.exit_story}\nLegal: Auth=${profile.legal.work_authorization}, Notice=${profile.legal.notice_period}`;

  const prompt = `
    You are an expert at mapping job application form fields to a candidate's profile.
    Target Company: ${companyName || 'Unknown'}
    
    FIELDS FOUND ON PAGE:
    ${fieldList}
    
    CANDIDATE PROFILE:
    ${profileSummary}
    
    TASK:
    1. Map each field index to a suggested value from the profile.
    2. For common fields (email, phone, linkedin, etc.), provide the direct value.
    3. For complex questions (e.g., "Why do you want to work here?", "Describe a challenge"), generate a 2-3 sentence tailored response based on the profile narrative and company name.
    4. For work authorization, use the Legal values provided.
    
    RETURN ONLY VALID JSON:
    {
      "mappings": {
        "0": "value",
        "1": "generated text...",
        ...
      }
    }
  `;

  try {
    const response = await hfClient.chatCompletion({
      model: "MiniMaxAI/MiniMax-M2.7",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2000,
      temperature: 0.1
    });

    const content = response.choices[0].message.content;
    const jsonStr = content.substring(content.indexOf('{'), content.lastIndexOf('}') + 1);
    return JSON.parse(jsonStr).mappings;
  } catch (err) {
    console.warn("⚠ AI Reasoning failed, falling back to keyword matching.", err.message);
    return null;
  }
}

async function matchAndFillFields(fields, profile, aiMapping) {
  console.log(`🧠 Matching ${fields.length} discovered fields using ${aiMapping ? 'AI Mapping' : 'Static Rules'}...`);
  
  const c = profile.candidate;
  const l = profile.legal || {};
  const comp = profile.compensation || {};

  // Static rules as fallback
  const staticRules = [
    { kw: ['first name', 'given name'], val: c.full_name?.split(' ')[0] },
    { kw: ['last name', 'family name', 'surname'], val: c.full_name?.split(' ').slice(1).join(' ') },
    { kw: ['email'], val: c.email },
    { kw: ['phone', 'mobile', 'contact number'], val: c.phone },
    { kw: ['linkedin'], val: c.linkedin },
    { kw: ['github'], val: c.github },
    { kw: ['portfolio', 'website'], val: c.portfolio_url },
    { kw: ['authorized', 'legally', 'eligible'], val: l.work_authorization },
    { kw: ['sponsorship', 'visa', 'require'], val: l.sponsorship_required },
    { kw: ['notice', 'start'], val: l.notice_period },
    { kw: ['salary', 'expectation', 'ctc'], val: l.salary_expectations || comp.target_range }
  ];

  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    const labelText = field.label.toLowerCase();
    
    let value = null;
    if (aiMapping && aiMapping[i]) {
      value = aiMapping[i];
      console.log(`   ▹ [AI] ${field.label.padEnd(30)} -> ${value.substring(0, 40)}${value.length > 40 ? '...' : ''}`);
    } else {
      const rule = staticRules.find(r => r.kw.some(k => labelText.includes(k)));
      if (rule) {
        value = rule.val;
        console.log(`   ▹ [Static] ${field.label.padEnd(30)} -> ${value}`);
      }
    }

    if (value) {
      try {
        if (field.type === 'select') {
          // Try exact match first, then partial
          await field.element.selectOption({ label: value }).catch(async () => {
             const options = await field.element.$$eval('option', (opts, v) => {
                const match = opts.find(o => o.textContent.toLowerCase().includes(v.toLowerCase()));
                return match ? match.value : null;
             }, value);
             if (options) await field.element.selectOption(options);
          });
        } else if (field.type === 'radio' || field.type === 'checkbox') {
          const valNorm = value.toLowerCase();
          const parent = await field.element.evaluateHandle(e => e.closest('div, fieldset, .question, .field'));
          const clickable = await parent.asElement().$(`input[value*="${value}"], label:has-text("${value}")`);
          if (clickable) await clickable.click();
        } else {
          await field.element.fill(value).catch(() => {});
        }
      } catch (err) {
        // Silently skip if fill fails
      }
    }
  }
}

// Success detection removed for manual review mode

// Main Loop
(async () => {
  console.log(`🚀 Starting Job Application Companion...`);
  targetUrl = normalizeUrl(targetUrl);
  console.log(`Target: ${company || 'Unknown'} @ ${targetUrl}`);

  const chromium = await getChromium();
  const forced = shouldForceGuided(targetUrl);
  if (forced.guided) {
    await runGuidedPack(forced.reason);
  }
  if (!chromium) {
    await runGuidedPack('Playwright runtime is unavailable in this environment.');
  }

  const browser = await chromium.launch({ headless: true }); 
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    const [profileRow] = await sql`SELECT resume_context FROM user_profiles WHERE user_id = ${userId} LIMIT 1`;
    if (profileRow?.resume_context) {
      profile = profileRow.resume_context;
    } else {
      console.warn("⚠ No profile found in DB for this user. Using placeholders.");
    }

    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForLoadState('load').catch(() => {});
    
    let formFrame = page;
    const iframeElement = await page.$('iframe#grnhse_iframe');
    if (iframeElement) {
        console.log("✓ Greenhouse iframe detected.");
        formFrame = await iframeElement.contentFrame();
    }

    // 1. SCAN
    const discoveredFields = await scanFormFields(formFrame);
    
    // 2. REASON (NEW)
    const aiMapping = await reasonFieldMappings(discoveredFields, profile, company);

    // 3. TAILORED RESUME PREP
    const tailoredPdf = findTailoredCV(company);
    const fullPdfPath = tailoredPdf ? path.resolve(tailoredPdf) : null;
    
    if (fullPdfPath) {
      console.log('─────────────────────────────────────────────────────');
      console.log('📄 TAILORED RESUME LOCATED:');
      console.log(`   ${fullPdfPath}`);
      console.log('─────────────────────────────────────────────────────');
    } else {
      console.warn('⚠ No tailored resume found for this company in output/.');
    }

    // 4. FILL WITH REASONING
    await matchAndFillFields(discoveredFields, profile, aiMapping);

    console.log('\n✅ PRE-FILLING COMPLETE.');
    console.log('─────────────────────────────────────────────────────');
    console.log('  🛡️  READY FOR HUMAN REVIEW:');
    console.log('  1. Verify the Resume is attached (upload if missing).');
    console.log('  2. Complete any unanswered custom questions.');
    console.log('  3. Click "Submit" manually when you are ready.');
    console.log('─────────────────────────────────────────────────────');
    
    // We record as 'READY' but not 'APPLIED' yet
    await recordApplication(targetUrl, 'READY', tailoredPdf || 'pending');

    if (process.env.GITHUB_ACTIONS || process.env.CI) {
      console.log('✅ Guided prefill finished (CI mode).');
    } else {
      console.log('⏳ Handing over control to you. Browser will stay open.');
      await new Promise(resolve => {
          page.on('close', resolve);
          setTimeout(resolve, 600000);
      });
    }
    
  } catch (err) {
    await runGuidedPack(`Automation failed: ${err.message}`);
  } finally {
    try { await browser.close(); } catch {}
    process.exit(0);
  }
})();
