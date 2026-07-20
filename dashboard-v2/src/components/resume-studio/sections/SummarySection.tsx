'use client';

import { TextArea } from '../SectionAccordion';

export function SummarySection({
  headline,
  exitStory,
  onChange,
}: {
  headline: string;
  exitStory: string;
  onChange: (patch: { headline?: string; exit_story?: string }) => void;
}) {
  return (
    <div className="space-y-3">
      <TextArea
        label="Professional headline"
        value={headline}
        onChange={(v) => onChange({ headline: v })}
        placeholder="Senior engineer building reliable platforms at scale."
        rows={2}
      />
      <TextArea
        label="Professional summary"
        value={exitStory}
        onChange={(v) => onChange({ exit_story: v })}
        placeholder="3–4 tight lines on ownership, stack, and impact. Used as the master summary for all tailoring."
        rows={5}
      />
    </div>
  );
}
