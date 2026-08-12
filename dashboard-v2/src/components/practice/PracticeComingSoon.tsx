'use client';

import { motion } from 'framer-motion';
import { GraduationCap, Sparkles } from 'lucide-react';

/** Shown to users outside the Interview Practice beta allowlist. */
export default function PracticeComingSoon() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
      className="mx-auto flex min-h-[48vh] w-full max-w-xl flex-col items-center justify-center px-3 text-center sm:px-4"
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F4F4F0] text-[#1C1C1E] sm:mb-5 sm:h-14 sm:w-14">
        <GraduationCap size={26} />
      </div>
      <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#E5E5E0] bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#6B6B6B]">
        <Sparkles size={12} />
        Private beta
      </div>
      <h2 className="text-xl font-bold tracking-tight text-[#1C1C1E] sm:text-3xl">
        Something wonderful is coming soon
      </h2>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-[#6B6B6B] sm:text-base">
        Interview Practice — JD-linked coding, system design, and behavioral packs — is in a
        limited rollout. We&apos;ll open it up when it&apos;s ready for everyone.
      </p>
    </motion.div>
  );
}
