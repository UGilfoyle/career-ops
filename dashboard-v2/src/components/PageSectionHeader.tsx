'use client';

import type { ReactNode } from 'react';

export type LastRunMeta = {
  lastRunScript?: string | null;
  lastRunStatus?: string | null;
  lastRunUrl?: string | null;
};

type PageSectionHeaderProps = {
  title: string;
  subtitle?: string;
  welcomeName?: string | null;
  lastRun?: LastRunMeta | null;
  actions?: ReactNode;
};

export function PageSectionHeader({
  title,
  subtitle,
  welcomeName,
  lastRun,
  actions,
}: PageSectionHeaderProps) {
  const scriptLabel = String(lastRun?.lastRunScript || '')
    .replace('.mjs', '')
    .replace(/-/g, ' ')
    .toUpperCase();
  const status = String(lastRun?.lastRunStatus || '').toUpperCase();
  const statusOk = status === 'SUCCESS';

  return (
    <header className="mb-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
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
          {scriptLabel && (
            <div className="mt-3 text-[10px] font-mono uppercase tracking-[0.2em] text-[#9CA3AF]">
              Last run:{' '}
              <span className="font-bold text-[#1C1C1E]">{scriptLabel}</span>
              {status && (
                <>
                  {' '}
                  <span className="text-[#9CA3AF]">·</span>{' '}
                  <span className={statusOk ? 'font-bold text-emerald-600' : 'font-bold text-[#1C1C1E]'}>
                    {statusOk ? '● SUCCESS' : status}
                  </span>
                </>
              )}
              {lastRun?.lastRunUrl && (
                <>
                  {' '}
                  <a
                    href={lastRun.lastRunUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-[#6B6B6B] underline underline-offset-4 hover:text-[#1C1C1E]"
                  >
                    LOGS
                  </a>
                </>
              )}
            </div>
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
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#E5E5E0] bg-[#F5F5F0] text-sm font-bold text-[#6B6B6B]">
      {letter}
    </div>
  );
}

export function AiScoreBadge({ score }: { score?: string | number | null }) {
  const raw = parseFloat(String(score ?? '').replace('/5', ''));
  const value = Number.isFinite(raw) ? raw : null;
  const label = value != null ? `${value.toFixed(1)}/5` : '—';

  return (
    <div className="inline-flex min-w-[9rem] items-center gap-2 rounded-full bg-[#1C1C1E] px-4 py-2 text-xs font-bold text-white">
      <span className="text-white/90">★</span>
      <span>{label}</span>
    </div>
  );
}
