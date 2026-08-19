'use client';

import { motion } from 'framer-motion';

/**
 * Floating competency score badge — overlaid on the live resume preview.
 * Shows section-level scores like "Technical Depth: 9.5/10".
 */
export type CompetencyScore = {
  label: string;
  score: number;
  maxScore?: number;
};

export function CompetencyBadge({
  label,
  score,
  maxScore = 10,
  index = 0,
}: CompetencyScore & { index?: number }) {
  const pct = score / maxScore;
  const color =
    pct >= 0.85
      ? { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800' }
      : pct >= 0.6
        ? { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800' }
        : { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-800' };

  return (
    <motion.div
      initial={{ opacity: 0, x: 12, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ delay: 0.15 + index * 0.08, type: 'spring', damping: 22, stiffness: 260 }}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 shadow-sm backdrop-blur-sm ${color.bg} ${color.border}`}
    >
      <span className={`text-[10px] font-bold ${color.text}`}>{label}</span>
      <span className={`text-[10px] font-bold tabular-nums ${color.text}`}>
        {score.toFixed(1)}/{maxScore}
      </span>
    </motion.div>
  );
}

/**
 * Container for multiple competency badges — positioned absolutely on the right edge of preview.
 */
export function CompetencyBadgeStack({
  scores,
  visible,
}: {
  scores: CompetencyScore[];
  visible: boolean;
}) {
  if (!visible || scores.length === 0) return null;

  return (
    <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
      {scores.map((s, i) => (
        <CompetencyBadge key={s.label} {...s} index={i} />
      ))}
    </div>
  );
}
