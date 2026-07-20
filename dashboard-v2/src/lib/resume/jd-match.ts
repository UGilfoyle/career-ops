/**
 * Server-side JD match — loads the proven CLI engines without forking logic.
 */
import { pathToFileURL } from 'url';
import { join } from 'path';
import type { ResumeContext } from './types';

export type JdMatchResult = {
  jdKeywords: string[];
  honest: string[];
  gaps: string[];
  profileTech: string[];
  coveragePct: number;
};

async function importJdProfileMatch() {
  const candidates = [
    join(/* turbopackIgnore: true */ process.cwd(), '..', 'jd-profile-match.mjs'),
    join(/* turbopackIgnore: true */ process.cwd(), 'runtime-assets', '..', '..', 'jd-profile-match.mjs'),
  ];
  let lastErr: unknown;
  for (const file of candidates) {
    try {
      return await import(/* webpackIgnore: true */ pathToFileURL(file).href);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('jd-profile-match.mjs not found');
}

export async function runJdMatch(profile: ResumeContext, jdText: string): Promise<JdMatchResult> {
  const mod = await importJdProfileMatch();
  const fit = mod.analyzeJdProfileFit(jdText || '', profile) as {
    jdKeywords: string[];
    honest: string[];
    gaps: string[];
    profileTech: string[];
  };
  const total = fit.jdKeywords?.length || 0;
  const coveragePct = total > 0 ? Math.round((fit.honest.length / total) * 100) : 0;
  return {
    jdKeywords: fit.jdKeywords || [],
    honest: fit.honest || [],
    gaps: fit.gaps || [],
    profileTech: fit.profileTech || [],
    coveragePct,
  };
}
