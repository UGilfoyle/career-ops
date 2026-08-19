'use client';

import { useState } from 'react';
import { portalLabel, resolveDisplayLogo, type JobLogoProps } from '@/lib/job-logos';

type Size = 'sm' | 'md' | 'lg';

const SIZE: Record<Size, { box: string; badge: string; text: string }> = {
  sm: { box: 'h-7 w-7 text-[10px]', badge: 'h-3.5 w-3.5 -bottom-0.5 -right-0.5', text: 'text-[9px]' },
  md: { box: 'h-8 w-8 text-[11px]', badge: 'h-4 w-4 -bottom-0.5 -right-0.5', text: 'text-[10px]' },
  lg: { box: 'h-10 w-10 text-sm', badge: 'h-4 w-4 -bottom-0.5 -right-0.5', text: 'text-[10px]' },
};

export function CompanyAvatar({ name, size = 'md' }: { name?: string | null; size?: Size }) {
  const letter = String(name || '?').trim().charAt(0).toUpperCase() || '?';
  const sizeClass = SIZE[size].box;
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-xl border border-[#E5E5E0] bg-gradient-to-br from-white to-[#F5F5F0] font-bold text-[#1C1C1E] shadow-sm ${sizeClass}`}
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
  const [imgFailed, setImgFailed] = useState(false);
  const display = resolveDisplayLogo({ company, url, source, logoUrl, portalKey, logoSource });
  const letter = String(company || '?').trim().charAt(0).toUpperCase() || '?';
  const sz = SIZE[size];
  const showImage = Boolean(display.imageUrl) && !imgFailed;
  const showPortalBadge =
    Boolean(display.portalBadgeUrl) &&
    display.portalKey &&
    !display.isPortalOnly &&
    display.portalBadgeUrl !== display.imageUrl;

  return (
    <div className="relative shrink-0" title={portalLabel(display.portalKey) || undefined}>
      {showImage ? (
        <img
          src={display.imageUrl!}
          alt=""
          referrerPolicy="no-referrer"
          loading="lazy"
          onError={() => setImgFailed(true)}
          className={`${sz.box} rounded-xl border border-[#E5E5E0] bg-white object-cover shadow-sm`}
        />
      ) : (
        <div
          className={`flex items-center justify-center rounded-xl border border-[#E5E5E0] bg-gradient-to-br from-white to-[#F5F5F0] font-bold text-[#1C1C1E] shadow-sm ${sz.box}`}
        >
          {letter}
        </div>
      )}
      {showPortalBadge ? (
        <img
          src={display.portalBadgeUrl!}
          alt=""
          referrerPolicy="no-referrer"
          loading="lazy"
          className={`absolute ${sz.badge} rounded-full border border-white bg-white object-cover shadow-sm`}
        />
      ) : null}
    </div>
  );
}
