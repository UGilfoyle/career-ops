'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { GraduationCap, Sparkles, CheckCircle2, Mic } from 'lucide-react';
import { Button } from 'antd';

/** Shown to users outside the Interview Practice beta allowlist. */
export default function PracticeComingSoon() {
  const [joinedWaitlist, setJoinedWaitlist] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="mx-auto flex min-h-[55vh] w-full max-w-xl flex-col items-center justify-center px-4 text-center"
    >
      {/* Floating Animated Icon */}
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className="relative mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-b from-zinc-100 to-zinc-200/80 text-zinc-900 shadow-sm border border-zinc-200"
      >
        <GraduationCap size={32} />
        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-zinc-900 text-[9px] text-white">
          <Mic size={10} />
        </span>
      </motion.div>

      <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3.5 py-1 text-[11px] font-bold uppercase tracking-wider text-zinc-600 shadow-2xs">
        <Sparkles size={13} className="text-amber-500" />
        Interactive Voice & Coding Beta
      </div>

      <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900">
        AI Interview Practice & Voice Mock
      </h2>

      <p className="mt-3 max-w-md text-sm leading-relaxed text-zinc-500">
        Live voice mock interviews with real-time bar-raiser evaluation, plus JD-linked coding challenges and system design sandboxes. Rolling out to early adopters.
      </p>

      <div className="mt-6 flex flex-col sm:flex-row items-center gap-3">
        {joinedWaitlist ? (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
            <CheckCircle2 size={16} />
            You&apos;re on the priority early access list!
          </div>
        ) : (
          <Button
            type="primary"
            size="large"
            onClick={() => setJoinedWaitlist(true)}
            className="bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold px-6 rounded-xl h-10 shadow-xs"
          >
            Request Beta Access
          </Button>
        )}
      </div>
    </motion.div>
  );
}
