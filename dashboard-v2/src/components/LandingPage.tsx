'use client';

import { ArrowRight, Sparkles, Zap, Target, ShieldCheck, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { WhatsNewPanel } from '@/components/WhatsNewPanel';
import { ProductFlowPanel } from '@/components/ProductFlowPanel';
import { releaseSeenKey } from '@/lib/product-updates';

export default function LandingPage() {
  const [visitorStats, setVisitorStats] = useState<any>(null);
  const [showTourModal, setShowTourModal] = useState(false);
  const [tourTab, setTourTab] = useState<'new' | 'flow'>('flow');

  useEffect(() => {
    fetch('/api/view')
      .then((r) => r.json())
      .then(setVisitorStats)
      .catch(() => {});

    const hasSeen = localStorage.getItem(releaseSeenKey());
    if (!hasSeen) {
      const timer = setTimeout(() => {
        setTourTab('flow');
        setShowTourModal(true);
        localStorage.setItem(releaseSeenKey(), 'true');
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#1C1C1E] flex flex-col relative overflow-hidden font-sans">
      <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-[#f59e0b]/5 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-20%] left-[-10%] w-[50%] h-[50%] bg-[#0ea5e9]/3 rounded-full blur-[120px]" />

      <header className="z-20 px-8 py-6 flex justify-between items-center border-b border-[#E5E5E0] backdrop-blur-md sticky top-0 bg-[#FAFAF8]/80">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 bg-[#1C1C1E] rounded-lg flex items-center justify-center shadow-sm">
            <Zap className="h-5 w-5 text-white" strokeWidth={2.25} />
          </div>
          <span className="text-xl font-bold tracking-tight text-[#1C1C1E]">
            Career-Ops <span className="text-[10px] text-[#6B6B6B] font-mono uppercase tracking-widest ml-1">v3</span>
          </span>
        </div>
        <div className="flex items-center gap-6">
          <button
            type="button"
            onClick={() => { setTourTab('flow'); setShowTourModal(true); }}
            className="text-sm font-bold text-[#6B6B6B] hover:text-[#1C1C1E] transition-colors cursor-pointer"
          >
            How it works
          </button>
          <button
            type="button"
            onClick={() => { setTourTab('new'); setShowTourModal(true); }}
            className="text-sm font-bold text-[#6B6B6B] hover:text-[#1C1C1E] transition-colors cursor-pointer"
          >
            What&apos;s New
          </button>
          <Link href="/login" className="text-sm font-bold text-[#6B6B6B] hover:text-[#1C1C1E] transition-colors">
            Sign In
          </Link>
          <Link
            href="/signup"
            className="px-5 py-2.5 bg-[#1C1C1E] text-white font-bold rounded-xl hover:bg-[#27272a] transition-all shadow-md active:scale-95"
          >
            Sign up
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center z-10 max-w-5xl mx-auto w-full pt-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="space-y-6"
        >
          <button
            type="button"
            onClick={() => setShowTourModal(true)}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold uppercase tracking-widest mb-4 hover:bg-emerald-100 transition-colors cursor-pointer"
          >
            <Sparkles size={12} />
            v3 release — Copilot & Resume Studio
          </button>

          <h1 className="text-6xl md:text-8xl font-bold tracking-tighter leading-tight text-[#1C1C1E]">
            Run your job search <br />
            <span className="text-[#9CA3AF]">from one place</span>
          </h1>

          <p className="text-[#6B6B6B] text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
            Scan portals, score matches, tailor resumes, and track applications — with Career Copilot and Resume Studio built in.
          </p>

          <div className="flex flex-col md:flex-row items-center justify-center gap-4 pt-12">
            <Link
              href="/signup"
              className="w-full md:w-auto px-10 py-5 bg-[#1C1C1E] text-white font-bold text-lg rounded-2xl flex items-center justify-center gap-3 hover:bg-[#27272a] transition-all shadow-xl active:scale-95 group"
            >
              Create free account
              <ArrowRight className="group-hover:translate-x-1 transition-transform text-white/50" />
            </Link>
            <button
              type="button"
              onClick={() => { setTourTab('flow'); setShowTourModal(true); }}
              className="w-full md:w-auto px-10 py-5 bg-white border border-[#E5E5E0] text-[#1C1C1E] font-bold text-lg rounded-2xl flex items-center justify-center gap-3 hover:bg-[#F5F5F0] transition-all active:scale-95 cursor-pointer"
            >
              See How It Works
            </button>
          </div>
        </motion.div>

        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.7 }}
          className="mt-24 w-full mb-8"
        >
          <ProductFlowPanel variant="landing" />
        </motion.section>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 1 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-40 w-full mb-20"
        >
          <FeatureCard
            icon={<Zap size={22} />}
            title="Career Copilot"
            desc="Mistral-powered chat that knows your profile — outreach, interview prep, and gap analysis."
          />
          <FeatureCard
            icon={<Target size={22} />}
            title="Resume Studio"
            desc="Live ATS preview, JD match scoring, saved tailored resumes, and one-click PDF export."
          />
          <FeatureCard
            icon={<ShieldCheck size={22} />}
            title="Secure & Mobile"
            desc="Login lockout, rate limits, encrypted tenancy — works on phone and desktop."
          />
        </motion.div>

        {visitorStats && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="mb-12 inline-flex items-center gap-4 px-6 py-3 bg-white border border-[#E5E5E0] rounded-2xl shadow-sm text-sm"
          >
            <div className="flex items-center gap-2 text-[#6B6B6B] font-medium border-r border-[#E5E5E0] pr-4">
              <Eye size={16} />
              Platform Visitors
            </div>
            <div className="flex items-center gap-4">
              <div>
                <span className="font-bold text-[#1C1C1E]">{visitorStats.today?.unique_visitors ?? 0}</span>
                <span className="text-xs text-[#9CA3AF] ml-1">Today</span>
              </div>
              <div className="w-1 h-1 rounded-full bg-[#d4d4d8]" />
              <div>
                <span className="font-bold text-[#1C1C1E]">{visitorStats.allTime?.unique_visitors ?? 0}</span>
                <span className="text-xs text-[#9CA3AF] ml-1">All Time</span>
              </div>
            </div>
          </motion.div>
        )}
      </main>

      <footer className="z-10 border-t border-[#E5E5E0] bg-[#F5F5F0]">
        <div className="p-12 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-[10px] font-bold text-[#6B6B6B] uppercase tracking-[0.2em]">
            Career-Ops v3.0 · careerops.dpdns.org
          </div>
          <div className="flex gap-8 text-[#9CA3AF] text-[11px] font-bold uppercase tracking-widest">
            <Link href="/docs" className="hover:text-[#1C1C1E] transition-colors">
              Documentation
            </Link>
            <Link href="/privacy" className="hover:text-[#1C1C1E] transition-colors">
              Privacy
            </Link>
            <Link href="/status" className="hover:text-[#1C1C1E] transition-colors">
              Status
            </Link>
          </div>
        </div>
        <div className="pb-6 pt-2 text-center text-xs text-[#9CA3AF]">
          Made with <span className="text-red-400">❤️</span> by{' '}
          <a
            href="https://github.com/UGilfoyle"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#6B6B6B] hover:text-[#1C1C1E] underline decoration-dotted underline-offset-2 transition-colors"
          >
            Akash Kaintura
          </a>
        </div>
      </footer>

      <AnimatePresence>
        {showTourModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-md z-[100] flex items-center justify-center p-6"
            onClick={() => setShowTourModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-[#FAFAF8] rounded-[2.5rem] border border-[#E5E5E0] shadow-2xl relative"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 z-10 flex items-center gap-2 p-4 border-b border-[#E5E5E0] bg-[#FAFAF8]/95 backdrop-blur-sm">
                <button
                  type="button"
                  onClick={() => setTourTab('flow')}
                  className={`flex-1 rounded-xl py-2.5 text-xs font-bold transition-all ${tourTab === 'flow' ? 'bg-[#1C1C1E] text-white' : 'text-[#6B6B6B] hover:bg-white'}`}
                >
                  How it works
                </button>
                <button
                  type="button"
                  onClick={() => setTourTab('new')}
                  className={`flex-1 rounded-xl py-2.5 text-xs font-bold transition-all ${tourTab === 'new' ? 'bg-[#1C1C1E] text-white' : 'text-[#6B6B6B] hover:bg-white'}`}
                >
                  What&apos;s New
                </button>
                <button
                  type="button"
                  onClick={() => setShowTourModal(false)}
                  className="h-10 w-10 rounded-full border border-[#E5E5E0] bg-white hover:bg-[#F5F5F0] flex items-center justify-center text-[#6B6B6B] transition-all cursor-pointer shrink-0"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
              {tourTab === 'flow' ? (
                <div className="p-6">
                  <ProductFlowPanel variant="landing" showSignupCta />
                </div>
              ) : (
                <WhatsNewPanel variant="modal" onDismiss={() => setShowTourModal(false)} />
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: ReactNode; title: string; desc: string }) {
  return (
    <div className="p-10 bg-white border border-[#E5E5E0] rounded-[2rem] text-left group hover:border-[#d4d4d8] hover:shadow-2xl hover:shadow-black/[0.02] transition-all">
      <div className="mb-6 p-4 bg-[#FAFAF8] w-fit rounded-2xl group-hover:bg-[#F5F5F0] transition-colors text-[#1C1C1E]">
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-3 text-[#1C1C1E]">{title}</h3>
      <p className="text-[#6B6B6B] text-sm leading-relaxed">{desc}</p>
    </div>
  );
}
