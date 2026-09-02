import { openStealthScraperSession } from './stealth-browser.mjs';

/**
 * Naukri Direct Scraper
 * Uses high-stealth Obscura CDP session with resilient Playwright Chromium fallback.
 */
export async function scrapeNaukri(keywords, location = 'India') {
  console.log(`\n🇮🇳 Naukri Direct Scraper — ${keywords} in ${location}`);
  const jobs = [];
  const session = await openStealthScraperSession();
  const page = session.page;

  try {
    const kwSlug = keywords.toLowerCase().replace(/\s+/g, '-');
    const locSlug = location.toLowerCase().replace(/\s+/g, '-');
    const searchUrl = `https://www.naukri.com/${kwSlug}-jobs-in-${locSlug}`;
    console.log(`  🌐 Navigating (${session.engine}): ${searchUrl}`);
    
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('.list', { timeout: 15000 }).catch(() => null);

    const results = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.cust-job-tuple, .srp-jobtuple-container, article.jobTuple'));
      return cards.map(card => {
        const titleEl = card.querySelector('.title, a.title');
        const companyEl = card.querySelector('.comp-name, .companyName');
        const linkEl = card.querySelector('a.title');
        
        if (titleEl && companyEl && linkEl) {
          return {
            title: titleEl.innerText.trim(),
            company: companyEl.innerText.trim(),
            url: linkEl.href
          };
        }
        return null;
      }).filter(Boolean);
    });

    console.log(`  ✓ Found ${results.length} jobs on Naukri`);
    results.forEach(j => jobs.push({ ...j, source: 'Naukri Direct' }));

  } catch (err) {
    console.error(`  ✗ Naukri Error: ${err.message}`);
  } finally {
    await session.close();
  }
  return jobs;
}
