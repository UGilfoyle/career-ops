'use client';

import { Fingerprint, Lock, EyeOff, ArrowLeft, Key } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';

export default function PrivacyPage() {
  const pillars = [
    {
      title: 'Your data stays yours',
      icon: <Fingerprint />,
      content:
        'Profile, resume, and application data are stored per account on Neon Postgres. We do not mix data between users.',
    },
    {
      title: 'Email & verification',
      icon: <Lock />,
      content:
        'Verification emails are sent over TLS. We do not sell or share your email with job boards or recruiters.',
    },
    {
      title: 'AI requests',
      icon: <EyeOff />,
      content:
        'Tailoring and Copilot calls are stateless. Your career data is not used to fine-tune external models.',
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
        <h1 className="text-4xl md:text-7xl font-bold tracking-tighter mb-6">Privacy</h1>
        <p className="text-[#6B6B6B] text-xl mb-20 max-w-2xl font-medium leading-relaxed border-l-4 border-[#E5E5E0] pl-8">
          What we store, how we use it, and what we do not do with your career data.
        </p>

        <div className="space-y-20 mb-32">
          {pillars.map((p, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="flex gap-10 items-start"
            >
              <div className="p-5 bg-white rounded-2xl border border-[#E5E5E0] text-[#1C1C1E] shrink-0">{p.icon}</div>
              <div className="pt-2">
                <h3 className="text-3xl font-bold mb-3 tracking-tight">{p.title}</h3>
                <p className="text-[#6B6B6B] leading-relaxed max-w-xl font-medium">{p.content}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="p-10 bg-white border border-[#E5E5E0] rounded-[2.5rem] flex items-center gap-8 shadow-2xl shadow-black/[0.02]">
          <Key className="text-[#1C1C1E] shrink-0" size={40} />
          <div>
            <h4 className="font-bold text-xl mb-1">Encrypted API keys</h4>
            <p className="text-[#6B6B6B] font-medium leading-relaxed">
              GitHub PATs and other secrets are encrypted at rest (AES-256). They are only decrypted inside the
              secure execution runner when you run a deep scan or tailor.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
