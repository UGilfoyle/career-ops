/** Bump when the in-dashboard tour changes materially — new users always see latest. */
export const ONBOARDING_STORAGE_KEY = 'career_ops_onboarding_v3';

export type PublicFlowStep = {
  id: string;
  step: string;
  title: string;
  summary: string;
  detail: string;
  command?: string;
};

/** Shown on landing + signup — no account required. */
export const PUBLIC_GETTING_STARTED: PublicFlowStep[] = [
  {
    id: 'signup',
    step: '1',
    title: 'Create your account',
    summary: 'Sign up free, verify email, open your dashboard.',
    detail: 'GitHub or email signup. After verify you land on the dashboard with a guided tour — no credit card.',
  },
  {
    id: 'profile',
    step: '2',
    title: 'Set profile & keywords',
    summary: 'Resume, experience, and targeting keywords in Settings.',
    detail: 'Positive keywords (e.g. Senior, Backend, AWS) drive AI scoring. Negative keywords filter noise (Junior, PHP).',
  },
  {
    id: 'discover',
    step: '3',
    title: 'Discover jobs',
    summary: 'GCC captives vs general boards — two different scan commands.',
    detail: 'Targeting GCC/captive roles? Run gcc-scan --deep. Broad job-board hunt? Run scan --deep. Both need GitHub PAT for --deep on cloud.',
    command: 'gcc-scan --deep',
  },
  {
    id: 'tailor',
    step: '4',
    title: 'Tailor & apply',
    summary: 'Pipeline → Tailor or Resume Studio for ATS-optimized PDFs.',
    detail: 'High scores (7+) are strong matches. Tailor generates role-specific resumes. Mark Applied keeps pipeline in sync.',
    command: 'tailor <job_id> --deep',
  },
  {
    id: 'gcc',
    step: '5',
    title: 'GCC outreach (optional)',
    summary: 'GCC Campaign tab — curated DMs, not blind Apply Now.',
    detail: 'Import high-value GCC jobs, log LinkedIn/email outreach, and track follow-ups in the 30-day campaign tracker.',
  },
];

export type DashboardTourStep = {
  target: string | null;
  title: string;
  content: string;
  tab?: string;
};

/** In-app walkthrough copy (icons mapped in Dashboard). */
export const DASHBOARD_TOUR_STEPS: DashboardTourStep[] = [
  {
    target: null,
    title: 'Welcome to Career-Ops',
    content:
      'Your job search workspace: discover roles, score matches, tailor resumes, track applications, and run GCC outreach. This quick tour covers the usual workflow.',
  },
  {
    target: 'nav-settings',
    title: 'Start in Settings',
    content:
      'Upload your resume or fill Experience & Education. Add a 2–3 sentence headline and your targeting keywords. The AI uses this for scoring, tailoring, and Career Copilot answers.',
  },
  {
    target: 'config-targeting',
    title: 'Smart job filtering',
    content:
      'POSITIVE keywords = roles you want (Senior, Backend, Remote). NEGATIVE = noise to drop (Junior, PHP). Every pipeline job gets a 0–10 AI score from these rules.',
    tab: 'settings',
  },
  {
    target: 'nav-terminal',
    title: 'The command terminal',
    content:
      'Type commands here. gcc-scan --deep hunts GCC/captive employers (Stripe, JPMorgan, SAP Labs…) in India hubs. scan --deep crawls LinkedIn, Naukri, Indeed broadly. Add --deep on Vercel (needs GitHub PAT in Settings).',
  },
  {
    target: 'nav-pipeline',
    title: 'Your job pipeline',
    content:
      'Discovered jobs land here with AI scores. GCC jobs show a GCC badge + signal score. Click Evaluate, Tailor, or Mark Applied — applied jobs stay visible with a green Applied status.',
  },
  {
    target: 'nav-gcc',
    title: 'GCC Campaign tracker',
    content:
      'Targeting captive employers? After gcc-scan --deep, import high-value jobs here. Log DMs, emails, and follow-ups — curated outreach beats blind Apply Now.',
  },
  {
    target: 'nav-resume-studio',
    title: 'Resume Studio',
    content:
      'Live ATS preview, JD match scoring, template picker, and one-click PDF export. Pick a pipeline job for JD context, then tailor from Studio or the Terminal.',
  },
  {
    target: 'nav-chat',
    title: 'Career Copilot',
    content:
      'Chat with AI that knows your profile. Draft LinkedIn outreach, prep interviews, analyze skill gaps, or ask what to run next in the terminal.',
  },
  {
    target: 'nav-practice',
    title: 'Interview Practice',
    content:
      'Generate a JD-linked practice pack (coding, system design, behavioral). Free: 1 pack / week. Pro includes unlimited.',
  },
  {
    target: null,
    title: "You're ready",
    content:
      'Quick start: 1) Save Settings 2) gcc-scan --deep or scan --deep 3) Tailor a 7+ match 4) Mark Applied when done 5) Log GCC outreach if relevant. Type help in Terminal anytime.',
  },
];
