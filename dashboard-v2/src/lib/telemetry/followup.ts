export type EngagementFollowupInput = {
  company: string;
  role: string;
  viewCount: number;
  clickCount: number;
  dwellSec: number;
  clicksGh: number;
  clicksLi: number;
  lastEngagedAt: Date | null;
  appliedAt: Date | null;
};

export type EngagementFollowup = {
  subject: string;
  body: string;
  hook: string;
  priority: 'now' | 'soon' | 'wait';
  suggested_wait_hours: number;
  reason: string;
};

function formatDwell(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? `${m}m ${s}s` : `${m}m`;
}

function hoursSince(d: Date | null): number | null {
  if (!d || Number.isNaN(d.getTime())) return null;
  return (Date.now() - d.getTime()) / (1000 * 60 * 60);
}

/**
 * Deterministic follow-up from stealth engagement — no LLM, instant copy.
 */
export function buildEngagementFollowup(input: EngagementFollowupInput): EngagementFollowup {
  const company = input.company.trim() || 'the team';
  const role = input.role.trim() || 'the role';
  const hoursSinceEngage = hoursSince(input.lastEngagedAt);
  const hoursSinceApply = hoursSince(input.appliedAt);

  let priority: EngagementFollowup['priority'] = 'soon';
  let suggested_wait_hours = 4;
  let reason = 'Recruiter opened your companion link.';

  if (input.dwellSec >= 90 || input.clickCount >= 2 || input.clicksGh >= 1) {
    priority = 'now';
    suggested_wait_hours = 0;
    reason = 'Strong signal: meaningful dwell and/or outbound clicks.';
  } else if (hoursSinceEngage != null && hoursSinceEngage < 2) {
    priority = 'wait';
    suggested_wait_hours = 2;
    reason = 'Very recent open — give them a short window before nudging.';
  } else if (hoursSinceApply != null && hoursSinceApply < 48 && input.viewCount === 1 && input.clickCount === 0) {
    priority = 'soon';
    suggested_wait_hours = 24;
    reason = 'Single light view — follow up after a day if no reply.';
  }

  const interestBits: string[] = [];
  if (input.clicksGh > 0) interestBits.push('GitHub');
  if (input.clicksLi > 0) interestBits.push('LinkedIn');
  if (input.dwellSec >= 60) interestBits.push(`${formatDwell(input.dwellSec)} on the profile`);

  const hook =
    interestBits.length > 0
      ? `Noticed interest in ${interestBits.join(' + ')}`
      : `Saw the ${role} profile got a look`;

  const subject = `Following up — ${role} at ${company}`;

  const bodyLines = [
    `Hi,`,
    ``,
    `I applied for the ${role} role at ${company} and wanted to follow up briefly.`,
    interestBits.length > 0
      ? `If helpful, happy to walk through the work behind ${interestBits[0] === 'GitHub' ? 'the GitHub projects' : 'the profile'} or answer any questions on fit.`
      : `Happy to share a short walkthrough of relevant backend / systems work, or jump on a quick call if useful.`,
    ``,
    `Thanks for your time — open to whatever next step works on your side.`,
    ``,
    `Best,`,
  ];

  return {
    subject,
    body: bodyLines.join('\n'),
    hook,
    priority,
    suggested_wait_hours,
    reason,
  };
}
