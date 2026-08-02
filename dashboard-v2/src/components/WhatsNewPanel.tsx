'use client';

import { type ReactNode } from 'react';
import { ArrowRight, Bot, FileText, Shield, Smartphone, Sparkles, Users, Zap, Link2, Save } from 'lucide-react';
import Link from 'next/link';
import { CURRENT_RELEASE, type ProductFeature } from '@/lib/product-updates';

const ICONS: Record<string, ReactNode> = {
  copilot: <Bot size={18} />,
  'resume-studio': <FileText size={18} />,
  'saved-docs': <Save size={18} />,
  mobile: <Smartphone size={18} />,
  security: <Shield size={18} />,
  admin: <Users size={18} />,
  domain: <Link2 size={18} />,
  referral: <Zap size={18} />,
};

const BADGE_STYLES: Record<string, string> = {
  New: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Flagship: 'bg-amber-50 text-amber-800 border-amber-200',
  Improved: 'bg-sky-50 text-sky-700 border-sky-200',
  Security: 'bg-violet-50 text-violet-700 border-violet-200',
  Live: 'bg-[#1C1C1E] text-white border-[#1C1C1E]',
  Bonus: 'bg-[#F5F5F0] text-[#6B6B6B] border-[#E5E5E0]',
};

type Props = {
  variant?: 'modal' | 'compact' | 'signup';
  onDismiss?: () => void;
  showCta?: boolean;
};

export function WhatsNewPanel({ variant = 'modal', onDismiss, showCta = true }: Props) {
  const release = CURRENT_RELEASE;
  const features = variant === 'compact' ? release.features.slice(0, 4) : release.features;

  if (variant === 'signup') {
    return (
      <div className="mb-8 rounded-[1.75rem] border border-[#E5E5E0] bg-[#FAFAF8] overflow-hidden">
        <div className="px-6 py-4 bg-[#1C1C1E] text-white flex items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest text-white/70 mb-1">
              <Sparkles size={10} />
              {release.version} · {release.title}
            </div>
            <h2 className="text-sm font-bold">{release.headline}</h2>
            <p className="text-[11px] text-white/65 mt-1">{release.tagline}</p>
          </div>
        </div>
        <div className="p-5 space-y-3 max-h-52 overflow-y-auto">
          {release.features.slice(0, 5).map((f) => (
            <FeatureRow key={f.id} feature={f} compact />
          ))}
        </div>
        <div className="px-5 pb-4">
          <Link
            href="/"
            className="text-[10px] font-bold text-[#6B6B6B] hover:text-[#1C1C1E] uppercase tracking-wider"
          >
            See all features on homepage →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-[#1C1C1E] p-8 text-white relative overflow-hidden">
        <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[150%] bg-emerald-500/10 rounded-full blur-[60px]" />
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white text-[9px] font-bold uppercase tracking-widest mb-3">
          <Sparkles size={10} />
          {release.version} · {release.title}
        </div>
        <h2 className="text-2xl font-bold tracking-tight mb-2">{release.headline}</h2>
        <p className="text-white/70 text-xs max-w-md">{release.subheadline}</p>
        <p className="text-white/50 text-[10px] mt-2 font-medium">{release.tagline}</p>
      </div>

      <div
        className={`p-8 space-y-5 ${variant === 'compact' ? '' : 'max-h-[50vh] overflow-y-auto'}`}
      >
        {features.map((f) => (
          <FeatureRow key={f.id} feature={f} compact={variant === 'compact'} />
        ))}
      </div>

      {(showCta || onDismiss) && (
        <div className="p-6 bg-[#FAFAF8] border-t border-[#E5E5E0] flex items-center justify-between gap-4">
          {onDismiss ? (
            <button
              type="button"
              onClick={onDismiss}
              className="text-xs font-bold text-[#6B6B6B] hover:text-[#1C1C1E] transition-colors cursor-pointer"
            >
              Dismiss
            </button>
          ) : (
            <span />
          )}
          {showCta ? (
            <Link
              href="/signup"
              className="px-6 py-3 bg-[#1C1C1E] text-white text-xs font-bold rounded-xl hover:bg-[#27272a] transition-all shadow-md active:scale-95 flex items-center gap-2"
            >
              Create free account
              <ArrowRight size={12} />
            </Link>
          ) : null}
        </div>
      )}
    </>
  );
}

function FeatureRow({ feature, compact }: { feature: ProductFeature; compact?: boolean }) {
  const icon = ICONS[feature.id] ?? <Sparkles size={18} />;
  const badgeClass = BADGE_STYLES[feature.badge] ?? BADGE_STYLES.New;

  return (
    <div className="flex gap-4">
      <div className="h-10 w-10 bg-[#FAFAF8] border border-[#E5E5E0] rounded-xl flex items-center justify-center text-[#1C1C1E] shrink-0 shadow-sm">
        {icon}
      </div>
      <div className="min-w-0">
        <h4 className="text-sm font-bold text-[#1C1C1E] flex items-center gap-2 flex-wrap">
          {feature.title}
          <span
            className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${badgeClass}`}
          >
            {feature.badge}
          </span>
        </h4>
        <p className="text-xs text-[#6B6B6B] leading-relaxed mt-1">
          {compact ? feature.summary : `${feature.summary} ${feature.detail}`}
        </p>
      </div>
    </div>
  );
}
