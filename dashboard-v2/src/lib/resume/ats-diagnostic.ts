import type { ResumeContext } from './types';
import { getCompetencies } from './types';
import { masterSummaryText } from './fill-template';

export type AtsFinding = {
  id: string;
  severity: 'critical' | 'warning' | 'tip';
  title: string;
  description: string;
  recommendation: string;
};

export type CategoryScore = {
  score: number; // 0-100
  label: string;
  details: string;
};

export type AtsDiagnostic = {
  overallScore: number; // 0-100
  tier: 'Elite (Top 5%)' | 'Strong (Competitive)' | 'Moderate (Polish Needed)' | 'At Risk (Filters Likely)';
  tierColor: 'green' | 'emerald' | 'amber' | 'red';
  categories: {
    keywordMatch: CategoryScore & { matched: string[]; missing: string[]; coveragePct: number };
    formattingLayout: CategoryScore & { passedChecks: string[]; failedChecks: string[] };
    impactMetrics: CategoryScore & { metricsPct: number; strongVerbsPct: number };
    sectionCompleteness: CategoryScore & { sections: Record<string, boolean> };
  };
  findings: AtsFinding[];
};

const ACTION_VERBS = new Set([
  'accelerated', 'achieved', 'administered', 'analyzed', 'architected', 'automated',
  'built', 'championed', 'consolidated', 'constructed', 'coordinated', 'created',
  'decreased', 'delivered', 'deployed', 'designed', 'developed', 'devised',
  'eliminated', 'engineered', 'enhanced', 'established', 'executed', 'expanded',
  'expedited', 'formulated', 'generated', 'guided', 'implemented', 'improved',
  'increased', 'initiated', 'instituted', 'integrated', 'introduced', 'invented',
  'launched', 'led', 'maximized', 'mentored', 'minimized', 'modernized',
  'negotiated', 'optimized', 'orchestrated', 'overhauled', 'pioneered', 'produced',
  'reduced', 'refactored', 'restructured', 'revamped', 'scaled', 'simplified',
  'spearheaded', 'standardized', 'streamlined', 'strengthened', 'supervised',
  'transformed', 'unified', 'upgraded',
]);

const METRICS_REGEX = /\b(\d+(?:\.\d+)?%|\$\d+(?:,\d+)*(?:\.\d+)?[kKmMbB]?|\b\d+\+\b|\b\d+x\b|\b\d+\s*(?:ms|seconds|users|requests|tps|qps|tb|gb|million|billion|k|lpa|cr)\b)/i;

export function evaluateAtsDiagnostic(
  profile: ResumeContext,
  jdKeywords?: { matched: string[]; missing: string[]; total: number } | null,
): AtsDiagnostic {
  const c = profile.candidate || {};
  const n = profile.narrative || {};
  const exp = profile.experience || [];
  const edu = profile.education || [];
  const skills = getCompetencies(profile);
  const summary = masterSummaryText(profile).trim();

  // 1. Formatting & Layout Checks
  const passedChecks: string[] = [];
  const failedChecks: string[] = [];

  if (c.full_name?.trim() && c.full_name.trim().length >= 3) {
    passedChecks.push('Candidate Name present');
  } else {
    failedChecks.push('Missing Candidate Full Name');
  }

  if (c.email?.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email.trim())) {
    passedChecks.push('Valid Email Address');
  } else {
    failedChecks.push('Missing or invalid Email Address');
  }

  if (c.phone?.trim() && c.phone.trim().length >= 7) {
    passedChecks.push('Phone Number present');
  } else {
    failedChecks.push('Missing Phone Number');
  }

  if (c.linkedin?.trim() || c.github?.trim() || c.portfolio_url?.trim()) {
    passedChecks.push('Professional Links (LinkedIn/GitHub/Portfolio)');
  } else {
    failedChecks.push('No professional profile links provided');
  }

  if (c.location?.trim()) {
    passedChecks.push('Location / Geographic residency defined');
  } else {
    failedChecks.push('Missing Location / Work Authorization Region');
  }

  if (summary.length >= 40) {
    passedChecks.push('Standard Professional Summary block');
  } else {
    failedChecks.push('Summary block is missing or too brief');
  }

  if (exp.length > 0) {
    passedChecks.push('Standard Work Experience chronology');
  } else {
    failedChecks.push('No Work Experience listed');
  }

  if (skills.length >= 6) {
    passedChecks.push('Standard Core Competencies block');
  } else {
    failedChecks.push('Fewer than 6 Core Competencies defined');
  }

  if (edu.length > 0) {
    passedChecks.push('Education background listed');
  } else {
    failedChecks.push('Missing Education details');
  }

  const formatScore = Math.round((passedChecks.length / (passedChecks.length + failedChecks.length)) * 100);

  // 2. Impact & Metrics Checks
  const allBullets = exp.flatMap((role) => (Array.isArray(role.bullets) ? role.bullets.map((b) => String(b).trim()) : [])).filter(Boolean);
  let bulletsWithMetrics = 0;
  let bulletsWithVerbs = 0;

  for (const b of allBullets) {
    if (METRICS_REGEX.test(b)) bulletsWithMetrics++;
    const firstWord = (b.split(/\s+/)[0] || '').toLowerCase().replace(/[^a-z]/g, '');
    if (ACTION_VERBS.has(firstWord)) bulletsWithVerbs++;
  }

  const totalBullets = allBullets.length || 1;
  const metricsPct = Math.round((bulletsWithMetrics / totalBullets) * 100);
  const strongVerbsPct = Math.round((bulletsWithVerbs / totalBullets) * 100);
  const impactScore = Math.round(metricsPct * 0.5 + strongVerbsPct * 0.5);

  // 3. Section Completeness
  const sectionRecord = {
    contact: Boolean(c.full_name && c.email && c.phone),
    summary: summary.length >= 40,
    experience: exp.length >= 1 && exp.some((e) => (e.bullets || []).length >= 2),
    skills: skills.length >= 6,
    education: edu.length >= 1,
  };
  const sectionCount = Object.values(sectionRecord).filter(Boolean).length;
  const sectionScore = Math.round((sectionCount / 5) * 100);

  // 4. Keyword Match
  let keywordScore = 75; // Baseline if no JD supplied
  let matchedKw: string[] = [];
  let missingKw: string[] = [];
  let coveragePct = 75;

  if (jdKeywords && jdKeywords.total > 0) {
    matchedKw = jdKeywords.matched || [];
    missingKw = jdKeywords.missing || [];
    coveragePct = Math.min(100, Math.round((matchedKw.length / jdKeywords.total) * 100));
    keywordScore = coveragePct;
  }

  // 5. Composite Overall Score
  const hasJd = Boolean(jdKeywords && jdKeywords.total > 0);
  const overallScore = hasJd
    ? Math.round(keywordScore * 0.4 + formatScore * 0.25 + impactScore * 0.2 + sectionScore * 0.15)
    : Math.round(formatScore * 0.35 + impactScore * 0.35 + sectionScore * 0.3);

  // Determine Tier
  let tier: AtsDiagnostic['tier'] = 'At Risk (Filters Likely)';
  let tierColor: AtsDiagnostic['tierColor'] = 'red';
  if (overallScore >= 88) {
    tier = 'Elite (Top 5%)';
    tierColor = 'green';
  } else if (overallScore >= 75) {
    tier = 'Strong (Competitive)';
    tierColor = 'emerald';
  } else if (overallScore >= 60) {
    tier = 'Moderate (Polish Needed)';
    tierColor = 'amber';
  }

  // 6. Actionable Findings
  const findings: AtsFinding[] = [];

  if (!c.email || !c.phone) {
    findings.push({
      id: 'missing-contact',
      severity: 'critical',
      title: 'Missing Core Contact Information',
      description: 'ATS parsers reject candidate profiles lacking verifiable direct phone and email coordinates.',
      recommendation: 'Add verified phone and email in the Candidate details section.',
    });
  }

  if (hasJd && missingKw.length > 0) {
    const topMissing = missingKw.slice(0, 5).join(', ');
    findings.push({
      id: 'missing-keywords',
      severity: missingKw.length > 5 ? 'critical' : 'warning',
      title: `${missingKw.length} Target Keywords Missing from Profile`,
      description: `The job description heavily references core competencies not yet indexed in your master profile: ${topMissing}.`,
      recommendation: 'Use 1-click Auto-Weave in Resume Studio to naturally incorporate these keywords into your summary and skills.',
    });
  }

  if (metricsPct < 40) {
    findings.push({
      id: 'low-metrics',
      severity: 'warning',
      title: 'Bullet Points Lack Quantified Impact Metrics',
      description: `Only ${metricsPct}% of experience bullets contain numerical proof points (%, $, latency, scale, revenue). High-screening ATS prioritize quantifiable results over task lists.`,
      recommendation: 'Add specific percentages, dollar amounts, team sizes, or speedups to your recent project bullets.',
    });
  }

  if (strongVerbsPct < 60) {
    findings.push({
      id: 'weak-action-verbs',
      severity: 'tip',
      title: 'Enhance Action Verb Leadership',
      description: `${100 - strongVerbsPct}% of bullets start with passive descriptions rather than decisive impact verbs (e.g. "Architected", "Engineered", "Optimized").`,
      recommendation: 'Start each bullet with an active past-tense engineering verb.',
    });
  }

  if (!sectionRecord.education) {
    findings.push({
      id: 'missing-education',
      severity: 'warning',
      title: 'Missing Education Credentials',
      description: 'Corporate ATS parsers flag unpopulated education sections during automated credential screening.',
      recommendation: 'List your highest completed degree and institution.',
    });
  }

  return {
    overallScore,
    tier,
    tierColor,
    categories: {
      keywordMatch: {
        score: keywordScore,
        label: 'Keyword & Skill Match',
        details: hasJd
          ? `${matchedKw.length}/${(jdKeywords?.total || 0)} JD keywords aligned (${coveragePct}%)`
          : 'Profile core skill coverage',
        matched: matchedKw,
        missing: missingKw,
        coveragePct,
      },
      formattingLayout: {
        score: formatScore,
        label: 'ATS Layout & Hygiene',
        details: `${passedChecks.length}/${passedChecks.length + failedChecks.length} standards verified`,
        passedChecks,
        failedChecks,
      },
      impactMetrics: {
        score: impactScore,
        label: 'Impact & Quantified Proof',
        details: `${metricsPct}% bullets with metrics, ${strongVerbsPct}% strong action verbs`,
        metricsPct,
        strongVerbsPct,
      },
      sectionCompleteness: {
        score: sectionScore,
        label: 'Section Completeness',
        details: `${sectionCount}/5 core sections complete`,
        sections: sectionRecord,
      },
    },
    findings,
  };
}
