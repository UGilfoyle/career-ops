'use client';

import { Field } from '../SectionAccordion';
import type { Candidate } from '@/lib/resume/types';

export function PersonalInfoSection({
  candidate,
  onChange,
}: {
  candidate: Candidate;
  onChange: (patch: Partial<Candidate>) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="sm:col-span-2">
        <Field
          label="Full name"
          value={candidate.full_name || ''}
          onChange={(v) => onChange({ full_name: v })}
          placeholder="Jane Doe"
        />
      </div>
      <Field
        label="Email"
        type="email"
        value={candidate.email || ''}
        onChange={(v) => onChange({ email: v })}
        placeholder="jane@example.com"
      />
      <Field
        label="Phone"
        value={candidate.phone || ''}
        onChange={(v) => onChange({ phone: v })}
        placeholder="+1 (555) 000-0000"
      />
      <Field
        label="Location"
        value={candidate.location || ''}
        onChange={(v) => onChange({ location: v })}
        placeholder="San Francisco, CA"
      />
      <Field
        label="LinkedIn"
        value={candidate.linkedin || ''}
        onChange={(v) => onChange({ linkedin: v })}
        placeholder="linkedin.com/in/jane"
      />
      <Field
        label="GitHub"
        value={candidate.github || ''}
        onChange={(v) => onChange({ github: v })}
        placeholder="github.com/jane"
      />
      <Field
        label="Portfolio URL"
        value={candidate.portfolio_url || ''}
        onChange={(v) => onChange({ portfolio_url: v })}
        placeholder="jane.dev"
      />
    </div>
  );
}
