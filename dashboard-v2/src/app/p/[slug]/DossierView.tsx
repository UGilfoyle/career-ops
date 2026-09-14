'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Download,
  ExternalLink,
  Github,
  Linkedin,
  Globe,
  MapPin,
  Share2,
  ShieldCheck,
  Check,
  Terminal,
  Cpu,
  Layers,
  Sparkles,
  ArrowUpRight,
} from 'lucide-react';
import type { PublicDossier, DossierBadge } from '@/lib/dossier/types';

export function DossierView({ dossier }: { dossier: PublicDossier }) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      void navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getTierBadgeStyle = (tier: DossierBadge['tier']) => {
    switch (tier) {
      case 'emerald':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'purple':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      case 'blue':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      case 'amber':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      default:
        return 'bg-zinc-800 text-zinc-300 border-zinc-700';
    }
  };

  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-100 font-sans selection:bg-emerald-500/30 selection:text-white relative overflow-x-hidden">
      {/* Background Gradients */}
      <div className="pointer-events-none fixed inset-0 opacity-25">
        <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-emerald-600/15 rounded-full blur-[140px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[650px] h-[650px] bg-blue-600/15 rounded-full blur-[160px]" />
      </div>

      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-[#09090B]/80 backdrop-blur-md px-4 sm:px-8 py-3.5">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-xs font-mono font-semibold tracking-wider text-zinc-400 hover:text-white transition-colors"
          >
            <div className="h-6 w-6 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Terminal size={13} />
            </div>
            <span>CAREER-OPS <span className="text-zinc-600 font-normal">/ DOSSIER</span></span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-white transition-all cursor-pointer"
            >
              {copied ? <Check size={13} className="text-emerald-400" /> : <Share2 size={13} />}
              <span>{copied ? 'Copied' : 'Share Link'}</span>
            </button>

            {dossier.hasPdf && (
              <a
                href={dossier.pdfDownloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-white text-zinc-950 hover:bg-zinc-200 transition-all shadow-sm active:scale-95"
              >
                <Download size={13} />
                <span>Verified CV</span>
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative max-w-5xl mx-auto px-4 sm:px-8 pt-10 pb-20 space-y-12">
        {/* Candidate Hero Card */}
        <section className="rounded-2xl border border-zinc-800/90 bg-zinc-900/50 backdrop-blur-sm p-6 sm:p-10 relative overflow-hidden shadow-xl">
          <div className="absolute top-0 right-0 p-6 pointer-events-none opacity-10 sm:opacity-20">
            <ShieldCheck size={140} className="text-emerald-500" />
          </div>

          <div className="relative space-y-4 max-w-3xl">
            {/* Status Pills */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                VERIFIED TALENT
              </span>
              {dossier.readinessScore ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold bg-blue-500/10 border border-blue-500/30 text-blue-400">
                  <Sparkles size={11} />
                  READINESS {dossier.readinessScore}%
                </span>
              ) : null}
            </div>

            {/* Name and Headline */}
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white">
              {dossier.name}
            </h1>
            <p className="text-base sm:text-xl font-medium text-zinc-300 leading-relaxed">
              {dossier.headline}
            </p>

            {/* Location & Links */}
            <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-zinc-400">
              {dossier.location && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin size={14} className="text-zinc-500" />
                  {dossier.location}
                </span>
              )}
              {dossier.socials.githubUrl && (
                <a
                  href={dossier.socials.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-zinc-300 hover:text-white transition-colors"
                >
                  <Github size={14} />
                  <span>GitHub</span>
                </a>
              )}
              {dossier.socials.linkedinUrl && (
                <a
                  href={dossier.socials.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-zinc-300 hover:text-white transition-colors"
                >
                  <Linkedin size={14} />
                  <span>LinkedIn</span>
                </a>
              )}
              {dossier.socials.portfolioUrl && (
                <a
                  href={dossier.socials.portfolioUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-zinc-300 hover:text-white transition-colors"
                >
                  <Globe size={14} />
                  <span>Portfolio</span>
                </a>
              )}
            </div>

            {/* Executive Bio */}
            {dossier.summary && (
              <p className="text-sm text-zinc-400 leading-relaxed pt-3 border-t border-zinc-800/80">
                {dossier.summary}
              </p>
            )}
          </div>
        </section>

        {/* Badges Bar */}
        {dossier.badges.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xs font-mono font-semibold uppercase tracking-widest text-zinc-500">
              VERIFIED HIRING SIGNALS
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {dossier.badges.map((b) => (
                <div
                  key={b.label}
                  className={`p-4 rounded-xl border ${getTierBadgeStyle(b.tier)} backdrop-blur-xs flex flex-col justify-between space-y-1.5`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold tracking-tight">{b.label}</span>
                    <ShieldCheck size={14} className="opacity-80" />
                  </div>
                  {b.description && (
                    <p className="text-[11px] text-zinc-400 leading-relaxed font-normal">
                      {b.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Quantified Impact Metrics */}
        {dossier.metrics.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xs font-mono font-semibold uppercase tracking-widest text-zinc-500">
              QUANTIFIED IMPACT
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {dossier.metrics.map((m) => (
                <div
                  key={m.label}
                  className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-1"
                >
                  <div className="text-2xl sm:text-3xl font-mono font-extrabold text-white">
                    {m.value}
                  </div>
                  <div className="text-xs font-semibold text-zinc-300">{m.label}</div>
                  {m.detail && <div className="text-[11px] text-zinc-500">{m.detail}</div>}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Core Technology Stack */}
        {Object.keys(dossier.skills).length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xs font-mono font-semibold uppercase tracking-widest text-zinc-500">
              TECHNICAL ARSENAL
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Object.entries(dossier.skills).map(([category, items]) => (
                <div
                  key={category}
                  className="p-5 rounded-xl border border-zinc-800/80 bg-zinc-900/30 space-y-3"
                >
                  <div className="flex items-center gap-2 text-xs font-mono font-bold text-zinc-300">
                    <Cpu size={14} className="text-emerald-400" />
                    <span>{category}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {items.map((skill) => (
                      <span
                        key={skill}
                        className="px-2.5 py-1 text-xs rounded-md bg-zinc-800/70 border border-zinc-700/60 text-zinc-200 font-mono"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Featured Projects & Architecture */}
        {dossier.featuredProjects.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-xs font-mono font-semibold uppercase tracking-widest text-zinc-500">
              PRODUCTION PROOF OF WORK
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {dossier.featuredProjects.map((p) => (
                <div
                  key={p.title}
                  className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/40 flex flex-col justify-between space-y-3.5 hover:border-zinc-700 transition-colors"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-base font-bold text-white">{p.title}</h3>
                      <div className="flex items-center gap-2">
                        {p.githubUrl && (
                          <a
                            href={p.githubUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-zinc-400 hover:text-white transition-colors"
                          >
                            <Github size={15} />
                          </a>
                        )}
                        {p.liveUrl && (
                          <a
                            href={p.liveUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-zinc-400 hover:text-white transition-colors"
                          >
                            <ArrowUpRight size={16} />
                          </a>
                        )}
                      </div>
                    </div>
                    {p.subtitle && (
                      <p className="text-xs font-mono text-emerald-400">{p.subtitle}</p>
                    )}
                    <p className="text-xs text-zinc-400 leading-relaxed">{p.description}</p>
                  </div>

                  {p.techStack && p.techStack.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-2 border-t border-zinc-800/70">
                      {p.techStack.map((tech) => (
                        <span
                          key={tech}
                          className="px-2 py-0.5 text-[10px] font-mono rounded bg-zinc-800 text-zinc-400"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Experience Highlights */}
        {dossier.experience.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-xs font-mono font-semibold uppercase tracking-widest text-zinc-500">
              EXPERIENCE & IMPACT HIGHLIGHTS
            </h2>
            <div className="space-y-3">
              {dossier.experience.map((exp) => (
                <div
                  key={`${exp.company}-${exp.role}`}
                  className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/30 space-y-2.5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div className="text-sm font-bold text-white">
                      {exp.role} · <span className="text-zinc-400 font-normal">{exp.company}</span>
                    </div>
                    {exp.period && (
                      <span className="text-xs font-mono text-zinc-500">{exp.period}</span>
                    )}
                  </div>
                  {exp.highlights.length > 0 && (
                    <ul className="space-y-1 text-xs text-zinc-300 list-disc list-inside">
                      {exp.highlights.map((h, i) => (
                        <li key={i} className="leading-relaxed">
                          {h}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Viral Brand Referral Footer */}
        <footer className="pt-10 border-t border-zinc-800 text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-400">
            <ShieldCheck size={14} className="text-emerald-400" />
            <span>Verified Candidate Dossier by Career-Ops</span>
          </div>

          <p className="text-xs text-zinc-500 max-w-md mx-auto leading-relaxed">
            Career-Ops is an AI Job Search Command Center used by software engineers to score matches, pass ATS filters, and manage engineering careers.
          </p>

          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-emerald-500 text-zinc-950 text-xs font-bold hover:bg-emerald-400 transition-all shadow-md active:scale-95"
            >
              <span>Build Your Engineer Dossier Free</span>
              <ArrowUpRight size={14} />
            </Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
