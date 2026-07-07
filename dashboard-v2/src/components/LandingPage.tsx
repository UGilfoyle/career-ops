'use client';

import { ArrowRight, ShieldCheck, Play, Sparkles, Zap, Target, Eye, X, MessageSquare, Bot } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function LandingPage() {
  const [visitorStats, setVisitorStats] = useState<any>(null);
  const [showTourModal, setShowTourModal] = useState(false);

  useEffect(() => {
    fetch('/api/view')
      .then(r => r.json())
      .then(setVisitorStats)
      .catch(() => {});

    // Auto-open modal once to showcase the new features
    const hasSeen = localStorage.getItem('career_ops_seen_landing_tour_v2');
    if (!hasSeen) {
      const timer = setTimeout(() => {
        setShowTourModal(true);
        localStorage.setItem('career_ops_seen_landing_tour_v2', 'true');
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#1C1C1E] flex flex-col relative overflow-hidden font-sans">
      {/* Background Subtle Organic Glows: Switched to warm, soft tones */}
      <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-[#f59e0b]/5 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-20%] left-[-10%] w-[50%] h-[50%] bg-[#0ea5e9]/3 rounded-full blur-[120px]" />

      {/* Header */}
      <header className="z-20 px-8 py-6 flex justify-between items-center border-b border-[#E5E5E0] backdrop-blur-md sticky top-0 bg-[#FAFAF8]/80">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 bg-[#1C1C1E] rounded-lg flex items-center justify-center shadow-sm">
            <Zap className="h-5 w-5 text-white" strokeWidth={2.25} />
          </div>
          <span className="text-xl font-bold tracking-tight text-[#1C1C1E]">Career-Ops <span className="text-[10px] text-[#6B6B6B] font-mono uppercase tracking-widest ml-1">SaaS v2</span></span>
        </div>
        <div className="flex items-center gap-6">
          <button 
            type="button" 
            onClick={() => setShowTourModal(true)} 
            className="text-sm font-bold text-[#6B6B6B] hover:text-[#1C1C1E] transition-colors cursor-pointer"
          >
            Tour Features
          </button>
          <Link href="/login" className="text-sm font-bold text-[#6B6B6B] hover:text-[#1C1C1E] transition-colors">
            Sign In
          </Link>
          <Link href="/signup" className="px-5 py-2.5 bg-[#1C1C1E] text-white font-bold rounded-xl hover:bg-[#27272a] transition-all shadow-md active:scale-95">
            Join Platform
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center z-10 max-w-5xl mx-auto w-full pt-20">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="space-y-6"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#F5F5F0] border border-[#E5E5E0] text-[#6B6B6B] text-[10px] font-bold uppercase tracking-widest mb-4">
            <Sparkles size={12} className="text-[#1C1C1E]" />
            Professional Career Infrastructure
          </div>
          
          <h1 className="text-6xl md:text-8xl font-bold tracking-tighter leading-tight text-[#1C1C1E]">
            Automate Your <br />
            <span className="text-[#9CA3AF]">Career Ascension</span>
          </h1>

          <p className="text-[#6B6B6B] text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
            The sophisticated AI command center for professional growth. 
            Automated job scanning, agentic resume tailoring, and 
            real-time pipeline intelligence.
          </p>

          <div className="flex flex-col md:flex-row items-center justify-center gap-4 pt-12">
            <Link 
              href="/signup" 
              className="w-full md:w-auto px-10 py-5 bg-[#1C1C1E] text-white font-bold text-lg rounded-2xl flex items-center justify-center gap-3 hover:bg-[#27272a] transition-all shadow-xl active:scale-95 group"
            >
              Get Started for Free
              <ArrowRight className="group-hover:translate-x-1 transition-transform text-white/50" />
            </Link>
            <Link 
              href="/login" 
              className="w-full md:w-auto px-10 py-5 bg-white border border-[#E5E5E0] text-[#1C1C1E] font-bold text-lg rounded-2xl flex items-center justify-center gap-3 hover:bg-[#F5F5F0] transition-all active:scale-95"
            >
              Enter Command Center
            </Link>
          </div>
        </motion.div>

        {/* Feature Highlights: Switched to soft white cards with delicate borders */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 1 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-40 w-full mb-20"
        >
          <FeatureCard 
            icon={<Zap size={22} />} 
            title="Real-time Scanning" 
            desc="Continuous scraping of global job boards with high-precision AI ranking." 
          />
          <FeatureCard 
            icon={<Target size={22} />} 
            title="Agentic Tailoring" 
            desc="LLM-driven resume optimization that matches exact hiring manager signals." 
          />
          <FeatureCard 
            icon={<ShieldCheck size={22} />} 
            title="Secure Tenancy" 
            desc="Encrypted multi-tenant architecture keeps your career narrative private." 
          />
        </motion.div>
        
        {/* Visitor Counter */}
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

      {/* Footer */}
      <footer className="z-10 border-t border-[#E5E5E0] bg-[#F5F5F0]">
        <div className="p-12 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-[10px] font-bold text-[#6B6B6B] uppercase tracking-[0.2em] flex items-center gap-2">
            <Play size={10} className="fill-[#6B6B6B] text-[#6B6B6B]" />
            Initialized v2.0-modern-beige
          </div>
          <div className="flex gap-8 text-[#9CA3AF] text-[11px] font-bold uppercase tracking-widest">
            <Link href="/docs" className="hover:text-[#1C1C1E] transition-colors">Documentation</Link>
            <Link href="/privacy" className="hover:text-[#1C1C1E] transition-colors">Privacy Core</Link>
            <Link href="/status" className="hover:text-[#1C1C1E] transition-colors">Infra Status</Link>
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

      {/* Feature Showcase Modal */}
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
              className="w-full max-w-2xl bg-[#FAFAF8] rounded-[2.5rem] border border-[#E5E5E0] shadow-2xl overflow-hidden relative"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setShowTourModal(false)}
                className="absolute right-6 top-6 h-10 w-10 rounded-full bg-white border border-[#E5E5E0] hover:border-[#1C1C1E] flex items-center justify-center text-[#6B6B6B] hover:text-[#1C1C1E] transition-all cursor-pointer z-10"
              >
                <X size={16} />
              </button>

              {/* Cover Banner */}
              <div className="bg-[#1C1C1E] p-8 text-white relative overflow-hidden">
                <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[150%] bg-emerald-500/10 rounded-full blur-[60px]" />
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white text-[9px] font-bold uppercase tracking-widest mb-3">
                  <Sparkles size={10} />
                  New Feature Release
                </div>
                <h2 className="text-2xl font-bold tracking-tight mb-2">Platform Enhancements</h2>
                <p className="text-white/70 text-xs">Unlock professional career velocity with automated intelligence</p>
              </div>

              {/* Features List */}
              <div className="p-8 space-y-6 max-h-[50vh] overflow-y-auto">
                {/* 1. Chatbot */}
                <div className="flex gap-4">
                  <div className="h-10 w-10 bg-[#FAFAF8] border border-[#E5E5E0] rounded-xl flex items-center justify-center text-[#1C1C1E] shrink-0 shadow-sm">
                    <MessageSquare size={18} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-[#1C1C1E] flex items-center gap-2">
                      Career Copilot Chatbot
                      <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">Flagship</span>
                    </h4>
                    <p className="text-xs text-[#6B6B6B] leading-relaxed mt-1">
                      Chat in real-time with an AI that knows your entire profile. Instantly draft personalized LinkedIn recruiter messages, identify skill gaps, and run mock interviews.
                    </p>
                  </div>
                </div>

                {/* 2. Scanning */}
                <div className="flex gap-4">
                  <div className="h-10 w-10 bg-[#FAFAF8] border border-[#E5E5E0] rounded-xl flex items-center justify-center text-[#1C1C1E] shrink-0 shadow-sm">
                    <Zap size={18} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-[#1C1C1E]">Real-Time Portal Scanning</h4>
                    <p className="text-xs text-[#6B6B6B] leading-relaxed mt-1">
                      Continuous, automated checking of top portals (Greenhouse, Ashby, Lever, Indeed, LinkedIn) with built-in unwrapping of redirect links and auto-scoring out of 10.
                    </p>
                  </div>
                </div>

                {/* 3. Tailoring */}
                <div className="flex gap-4">
                  <div className="h-10 w-10 bg-[#FAFAF8] border border-[#E5E5E0] rounded-xl flex items-center justify-center text-[#1C1C1E] shrink-0 shadow-sm">
                    <Target size={18} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-[#1C1C1E]">Agentic Tailoring Studio</h4>
                    <p className="text-xs text-[#6B6B6B] leading-relaxed mt-1">
                      Generate optimized cover letters and tailored HTML/PDF resumes matching the exact skills and qualifications wanted by recruiters.
                    </p>
                  </div>
                </div>
              </div>

              {/* Call to Action Footer */}
              <div className="p-6 bg-[#FAFAF8] border-t border-[#E5E5E0] flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() => setShowTourModal(false)}
                  className="text-xs font-bold text-[#6B6B6B] hover:text-[#1C1C1E] transition-colors cursor-pointer"
                >
                  Dismiss Tour
                </button>
                <Link
                  href="/signup"
                  className="px-6 py-3 bg-[#1C1C1E] text-white text-xs font-bold rounded-xl hover:bg-[#27272a] transition-all shadow-md active:scale-95 flex items-center gap-2"
                >
                  Join Platform & Get Started
                  <ArrowRight size={12} />
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: any, title: string, desc: string }) {
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
