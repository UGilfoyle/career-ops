'use client';

import { useEffect, useRef } from 'react';
import { ExternalLink, Github, Linkedin } from 'lucide-react';

type Props = {
  slug: string;
  name: string;
  headline: string;
  company: string;
  role: string | null;
  githubUrl: string | null;
  linkedinUrl: string | null;
  location?: string | null;
};

export function CompanionViewerClient({
  slug,
  name,
  headline,
  company,
  role,
  githubUrl,
  linkedinUrl,
  location,
}: Props) {
  const startedAt = useRef(Date.now());
  const sent = useRef(false);

  useEffect(() => {
    const send = () => {
      if (sent.current) return;
      const dwellSeconds = Math.round((Date.now() - startedAt.current) / 1000);
      if (dwellSeconds < 4) return;
      sent.current = true;
      const payload = JSON.stringify({ slug, dwellSeconds });
      try {
        if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
          const blob = new Blob([payload], { type: 'application/json' });
          if (navigator.sendBeacon('/api/v/beacon', blob)) return;
        }
      } catch {
        // fall through
      }
      void fetch('/api/v/beacon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    };

    const onHidden = () => {
      if (document.visibilityState === 'hidden') send();
    };

    window.addEventListener('pagehide', send);
    window.addEventListener('beforeunload', send);
    document.addEventListener('visibilitychange', onHidden);

    return () => {
      window.removeEventListener('pagehide', send);
      window.removeEventListener('beforeunload', send);
      document.removeEventListener('visibilitychange', onHidden);
      send();
    };
  }, [slug]);

  return (
    <div className="min-h-dvh bg-[#0B0B0C] text-[#F5F5F0]">
      <div
        className="pointer-events-none fixed inset-0 opacity-40"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -20%, #1e3a5f 0%, transparent 55%), radial-gradient(ellipse 60% 40% at 100% 100%, #1a2e1a 0%, transparent 50%)',
        }}
      />
      <main className="relative mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-6 py-16 sm:px-10">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8B9BB4]">
          {role ? `Considering ${company} · ${role}` : company}
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">{name}</h1>
        {headline ? (
          <p className="mt-4 text-base leading-relaxed text-[#C8C8C0] sm:text-lg">{headline}</p>
        ) : null}
        {location ? <p className="mt-3 text-sm text-[#8A8A84]">{location}</p> : null}

        <div className="mt-10 flex flex-wrap gap-3">
          {githubUrl ? (
            <a
              href={githubUrl}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition hover:border-white/30 hover:bg-white/10"
            >
              <Github size={16} />
              GitHub
              <ExternalLink size={12} className="opacity-50" />
            </a>
          ) : null}
          {linkedinUrl ? (
            <a
              href={linkedinUrl}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition hover:border-white/30 hover:bg-white/10"
            >
              <Linkedin size={16} />
              LinkedIn
              <ExternalLink size={12} className="opacity-50" />
            </a>
          ) : null}
        </div>
      </main>
    </div>
  );
}
