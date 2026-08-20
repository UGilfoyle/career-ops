/** Node mirror of src/lib/analytics/run-metadata.ts for backfill scripts. */

export function normalizeActionType(actionScript) {
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

export function parseJobIdFromActionArgs(actionArgs) {
  const raw = String(actionArgs || '').trim();
  if (!raw) return null;
  const first = raw.split(/\s+/)[0];
  if (/^\d+$/.test(first)) return Number.parseInt(first, 10);
  return null;
}

export function parseRunMetadata(input = {}) {
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
