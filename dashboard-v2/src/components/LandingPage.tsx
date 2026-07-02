'use client';

import { ArrowRight, ShieldCheck, Play, Sparkles, Zap, Target, Eye } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function LandingPage() {
  const [visitorStats, setVisitorStats] = useState<any>(null);

  useEffect(() => {
    fetch('/api/view')
      .then(r => r.json())
      .then(setVisitorStats)
      .catch(() => {});
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
