'use client';

import React from 'react';

type TemplatePreviewThumbnailProps = {
  templateId: string;
  name?: string;
  className?: string;
};

export function TemplatePreviewThumbnail({
  templateId,
  name = 'Alex Morgan',
  className = '',
}: TemplatePreviewThumbnailProps) {
  switch (templateId) {
    case 'ats-faang':
      return (
        <div className={`w-full h-36 bg-white border border-zinc-200 rounded-lg p-3 flex flex-col justify-between overflow-hidden font-sans select-none shadow-xs ${className}`}>
          {/* Header */}
          <div>
            <div className="flex items-center justify-between border-b-2 border-zinc-900 pb-1 mb-1.5">
              <span className="font-extrabold text-[11px] uppercase tracking-wider text-zinc-900">{name}</span>
              <span className="text-[7px] font-mono text-zinc-500">github.com/alex · San Francisco, CA</span>
            </div>
            {/* Summary */}
            <div className="mb-1.5">
              <div className="text-[7px] font-bold uppercase tracking-wider text-zinc-800 mb-0.5">Summary</div>
              <p className="text-[6.5px] text-zinc-600 leading-tight m-0 line-clamp-1">
                Senior Staff Engineer leading distributed systems and high-throughput real-time pipelines.
              </p>
            </div>
            {/* Skills */}
            <div className="mb-1.5">
              <div className="text-[7px] font-bold uppercase tracking-wider text-zinc-800 mb-0.5">Core Technologies</div>
              <div className="flex gap-1 flex-wrap">
                <span className="bg-zinc-100 px-1 py-0.2 rounded text-[6px] font-mono text-zinc-800">TypeScript</span>
                <span className="bg-zinc-100 px-1 py-0.2 rounded text-[6px] font-mono text-zinc-800">Go</span>
                <span className="bg-zinc-100 px-1 py-0.2 rounded text-[6px] font-mono text-zinc-800">Kubernetes</span>
                <span className="bg-zinc-100 px-1 py-0.2 rounded text-[6px] font-mono text-zinc-800">PostgreSQL</span>
              </div>
            </div>
          </div>
          {/* Experience */}
          <div className="border-t border-zinc-100 pt-1">
            <div className="flex justify-between items-baseline text-[7px] font-bold text-zinc-900">
              <span>Principal Engineer — Tech Corp</span>
              <span className="text-[6px] text-zinc-400 font-mono">2021 – Present</span>
            </div>
            <div className="text-[6.5px] text-zinc-600 leading-tight truncate">
              • Scaled real-time ingestion by 400% reducing p99 latency to 12ms.
            </div>
          </div>
        </div>
      );

    case 'ats-executive':
      return (
        <div className={`w-full h-36 bg-stone-50/50 border border-stone-200 rounded-lg p-3 flex flex-col justify-between overflow-hidden font-serif select-none shadow-xs ${className}`}>
          {/* Header */}
          <div className="text-center border-b border-stone-300 pb-1.5 mb-1.5">
            <div className="font-bold text-[12px] tracking-wide text-stone-900 uppercase">{name}</div>
            <div className="text-[6.5px] font-sans text-stone-600 tracking-wider mt-0.5">
              EXECUTIVE DIRECTOR · STRATEGY & TECHNOLOGY LEADERSHIP
            </div>
          </div>
          {/* Executive Summary */}
          <div className="mb-1">
            <div className="text-[7px] font-sans font-bold uppercase tracking-widest text-stone-700 mb-0.5 text-center">
              Executive Profile
            </div>
            <p className="text-[6.5px] text-stone-700 leading-tight italic m-0 line-clamp-2 text-center">
              15+ years orchestrating global engineering transformations, scaling teams from 20 to 180+ and managing $45M budgets.
            </p>
          </div>
          {/* Experience */}
          <div className="border-t border-stone-200 pt-1 font-sans">
            <div className="flex justify-between items-baseline text-[7px] font-bold text-stone-900">
              <span>VP of Engineering — Global Solutions</span>
              <span className="text-[6px] text-stone-500">2019 – Present</span>
            </div>
            <div className="text-[6.5px] text-stone-600 truncate">
              • Steered enterprise multi-cloud migration with 99.999% uptime SLA.
            </div>
          </div>
        </div>
      );

    case 'ats-ivy':
      return (
        <div className={`w-full h-36 bg-white border border-zinc-200 rounded-lg p-3 flex flex-col justify-between overflow-hidden font-serif select-none shadow-xs ${className}`}>
          {/* Header */}
          <div className="text-center border-b border-zinc-800 pb-1 mb-1">
            <div className="font-bold text-[12px] text-zinc-900">{name}</div>
            <div className="text-[6.5px] text-zinc-500 italic">
              Cambridge, MA · alex.morgan@alumni.harvard.edu
            </div>
          </div>
          {/* Education */}
          <div className="mb-1 font-sans">
            <div className="text-[7px] font-serif font-bold uppercase tracking-widest text-zinc-900 border-b border-zinc-200 pb-0.5 mb-0.5">
              Education
            </div>
            <div className="flex justify-between text-[6.5px] font-semibold text-zinc-800">
              <span>Harvard University — M.S. Computer Science</span>
              <span className="text-zinc-500">2020</span>
            </div>
          </div>
          {/* Experience */}
          <div className="font-sans">
            <div className="text-[7px] font-serif font-bold uppercase tracking-widest text-zinc-900 border-b border-zinc-200 pb-0.5 mb-0.5">
              Experience
            </div>
            <div className="flex justify-between text-[6.5px] font-semibold text-zinc-800">
              <span>Research Scientist — Deep Systems Lab</span>
              <span className="text-zinc-500">2020 – Present</span>
            </div>
            <div className="text-[6px] text-zinc-600 truncate">
              • Published 4 papers on distributed consensus algorithms and fault-tolerance.
            </div>
          </div>
        </div>
      );

    case 'ats-technical':
      return (
        <div className={`w-full h-36 bg-zinc-950 text-zinc-100 border border-zinc-800 rounded-lg p-3 flex flex-col justify-between overflow-hidden font-mono select-none shadow-xs ${className}`}>
          {/* Header */}
          <div>
            <div className="flex items-center justify-between border-b border-zinc-700 pb-1 mb-1.5">
              <span className="font-bold text-[10px] text-emerald-400">&gt; {name}</span>
              <span className="text-[6.5px] text-zinc-400">dev@kernel.io</span>
            </div>
            {/* Tech Stack */}
            <div className="mb-1">
              <div className="text-[6.5px] text-zinc-400 uppercase tracking-widest mb-0.5">STACK:</div>
              <div className="text-[6.5px] text-emerald-300/90 leading-tight truncate">
                Rust, C++, Linux eBPF, Tokio, Kafka, Distributed Consensus
              </div>
            </div>
          </div>
          {/* Experience */}
          <div className="border-t border-zinc-800 pt-1">
            <div className="flex justify-between text-[7px] font-bold text-zinc-200">
              <span>Systems Engineer @ CloudOS</span>
              <span className="text-[6px] text-zinc-500">2022 - NOW</span>
            </div>
            <div className="text-[6px] text-zinc-400 truncate">
              $ optimized memory allocators in Rust reducing cold boot by 65%
            </div>
          </div>
        </div>
      );

    case 'ats-modern-compact':
      return (
        <div className={`w-full h-36 bg-white border border-zinc-200 rounded-lg p-3 flex flex-col justify-between overflow-hidden font-sans select-none shadow-xs ${className}`}>
          {/* Header */}
          <div className="border-l-2 border-indigo-600 pl-2 mb-1.5">
            <div className="font-extrabold text-[11px] text-zinc-900 leading-none">{name}</div>
            <div className="text-[6.5px] font-medium text-indigo-600 mt-0.5">FULL-STACK ENGINEER</div>
          </div>
          {/* Skills & Experience Compact */}
          <div className="space-y-1">
            <div>
              <div className="text-[6.5px] font-bold uppercase tracking-wider text-zinc-400">Skills</div>
              <div className="text-[6.5px] text-zinc-700 truncate">
                React 19, Next.js, Node.js, GraphQL, PostgreSQL, Tailwind, AWS
              </div>
            </div>
            <div className="border-t border-zinc-100 pt-1">
              <div className="flex justify-between text-[6.5px] font-bold text-zinc-900">
                <span>Lead Frontend Developer — FinTech Inc</span>
                <span className="text-[6px] text-zinc-400 font-mono">2022–Present</span>
              </div>
              <div className="text-[6px] text-zinc-600 truncate">
                • Built high-frequency trading dashboard with sub-50ms render times.
              </div>
            </div>
          </div>
        </div>
      );

    case 'ats-mit':
      return (
        <div className={`w-full h-36 bg-white border border-zinc-200 rounded-lg p-3 flex flex-col justify-between overflow-hidden font-serif select-none shadow-xs ${className}`}>
          <div>
            <div className="text-center border-b-2 border-black pb-1 mb-1.5">
              <div className="font-bold text-[12px] text-black tracking-wide">{name}</div>
              <div className="text-[6.5px] font-sans text-zinc-600">
                Cambridge, MA · alex@mit.edu · (555) 019-2834 · github.com/alex
              </div>
            </div>
            <div className="mb-1">
              <div className="text-[7px] font-sans font-bold uppercase tracking-wider text-black border-b border-black pb-0.5 mb-0.5">
                Education
              </div>
              <div className="flex justify-between text-[6.5px] font-semibold text-zinc-900">
                <span>Massachusetts Institute of Technology — M.Eng EECS</span>
                <span className="font-mono text-zinc-500">2020</span>
              </div>
            </div>
          </div>
          <div className="border-t border-zinc-200 pt-1 font-sans">
            <div className="text-[7px] font-bold uppercase tracking-wider text-black border-b border-black pb-0.5 mb-0.5">
              Experience
            </div>
            <div className="flex justify-between text-[6.5px] font-semibold text-zinc-900">
              <span>Senior Systems Engineer — Distributed Core</span>
              <span className="text-[5.5px] font-mono text-zinc-500">2021 – Present</span>
            </div>
            <div className="text-[6px] text-zinc-600 truncate">
              • Architected lock-free memory cache serving 2.4M ops/sec at sub-5ms p99 latency.
            </div>
          </div>
        </div>
      );

    case 'ats-berkeley':
      return (
        <div className={`w-full h-36 bg-white border border-zinc-200 rounded-lg p-3 flex flex-col justify-between overflow-hidden font-sans select-none shadow-xs ${className}`}>
          <div>
            <div className="border-b-2 border-[#003262] pb-1 mb-1.5 flex justify-between items-baseline">
              <span className="font-bold text-[11px] text-[#003262] tracking-tight">{name}</span>
              <span className="text-[6.5px] text-zinc-500">Berkeley, CA · berkeley.edu/alumni</span>
            </div>
            <div className="mb-1">
              <div className="text-[7px] font-bold uppercase tracking-wider text-[#003262] border-b border-zinc-200 pb-0.5 mb-0.5">
                Core Competencies
              </div>
              <div className="text-[6.5px] text-zinc-700 truncate">
                Full-Stack Systems, Distributed Computing, React 19, Python, PostgreSQL, AWS
              </div>
            </div>
          </div>
          <div className="border-t border-zinc-100 pt-1">
            <div className="text-[7px] font-bold uppercase tracking-wider text-[#003262] border-b border-zinc-200 pb-0.5 mb-0.5">
              Work Experience
            </div>
            <div className="flex justify-between text-[6.5px] font-semibold text-zinc-900">
              <span>Lead Software Engineer — Silicon Valley Labs</span>
              <span className="text-[6px] text-zinc-400">2021 – Present</span>
            </div>
            <div className="text-[6px] text-zinc-600 truncate">
              • Scaled cloud microservices handling 15M daily requests; reduced infra cost by 38%.
            </div>
          </div>
        </div>
      );

    case 'ats-wharton':
      return (
        <div className={`w-full h-36 bg-slate-50/40 border border-zinc-200 rounded-lg p-3 flex flex-col justify-between overflow-hidden font-serif select-none shadow-xs ${className}`}>
          <div className="text-center border-b border-[#1e3a8a] pb-1 mb-1">
            <div className="font-bold text-[12px] text-[#1e3a8a] tracking-wide uppercase">{name}</div>
            <div className="text-[6px] font-sans tracking-widest text-zinc-600 mt-0.5 uppercase">
              MBA · Director of Product & Engineering Strategy
            </div>
          </div>
          <div className="mb-1 font-sans">
            <div className="text-[7px] font-serif font-bold uppercase tracking-widest text-[#1e3a8a] border-b border-zinc-200 pb-0.5 mb-0.5">
              Executive Profile & Strategy
            </div>
            <div className="text-[6px] text-zinc-600 italic line-clamp-1">
              7+ years driving enterprise digital transformation, scaling cross-functional teams and P&L portfolios.
            </div>
          </div>
          <div className="border-t border-zinc-100 pt-1 font-sans">
            <div className="flex justify-between text-[6.5px] font-bold text-zinc-900">
              <span>Principal Strategy Director — Global Tech</span>
              <span className="text-[6px] text-zinc-500">2021 – Present</span>
            </div>
            <div className="text-[6px] text-zinc-600 truncate">
              • Delivered $14.2M recurring ARR by orchestrating enterprise platform re-architecture.
            </div>
          </div>
        </div>
      );

    case 'ats-iit':
      return (
        <div className={`w-full h-36 bg-white border border-zinc-200 rounded-lg p-3 flex flex-col justify-between overflow-hidden font-sans select-none shadow-xs ${className}`}>
          <div>
            <div className="flex justify-between items-baseline border-b-2 border-black pb-1 mb-1">
              <span className="font-extrabold text-[12px] uppercase tracking-wider text-black">{name}</span>
              <span className="text-[6.5px] font-mono text-zinc-600">IIT Placement Standard · B.Tech / M.Tech</span>
            </div>
            <div className="mb-1">
              <div className="text-[7px] font-bold uppercase tracking-wider text-black border-b border-black pb-0.2 mb-0.5">
                Technical Skills & Tools
              </div>
              <div className="text-[6.5px] text-zinc-800 truncate font-mono">
                Languages: Go, C++, Python, TS | Cloud: Docker, K8s, AWS, GCP
              </div>
            </div>
          </div>
          <div className="border-t border-zinc-100 pt-1">
            <div className="text-[7px] font-bold uppercase tracking-wider text-black border-b border-black pb-0.2 mb-0.5">
              Professional Experience
            </div>
            <div className="flex justify-between text-[6.5px] font-bold text-black">
              <span>Senior Platform Engineer — Tech Ventures</span>
              <span className="text-[6px] text-zinc-500">2021 – Present</span>
            </div>
            <div className="text-[6px] text-zinc-700 truncate">
              • Optimized low-latency data pipelines processing 80k events/sec with zero packet loss.
            </div>
          </div>
        </div>
      );

    case 'ats-stanford':
      return (
        <div className={`w-full h-36 bg-white border border-zinc-200 rounded-lg p-3 flex flex-col justify-between overflow-hidden font-sans select-none shadow-xs ${className}`}>
          <div>
            <div className="border-b-2 border-[#8c1515] pb-1 mb-1.5 flex justify-between items-baseline">
              <span className="font-bold text-[11px] text-[#8c1515] tracking-tight">{name}</span>
              <span className="text-[6.5px] text-zinc-500">Palo Alto, CA · stanford.edu/alumni</span>
            </div>
            <div className="mb-1">
              <div className="text-[7px] font-bold uppercase tracking-wider text-[#8c1515] border-b border-zinc-200 pb-0.5 mb-0.5">
                Technical Mastery
              </div>
              <div className="text-[6.5px] text-zinc-700 truncate">
                AI/ML Systems, React, Next.js, Node.js, GraphQL, Distributed Databases
              </div>
            </div>
          </div>
          <div className="border-t border-zinc-100 pt-1">
            <div className="text-[7px] font-bold uppercase tracking-wider text-[#8c1515] border-b border-zinc-200 pb-0.5 mb-0.5">
              Experience
            </div>
            <div className="flex justify-between text-[6.5px] font-semibold text-zinc-900">
              <span>Founding Engineer — AI Venture</span>
              <span className="text-[6px] text-zinc-400">2021 – Present</span>
            </div>
            <div className="text-[6px] text-zinc-600 truncate">
              • Built high-performance LLM streaming backend serving 500K DAUs.
            </div>
          </div>
        </div>
      );

    case 'ats-precision':
      return (
        <div className={`w-full h-36 bg-white border border-zinc-200 rounded-lg p-3 flex flex-col justify-between overflow-hidden font-sans select-none shadow-xs ${className}`}>
          {/* Top Banner */}
          <div className="bg-zinc-100 -mx-3 -mt-3 px-3 py-1.5 border-b border-zinc-200 flex justify-between items-center mb-1">
            <span className="font-bold text-[10px] text-zinc-900">{name}</span>
            <span className="text-[6px] font-mono text-zinc-500">ATS RATING: 98%</span>
          </div>
          {/* Keyword Match Bar */}
          <div className="mb-1">
            <div className="text-[6.5px] font-bold text-zinc-700 mb-0.5">TARGET SKILLS MATCH:</div>
            <div className="flex gap-1 flex-wrap">
              <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-1 rounded text-[5.5px] font-bold">PYTHON</span>
              <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-1 rounded text-[5.5px] font-bold">AWS LAMBDA</span>
              <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-1 rounded text-[5.5px] font-bold">TERRAFORM</span>
            </div>
          </div>
          {/* Experience */}
          <div className="border-t border-zinc-100 pt-1">
            <div className="flex justify-between text-[6.5px] font-bold text-zinc-900">
              <span>Cloud Infrastructure Architect</span>
              <span className="text-[6px] text-zinc-400">2021 – Present</span>
            </div>
            <div className="text-[6px] text-zinc-600 truncate">
              • Engineered automated multi-region disaster recovery on AWS.
            </div>
          </div>
        </div>
      );

    default: // ats-professional / default
      return (
        <div className={`w-full h-36 bg-white border border-zinc-200 rounded-lg p-3 flex flex-col justify-between overflow-hidden font-sans select-none shadow-xs ${className}`}>
          {/* Classic Header */}
          <div>
            <div className="text-center border-b border-zinc-300 pb-1 mb-1">
              <div className="font-bold text-[11px] text-zinc-900 tracking-wide">{name}</div>
              <div className="text-[6.5px] text-zinc-500 font-mono mt-0.5">
                alex@careerops.dev · (555) 234-5678 · San Francisco, CA
              </div>
            </div>
            {/* Experience */}
            <div className="mb-1">
              <div className="text-[7px] font-bold uppercase tracking-wider text-zinc-800 border-b border-zinc-200 pb-0.5 mb-0.5">
                Professional Experience
              </div>
              <div className="flex justify-between items-baseline text-[6.5px] font-semibold text-zinc-900">
                <span>Senior Software Engineer — Apex Systems</span>
                <span className="text-[5.5px] text-zinc-400">2021 – Present</span>
              </div>
              <div className="text-[6px] text-zinc-600 leading-tight line-clamp-2">
                • Spearheaded microservices migration improving deployment speed by 75%.
              </div>
            </div>
          </div>
          {/* Skills */}
          <div className="border-t border-zinc-100 pt-1">
            <div className="text-[6.5px] font-bold uppercase tracking-wider text-zinc-700 mb-0.5">Technical Competencies</div>
            <div className="text-[6px] text-zinc-600 truncate">
              TypeScript, Node.js, React, Docker, Kubernetes, PostgreSQL, Redis, CI/CD
            </div>
          </div>
        </div>
      );
  }
}
