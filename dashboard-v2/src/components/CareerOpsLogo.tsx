import React from 'react';

interface CareerOpsLogoProps {
  size?: number;
  className?: string;
  showText?: boolean;
  versionBadge?: string;
}

/**
 * CareerOpsLogoMark — "The Sovereign Document & Kinetic Horizon"
 * 
 * Design Philosophy (Industry-Lead UI/UX Perspective):
 * 1. The Substrate: Pristine architectural document monolith derived from the ISO 216 / DIN 476 paper plane.
 * 2. Typographic Baseline Anatomy: Structural hierarchy representing candidate identity (Cobalt), experience impact (Obsidian/Slate), and verified competency metrics (Emerald).
 * 3. Kinetic 45° Architectural Fold: The physical sheet folding forward into upward career elevation and ATS breakthrough.
 * 4. Optical Calibration Reticle: Focal point at the fold vertex representing mathematical ATS parsing precision and deterministic keyword alignment.
 * 5. High-Contrast Materiality: High-contrast light platinum canvas against deep obsidian titanium squircle for instant recognition across 16px to 512px.
 */
export function CareerOpsLogoMark({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 transition-transform duration-200 ${className}`}
    >
      <defs>
        {/* Kinetic 45-degree Fold Gradient */}
        <linearGradient id="logoFoldGrad" x1="54" y1="20" x2="74" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0284C7" />
          <stop offset="100%" stopColor="#10B981" />
        </linearGradient>

        {/* Architectural Paper Sheet Gradient */}
        <linearGradient id="logoSheetGrad" x1="26" y1="20" x2="74" y2="80" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#F1F5F9" />
        </linearGradient>
      </defs>

      {/* 1. Deep Obsidian Titanium Squircle Chassis */}
      <rect x="3" y="3" width="94" height="94" rx="24" fill="#090D16" stroke="#1E293B" strokeWidth="2" />
      <circle cx="50" cy="50" r="38" fill="#06B6D4" fillOpacity="0.18" />

      {/* 2. Pristine Architectural Document Monolith */}
      <path
        d="M26 26C26 22.69 28.69 20 32 20H54L74 40V74C74 77.31 71.31 80 68 80H32C28.69 80 26 77.31 26 74V26Z"
        fill="url(#logoSheetGrad)"
      />

      {/* 3. The 45° Architectural Ascent Fold */}
      <path
        d="M54 20V36C54 38.21 55.79 40 58 40H74L54 20Z"
        fill="url(#logoFoldGrad)"
      />

      {/* 4. Typographic Baseline Architecture */}
      {/* Tier 1: Candidate Status & Identity (Cobalt) */}
      <rect x="33" y="32" width="15" height="4" rx="2" fill="#2563EB" />

      {/* Tier 2: Executive Impact & Experience Rules */}
      <rect x="33" y="42" width="34" height="3.5" rx="1.75" fill="#0F172A" />
      <rect x="33" y="50" width="26" height="3.5" rx="1.75" fill="#334155" />
      <rect x="33" y="58" width="34" height="3.5" rx="1.75" fill="#64748B" />

      {/* Tier 3: Verified Capabilities & The Green Light */}
      <circle cx="36" cy="69" r="3" fill="#10B981" />
      <rect x="42" y="67.5" width="25" height="3" rx="1.5" fill="#0284C7" />

      {/* 5. Precision Optical Alignment Anchor */}
      <circle cx="54" cy="40" r="2.5" fill="#FFFFFF" stroke="#06B6D4" strokeWidth="1.5" />
    </svg>
  );
}

export function CareerOpsLogo({
  size = 32,
  className = '',
  showText = true,
  versionBadge = 'v3',
}: CareerOpsLogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <CareerOpsLogoMark size={size} />
      {showText && (
        <div className="flex items-baseline gap-1.5 leading-none">
          <span className="text-[15px] font-extrabold tracking-tight text-zinc-900 select-none">
            Career-Ops
          </span>
          {versionBadge && (
            <span className="shrink-0 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[8.5px] font-bold font-mono text-emerald-800 border border-emerald-200/80 uppercase tracking-tight">
              {versionBadge}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default CareerOpsLogo;
