'use client';

import { useEffect, useMemo, useState } from 'react';
import { portalLabel, resolveDisplayLogo, type JobLogoProps } from '@/lib/job-logos';

type Size = 'sm' | 'md' | 'lg';

const SIZE: Record<Size, { box: string; badge: string; letter: string; pad: string }> = {
  sm: { box: 'h-8 w-8', badge: 'h-3.5 w-3.5 -bottom-0.5 -right-0.5', letter: 'text-[11px]', pad: 'p-1' },
  md: { box: 'h-9 w-9', badge: 'h-4 w-4 -bottom-0.5 -right-0.5', letter: 'text-xs', pad: 'p-1' },
  lg: { box: 'h-11 w-11', badge: 'h-4 w-4 -bottom-0.5 -right-0.5', letter: 'text-sm', pad: 'p-1.5' },
};

function hashColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const hues = ['#6366f1', '#8b5cf6', '#0891b2', '#059669', '#d97706', '#dc2626', '#db2777'];
  return hues[h % hues.length];
}

export function CompanyAvatar({ name, size = 'md' }: { name?: string | null; size?: Size }) {
  const letter = String(name || '?').trim().charAt(0).toUpperCase() || '?';
  const sz = SIZE[size];
  const bg = hashColor(String(name || '?'));
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold text-white shadow-sm ring-1 ring-black/5 ${sz.box} ${sz.letter}`}
      style={{ backgroundColor: bg }}
    >
      {letter}
    </div>
  );
}

export function JobAvatar({
  company,
  url,
  source,
  logoUrl,
  portalKey,
  logoSource,
  size = 'md',
}: JobLogoProps & { size?: Size }) {
  const display = useMemo(
    () => resolveDisplayLogo({ company, url, source, logoUrl, portalKey, logoSource }),
    [company, url, source, logoUrl, portalKey, logoSource],
  );
  const [stage, setStage] = useState<'primary' | 'fallback' | 'failed'>('primary');

  useEffect(() => {
    setStage('primary');
  }, [company, url, logoUrl, logoSource, portalKey]);

  const letter = String(company || '?').trim().charAt(0).toUpperCase() || '?';
  const sz = SIZE[size];
  const bg = hashColor(String(company || '?'));

  const activeUrl =
    stage === 'primary'
      ? display.imageUrl
      : stage === 'fallback'
        ? display.fallbackUrl
        : null;

  const showPortalBadge =
    Boolean(display.portalBadgeUrl) &&
    Boolean(display.portalKey) &&
    !display.isPortalOnly &&
    activeUrl;

  const title = [company, portalLabel(display.portalKey)].filter(Boolean).join(' · ');

  return (
    <div className="relative shrink-0" title={title || undefined}>
      {activeUrl ? (
        <div
          className={`flex items-center justify-center overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-black/[0.06] ${sz.box} ${sz.pad}`}
        >
          <img
            src={activeUrl}
            alt=""
            referrerPolicy="no-referrer"
            loading="lazy"
            decoding="async"
            onError={() => {
              if (stage === 'primary' && display.fallbackUrl && display.fallbackUrl !== display.imageUrl) {
                setStage('fallback');
                return;
              }
              setStage('failed');
            }}
            className="h-full w-full object-contain"
          />
        </div>
      ) : (
        <div
          className={`flex items-center justify-center rounded-full font-semibold text-white shadow-sm ring-1 ring-black/5 ${sz.box} ${sz.letter}`}
          style={{ backgroundColor: bg }}
        >
          {letter}
        </div>
      )}
      {showPortalBadge ? (
        <div
          className={`absolute ${sz.badge} overflow-hidden rounded-full bg-white ring-2 ring-white shadow-sm`}
        >
          <img
            src={display.portalBadgeUrl!}
            alt=""
            referrerPolicy="no-referrer"
            loading="lazy"
            className="h-full w-full object-cover"
          />
        </div>
      ) : null}
    </div>
  );
}
