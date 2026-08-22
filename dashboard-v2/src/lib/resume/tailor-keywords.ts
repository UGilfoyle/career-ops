/**
 * Same JD keyword list the tailor uses (atsMirror) — keeps Studio + card scores aligned.
 */
import { pathToFileURL } from 'url';
import { join } from 'path';
import type { ResumeContext } from './types';

async function importTailoringPlan() {
  const candidates = [
    join(/* turbopackIgnore: true */ process.cwd(), '..', 'resume-tailoring-plan.mjs'),
    join(/* turbopackIgnore: true */ process.cwd(), 'runtime-assets', '..', '..', 'resume-tailoring-plan.mjs'),
  ];
  let lastErr: unknown;
  for (const file of candidates) {
    try {
      return await import(/* webpackIgnore: true */ pathToFileURL(file).href);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('resume-tailoring-plan.mjs not found');
}

export async function extractTailorAtsKeywords(
  jdText: string,
  profile: ResumeContext,
): Promise<string[]> {
  const mod = await importTailoringPlan();
  const plan = mod.buildTailoringPlan(jdText || '', profile) as {
    keywords?: { atsMirror?: string[] };
  };
  return Array.isArray(plan.keywords?.atsMirror) ? plan.keywords!.atsMirror!.map(String) : [];
}
