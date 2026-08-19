'use client';

/**
 * Animated SVG circular progress ring.
 * Used in JD Match Inspector to show coverage percentage.
 */
export function MatchProgressRing({
  value,
  size = 72,
  strokeWidth = 5,
  label,
  sublabel,
  color,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  sublabel?: string;
  color?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, value));
  const offset = circumference - (pct / 100) * circumference;

  const ringColor =
    color || (pct >= 75 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444');

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#E5E5E0"
          strokeWidth={strokeWidth}
        />
        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={ringColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: 'stroke-dashoffset 0.6s ease-out, stroke 0.3s ease',
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-base font-bold text-[#1C1C1E] leading-none">
          {label ?? `${Math.round(pct)}%`}
        </span>
        {sublabel ? (
          <span className="text-[8px] font-bold uppercase tracking-widest text-[#9CA3AF] mt-0.5">
            {sublabel}
          </span>
        ) : null}
      </div>
    </div>
  );
}
