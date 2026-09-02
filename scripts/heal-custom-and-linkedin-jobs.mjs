#!/usr/bin/env node
/**
 * heal-custom-and-linkedin-jobs.mjs
 * Heals existing jobs in DB where company is "Custom JD", "Linkedin", or title is "Job via URL".
 */

import sql from '../db/client.mjs';
import { resolveJobLogoFields } from '../dashboard-v2/scripts/lib/job-logos.mjs';

async function healJobs() {
  console.log('🔍 Finding jobs to heal in database...');
  const jobs = await sql`
    SELECT id, company, title, url, jd_text
    FROM jobs
    WHERE 
      company ILIKE '%custom%' 
      OR company ILIKE '%linkedin%' 
      OR company = 'Direct Application'
      OR company IN ('Smartrecruiters', 'Ripplehire', 'Myworkdayjobs', 'Greenhouse')
      OR title = 'Job via URL'
      OR title = 'Overview:'
      OR title ILIKE 'Hi % is hiring%'
    ORDER BY id DESC
  `;

  console.log(`📋 Found ${jobs.length} jobs to evaluate.`);
  let updatedCount = 0;

  for (const j of jobs) {
    const text = j.jd_text || '';
    const u = j.url || '';
    let newComp = null;
    let newTitle = null;

    // URL inspection for ATS subdomains
    if (u.includes('smartrecruiters.com')) {
      const match = u.match(/\/([^/]+)\/[0-9a-zA-Z\-_]+/);
      if (match && match[1] && match[1] !== 'jobs') newComp = match[1];
    } else if (u.includes('greenhouse.io') || u.includes('ashbyhq.com') || u.includes('lever.co')) {
      const parts = new URL(u).pathname.split('/').filter(Boolean);
      if (parts[0] && parts[0] !== 'jobs' && parts[0] !== 'job-boards') newComp = parts[0];
      else if (parts[1]) newComp = parts[1];
    } else if (u.includes('myworkdayjobs.com') || u.includes('ripplehire.com') || u.includes('bamboohr.com')) {
      const sub = new URL(u).hostname.split('.')[0];
      if (sub && sub !== 'jobs' && sub !== 'careers' && sub !== 'usource') newComp = sub;
    }

    // Clean lines inspection
    const cleanLines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
      .filter(l => !/^(skip to|linkedin|jobs|clear text|sign in|join now|apply|save|about the job|overview|get ai)/i.test(l));

    if (cleanLines.length >= 2 && /(?:engineer|developer|architect|lead|manager|analyst|specialist|head|director)/i.test(cleanLines[0])) {
      if (!newTitle) newTitle = cleanLines[0];
      if (!newComp && cleanLines[1].length < 80) {
        const comp = cleanLines[1].split(/[·\t]|  /)[0].trim();
        if (comp && comp.length >= 2 && !/^(full-time|remote|contract|part-time|hybrid)/i.test(comp)) {
          newComp = comp;
        }
      }
    }

    const hiringMatch = text.slice(0, 3000).match(/(?:(?:hi|hey|hello)\s+)?([A-Za-z0-9&.\s]{2,35}?)\s+is\s+hiring\s+(?:for\s+)?(?:a\s+|an\s+)?([A-Za-z0-9\s/+\-_()]+?)(?:\s+(?:in|at|for|location|experience|exp|ctc|notice)|\s*[.!\n]|$)/i);
    if (hiringMatch) {
      if (!newComp) newComp = hiringMatch[1].trim();
      if (!newTitle && hiringMatch[2]?.length >= 3) newTitle = hiringMatch[2].trim();
    }

    const atMatch = text.slice(0, 3000).match(/^(?:About\s+|Join\s+)?(?:At\s+)([A-Za-z0-9&.\s]{2,35}?)(?:,\s*|\s+we\b|\s+is\b)/im);
    if (atMatch && !newComp && !/^(the|our|this|a|an)\b/i.test(atMatch[1].trim())) {
      newComp = atMatch[1].trim();
    }

    const isMatch = text.slice(0, 3000).match(/^([A-Za-z0-9&.\s]{2,30}?)\s+is\s+(?:an?\s+)?(?:fast-growing|global|leading|pioneering|venture|seed|scale-up|transformation|technology|software|ai|fintech|b2b|b2c|saas|healthcare|consulting)\b/im);
    if (isMatch && !newComp && !/^(it|this|there|he|she|they|we|our|who|which)\b/i.test(isMatch[1].trim())) {
      newComp = isMatch[1].trim();
    }

    if (!newTitle) {
      for (const line of cleanLines.slice(0, 10)) {
        if (line.length >= 4 && line.length <= 100 && /(?:engineer|developer|architect|lead|manager|analyst|specialist|head|director)/i.test(line)) {
          newTitle = line;
          break;
        }
      }
    }

    // Apply sane fallback if nothing changed
    const finalCompany = (newComp && newComp.length >= 2 && !newComp.includes('\n')) ? newComp : j.company;
    const finalTitle = (newTitle && newTitle.length >= 3 && !newTitle.includes('\n')) ? newTitle : j.title;

    if (finalCompany !== j.company || finalTitle !== j.title) {
      const logoFields = resolveJobLogoFields({
        url: j.url,
        source: 'healed',
        company: finalCompany,
      });

      await sql`
        UPDATE jobs
        SET
          company = ${finalCompany},
          title = ${finalTitle},
          portal_key = COALESCE(${logoFields.portal_key}, portal_key),
          logo_url = COALESCE(${logoFields.logo_url}, logo_url),
          logo_source = COALESCE(${logoFields.logo_source}, logo_source)
        WHERE id = ${j.id}
      `;

      console.log(`✅ Healed Job ${j.id}: [${j.company}] "${j.title}"  →  [${finalCompany}] "${finalTitle}"`);
      updatedCount++;
    }
  }

  console.log(`\n🎉 Successfully healed ${updatedCount} jobs!`);
  process.exit(0);
}

healJobs().catch((e) => {
  console.error('Error healing jobs:', e);
  process.exit(1);
});
