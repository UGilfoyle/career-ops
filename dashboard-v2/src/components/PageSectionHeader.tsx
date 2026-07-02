'use client';

import type { ReactNode } from 'react';

type PageSectionHeaderProps = {
  title: string;
  subtitle?: string;
  welcomeName?: string | null;
  actions?: ReactNode;
};

export function PageSectionHeader({
  title,
  subtitle,
  welcomeName,
  actions,
}: PageSectionHeaderProps) {
  return (
    <header className="mb-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          {welcomeName ? (
            <h1 className="text-3xl font-bold tracking-tight text-[#1C1C1E] sm:text-4xl">
              Welcome back, {welcomeName}
            </h1>
          ) : (
            <h1 className="text-3xl font-bold tracking-tight text-[#1C1C1E] sm:text-4xl">{title}</h1>
          )}
          {welcomeName && (
            <p className="mt-1 text-sm font-medium text-[#9CA3AF]">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          )}
          {!welcomeName && subtitle && (
            <p className="mt-1 text-sm text-[#6B6B6B]">{subtitle}</p>
          )}
          {welcomeName && subtitle && (
            <p className="mt-2 text-sm text-[#6B6B6B]">{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>}
      </div>
    </header>
  );
}

export function CompanyAvatar({ name }: { name?: string | null }) {
  const letter = String(name || '?').trim().charAt(0).toUpperCase() || '?';
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#E5E5E0] bg-[#F5F5F0] text-[11px] font-bold text-[#6B6B6B]">
      {letter}
    </div>
  );
}

export function AiScoreBadge({ score }: { score?: string | number | null }) {
  const raw = parseFloat(String(score ?? '').replace('/5', ''));
  const value = Number.isFinite(raw) ? raw : null;
  const label = value != null ? `${value.toFixed(1)}/5` : '—';

  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#1C1C1E] px-2 py-0.5 font-mono text-[10px] text-white whitespace-nowrap">
      <span className="text-white/75">★</span>
      {label}
    </span>
  );
}
