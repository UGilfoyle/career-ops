/**
 * resume-persona-track.mjs — Multi-Track Persona Presets & Architectural Reframing
 * Supports:
 *   Track A: Linux, Python & Distributed Data Platform (PostgreSQL at scale, PgBouncer, Ingestion)
 *   Track B: Node.js, Bun, TypeScript & Cloud Microservices (Redis, Docker/K8s, Latency Optimization)
 */

export const TRACK_A_ID = 'track_a';
export const TRACK_B_ID = 'track_b';

const TRACK_A_PATTERNS = [
  /\bpython(?:\d+)?\b/gi,
  /\bpostgres(?:ql)?\b/gi,
  /\bdata platform\b/gi,
  /\bdistributed systems?\b/gi,
  /\btelemetry\b/gi,
  /\bingestion\b/gi,
  /\blinux\b/gi,
  /\bkernel\b/gi,
  /\bpgbouncer\b/gi,
  /\bpartition(?:ing|ed)?\b/gi,
  /\bautovacuum\b/gi,
  /\bclickhouse\b/gi,
  /\bkafka\b/gi,
  /\bspark\b/gi,
  /\betl\b/gi,
  /\bpipeline\b/gi,
  /\bsre\b/gi,
];

const TRACK_B_PATTERNS = [
  /\bnode(?:\.js)?\b/gi,
  /\btypescript\b/gi,
  /\bbun\b/gi,
  /\bjavascript\b/gi,
  /\bnest(?:js)?\b/gi,
  /\bexpress(?:js)?\b/gi,
  /\breact(?:\.js)?\b/gi,
  /\bfull[\s-]?stack\b/gi,
  /\bfrontend\b/gi,
  /\bnext(?:\.js)?\b/gi,
];

/**
 * Detect the target persona track based on explicit override or JD analysis.
 * @param {string} jdText 
 * @param {string} [requestedTrack] - CLI argument like 'data', 'node', 'track_a', 'track_b'
 * @param {object} [profile] 
 * @returns {{ trackId: string, trackName: string, source: 'cli' | 'profile' | 'auto', scoreA: number, scoreB: number }}
 */
export function detectPersonaTrack(jdText, requestedTrack, profile) {
  // 1. Explicit CLI argument override
  if (requestedTrack) {
    const norm = String(requestedTrack).toLowerCase().trim();
    if (['data', 'track_a', 'a', 'python', 'linux', 'postgres'].includes(norm)) {
      return {
        trackId: TRACK_A_ID,
        trackName: 'Track A: Linux, Python & Distributed Data Platform',
        source: 'cli',
        scoreA: 999,
        scoreB: 0,
      };
    }
    if (['node', 'track_b', 'b', 'ts', 'typescript', 'cloud', 'bun'].includes(norm)) {
      return {
        trackId: TRACK_B_ID,
        trackName: 'Track B: Node.js, Bun, TypeScript & Cloud Microservices',
        source: 'cli',
        scoreA: 0,
        scoreB: 999,
      };
    }
  }

  // 2. Profile default setting if explicitly set to track_a or track_b
  const profileSetting = profile?.narrative?.active_track;
  if (profileSetting === TRACK_A_ID || profileSetting === TRACK_B_ID) {
    return {
      trackId: profileSetting,
      trackName: profileSetting === TRACK_A_ID
        ? 'Track A: Linux, Python & Distributed Data Platform'
        : 'Track B: Node.js, Bun, TypeScript & Cloud Microservices',
      source: 'profile',
      scoreA: 0,
      scoreB: 0,
    };
  }

  // 3. Autonomous Lexical Scoring from JD Text
  const jd = String(jdText || '');
  let scoreA = 0;
  for (const pat of TRACK_A_PATTERNS) {
    const matches = jd.match(pat);
    if (matches) scoreA += matches.length;
  }

  let scoreB = 0;
  for (const pat of TRACK_B_PATTERNS) {
    const matches = jd.match(pat);
    if (matches) scoreB += matches.length;
  }

  // Weight heavy signals: if "python" or "postgres" appear >= 2 times or "data platform" appears
  const isHeavyData = /\bdata platform\b/i.test(jd) ||
    ((jd.match(/\bpython\b/gi) || []).length >= 2 && (jd.match(/\bpostgres\b/gi) || []).length >= 1);

  if (isHeavyData || (scoreA > scoreB && scoreA >= 3)) {
    return {
      trackId: TRACK_A_ID,
      trackName: 'Track A: Linux, Python & Distributed Data Platform',
      source: 'auto',
      scoreA,
      scoreB,
    };
  }

  return {
    trackId: TRACK_B_ID,
    trackName: 'Track B: Node.js, Bun, TypeScript & Cloud Microservices',
    source: 'auto',
    scoreA,
    scoreB,
  };
}

/**
 * Reframe candidate profile based on the selected track preset.
 * @param {object} profile 
 * @param {string} trackId 
 * @returns {object} reframed profile clone
 */
export function applyPersonaTrackToProfile(profile, trackId) {
  if (!profile) return profile;
  const cloned = JSON.parse(JSON.stringify(profile));

  const tracks = cloned?.narrative?.tracks || {};
  const activePreset = tracks[trackId];

  // Guarantee STEM annotation in education
  if (Array.isArray(cloned.education)) {
    cloned.education = cloned.education.map((edu) => {
      const degree = String(edu.degree || '');
      if ((degree.includes('MCA') || degree.includes('BCA') || degree.includes('Computer')) && !degree.includes('STEM')) {
        return { ...edu, degree: `${degree} — STEM` };
      }
      return edu;
    });
  }

  if (!activePreset) {
    return cloned;
  }

  // Apply narrative overrides
  if (!cloned.narrative) cloned.narrative = {};
  if (activePreset.headline) cloned.narrative.headline = activePreset.headline;
  if (activePreset.exit_story) cloned.narrative.exit_story = activePreset.exit_story;
  if (Array.isArray(activePreset.superpowers) && activePreset.superpowers.length > 0) {
    cloned.narrative.superpowers = [...activePreset.superpowers];
  }
  if (Array.isArray(activePreset.proof_points) && activePreset.proof_points.length > 0) {
    cloned.narrative.proof_points = [...activePreset.proof_points];
  }

  // Apply track-specific experience reframings if present
  if (activePreset.experience_reframes && Array.isArray(cloned.experience)) {
    cloned.experience = cloned.experience.map((exp) => {
      const comp = String(exp?.company || '').toLowerCase();
      if (comp.includes('quest') && activePreset.experience_reframes.quest) {
        return {
          ...exp,
          role: activePreset.experience_reframes.quest.role || exp.role,
          bullets: [...activePreset.experience_reframes.quest.bullets],
        };
      }
      if (comp.includes('intverse') && activePreset.experience_reframes.intverse) {
        return {
          ...exp,
          role: activePreset.experience_reframes.intverse.role || exp.role,
          bullets: [...activePreset.experience_reframes.intverse.bullets],
        };
      }
      if (comp.includes('glidewell') && activePreset.experience_reframes.glidewell) {
        return {
          ...exp,
          role: activePreset.experience_reframes.glidewell.role || exp.role,
          bullets: [...activePreset.experience_reframes.glidewell.bullets],
        };
      }
      return exp;
    });
  }

  return cloned;
}
