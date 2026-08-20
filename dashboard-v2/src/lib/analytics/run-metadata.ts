/** Normalize background run scripts → product action types for analytics. */
export type ProductActionType =
  | 'scan'
  | 'gcc_scan'
  | 'tailor'
  | 'apply'
  | 'add_job'
  | 'export_pdf'
  | 'unknown';

export function normalizeActionType(actionScript?: string | null): ProductActionType {
  const s = String(actionScript || '').trim().toLowerCase();
  if (!s) return 'unknown';
  if (s.includes('scratch-scan')) return 'scan';
  if (s.includes('gcc-scan')) return 'gcc_scan';
  if (s.includes('agentic-tailor')) return 'tailor';
  if (s.includes('auto-apply')) return 'apply';
  if (s.includes('add-job')) return 'add_job';
  if (s.includes('export-pdf') || s.includes('export_master') || s.includes('export-job-pdf')) return 'export_pdf';
  return 'unknown';
}

/** First numeric token in tailor/apply args is usually job_id. */
export function parseJobIdFromActionArgs(actionArgs?: string | null): number | null {
  const raw = String(actionArgs || '').trim();
  if (!raw) return null;
  const first = raw.split(/\s+/)[0];
  if (/^\d+$/.test(first)) return Number.parseInt(first, 10);
  return null;
}

export function parseRunMetadata(input: {
  actionScript?: string | null;
  actionArgs?: string | null;
  jobId?: number | string | null;
}): { action_type: ProductActionType; job_id: number | null } {
  const action_type = normalizeActionType(input.actionScript);
  const parsed = parseJobIdFromActionArgs(input.actionArgs);
  const explicit =
    input.jobId != null && String(input.jobId).trim() !== ''
      ? Number.parseInt(String(input.jobId), 10)
      : null;
  const job_id =
    explicit != null && Number.isFinite(explicit)
      ? explicit
      : parsed != null && Number.isFinite(parsed)
        ? parsed
        : null;
  return { action_type, job_id };
}

/** Job row has tailored deliverables — source of truth for "resume banaya". */
export const TAILORED_JOB_PREDICATE = `(
  resume_html IS NOT NULL
  OR cover_letter_html IS NOT NULL
  OR resume_pdf_key IS NOT NULL
  OR cover_letter_pdf_key IS NOT NULL
  OR resume_pdf IS NOT NULL
  OR cover_letter_pdf IS NOT NULL
)`;

export function tailoredJobPredicate(alias = ''): string {
  const p = alias ? `${alias}.` : '';
  return `(
    ${p}resume_html IS NOT NULL
    OR ${p}cover_letter_html IS NOT NULL
    OR ${p}resume_pdf_key IS NOT NULL
    OR ${p}cover_letter_pdf_key IS NOT NULL
    OR ${p}resume_pdf IS NOT NULL
    OR ${p}cover_letter_pdf IS NOT NULL
  )`;
}
