/**
 * Shared resume bullet normalization (root resume-quality.mjs).
 * Used by Studio preview + PDF export so master resumes match tailor quality.
 */
export {
  normalizeExperienceBulletList,
  sanitizeExperienceEntries,
  formatPeriodDisplay,
  isEmbeddedJobHeader,
  isIncompleteBullet,
  isGarbledBullet,
  isBulletContinuationFragment,
  preferSourceIfThin,
  parseTenureMonths,
} from '../../../../resume-quality.mjs';
