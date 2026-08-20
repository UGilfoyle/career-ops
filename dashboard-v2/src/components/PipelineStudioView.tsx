'use client';

import { useMemo, useState } from 'react';
import {
  ArrowRight,
  ArrowUpDown,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  Eye,
  Filter,
  Flame,
  Globe,
  Layers,
  LayoutGrid,
  Mail,
  Play,
  Plus,
  Search,
  Sparkles,
  Table,
  Target,
  TrendingUp,
  UserCheck,
  X,
  Zap,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { JobAvatar, CompanyAvatar } from './JobAvatar';
import { MatchProgressRing } from './resume-studio/MatchProgressRing';

export type PipelineJob = {
  pipeline_id?: number | string;
  id?: number | string;
  company?: string;
  title?: string;
  url?: string;
  source?: string;
  logo_url?: string;
  logo_source?: string;
  portal_key?: string;
  location?: string;
  work_arrangement?: string;
  posted_date?: string;
  created_at?: string;
  score?: string | number | null;
  score_raw?: number | null;
  status?: string;
  notes?: string;
  is_applied?: boolean;
  has_resume_html?: boolean;
  has_resume_pdf?: boolean;
  is_gcc?: boolean;
  tags?: string[];
};

type PipelineStudioViewProps = {
  pipeline: PipelineJob[];
  onEvaluate: (job: PipelineJob) => void;
  onTailor: (jobId: number) => void;
  onMarkApplied: (jobId: number, currentApplied: boolean) => void;
  onOutreach?: (job: PipelineJob) => void;
  onScan: () => void;
  onClear: () => void;
  onSelectCompany?: (company: string | null) => void;
  selectedCompany?: string | null;
};

type FilterTab = 'all' | 'hot' | 'gcc' | 'applied';
type ViewDensity = 'cards' | 'table';
type SortField = 'score' | 'date' | 'company';

function parseNumericScore(score: string | number | null | undefined): number {
  if (score == null) return 0;
  if (typeof score === 'number') return score;
  const match = String(score).match(/(\d+(\.\d+)?)/);
  if (!match) return 0;
  return parseFloat(match[1]);
}

function extractTechTags(title?: string, notes?: string): string[] {
  const text = `${title || ''} ${notes || ''}`.toLowerCase();
  const known = [
    'React', 'Node.js', 'TypeScript', 'Python', 'Go', 'AWS', 'Next.js',
    'Kubernetes', 'GraphQL', 'Backend', 'Frontend', 'Full Stack', 'Cloud AI',
    'Machine Learning', 'DevOps', 'Distributed Systems', 'PostgreSQL'
  ];
  const found = known.filter((k) => text.includes(k.toLowerCase()));
  if (found.length > 0) return found.slice(0, 3);
  if (text.includes('engineer') || text.includes('developer')) return ['Software Eng', 'System Architecture'];
  return ['Full Stack', 'Engineering'];
}

export function PipelineStudioView({
  pipeline,
  onEvaluate,
  onTailor,
  onMarkApplied,
  onOutreach,
  onScan,
  onClear,
  selectedCompany: controlledSelectedCompany,
  onSelectCompany,
}: PipelineStudioViewProps) {
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [viewDensity, setViewDensity] = useState<ViewDensity>('cards');
  const [sortBy, setSortBy] = useState<SortField>('score');
  const [searchQuery, setSearchQuery] = useState('');
  const [companySearch, setCompanySearch] = useState('');
  const [internalSelectedCompany, setInternalSelectedCompany] = useState<string | null>(null);
  const [inspectingJob, setInspectingJob] = useState<PipelineJob | null>(null);
  const [followedCompanies, setFollowedCompanies] = useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const saved = localStorage.getItem('career_ops_followed_companies');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const selectedCompany = controlledSelectedCompany !== undefined ? controlledSelectedCompany : internalSelectedCompany;

  const toggleFollow = (company: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFollowedCompanies((prev) => {
      const next = { ...prev, [company]: !prev[company] };
      try {
        localStorage.setItem('career_ops_followed_companies', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleSelectCompany = (comp: string | null) => {
    if (onSelectCompany) {
      onSelectCompany(comp);
    } else {
      setInternalSelectedCompany(comp);
    }
  };

  // Group companies by count
  const companiesList = useMemo(() => {
    const map = new Map<string, { count: number; isGcc: boolean; topScore: number }>();
    pipeline.forEach((job) => {
      const name = (job.company || 'Unknown').trim();
      const current = map.get(name) || { count: 0, isGcc: false, topScore: 0 };
      const score = parseNumericScore(job.score ?? job.score_raw);
      map.set(name, {
        count: current.count + 1,
        isGcc: current.isGcc || Boolean(job.is_gcc),
        topScore: Math.max(current.topScore, score),
      });
    });

    return Array.from(map.entries())
      .map(([name, data]) => ({
        name,
        count: data.count,
        isGcc: data.isGcc,
        topScore: data.topScore,
        isFollowed: Boolean(followedCompanies[name]),
      }))
      .sort((a, b) => {
        if (a.isFollowed && !b.isFollowed) return -1;
        if (!a.isFollowed && b.isFollowed) return 1;
        return b.count - a.count;
      });
  }, [pipeline, followedCompanies]);

  const filteredCompanies = useMemo(() => {
    if (!companySearch.trim()) return companiesList;
    const q = companySearch.toLowerCase();
    return companiesList.filter((c) => c.name.toLowerCase().includes(q));
  }, [companiesList, companySearch]);

  // Filtered and Sorted Job Pipeline
  const filteredJobs = useMemo(() => {
    const filtered = pipeline.filter((job) => {
      // Company filter
      if (selectedCompany && (job.company?.trim().toLowerCase() !== selectedCompany.toLowerCase())) {
        return false;
      }

      // Tab filter
      const score = parseNumericScore(job.score ?? job.score_raw);
      const isApplied = Boolean(job.is_applied || (typeof job.status === 'string' && job.status.toLowerCase().includes('applied')));

      if (filterTab === 'hot' && (score < 7.0 || isApplied)) return false;
      if (filterTab === 'gcc' && (!job.is_gcc || isApplied)) return false;
      if (filterTab === 'applied' && !isApplied) return false;

      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const comp = (job.company || '').toLowerCase();
        const title = (job.title || '').toLowerCase();
        const loc = (job.location || '').toLowerCase();
        if (!comp.includes(q) && !title.includes(q) && !loc.includes(q)) return false;
      }

      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === 'score') {
        const sa = parseNumericScore(a.score ?? a.score_raw);
        const sb = parseNumericScore(b.score ?? b.score_raw);
        return sb - sa;
      }
      if (sortBy === 'company') {
        return (a.company || '').localeCompare(b.company || '');
      }
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });
  }, [pipeline, selectedCompany, filterTab, searchQuery, sortBy]);

  // Stats calculation
  const stats = useMemo(() => {
    let total = pipeline.length;
    let applied = 0;
    let hot = 0;
    let gcc = 0;
    let scoreSum = 0;
    let scoreCount = 0;

    pipeline.forEach((j) => {
      const score = parseNumericScore(j.score ?? j.score_raw);
      if (score > 0) {
        scoreSum += score;
        scoreCount += 1;
      }
      if (score >= 7.0) hot += 1;
      if (j.is_gcc) gcc += 1;
      if (j.is_applied || (typeof j.status === 'string' && j.status.toLowerCase().includes('applied'))) {
        applied += 1;
      }
    });

    const avgScore = scoreCount > 0 ? (scoreSum / scoreCount).toFixed(1) : '—';
    return { total, applied, hot, gcc, avgScore, open: total - applied };
  }, [pipeline]);

  return (
    <div className="space-y-6">
      {/* ── Studio Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E5E5E0] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-[#1C1C1E]">Pipeline Studio</h1>
            <span className="rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 border border-emerald-300">
              Live Scanner
            </span>
          </div>
          <p className="text-xs text-[#6B6B6B] mt-1">
            Discover active job board & GCC captive roles, score matches, and tailor tailored CVs.
          </p>
        </div>

        {/* Global Action Buttons & View Mode */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Density Switcher */}
          <div className="flex items-center rounded-xl border border-[#E5E5E0] bg-[#F5F5F0] p-1">
            <button
              onClick={() => setViewDensity('cards')}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewDensity === 'cards' ? 'bg-white text-[#1C1C1E] shadow-2xs' : 'text-[#6B6B6B] hover:text-[#1C1C1E]'
              }`}
              title="Card Grid View"
            >
              <LayoutGrid size={15} />
            </button>
            <button
              onClick={() => setViewDensity('table')}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewDensity === 'table' ? 'bg-white text-[#1C1C1E] shadow-2xs' : 'text-[#6B6B6B] hover:text-[#1C1C1E]'
              }`}
              title="Compact Data Table View"
            >
              <Table size={15} />
            </button>
          </div>

          {/* Sort Dropdown */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortField)}
              className="appearance-none rounded-xl border border-[#E5E5E0] bg-white pl-3 pr-8 py-2 text-xs font-bold text-[#1C1C1E] outline-none hover:border-[#1C1C1E]/40 cursor-pointer shadow-2xs"
            >
              <option value="score">Sort: Highest Match</option>
              <option value="date">Sort: Newest First</option>
              <option value="company">Sort: Company (A-Z)</option>
            </select>
            <ArrowUpDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
          </div>

          <button
            type="button"
            onClick={onScan}
            className="flex items-center gap-1.5 rounded-xl bg-[#1C1C1E] px-4 py-2 text-xs font-bold text-white hover:bg-[#27272a] shadow-sm transition-all cursor-pointer"
          >
            <Zap size={14} className="text-amber-300" />
            Scan
          </button>

          {stats.total > 0 ? (
            <button
              type="button"
              onClick={onClear}
              className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-bold uppercase tracking-wider text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>

      {/* ── 3-Column Studio Grid Layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ── Column 1: Target Companies (3 cols on lg) ── */}
        <div className="lg:col-span-3 rounded-2xl border border-[#E5E5E0] bg-white p-4 shadow-sm flex flex-col space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-bold text-[#1C1C1E]">Target Companies</h3>
              <span className="text-[10px] font-bold text-[#9CA3AF] bg-[#F5F5F0] px-2 py-0.5 rounded-full font-mono">
                {companiesList.length}
              </span>
            </div>
            {selectedCompany ? (
              <button
                type="button"
                onClick={() => handleSelectCompany(null)}
                className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 hover:underline cursor-pointer"
              >
                Reset
              </button>
            ) : null}
          </div>

          {/* Search company */}
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
            <input
              type="text"
              value={companySearch}
              onChange={(e) => setCompanySearch(e.target.value)}
              placeholder="Filter companies…"
              className="w-full rounded-xl border border-[#E5E5E0] bg-[#FAFAF8] pl-7 pr-2.5 py-1.5 text-xs text-[#1C1C1E] outline-none focus:border-[#1C1C1E]"
            />
          </div>

          {/* Companies List */}
          <div className="max-h-[560px] overflow-y-auto space-y-2 pr-1">
            {filteredCompanies.slice(0, 30).map((c) => {
              const isSelected = selectedCompany === c.name;
              return (
                <div
                  key={c.name}
                  onClick={() => handleSelectCompany(isSelected ? null : c.name)}
                  className={`group flex items-center justify-between gap-2.5 rounded-xl border p-2.5 cursor-pointer transition-all ${
                    isSelected
                      ? 'border-[#1C1C1E] bg-[#FAFAF8] shadow-sm ring-1 ring-[#1C1C1E]/15'
                      : 'border-[#E5E5E0] bg-white hover:border-[#1C1C1E]/40 hover:bg-[#FAFAF8]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <JobAvatar company={c.name} size="sm" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#1C1C1E] truncate group-hover:text-emerald-800 transition-colors">
                        {c.name}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 font-mono">
                          {c.count} role{c.count === 1 ? '' : 's'}
                        </span>
                        {c.isGcc ? (
                          <span className="text-[9px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                            GCC
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => toggleFollow(c.name, e)}
                    className={`shrink-0 rounded-lg px-2 py-1 text-[9px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                      c.isFollowed
                        ? 'bg-[#1C1C1E] text-white'
                        : 'border border-[#E5E5E0] bg-white text-[#6B6B6B] hover:text-[#1C1C1E] hover:border-[#1C1C1E]'
                    }`}
                  >
                    {c.isFollowed ? 'Following' : 'Follow'}
                  </button>
                </div>
              );
            })}
            {filteredCompanies.length === 0 ? (
              <p className="text-center py-6 text-xs text-[#9CA3AF]">No companies found</p>
            ) : null}
          </div>
        </div>

        {/* ── Column 2: Live Pipeline (Cards or Table) (6 cols on lg) ── */}
        <div className="lg:col-span-6 space-y-4">
          {/* Filter Chips */}
          <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1">
            <div className="flex items-center gap-1.5">
              {[
                { id: 'all', label: 'All', count: stats.total },
                { id: 'hot', label: '🔥 Hot Matches', count: stats.hot },
                { id: 'gcc', label: '🌐 GCC Targets', count: stats.gcc },
                { id: 'applied', label: '✓ Applied', count: stats.applied },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterTab(tab.id as FilterTab)}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                    filterTab === tab.id
                      ? 'bg-[#1C1C1E] text-white shadow-sm'
                      : 'border border-[#E5E5E0] bg-white text-[#6B6B6B] hover:text-[#1C1C1E] hover:border-[#1C1C1E]/40'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[9px] font-mono ${
                      filterTab === tab.id ? 'bg-white/20 text-white' : 'bg-[#F5F5F0] text-[#9CA3AF]'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {selectedCompany ? (
              <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg shrink-0">
                {selectedCompany}
              </span>
            ) : null}
          </div>

          {/* View Mode: CARDS */}
          {viewDensity === 'cards' ? (
            <div className="space-y-3 max-h-[720px] overflow-y-auto pr-1">
              {filteredJobs.slice(0, 40).map((job, idx) => {
                const jobId = Number(job.pipeline_id ?? job.id ?? idx);
                const scoreNum = parseNumericScore(job.score ?? job.score_raw);
                const isApplied = Boolean(job.is_applied || (typeof job.status === 'string' && job.status.toLowerCase().includes('applied')));
                const tags = extractTechTags(job.title, job.notes);

                return (
                  <motion.div
                    key={jobId}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: Math.min(idx * 0.03, 0.3) }}
                    onClick={() => setInspectingJob(job)}
                    className={`group rounded-2xl border p-4 transition-all hover:shadow-md cursor-pointer ${
                      isApplied
                        ? 'border-emerald-200/90 bg-[#F9FAF8] opacity-70 hover:opacity-100'
                        : 'border-[#E5E5E0] bg-white hover:border-[#1C1C1E]/30'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <JobAvatar
                          company={job.company}
                          url={job.url}
                          source={job.source}
                          logoUrl={job.logo_url}
                          logoSource={job.logo_source}
                          portalKey={job.portal_key}
                          size="md"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-[#6B6B6B] uppercase tracking-wider">
                              {job.company || 'Company'}
                            </span>
                            {isApplied && (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/70 border border-emerald-300 px-2 py-0.5 rounded-md flex items-center gap-1">
                                ✓ Applied (Inactive)
                              </span>
                            )}
                            {job.is_gcc ? (
                              <span className="text-[9px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                                GCC
                              </span>
                            ) : null}
                            {job.location ? (
                              <span className="text-[10px] text-[#9CA3AF] truncate">
                                · {job.location}
                              </span>
                            ) : null}
                          </div>

                          <h4 className="text-sm font-extrabold text-[#1C1C1E] mt-0.5 leading-snug group-hover:text-emerald-800 transition-colors line-clamp-1">
                            {job.title || 'Role Title'}
                          </h4>

                          {/* Tech tags */}
                          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                            {tags.map((tag) => (
                              <span
                                key={tag}
                                className="text-[10px] font-semibold text-[#6B6B6B] bg-[#FAFAF8] px-2 py-0.5 rounded-md border border-[#E5E5E0]"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Score Indicator */}
                      <div className="flex flex-col items-end shrink-0 gap-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-xs font-mono font-extrabold px-2.5 py-1 rounded-xl border ${
                              scoreNum >= 8.5
                                ? 'bg-amber-50 text-amber-900 border-amber-300 shadow-2xs font-bold'
                                : scoreNum >= 7.0
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                : scoreNum >= 5.0
                                ? 'bg-amber-50/60 text-amber-700 border-amber-200'
                                : 'bg-[#F5F5F0] text-[#9CA3AF] border-[#E5E5E0]'
                            }`}
                          >
                            {scoreNum > 0 ? `${scoreNum.toFixed(1)}/10` : '—'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Action Ribbon */}
                    <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-[#F5F5F0]">
                      <div className="flex items-center gap-2">
                        {job.url && (
                          <a
                            href={job.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-[#6B6B6B] hover:text-[#1C1C1E] transition-colors"
                          >
                            <ExternalLink size={12} />
                            View Posting
                          </a>
                        )}
                      </div>

                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => onTailor(jobId)}
                          className="inline-flex items-center gap-1 rounded-xl bg-[#1C1C1E] px-3 py-1.5 text-[11px] font-bold text-white hover:bg-[#27272a] transition-all shadow-2xs cursor-pointer"
                        >
                          <Sparkles size={12} className="text-amber-300" />
                          Tailor CV
                        </button>
                        <button
                          type="button"
                          onClick={() => onMarkApplied(jobId, isApplied)}
                          className={`inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 text-[11px] font-bold transition-colors cursor-pointer ${
                            isApplied
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                              : 'border-[#E5E5E0] bg-white text-[#6B6B6B] hover:text-[#1C1C1E]'
                          }`}
                        >
                          <CheckCircle2 size={12} />
                          {isApplied ? 'Applied' : 'Mark Applied'}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
              {filteredJobs.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-2xl border border-[#E5E5E0]">
                  <p className="text-sm font-bold text-[#1C1C1E]">No matching jobs</p>
                  <p className="text-xs text-[#9CA3AF] mt-1">Try changing your search keywords or run a fresh scan.</p>
                </div>
              ) : null}
            </div>
          ) : (
            /* View Mode: COMPACT TABLE */
            <div className="bg-white rounded-2xl border border-[#E5E5E0] overflow-hidden shadow-sm">
              <div className="overflow-x-auto max-h-[720px]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAFAF8] border-b border-[#E5E5E0] text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF] sticky top-0 z-10">
                    <tr>
                      <th className="py-3 px-4">Company & Role</th>
                      <th className="py-3 px-3">Score</th>
                      <th className="py-3 px-3">Type</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F5F5F0]">
                    {filteredJobs.slice(0, 60).map((job, idx) => {
                      const jobId = Number(job.pipeline_id ?? job.id ?? idx);
                      const scoreNum = parseNumericScore(job.score ?? job.score_raw);
                      const isApplied = Boolean(job.is_applied || (typeof job.status === 'string' && job.status.toLowerCase().includes('applied')));

                      return (
                        <tr
                          key={jobId}
                          onClick={() => setInspectingJob(job)}
                          className={`hover:bg-[#FAFAF8] transition-colors cursor-pointer ${
                            isApplied ? 'opacity-60 bg-[#FAFAF8]' : ''
                          }`}
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <JobAvatar company={job.company} size="sm" />
                              <div className="min-w-0">
                                <p className="font-bold text-[#1C1C1E] truncate max-w-[220px]">{job.title}</p>
                                <p className="text-[10px] text-[#9CA3AF] truncate">{job.company}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3 font-mono font-bold">
                            <span
                              className={`px-2 py-0.5 rounded-md border text-[11px] ${
                                scoreNum >= 7.0
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                  : 'bg-[#F5F5F0] text-[#6B6B6B] border-[#E5E5E0]'
                              }`}
                            >
                              {scoreNum > 0 ? scoreNum.toFixed(1) : '—'}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            {job.is_gcc ? (
                              <span className="text-[9px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                                GCC
                              </span>
                            ) : (
                              <span className="text-[9px] text-[#9CA3AF]">Direct</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => onTailor(jobId)}
                                className="px-2.5 py-1 bg-[#1C1C1E] text-white text-[10px] font-bold rounded-lg hover:bg-[#27272a] cursor-pointer"
                              >
                                Tailor
                              </button>
                              <button
                                onClick={() => onMarkApplied(jobId, isApplied)}
                                className={`px-2 py-1 border text-[10px] font-bold rounded-lg cursor-pointer ${
                                  isApplied ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'text-[#6B6B6B] border-[#E5E5E0]'
                                }`}
                              >
                                {isApplied ? '✓' : 'Apply'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ── Column 3: Live Pipeline Match Intelligence Radar (3 cols on lg) ── */}
        <div className="lg:col-span-3 rounded-2xl border border-[#E5E5E0] bg-white p-5 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-[#F5F5F0] pb-3">
            <h3 className="text-sm font-bold text-[#1C1C1E]">Match Radar</h3>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              AI Powered
            </span>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#6B6B6B] font-medium">Avg Fit Score</span>
              <span className="text-base font-extrabold text-[#1C1C1E] font-mono">{stats.avgScore}/10</span>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-bold text-[#6B6B6B]">
                <span>Hot Matches (7.0+)</span>
                <span className="font-mono text-[#1C1C1E]">{stats.hot}</span>
              </div>
              <div className="h-2 w-full bg-[#F5F5F0] rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, (stats.hot / Math.max(1, stats.total)) * 100)}%` }}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-bold text-[#6B6B6B]">
                <span>GCC Captives</span>
                <span className="font-mono text-blue-700">{stats.gcc}</span>
              </div>
              <div className="h-2 w-full bg-[#F5F5F0] rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, (stats.gcc / Math.max(1, stats.total)) * 100)}%` }}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-bold text-[#6B6B6B]">
                <span>Applied</span>
                <span className="font-mono text-emerald-700">{stats.applied}</span>
              </div>
              <div className="h-2 w-full bg-[#F5F5F0] rounded-full overflow-hidden">
                <div
                  className="h-full bg-stone-700 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, (stats.applied / Math.max(1, stats.total)) * 100)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-[#F5F5F0]">
            <div className="rounded-xl bg-[#FAFAF8] p-3.5 border border-[#E5E5E0] space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#1C1C1E]">
                <Sparkles size={13} className="text-amber-500" />
                Tailoring Tip
              </div>
              <p className="text-[11px] text-[#6B6B6B] leading-relaxed">
                Roles scored <strong>7.0+</strong> have strong keyword synergy with your master profile. Tailor these for 3x higher callback rates.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Slide-Over Flyout Job Inspector Drawer ── */}
      <AnimatePresence>
        {inspectingJob && (
          <div className="fixed inset-0 z-[90] flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setInspectingJob(null)}
              className="fixed inset-0 bg-[#1C1C1E]/30 backdrop-blur-xs cursor-pointer"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="relative w-full max-w-lg bg-white h-full shadow-2xl border-l border-[#E5E5E0] z-10 flex flex-col overflow-hidden"
            >
              {/* Drawer Header */}
              <div className="p-6 border-b border-[#F0F0EB] bg-[#FAFAF8] flex items-start justify-between gap-4">
                <div className="flex items-start gap-3.5 min-w-0">
                  <JobAvatar
                    company={inspectingJob.company}
                    url={inspectingJob.url}
                    source={inspectingJob.source}
                    logoUrl={inspectingJob.logo_url}
                    size="lg"
                  />
                  <div className="min-w-0">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#6B6B6B]">
                      {inspectingJob.company || 'Company'}
                    </span>
                    <h2 className="text-lg font-extrabold text-[#1C1C1E] mt-0.5 leading-snug">
                      {inspectingJob.title || 'Role Title'}
                    </h2>
                    {inspectingJob.location && (
                      <p className="text-xs text-[#9CA3AF] mt-1">📍 {inspectingJob.location}</p>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => setInspectingJob(null)}
                  className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-[#1C1C1E] hover:bg-[#F0F0EB] transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Score Banner */}
                <div className="rounded-2xl bg-[#FAFAF8] border border-[#E5E5E0] p-4 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]">AI Match Score</span>
                    <p className="text-2xl font-extrabold text-[#1C1C1E] font-mono mt-0.5">
                      {parseNumericScore(inspectingJob.score ?? inspectingJob.score_raw) > 0
                        ? `${parseNumericScore(inspectingJob.score ?? inspectingJob.score_raw).toFixed(1)} / 10`
                        : 'Pending Score'}
                    </p>
                  </div>
                  {inspectingJob.is_gcc && (
                    <span className="text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-xl border border-blue-200">
                      GCC Captive Employer
                    </span>
                  )}
                </div>

                {/* Tech Stack Signals */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#9CA3AF] mb-2.5">Detected Stack & Signals</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {extractTechTags(inspectingJob.title, inspectingJob.notes).map((tag) => (
                      <span key={tag} className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-stone-100 text-[#1C1C1E] border border-stone-200">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Job Description / Notes Preview */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#9CA3AF] mb-2">Posting Overview</h4>
                  <div className="rounded-2xl border border-[#E5E5E0] bg-[#FAFAF8] p-4 text-xs text-[#6B6B6B] leading-relaxed max-h-60 overflow-y-auto">
                    {inspectingJob.notes || 'Full JD ingested and ready for AI tailoring.'}
                  </div>
                </div>
              </div>

              {/* Drawer Footer Actions */}
              <div className="p-5 border-t border-[#F0F0EB] bg-[#FAFAF8] flex items-center justify-between gap-3">
                {inspectingJob.url ? (
                  <a
                    href={inspectingJob.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 border border-[#E5E5E0] bg-white rounded-xl text-xs font-bold text-[#1C1C1E] hover:bg-stone-50 transition-colors"
                  >
                    <ExternalLink size={13} />
                    Open Board
                  </a>
                ) : <div />}

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const id = Number(inspectingJob.pipeline_id ?? inspectingJob.id);
                      onMarkApplied(id, Boolean(inspectingJob.is_applied));
                      setInspectingJob((prev) => prev ? { ...prev, is_applied: !prev.is_applied } : null);
                    }}
                    className="px-4 py-2.5 border border-[#E5E5E0] bg-white rounded-xl text-xs font-bold text-[#1C1C1E] hover:bg-stone-50 transition-colors cursor-pointer"
                  >
                    {inspectingJob.is_applied ? 'Mark Unapplied' : 'Mark Applied'}
                  </button>
                  <button
                    onClick={() => {
                      const id = Number(inspectingJob.pipeline_id ?? inspectingJob.id);
                      setInspectingJob(null);
                      onTailor(id);
                    }}
                    className="flex items-center gap-1.5 px-5 py-2.5 bg-[#1C1C1E] text-white rounded-xl text-xs font-bold hover:bg-[#27272a] transition-all shadow-md cursor-pointer"
                  >
                    <Sparkles size={14} className="text-amber-300" />
                    Tailor in Studio
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
