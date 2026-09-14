import type { ResumeContext } from '@/lib/resume/types';

export type ReadinessPillar = {
  name: string;
  score: number;
  maxScore: number;
  percentage: number;
  status: 'strong' | 'moderate' | 'action_needed';
};

export type ReadinessChecklistItem = {
  id: string;
  title: string;
  impactPts: number;
  completed: boolean;
  tab: string;
  tip: string;
};

export type ReadinessReport = {
  score: number; // 0 - 100
  tier: 'Elite (Top 5%)' | 'Market Ready' | 'Competitive' | 'Getting Started';
  summary: string;
  pillars: {
    resume: ReadinessPillar;
    interview: ReadinessPillar;
    pipeline: ReadinessPillar;
  };
  checklist: ReadinessChecklistItem[];
};

export type ReadinessInput = {
  resumeContext?: ResumeContext | null;
  pipelineJobsCount: number;
  applicationsCount: number;
  practicePacksCount: number;
  dossierEnabled?: boolean;
};

export function calculateMarketReadiness(input: ReadinessInput): ReadinessReport {
  const ctx = input.resumeContext || {};
  const candidate = ctx.candidate || {};
  const narrative = ctx.narrative || {};
  const experience = Array.isArray(ctx.experience) ? ctx.experience : [];
  const skills = ctx.skills && typeof ctx.skills === 'object' && !Array.isArray(ctx.skills)
    ? Object.values(ctx.skills).flat()
    : [];

  const checklist: ReadinessChecklistItem[] = [];

  // ==========================================
  // PILLAR 1: Resume & ATS Quality (Max 40 pts)
  // ==========================================
  let resumeScore = 0;

  // 1. Contact & Identity (5 pts)
  const hasBasicContact = Boolean(
    candidate.full_name && (candidate.linkedin || candidate.github || candidate.portfolio_url)
  );
  if (hasBasicContact) {
    resumeScore += 5;
    checklist.push({
      id: 'contact_info',
      title: 'Contact & Social Profiles Linked',
      impactPts: 5,
      completed: true,
      tab: 'resume-studio',
      tip: 'LinkedIn, GitHub, and Portfolio are properly configured.',
    });
  } else {
    checklist.push({
      id: 'contact_info',
      title: 'Link GitHub, LinkedIn & Portfolio',
      impactPts: 5,
      completed: false,
      tab: 'resume-studio',
      tip: 'Recruiters reject resumes without verifiable profile links.',
    });
  }

  // 2. Headline & Career Narrative (5 pts)
  const hasHeadline = Boolean(narrative.headline && narrative.headline.trim().length > 10);
  if (hasHeadline) {
    resumeScore += 5;
    checklist.push({
      id: 'headline',
      title: 'Executive Career Headline Defined',
      impactPts: 5,
      completed: true,
      tab: 'resume-studio',
      tip: 'Clear target role headline helps pass automated ATS title parsers.',
    });
  } else {
    checklist.push({
      id: 'headline',
      title: 'Add a Targeted Executive Headline',
      impactPts: 5,
      completed: false,
      tab: 'resume-studio',
      tip: 'Set a sharp role headline (e.g. Senior Backend & Distributed Systems Engineer).',
    });
  }

  // 3. Work Experience Coverage (10 pts)
  if (experience.length >= 2) {
    resumeScore += 10;
    checklist.push({
      id: 'experience_coverage',
      title: 'Work Experience History Populated (2+ roles)',
      impactPts: 10,
      completed: true,
      tab: 'resume-studio',
      tip: 'Demonstrates career progression and organizational tenure.',
    });
  } else if (experience.length === 1) {
    resumeScore += 5;
    checklist.push({
      id: 'experience_coverage',
      title: 'Add Secondary Work Experience or Major Project',
      impactPts: 5,
      completed: false,
      tab: 'resume-studio',
      tip: 'Add at least 2 structured roles or flagship projects to prove depth.',
    });
  } else {
    checklist.push({
      id: 'experience_coverage',
      title: 'Populate Work Experience',
      impactPts: 10,
      completed: false,
      tab: 'resume-studio',
      tip: 'Add your professional experience and company history.',
    });
  }

  // 4. Quantified Metrics Ratio (10 pts)
  // Scans all bullet points for numbers, %, $, multipliers, latency improvements
  const metricRegex = /\d+[\.,]?\d*%|\$\d+|\b\d+x\b|\b\d{2,}\b|\b\d+\+?\s*(?:ms|users|requests|ops|queries|k|m|b)\b/i;
  let quantifiedBulletsCount = 0;
  for (const exp of experience) {
    const bullets = Array.isArray(exp.bullets) ? exp.bullets : [];
    for (const b of bullets) {
      if (typeof b === 'string' && metricRegex.test(b)) {
        quantifiedBulletsCount++;
      }
    }
  }

  if (quantifiedBulletsCount >= 4) {
    resumeScore += 10;
    checklist.push({
      id: 'quantified_metrics',
      title: 'High Quantified Metrics Density (4+ metrics)',
      impactPts: 10,
      completed: true,
      tab: 'resume-studio',
      tip: 'Great job! Numbers and percentages drastically increase interview callback rates.',
    });
  } else if (quantifiedBulletsCount >= 2) {
    resumeScore += 6;
    checklist.push({
      id: 'quantified_metrics',
      title: 'Add 2 More Quantified Impact Bullets',
      impactPts: 4,
      completed: false,
      tab: 'resume-studio',
      tip: 'Add metrics like % performance gain, $ cost saved, or scale handled.',
    });
  } else {
    checklist.push({
      id: 'quantified_metrics',
      title: 'Quantify Your Accomplishments with Metrics',
      impactPts: 10,
      completed: false,
      tab: 'resume-studio',
      tip: 'Add metrics (e.g. "Reduced query latency by 45%", "Scaled to 100k DAU").',
    });
  }

  // 5. Skills Arsenal (10 pts)
  if (skills.length >= 6) {
    resumeScore += 10;
    checklist.push({
      id: 'skills_arsenal',
      title: 'Core Technical Arsenal Calibrated (6+ skills)',
      impactPts: 10,
      completed: true,
      tab: 'resume-studio',
      tip: 'Strong keyword coverage across Languages, Infrastructure, and Frameworks.',
    });
  } else {
    const missingCount = Math.max(0, 6 - skills.length);
    checklist.push({
      id: 'skills_arsenal',
      title: `Add ${missingCount} More Technical Competencies`,
      impactPts: 10,
      completed: false,
      tab: 'resume-studio',
      tip: 'List your core stack, databases, and infra tools to pass ATS keyword gates.',
    });
  }

  // ==============================================
  // PILLAR 2: Interview Preparedness (Max 30 pts)
  // ==============================================
  let interviewScore = 0;

  // 1. STAR Story Bank Coverage (15 pts)
  const proofPoints = Array.isArray(narrative.proof_points) ? narrative.proof_points : [];
  const superpowers = Array.isArray(narrative.superpowers) ? narrative.superpowers : [];
  const totalStories = proofPoints.length + superpowers.length;

  if (totalStories >= 3) {
    interviewScore += 15;
    checklist.push({
      id: 'star_stories',
      title: 'STAR Story Bank Prepared (3+ structured stories)',
      impactPts: 15,
      completed: true,
      tab: 'chat',
      tip: 'Proven track record of answering behavioral & Bar-Raiser questions with structure.',
    });
  } else if (totalStories >= 1) {
    interviewScore += 8;
    checklist.push({
      id: 'star_stories',
      title: 'Add 2 More STAR Stories to Story Bank',
      impactPts: 7,
      completed: false,
      tab: 'chat',
      tip: 'Ask Career Copilot: "Help me craft 2 STAR stories for system failure and leadership".',
    });
  } else {
    checklist.push({
      id: 'star_stories',
      title: 'Build Your STAR Story Bank',
      impactPts: 15,
      completed: false,
      tab: 'chat',
      tip: 'Draft at least 3 STAR stories for conflict, complexity, and failure rounds.',
    });
  }

  // 2. Voice Mock Interview Completed (15 pts)
  if (input.practicePacksCount >= 1) {
    interviewScore += 15;
    checklist.push({
      id: 'voice_mock',
      title: 'Bar-Raiser Voice Mock Practiced',
      impactPts: 15,
      completed: true,
      tab: 'practice',
      tip: 'Completed spoken interview simulations with instant scorecard feedback.',
    });
  } else {
    checklist.push({
      id: 'voice_mock',
      title: 'Complete 1 Voice Mock Interview Round',
      impactPts: 15,
      completed: false,
      tab: 'practice',
      tip: 'Simulate a live 10-minute spoken mock interview to practice under pressure.',
    });
  }

  // ==============================================
  // PILLAR 3: Pipeline Health & Search (Max 30 pts)
  // ==============================================
  let pipelineScore = 0;

  // 1. Scanned Pipeline Breadth (10 pts)
  if (input.pipelineJobsCount >= 5) {
    pipelineScore += 10;
    checklist.push({
      id: 'pipeline_breadth',
      title: 'Active Job Pipeline (5+ ranked jobs)',
      impactPts: 10,
      completed: true,
      tab: 'pipeline',
      tip: 'Healthy job funnel prevents scarcity mindset and improves offer leverage.',
    });
  } else if (input.pipelineJobsCount >= 1) {
    pipelineScore += 5;
    checklist.push({
      id: 'pipeline_breadth',
      title: 'Scan 5+ Relevant Target Jobs',
      impactPts: 5,
      completed: false,
      tab: 'pipeline',
      tip: 'Run a deep scan or add target jobs to your pipeline.',
    });
  } else {
    checklist.push({
      id: 'pipeline_breadth',
      title: 'Scan and Add Jobs to Your Pipeline',
      impactPts: 10,
      completed: false,
      tab: 'pipeline',
      tip: 'Use Job Pipeline or terminal scanner to find active openings.',
    });
  }

  // 2. Applications Tracked (15 pts)
  if (input.applicationsCount >= 5) {
    pipelineScore += 15;
    checklist.push({
      id: 'applications_sent',
      title: 'Application Cadence Maintained (5+ sent)',
      impactPts: 15,
      completed: true,
      tab: 'apps',
      tip: 'Consistent application volume with high-fit scores yields active interview loops.',
    });
  } else if (input.applicationsCount >= 2) {
    pipelineScore += 8;
    checklist.push({
      id: 'applications_sent',
      title: 'Submit & Track 3 More Targeted Applications',
      impactPts: 7,
      completed: false,
      tab: 'apps',
      tip: 'Aim for 5 tailored, high-fit applications per week.',
    });
  } else {
    checklist.push({
      id: 'applications_sent',
      title: 'Apply and Track Your First 3 Applications',
      impactPts: 15,
      completed: false,
      tab: 'apps',
      tip: 'Tailor your resume for top-scoring jobs and log your applications.',
    });
  }

  // 3. Public Dossier Active (5 pts)
  if (input.dossierEnabled !== false) {
    pipelineScore += 5;
    checklist.push({
      id: 'public_dossier',
      title: 'Public Candidate Dossier Active',
      impactPts: 5,
      completed: true,
      tab: 'dossier',
      tip: 'Your verified dossier link is live for recruiters and LinkedIn bio.',
    });
  } else {
    checklist.push({
      id: 'public_dossier',
      title: 'Enable Your Public Candidate Dossier',
      impactPts: 5,
      completed: false,
      tab: 'dossier',
      tip: 'Turn on your shareable dossier link to showcase proof-of-work.',
    });
  }

  // ==============================================
  // Total Score & Tier Classification
  // ==============================================
  const totalScore = Math.min(100, Math.max(0, resumeScore + interviewScore + pipelineScore));

  let tier: ReadinessReport['tier'] = 'Getting Started';
  let summary = 'Set up your resume and scan target roles to begin.';

  if (totalScore >= 88) {
    tier = 'Elite (Top 5%)';
    summary = 'Market-ready candidate profile with verified ATS alignment, STAR interview prep, and active pipeline cadence.';
  } else if (totalScore >= 70) {
    tier = 'Market Ready';
    summary = 'Strong candidacy. Address remaining checklist items to maximize offer conversion.';
  } else if (totalScore >= 45) {
    tier = 'Competitive';
    summary = 'Good foundation. Complete a voice mock interview and add more quantified metrics to stand out.';
  }

  const pillarStatus = (score: number, max: number): ReadinessPillar['status'] => {
    const pct = Math.round((score / max) * 100);
    if (pct >= 80) return 'strong';
    if (pct >= 50) return 'moderate';
    return 'action_needed';
  };

  return {
    score: totalScore,
    tier,
    summary,
    pillars: {
      resume: {
        name: 'Resume & ATS Calibration',
        score: resumeScore,
        maxScore: 40,
        percentage: Math.round((resumeScore / 40) * 100),
        status: pillarStatus(resumeScore, 40),
      },
      interview: {
        name: 'Interview & Story Bank',
        score: interviewScore,
        maxScore: 30,
        percentage: Math.round((interviewScore / 30) * 100),
        status: pillarStatus(interviewScore, 30),
      },
      pipeline: {
        name: 'Pipeline & Search Cadence',
        score: pipelineScore,
        maxScore: 30,
        percentage: Math.round((pipelineScore / 30) * 100),
        status: pillarStatus(pipelineScore, 30),
      },
    },
    checklist: checklist.sort((a, b) => {
      // Incomplete tasks first, then by impact
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return b.impactPts - a.impactPts;
    }),
  };
}
