/** Display date ranges as "Jul 2025 - Present". Never --, en-dash, or em-dash. */
export function formatPeriodDisplay(raw: string): string {
  return String(raw || '')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/\s*-\s*/g, ' - ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
