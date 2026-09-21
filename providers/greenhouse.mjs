import { fetchJson } from './_http.mjs';

function extractGreenhouseSlug(url) {
  if (!url) return null;
  const match = String(url).match(/(?:boards|job-boards|boards-api)\.(?:eu\.)?greenhouse\.io\/(?:v1\/boards\/)?([^/?#]+)/i);
  return match ? match[1] : null;
}

export default {
  id: 'greenhouse',

  detect(entry) {
    const slug = extractGreenhouseSlug(entry.careers_url) || extractGreenhouseSlug(entry.api);
    if (!slug) return null;
    return { url: `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs` };
  },

  async fetch(entry, ctx) {
    const slug = extractGreenhouseSlug(entry.careers_url) || extractGreenhouseSlug(entry.api);
    if (!slug) return [];

    const apiUrl = `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`;
    let data;
    try {
      data = await fetchJson(apiUrl, ctx);
    } catch {
      // Fallback without content=true if payload is too large or rate limited
      data = await fetchJson(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`, ctx);
    }

    const rawJobs = Array.isArray(data?.jobs) ? data.jobs : [];
    return rawJobs.map((j) => ({
      title: String(j.title || '').trim(),
      url: String(j.absolute_url || '').trim(),
      company: entry.name,
      location: String(j.location?.name || '').trim(),
      description: String(j.content || '').trim(),
      salary: String(j.metadata?.find?.((m) => /salary|comp/i.test(m.name))?.value || ''),
    })).filter((j) => j.title && j.url);
  },
};
