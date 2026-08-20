/** Bump when the in-dashboard tour changes materially — new users always see latest. */
export const ONBOARDING_STORAGE_KEY = 'career_ops_onboarding_v4';

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
    detail: 'GitHub or email signup. After verify you land on the dashboard with a guided tour, no credit card required.',
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
    summary: 'GCC captives vs general boards, two dedicated scan engines.',
    detail: 'Targeting GCC/captive roles? Run gcc-scan --deep. Broad job-board hunt? Run scan --deep. Both run seamlessly in the cloud.',
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
    title: 'GCC outreach & practice',
    summary: 'GCC Campaign & Interview Practice IDE.',
    detail: 'Import high-value GCC jobs, log LinkedIn DMs, and prepare in the multi-language coding & system design IDE.',
  },
];

export type DashboardTourStep = {
  target: string | null;
  title: string;
  content: string;
  tab?: string;
  actionHint?: string;
};

/** In-app walkthrough steps with automatic tab switching and live target spotlights. */
export const DASHBOARD_TOUR_STEPS: DashboardTourStep[] = [
  {
    target: null,
    title: 'Welcome to Career-Ops',
    content:
      'Your AI-powered job search command center. Discover high-match jobs, tailor ATS-optimized resumes in 15 layouts, practice technical interviews, and track applications.',
    actionHint: 'Take the 1-minute interactive tour',
  },
  {
    target: 'nav-settings',
    title: 'Step 1: Settings & Targeting Rules',
    content:
      'Configure your profile, headline, and positive/negative keywords (e.g. Senior, Backend, AWS vs Junior, PHP). The AI uses these to calculate 0–10 match scores automatically.',
    tab: 'settings',
    actionHint: 'Profile keywords drive all scoring',
  },
  {
    target: 'nav-terminal',
    title: 'Step 2: Command Terminal',
    content:
      'Run cloud automation directly: scan --deep crawls 45+ job portals, gcc-scan --deep targets captive GCC employers, and eval <id> tailors resumes instantly.',
    tab: 'terminal',
    actionHint: 'Type commands or click action buttons',
  },
  {
    target: 'nav-pipeline',
    title: 'Step 3: Pipeline Studio & Smart Filters',
    content:
      'All discovered jobs land here with live match scores. Filter by Hot Matches (7.0+), GCC Targets, or view Applied roles. Completed applications are kept inactive to keep your queue fresh.',
    tab: 'pipeline',
    actionHint: 'Explore hot opportunities & mark applied',
  },
  {
    target: 'nav-resume-studio',
    title: 'Step 4: Resume Studio (15 ATS Templates)',
    content:
      'Live ATS preview with 15 executive layouts including FAANG Elite, Executive Minimalist, and Prime ATS. Live JD keyword matching, section tailoring, and one-click PDF export.',
    tab: 'studio',
    actionHint: '100% single-column ATS verified',
  },
  {
    target: 'nav-practice',
    title: 'Step 5: Interview Practice IDE',
    content:
      'Practice technical coding in 10 languages (Python, JS, Go, Rust, C++, Java) powered by our free sandbox. Also includes Excalidraw system design and STAR behavioral AI scoring.',
    tab: 'practice',
    actionHint: 'Run live test cases & get AI feedback',
  },
  {
    target: 'nav-chat',
    title: 'Step 6: Career Copilot AI',
    content:
      'Chat with an AI assistant that understands your full CV and target roles. Draft high-conversion LinkedIn DMs, analyze skill gaps, or prep for company-specific interview loops.',
    tab: 'chat',
    actionHint: 'Generate outreach messages in seconds',
  },
  {
    target: null,
    title: "You're All Set!",
    content:
      'Quick start: 1) Verify your Settings 2) Run a scan in Terminal 3) Tailor your top matches in Resume Studio 4) Practice coding loops in the IDE. You can restart this tour anytime from the footer.',
    actionHint: 'Start exploring your pipeline',
  },
];
