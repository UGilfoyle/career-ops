import { fetchJson } from './_http.mjs';

function extractLeverSlug(url) {
  if (!url) return null;
  const match = String(url).match(/jobs\.lever\.co\/([^/?#]+)/i);
  return match ? match[1] : null;
}

export default {
  id: 'lever',

  detect(entry) {
    const slug = extractLeverSlug(entry.careers_url) || extractLeverSlug(entry.api);
    if (!slug) return null;
    return { url: `https://api.lever.co/v0/postings/${slug}?mode=json` };
  },

  async fetch(entry, ctx) {
    const slug = extractLeverSlug(entry.careers_url) || extractLeverSlug(entry.api);
    if (!slug) return [];

    const apiUrl = `https://api.lever.co/v0/postings/${slug}?mode=json`;
    const rawJobs = await fetchJson(apiUrl, ctx);
    if (!Array.isArray(rawJobs)) return [];

    return rawJobs.map((j) => ({
      title: String(j.text || '').trim(),
      url: String(j.hostedUrl || j.applyUrl || '').trim(),
      company: entry.name,
      location: String(j.categories?.location || j.workplaceType || '').trim(),
      description: String(j.descriptionPlain || j.description || '').trim(),
      salary: String(j.salaryDescription || j.categories?.commitment || ''),
    })).filter((j) => j.title && j.url);
  },
};
