'use client';

import { Search, ArrowLeft, Target, Cpu, Database } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';

export default function DocsPage() {
  const sections = [
    {
      title: 'Job scanning',
      icon: <Search />,
      content:
        'Scanners pull listings from company career pages (Greenhouse, Ashby, Lever) and major job boards. Results land in your pipeline with match scores.',
    },
    {
      title: 'Resume tailoring',
      icon: <Target />,
      content:
        'Tailor compares your profile and resume against a job description, then generates an ATS-friendly version with role-specific keywords and bullets.',
    },
    {
      title: 'Data & security',
      icon: <Database />,
      content:
        'Each account has isolated storage on Neon Postgres. API keys are encrypted. Your data is not shared across tenants.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#1C1C1E] p-8 md:p-24 selection:bg-[#1C1C1E]/10 font-sans">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-[#6B6B6B] hover:text-[#1C1C1E] transition-colors mb-12 group font-bold text-sm uppercase tracking-widest"
      >
        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
        Back home
      </Link>

      <div className="max-w-4xl">
        <h1 className="text-4xl md:text-7xl font-bold tracking-tighter mb-6">Documentation</h1>
        <p className="text-[#6B6B6B] text-xl mb-20 max-w-2xl font-medium leading-relaxed border-l-4 border-[#E5E5E0] pl-8">
          How Career-Ops works: scan, score, tailor, and track your applications.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
          {sections.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="space-y-6"
            >
              <div className="p-4 bg-[#F5F5F0] w-fit rounded-2xl border border-[#E5E5E0] text-[#1C1C1E]">{s.icon}</div>
              <h3 className="text-3xl font-bold tracking-tight">{s.title}</h3>
              <p className="text-[#6B6B6B] leading-relaxed font-medium">{s.content}</p>
            </motion.div>
          ))}
        </div>

        <div className="mt-32 p-12 bg-white border border-[#E5E5E0] rounded-[2.5rem] shadow-2xl shadow-black/[0.02]">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
            <Cpu className="text-[#1C1C1E]" size={24} />
            AI features
          </h2>
          <p className="text-[#6B6B6B] text-lg leading-relaxed font-medium">
            Career Copilot and tailoring use your profile, resume, and job context to draft answers and
            generate role-specific documents. Requests are not used to train third-party models on your data.
          </p>
        </div>
      </div>
    </div>
  );
}
