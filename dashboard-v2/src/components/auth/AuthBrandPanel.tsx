'use client';

import Link from 'next/link';
import { ArrowLeft, Check, Zap } from 'lucide-react';

const FEATURES = [
  'Scan job boards and GCC captives',
  'Score matches and tailor resumes',
  'Track applications in one pipeline',
];

const MOCK_JOBS = [
  { company: 'Stripe GCC', role: 'Senior Backend', score: '8.4' },
  { company: 'SAP Labs', role: 'Platform Engineer', score: '7.9' },
  { company: 'JPMorgan', role: 'Lead Backend', score: '7.2' },
];

export function AuthMobileBrand() {
  return (
    <div className="mb-8 flex flex-col items-center text-center lg:hidden">
      <Link href="/" className="mb-4 inline-flex items-center gap-2.5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1C1C1E] shadow-sm">
          <Zap className="h-5 w-5 text-white" strokeWidth={2.25} />
        </div>
        <span className="text-lg font-bold tracking-tight text-[#1C1C1E]">
          Career-Ops{' '}
          <span className="text-[9px] font-mono uppercase tracking-widest text-[#6B6B6B]">v3</span>
        </span>
      </Link>
    </div>
  );
}

export default function AuthBrandPanel() {
  return (
    <aside className="relative hidden min-h-screen w-full flex-col justify-between overflow-hidden bg-[#1C1C1E] p-10 text-white lg:flex lg:max-w-[480px] lg:shrink-0 xl:max-w-[520px]">
      <div className="absolute top-[-20%] right-[-30%] h-[60%] w-[80%] rounded-full bg-[#f59e0b]/10 blur-[100px]" />
      <div className="absolute bottom-[-10%] left-[-20%] h-[40%] w-[60%] rounded-full bg-white/5 blur-[80px]" />

      <div className="relative z-10">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/50 transition-colors hover:text-white/80"
        >
          <ArrowLeft size={14} />
          careerops.dpdns.org
        </Link>

        <div className="mt-12 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/10">
            <Zap className="h-6 w-6 text-white" strokeWidth={2.25} />
          </div>
          <div>
            <div className="text-2xl font-bold tracking-tight">Career-Ops</div>
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/45">v3</div>
          </div>
        </div>

        <h2 className="mt-10 text-3xl font-bold leading-tight tracking-tight xl:text-4xl">
          Run your job search
          <br />
          <span className="text-white/45">from one place</span>
        </h2>

        <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/55">
          Scan portals, score matches, tailor resumes, and track applications — with Career Copilot and
          Resume Studio built in.
        </p>

        <ul className="mt-8 space-y-3">
          {FEATURES.map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-sm text-white/75">
              <Check size={16} className="mt-0.5 shrink-0 text-emerald-400" strokeWidth={2.5} />
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div className="relative z-10 mt-10">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-sm">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-white/40">Pipeline preview</p>
          <div className="space-y-2">
            {MOCK_JOBS.map((job) => (
              <div
                key={job.company}
                className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.06] px-3 py-2.5"
              >
                <div className="min-w-0">
                  <div className="truncate text-xs font-bold text-white/90">{job.company}</div>
                  <div className="truncate text-[11px] text-white/45">{job.role}</div>
                </div>
                <span className="ml-3 shrink-0 rounded-lg bg-emerald-500/15 px-2 py-1 text-[11px] font-bold text-emerald-300">
                  {job.score}
                </span>
              </div>
            ))}
          </div>
        </div>
        <p className="mt-6 text-[10px] font-medium text-white/30">Free to start · No credit card</p>
      </div>
    </aside>
  );
}
