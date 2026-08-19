'use client';

import { motion } from 'framer-motion';
import {
  Sparkles,
  LayoutTemplate,
  Eye,
  GitCompare,
  FileDown,
  Terminal,
  Settings,
  Upload,
} from 'lucide-react';

type ResumeStudioTeaserProps = {
  onOpenTerminal?: () => void;
  onOpenSettings?: () => void;
  onOpenResumeManager?: () => void;
};

const comingFeatures = [
  {
    icon: <Eye size={18} />,
    title: 'Live preview editor',
    desc: 'Edit your master resume on the left; see the exact PDF layout update on the right.',
  },
  {
    icon: <LayoutTemplate size={18} />,
    title: 'Template gallery',
    desc: 'ATS Classic, Modern Compact, and more — pick a look without sacrificing parseability.',
  },
  {
    icon: <GitCompare size={18} />,
    title: 'Per-job diff review',
    desc: 'Compare master vs tailored versions with keyword highlights and quality audit scores.',
  },
  {
    icon: <FileDown size={18} />,
    title: 'One-click export',
    desc: 'PDF and JSON export — same output as terminal tailor today.',
  },
];

const availableNow = [
  {
    icon: <Terminal size={16} />,
    label: 'Tailor per job',
    hint: 'terminal → tailor <id> --deep',
    action: 'terminal' as const,
  },
  {
    icon: <Upload size={16} />,
    label: 'Import resume',
    hint: 'Settings → Resume Import',
    action: 'settings' as const,
  },
  {
    icon: <Settings size={16} />,
    label: 'Profile & narrative',
    hint: 'Shapes every tailored output',
    action: 'settings' as const,
  },
];

export default function ResumeStudioTeaser({
  onOpenTerminal,
  onOpenSettings,
  onOpenResumeManager,
}: ResumeStudioTeaserProps) {
  return (
    <motion.div
      key="resume-studio"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto space-y-10"
    >
      <div className="text-center space-y-4 pt-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#E5E5E0] bg-[#F5F5F0] px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[#6B6B6B]">
          <Sparkles size={12} className="text-[#1C1C1E]" />
          Most requested · Phase 2
        </div>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#1C1C1E]">Resume Studio</h2>
        <p className="text-[#6B6B6B] text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
          Edit, preview, and export resumes without leaving scan, score, tailor, and track. In development — your current workflow is unchanged.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {comingFeatures.map((f) => (
          <div
            key={f.title}
            className="p-6 bg-white border border-[#E5E5E0] rounded-2xl hover:border-[#D4D4CE] transition-colors"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F5F5F0] text-[#1C1C1E] mb-4">
              {f.icon}
            </div>
            <h3 className="font-bold text-[#1C1C1E] mb-1">{f.title}</h3>
            <p className="text-sm text-[#6B6B6B] leading-relaxed">{f.desc}</p>
            <span className="inline-block mt-3 text-[10px] font-bold uppercase tracking-widest text-amber-700">
              Coming soon
            </span>
          </div>
        ))}
      </div>

      <div className="rounded-[2rem] border border-[#E5E5E0] bg-[#FAFAF8] p-8 sm:p-10">
        <h3 className="text-lg font-bold text-[#1C1C1E] mb-2">What works today</h3>
        <p className="text-sm text-[#6B6B6B] mb-6">
          You don&apos;t need to wait — run the pipeline now and generated PDFs land in Resume Manager.
        </p>
        <div className="grid sm:grid-cols-3 gap-3">
          {availableNow.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                if (item.action === 'terminal') onOpenTerminal?.();
                else onOpenSettings?.();
              }}
              className="text-left p-4 rounded-xl bg-white border border-[#E5E5E0] hover:border-[#1C1C1E] hover:shadow-sm transition-all group"
            >
              <div className="flex items-center gap-2 text-[#1C1C1E] font-bold text-sm mb-1">
                <span className="text-[#9CA3AF] group-hover:text-[#1C1C1E] transition-colors">{item.icon}</span>
                {item.label}
              </div>
              <p className="text-[11px] font-mono text-[#9CA3AF]">{item.hint}</p>
            </button>
          ))}
        </div>
        {onOpenResumeManager && (
          <button
            type="button"
            onClick={onOpenResumeManager}
            className="mt-6 text-xs font-bold uppercase tracking-widest text-[#1C1C1E] hover:underline underline-offset-4"
          >
            Open Resume Manager →
          </button>
        )}
      </div>

      <p className="text-center text-xs text-[#9CA3AF] pb-8">
        Building in public. Feedback welcome — tell us what matters most in Settings or your issue tracker.
      </p>
    </motion.div>
  );
}
