import { fetchJson } from './_http.mjs';

function extractAshbySlug(url) {
  if (!url) return null;
  const match = String(url).match(/jobs\.ashbyhq\.com\/([^/?#]+)/i);
  return match ? match[1] : null;
}

export default {
  id: 'ashby',

  detect(entry) {
    const slug = extractAshbySlug(entry.careers_url) || extractAshbySlug(entry.api);
    if (!slug) return null;
    return { url: `https://api.ashbyhq.com/posting-api/job-board/${slug}` };
  },

  async fetch(entry, ctx) {
    const slug = extractAshbySlug(entry.careers_url) || extractAshbySlug(entry.api);
    if (!slug) return [];

    const apiUrl = `https://api.ashbyhq.com/posting-api/job-board/${slug}`;
    const data = await fetchJson(apiUrl, ctx);
    const rawJobs = Array.isArray(data?.jobs) ? data.jobs : [];

    return rawJobs.map((j) => {
      const locParts = [j.location, j.secondaryLocations?.join(', ')].filter(Boolean);
      return {
        title: String(j.title || '').trim(),
        url: String(j.jobUrl || `https://jobs.ashbyhq.com/${slug}/${j.id}`).trim(),
        company: entry.name,
        location: locParts.join(' | ') || (j.isRemote ? 'Remote' : ''),
        description: String(j.descriptionHtml || j.descriptionPlain || '').trim(),
        salary: String(j.compensation?.summary || ''),
      };
    }).filter((j) => j.title && j.url);
  },
};
