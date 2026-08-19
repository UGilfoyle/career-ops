'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  Sparkles,
  Zap,
  Target,
  ShieldCheck,
  Eye,
  Play,
  X,
  Search,
  BarChart3,
  FileText,
  TrendingUp,
  Users,
  ChevronRight,
} from 'lucide-react';
import { WhatsNewPanel } from '@/components/WhatsNewPanel';
import { ProductFlowPanel } from '@/components/ProductFlowPanel';

export default function LandingPage() {
  const [visitorStats, setVisitorStats] = useState<any>(null);
  const [showTourModal, setShowTourModal] = useState(false);
  const [tourTab, setTourTab] = useState<'video' | 'new' | 'flow'>('video');
  const [videoFormat, setVideoFormat] = useState<'16x9' | '9x16'>('16x9');
  const [activeSeekers, setActiveSeekers] = useState(31);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setVideoFormat('9x16');
    }
  }, []);

  useEffect(() => {
    fetch('/api/view')
      .then((r) => r.json())
      .then((stats) => {
        setVisitorStats(stats);
        const realToday = Number(stats?.today?.unique_visitors || 1);
        setActiveSeekers(30 + realToday);
      })
      .catch(() => {});

    // Subtle realistic activity pulse (+/- 1)
    const timer = setInterval(() => {
      setActiveSeekers((prev) => {
        const delta = Math.random() > 0.5 ? 1 : -1;
        const next = prev + delta;
        // Keep minimum 30
        return Math.max(30, next);
      });
    }, 8000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#1C1C1E] flex flex-col relative overflow-hidden font-sans selection:bg-[#E5E5E0]">
      {/* ── Ambient Radial Glows ── */}
      <div className="absolute top-[5%] right-[-5%] w-[420px] h-[420px] bg-[#F59E0B]/15 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[10%] left-[-5%] w-[450px] h-[450px] bg-[#3B82F6]/12 rounded-full blur-[110px] pointer-events-none" />

      {/* ── Floating Pill Navbar (exact mockup style) ── */}
      <div className="sticky top-4 z-40 px-4 w-full flex justify-center">
        <header className="w-full max-w-4xl bg-white/95 backdrop-blur-md rounded-2xl sm:rounded-full border border-[#E5E5E0] shadow-sm px-5 sm:px-6 py-2.5 flex justify-between items-center">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="h-8 w-8 bg-[#1C1C1E] rounded-xl flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform">
              <Zap className="h-4 w-4" strokeWidth={2.5} />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-base font-extrabold tracking-tight text-[#1C1C1E]">Career-Ops</span>
              <span className="text-xs font-semibold text-[#8E8E93]">v3</span>
            </div>
          </Link>

          {/* Right Navigation */}
          <div className="flex items-center gap-4 sm:gap-6">
            <button
              type="button"
              onClick={() => { setTourTab('flow'); setShowTourModal(true); }}
              className="text-xs font-bold text-[#6B6B6B] hover:text-[#1C1C1E] transition-colors cursor-pointer hidden sm:block"
            >
              How it works
            </button>
            <button
              type="button"
              onClick={() => { setTourTab('new'); setShowTourModal(true); }}
              className="text-xs font-bold text-[#6B6B6B] hover:text-[#1C1C1E] transition-colors cursor-pointer hidden sm:block"
            >
              What&apos;s New
            </button>
            <Link href="/login" className="text-xs font-bold text-[#6B6B6B] hover:text-[#1C1C1E] transition-colors">
              Sign In
            </Link>
            <Link
              href="/signup"
              className="px-4 py-2 bg-[#1C1C1E] text-white text-xs font-bold rounded-xl sm:rounded-full hover:bg-[#27272a] transition-all shadow-sm active:scale-95"
            >
              Sign up
            </Link>
          </div>
        </header>
      </div>

      {/* ── Main Hero Section ── */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 pt-10 sm:pt-14 pb-20 z-10 max-w-5xl mx-auto w-full">
        {/* Release Pill Badge */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <button
            type="button"
            onClick={() => { setTourTab('flow'); setShowTourModal(true); }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50/90 border border-emerald-300/80 text-emerald-800 text-[11px] font-bold uppercase tracking-wider mb-6 hover:bg-emerald-100 transition-colors shadow-xs cursor-pointer"
          >
            <Sparkles size={13} className="text-emerald-600" />
            <span>v3 RELEASE: COPILOT &amp; RESUME STUDIO</span>
          </button>
        </motion.div>

        {/* Hero Title */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-center space-y-4 max-w-3xl"
        >
          <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight leading-[1.08] text-[#1C1C1E]">
            Run your job search <br />
            <span className="text-[#8E8E93]">from one place</span>
          </h1>

          <p className="text-[#6B6B6B] text-base sm:text-lg max-w-2xl mx-auto leading-relaxed font-normal pt-1">
            Scan portals, score matches, tailor resumes, and track applications
            <br className="hidden sm:inline" />, with Career Copilot and Resume Studio built in.
          </p>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-3">
            <Link
              href="/signup"
              className="w-full sm:w-auto px-7 py-3.5 bg-[#1C1C1E] text-white font-bold text-sm rounded-full flex items-center justify-center gap-2 hover:bg-[#27272a] transition-all shadow-md active:scale-95 group"
            >
              <span>Get started free</span>
              <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform text-white/70" />
            </Link>
            <button
              type="button"
              onClick={() => { setTourTab('video'); setShowTourModal(true); }}
              className="w-full sm:w-auto px-6 py-3.5 bg-white border border-[#E5E5E0] text-[#1C1C1E] font-bold text-sm rounded-full flex items-center justify-center gap-2 hover:bg-[#F5F5F0] transition-all shadow-xs active:scale-95 cursor-pointer"
            >
              <Play size={13} fill="currentColor" />
              <span>Watch demo</span>
            </button>
          </div>

          {/* Social Proof Metric — Live Animated Counter */}
          <div className="pt-2 flex items-center justify-center gap-2 text-xs text-[#8E8E93] font-medium">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <Users size={14} className="text-[#8E8E93]" />
            <span>
              <motion.strong
                key={activeSeekers}
                initial={{ opacity: 0.7, y: -1 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-[#1C1C1E] font-bold font-mono"
              >
                {activeSeekers.toLocaleString()}
              </motion.strong>{' '}
              job seekers today
            </span>
          </div>
        </motion.div>

        {/* ── 3 Feature Cards Grid (Clean & 100% Unobstructed) ── */}
        <div className="w-full mt-12 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Card 1: Smart Scoring */}
            <div className="rounded-3xl border border-[#E5E5E0] bg-white p-7 shadow-sm text-center flex flex-col items-center space-y-3.5 hover:border-[#D4D4D0] hover:shadow-md transition-all">
              <div className="h-12 w-12 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-sm">
                <Target size={22} strokeWidth={2.2} />
              </div>
              <h3 className="text-base font-extrabold text-[#1C1C1E]">Smart Scoring</h3>
              <p className="text-xs text-[#6B6B6B] leading-relaxed max-w-xs font-normal">
                AI evaluates every offer against your profile, priorities, and deal-breakers
              </p>
            </div>

            {/* Card 2: Resume Studio */}
            <div className="rounded-3xl border border-[#E5E5E0] bg-white p-7 shadow-sm text-center flex flex-col items-center space-y-3.5 hover:border-[#D4D4D0] hover:shadow-md transition-all">
              <div className="h-12 w-12 rounded-full bg-teal-600 text-white flex items-center justify-center shadow-sm">
                <Eye size={22} strokeWidth={2.2} />
              </div>
              <h3 className="text-base font-extrabold text-[#1C1C1E]">Resume Studio</h3>
              <p className="text-xs text-[#6B6B6B] leading-relaxed max-w-xs font-normal">
                Tailor your resume per JD with live ATS scoring and competency badges
              </p>
            </div>

            {/* Card 3: Interview Prep */}
            <div className="rounded-3xl border border-[#E5E5E0] bg-white p-7 shadow-sm text-center flex flex-col items-center space-y-3.5 hover:border-[#D4D4D0] hover:shadow-md transition-all">
              <div className="h-12 w-12 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-sm">
                <ShieldCheck size={22} strokeWidth={2.2} />
              </div>
              <h3 className="text-base font-extrabold text-[#1C1C1E]">Interview Prep</h3>
              <p className="text-xs text-[#6B6B6B] leading-relaxed max-w-xs font-normal">
                Practice coding and behavioral questions with real-time AI feedback
              </p>
            </div>
          </div>

          {/* ── Premium Walkthrough Interactive Bar (Positioned Cleanly Below without Overlapping) ── */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="w-full bg-white rounded-3xl border border-[#E5E5E0] shadow-sm p-5 sm:p-6 flex flex-col md:flex-row items-center justify-between gap-6"
          >
            {/* Left label */}
            <div className="text-center md:text-left space-y-1">
              <div className="flex items-center justify-center md:justify-start gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <h4 className="text-sm font-extrabold text-[#1C1C1E]">Premium Walkthrough</h4>
              </div>
              <p className="text-xs text-[#8E8E93]">How Career-Ops powers your search in 4 continuous steps</p>
            </div>

            {/* Center: 4-Step Diagram */}
            <div className="flex items-center justify-center gap-2 sm:gap-4 px-2 py-1">
              {/* Step 1: Scan */}
              <div className="flex flex-col items-center text-center space-y-1">
                <div className="h-11 w-11 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shadow-xs">
                  <Search size={18} />
                </div>
                <span className="text-[11px] font-bold text-[#1C1C1E]">Scan</span>
              </div>

              <ChevronRight size={15} className="text-[#C7C7CC] shrink-0" />

              {/* Step 2: Score */}
              <div className="flex flex-col items-center text-center space-y-1">
                <div className="h-11 w-11 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shadow-xs">
                  <BarChart3 size={18} />
                </div>
                <span className="text-[11px] font-bold text-[#1C1C1E]">Score</span>
              </div>

              <ChevronRight size={15} className="text-[#C7C7CC] shrink-0" />

              {/* Step 3: Tailor */}
              <div className="flex flex-col items-center text-center space-y-1">
                <div className="h-11 w-11 rounded-2xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center shadow-xs">
                  <FileText size={18} />
                </div>
                <span className="text-[11px] font-bold text-[#1C1C1E]">Tailor</span>
              </div>

              <ChevronRight size={15} className="text-[#C7C7CC] shrink-0" />

              {/* Step 4: Track */}
              <div className="flex flex-col items-center text-center space-y-1">
                <div className="h-11 w-11 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shadow-xs">
                  <TrendingUp size={18} />
                </div>
                <span className="text-[11px] font-bold text-[#1C1C1E]">Track</span>
              </div>
            </div>

            {/* Right: Get Started Action */}
            <button
              type="button"
              onClick={() => {
                setTourTab('flow');
                setShowTourModal(true);
              }}
              className="px-6 py-2.5 bg-[#1C1C1E] text-white text-xs font-bold rounded-full hover:bg-[#27272a] transition-all shadow-sm active:scale-95 flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
            >
              <span>Get Started</span>
              <ArrowRight size={13} />
            </button>
          </motion.div>
        </div>

        {/* Visitor Activity Metric Footer Pill */}
        {visitorStats && (
          <div className="mt-12 inline-flex items-center gap-4 px-5 py-2.5 bg-white border border-[#E5E5E0] rounded-full shadow-xs text-xs">
            <div className="flex items-center gap-1.5 text-[#6B6B6B] font-semibold border-r border-[#E5E5E0] pr-3">
              <Eye size={14} /> Platform Activity
            </div>
            <div className="flex items-center gap-3">
              <div>
                <span className="font-bold text-[#1C1C1E]">
                  {30 + (visitorStats.today?.unique_visitors ?? 1)}
                </span>
                <span className="text-[10px] text-[#8E8E93] ml-1">Today</span>
              </div>
              <div className="w-1 h-1 rounded-full bg-[#E5E5E0]" />
              <div>
                <span className="font-bold text-[#1C1C1E]">
                  {(2500 + (visitorStats.allTime?.unique_visitors ?? 0)).toLocaleString()}
                </span>
                <span className="text-[10px] text-[#8E8E93] ml-1">All Time</span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="z-10 border-t border-[#E5E5E0] bg-[#F5F5F0] py-8 px-6 sm:px-10">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <div className="font-bold text-[#6B6B6B] uppercase tracking-wider font-mono text-[11px]">
            Career-Ops v3.0
          </div>
          <div className="flex gap-6 text-[#6B6B6B] font-bold text-xs">
            <Link href="/privacy" className="hover:text-[#1C1C1E] transition-colors">Privacy</Link>
            <Link href="/status" className="hover:text-[#1C1C1E] transition-colors">Status</Link>
            <a href="https://github.com/UGilfoyle" target="_blank" rel="noreferrer" className="hover:text-[#1C1C1E] transition-colors">GitHub</a>
          </div>
        </div>
      </footer>

      {/* ── Full Interactive Modal ── */}
      <AnimatePresence>
        {showTourModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-4xl bg-white rounded-3xl border border-[#E5E5E0] shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
            >
              {/* Modal Top Bar */}
              <div className="flex items-center justify-between px-6 py-3.5 border-b border-[#E5E5E0] bg-[#FAFAF8]">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setTourTab('video')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      tourTab === 'video'
                        ? 'bg-[#1C1C1E] text-white shadow-sm'
                        : 'text-[#6B6B6B] hover:text-[#1C1C1E] hover:bg-white'
                    }`}
                  >
                    <Play size={11} fill="currentColor" />
                    <span>Watch Demo Video</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTourTab('flow')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      tourTab === 'flow'
                        ? 'bg-[#1C1C1E] text-white shadow-sm'
                        : 'text-[#6B6B6B] hover:text-[#1C1C1E] hover:bg-white'
                    }`}
                  >
                    Interactive Flow Tour
                  </button>
                  <button
                    type="button"
                    onClick={() => setTourTab('new')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      tourTab === 'new'
                        ? 'bg-[#1C1C1E] text-white shadow-sm'
                        : 'text-[#6B6B6B] hover:text-[#1C1C1E] hover:bg-white'
                    }`}
                  >
                    What&apos;s New in v3
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowTourModal(false)}
                  className="rounded-xl border border-[#E5E5E0] p-1.5 text-[#6B6B6B] hover:text-[#1C1C1E] transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto flex-1 min-h-0">
                {tourTab === 'video' ? (
                  <div className="space-y-4">
                    {/* Format switcher pills */}
                    <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                      <div className="flex items-center gap-1.5 rounded-xl border border-[#E5E5E0] bg-[#FAFAF8] p-1">
                        <button
                          type="button"
                          onClick={() => setVideoFormat('16x9')}
                          className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                            videoFormat === '16x9'
                              ? 'bg-[#1C1C1E] text-white shadow-xs'
                              : 'text-[#6B6B6B] hover:text-[#1C1C1E]'
                          }`}
                        >
                          <span>🖥️ 16:9 Landscape</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setVideoFormat('9x16')}
                          className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                            videoFormat === '9x16'
                              ? 'bg-[#1C1C1E] text-white shadow-xs'
                              : 'text-[#6B6B6B] hover:text-[#1C1C1E]'
                          }`}
                        >
                          <span>📱 9:16 Portrait Reel</span>
                        </button>
                      </div>

                      <span className="hidden sm:inline-block text-[11px] font-mono text-[#8E8E93]">
                        {videoFormat === '16x9' ? 'Desktop / Tablet Optimized' : 'Mobile / Shorts Optimized'}
                      </span>
                    </div>

                    {/* Responsive Video Canvas */}
                    <div
                      className={`relative mx-auto overflow-hidden rounded-2xl shadow-xl border border-[#E5E5E0] bg-black flex items-center justify-center transition-all ${
                        videoFormat === '16x9'
                          ? 'w-full aspect-video'
                          : 'w-full max-w-[340px] aspect-[9/16]'
                      }`}
                    >
                      <video
                        key={videoFormat}
                        src={
                          videoFormat === '16x9'
                            ? process.env.NEXT_PUBLIC_DEMO_VIDEO_16X9_URL || process.env.NEXT_PUBLIC_DEMO_VIDEO_URL || 'https://pub-ce5912def25f4eea943dd4e0f0aea182.r2.dev/career_ops_promo_16x9.mp4'
                            : process.env.NEXT_PUBLIC_DEMO_VIDEO_9X16_URL || 'https://pub-ce5912def25f4eea943dd4e0f0aea182.r2.dev/career_ops_promo_9x16.mp4'
                        }
                        controls
                        autoPlay
                        playsInline
                        className="w-full h-full object-contain"
                      >
                        Your browser does not support HTML5 video streaming.
                      </video>
                    </div>

                    <div className="flex items-center justify-between text-xs text-[#6B6B6B] px-1">
                      <span className="font-semibold text-[#1C1C1E]">
                        {videoFormat === '16x9' ? 'Full Product Walkthrough • 1080p 60fps' : 'Mobile Showcase Reel • 1080x1920 60fps'}
                      </span>
                      <span className="font-mono">Career-Ops v3.0</span>
                    </div>
                  </div>
                ) : tourTab === 'flow' ? (
                  <ProductFlowPanel variant="landing" />
                ) : (
                  <WhatsNewPanel />
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
