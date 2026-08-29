'use client';

import { useMemo, useState } from 'react';
import {
  Segmented,
  Select,
  Button,
  Input,
  Card,
  Tag,
  Badge,
  Progress,
  Table as AntdTable,
  Drawer,
  Space,
  Statistic,
  Tooltip,
  Popconfirm,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  SearchOutlined,
  ThunderboltOutlined,
  AppstoreOutlined,
  TableOutlined,
  CheckCircleOutlined,
  ExportOutlined,
  DeleteOutlined,
  StarOutlined,
  StarFilled,
  GlobalOutlined,
  FireOutlined,
  BulbOutlined,
  RocketOutlined,
  MailOutlined,
} from '@ant-design/icons';
import { JobAvatar } from './JobAvatar';

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

  const selectedCompany =
    controlledSelectedCompany !== undefined ? controlledSelectedCompany : internalSelectedCompany;

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
      if (
        selectedCompany &&
        job.company?.trim().toLowerCase() !== selectedCompany.toLowerCase()
      ) {
        return false;
      }

      const score = parseNumericScore(job.score ?? job.score_raw);
      const isApplied = Boolean(
        job.is_applied ||
          (typeof job.status === 'string' && job.status.toLowerCase().includes('applied'))
      );

      if (filterTab === 'hot' && (score < 7.0 || isApplied)) return false;
      if (filterTab === 'gcc' && (!job.is_gcc || isApplied)) return false;
      if (filterTab === 'applied' && !isApplied) return false;

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
    const total = pipeline.length;
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
      if (
        j.is_applied ||
        (typeof j.status === 'string' && j.status.toLowerCase().includes('applied'))
      ) {
        applied += 1;
      }
    });

    const avgScore = scoreCount > 0 ? (scoreSum / scoreCount).toFixed(1) : '—';
    return { total, applied, hot, gcc, avgScore, open: total - applied };
  }, [pipeline]);

  // Ant Design Table Columns for Compact Table Mode
  const tableColumns: ColumnsType<PipelineJob> = [
    {
      title: 'Company & Role',
      key: 'company_role',
      render: (_, job) => (
        <div className="flex items-center gap-3">
          <JobAvatar company={job.company} size="sm" />
          <div className="min-w-0">
            <div className="font-bold text-zinc-900 truncate max-w-[240px] text-xs">
              {job.title}
            </div>
            <div className="text-[11px] text-zinc-500 truncate">{job.company}</div>
          </div>
        </div>
      ),
    },
    {
      title: 'Score',
      key: 'score',
      width: 100,
      sorter: (a, b) =>
        parseNumericScore(a.score ?? a.score_raw) - parseNumericScore(b.score ?? b.score_raw),
      render: (_, job) => {
        const s = parseNumericScore(job.score ?? job.score_raw);
        return (
          <Tag color={s >= 7.0 ? 'success' : s >= 5.0 ? 'warning' : 'default'} className="font-mono font-bold text-xs">
            {s > 0 ? `${s.toFixed(1)}/10` : '—'}
          </Tag>
        );
      },
    },
    {
      title: 'Type',
      key: 'type',
      width: 90,
      render: (_, job) =>
        job.is_gcc ? (
          <Tag color="blue" className="text-[10px] font-bold">
            GCC
          </Tag>
        ) : (
          <span className="text-[11px] text-zinc-400">Direct</span>
        ),
    },
    {
      title: 'Actions',
      key: 'actions',
      align: 'right',
      width: 160,
      render: (_, job, idx) => {
        const jobId = Number(job.pipeline_id ?? job.id ?? idx);
        const isApplied = Boolean(
          job.is_applied ||
            (typeof job.status === 'string' && job.status.toLowerCase().includes('applied'))
        );
        return (
          <Space size="small" onClick={(e) => e.stopPropagation()}>
            <Button
              type="primary"
              size="small"
              icon={<ThunderboltOutlined />}
              onClick={() => onTailor(jobId)}
            >
              Tailor
            </Button>
            <Button
              size="small"
              type={isApplied ? 'dashed' : 'default'}
              icon={<CheckCircleOutlined className={isApplied ? 'text-emerald-600' : ''} />}
              onClick={() => onMarkApplied(jobId, isApplied)}
            >
              {isApplied ? 'Applied' : 'Apply'}
            </Button>
            <Tooltip title="Research company & draft outreach email">
              <Button
                size="small"
                icon={<MailOutlined />}
                onClick={() => onOutreach?.(job)}
              />
            </Tooltip>
          </Space>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* ── Studio Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-zinc-900">Pipeline Studio</h1>
            <Tag color="success" className="font-bold text-[10px] uppercase">
              Live Scanner
            </Tag>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            Discover active job board & GCC captive roles, score matches, and generate tailored CVs.
          </p>
        </div>

        {/* Global Action Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          <Segmented
            options={[
              { value: 'cards', icon: <AppstoreOutlined /> },
              { value: 'table', icon: <TableOutlined /> },
            ]}
            value={viewDensity}
            onChange={(val) => setViewDensity(val as ViewDensity)}
          />

          <Select
            value={sortBy}
            onChange={(val) => setSortBy(val)}
            options={[
              { label: 'Sort: Highest Match', value: 'score' },
              { label: 'Sort: Newest First', value: 'date' },
              { label: 'Sort: Company (A-Z)', value: 'company' },
            ]}
            style={{ width: 170 }}
          />

          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            onClick={onScan}
          >
            Scan Portals
          </Button>

          {stats.total > 0 && (
            <Popconfirm
              title="Clear Pipeline"
              description="Are you sure you want to clear all unscored/unapplied jobs?"
              onConfirm={onClear}
              okText="Clear"
              cancelText="Cancel"
            >
              <Button danger icon={<DeleteOutlined />}>
                Clear
              </Button>
            </Popconfirm>
          )}
        </div>
      </div>

      {/* ── 3-Column Studio Grid Layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* ── Column 1: Target Companies (3 cols on lg) ── */}
        <Card
          size="small"
          className="lg:col-span-3 border-zinc-200 shadow-xs"
          title={
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-zinc-900">Target Companies</span>
                <Tag color="default" className="font-mono text-[10px]">
                  {companiesList.length}
                </Tag>
              </div>
              {selectedCompany && (
                <Button
                  type="link"
                  size="small"
                  onClick={() => handleSelectCompany(null)}
                  className="p-0 text-[10px] font-bold text-emerald-700 uppercase"
                >
                  Reset
                </Button>
              )}
            </div>
          }
        >
          <div className="space-y-3">
            <Input
              size="small"
              placeholder="Filter companies…"
              prefix={<SearchOutlined className="text-zinc-400" />}
              value={companySearch}
              onChange={(e) => setCompanySearch(e.target.value)}
              allowClear
            />

            <div className="max-h-[540px] overflow-y-auto space-y-1.5 pr-0.5">
              {filteredCompanies.slice(0, 30).map((c) => {
                const isSelected = selectedCompany === c.name;
                return (
                  <div
                    key={c.name}
                    onClick={() => handleSelectCompany(isSelected ? null : c.name)}
                    className={`flex items-center justify-between gap-2 rounded-xl border p-2 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-zinc-900 bg-zinc-50 shadow-xs ring-1 ring-zinc-900/10'
                        : 'border-zinc-100 bg-white hover:border-zinc-300 hover:bg-zinc-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <JobAvatar company={c.name} size="sm" />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-zinc-900 truncate">{c.name}</div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Tag color="green" className="text-[9px] m-0 px-1 py-0 font-mono">
                            {c.count} role{c.count === 1 ? '' : 's'}
                          </Tag>
                          {c.isGcc && (
                            <Tag color="blue" className="text-[9px] m-0 px-1 py-0">
                              GCC
                            </Tag>
                          )}
                        </div>
                      </div>
                    </div>

                    <Button
                      size="small"
                      type={c.isFollowed ? 'primary' : 'default'}
                      icon={c.isFollowed ? <StarFilled /> : <StarOutlined />}
                      onClick={(e) => toggleFollow(c.name, e)}
                      className="text-[10px] h-6 px-2 shrink-0"
                    >
                      {c.isFollowed ? 'Saved' : 'Save'}
                    </Button>
                  </div>
                );
              })}
              {filteredCompanies.length === 0 && (
                <div className="text-center py-6 text-xs text-zinc-400">No companies found</div>
              )}
            </div>
          </div>
        </Card>

        {/* ── Column 2: Live Pipeline (Cards or Table) (6 cols on lg) ── */}
        <div className="lg:col-span-6 space-y-3.5">
          {/* Filter Chips & Text Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <Segmented
              options={[
                { label: `All (${stats.total})`, value: 'all' },
                { label: `Hot (${stats.hot})`, value: 'hot' },
                { label: `GCC (${stats.gcc})`, value: 'gcc' },
                { label: `Applied (${stats.applied})`, value: 'applied' },
              ]}
              value={filterTab}
              onChange={(val) => setFilterTab(val as FilterTab)}
            />

            <div className="w-full sm:w-48">
              <Input
                size="small"
                placeholder="Search jobs..."
                prefix={<SearchOutlined className="text-zinc-400" />}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                allowClear
              />
            </div>
          </div>

          {/* Selected company filter pill */}
          {selectedCompany && (
            <div className="flex items-center gap-2">
              <Tag
                closable
                onClose={() => handleSelectCompany(null)}
                color="success"
                className="font-bold text-xs"
              >
                Filtered: {selectedCompany}
              </Tag>
            </div>
          )}

          {/* View Mode: CARDS */}
          {viewDensity === 'cards' ? (
            <div className="space-y-2.5 max-h-[720px] overflow-y-auto pr-1">
              {filteredJobs.slice(0, 40).map((job, idx) => {
                const jobId = Number(job.pipeline_id ?? job.id ?? idx);
                const scoreNum = parseNumericScore(job.score ?? job.score_raw);
                const isApplied = Boolean(
                  job.is_applied ||
                    (typeof job.status === 'string' && job.status.toLowerCase().includes('applied'))
                );
                const tags = extractTechTags(job.title, job.notes);

                return (
                  <Card
                    key={jobId}
                    size="small"
                    hoverable
                    onClick={() => setInspectingJob(job)}
                    className={`border transition-all cursor-pointer ${
                      isApplied
                        ? 'border-emerald-200 bg-zinc-50/70 opacity-80'
                        : 'border-zinc-200 bg-white'
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
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                              {job.company || 'Company'}
                            </span>
                            {isApplied && (
                              <Tag color="success" className="text-[10px] font-bold">
                                ✓ Applied
                              </Tag>
                            )}
                            {job.is_gcc && (
                              <Tag color="blue" className="text-[9px] font-bold">
                                GCC
                              </Tag>
                            )}
                            {job.location && (
                              <span className="text-[11px] text-zinc-400 truncate">
                                · {job.location}
                              </span>
                            )}
                          </div>

                          <div className="text-sm font-bold text-zinc-900 mt-0.5 leading-snug truncate">
                            {job.title || 'Role Title'}
                          </div>

                          {/* Tech tags */}
                          <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                            {tags.map((tag) => (
                              <Tag key={tag} className="text-[10px] m-0 bg-zinc-50 text-zinc-600">
                                {tag}
                              </Tag>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Score Badge */}
                      <div className="shrink-0 text-right">
                        <Tag
                          color={scoreNum >= 7.0 ? 'success' : scoreNum >= 5.0 ? 'warning' : 'default'}
                          className="font-mono font-bold text-xs"
                        >
                          {scoreNum > 0 ? `${scoreNum.toFixed(1)}/10` : '—'}
                        </Tag>
                      </div>
                    </div>

                    {/* Bottom Actions */}
                    <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-zinc-100">
                      <div>
                        {job.url && (
                          <a
                            href={job.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-500 hover:text-zinc-900"
                          >
                            <ExportOutlined /> View Posting
                          </a>
                        )}
                      </div>

                      <Space size="small" onClick={(e) => e.stopPropagation()}>
                        <Tooltip title="Research company & draft outreach email">
                          <Button
                            size="small"
                            icon={<MailOutlined />}
                            onClick={() => onOutreach?.(job)}
                          />
                        </Tooltip>
                        <Button
                          type="primary"
                          size="small"
                          icon={<ThunderboltOutlined />}
                          onClick={() => onTailor(jobId)}
                        >
                          Tailor CV
                        </Button>
                        <Button
                          size="small"
                          type={isApplied ? 'dashed' : 'default'}
                          icon={<CheckCircleOutlined className={isApplied ? 'text-emerald-600' : ''} />}
                          onClick={() => onMarkApplied(jobId, isApplied)}
                        >
                          {isApplied ? 'Applied' : 'Mark Applied'}
                        </Button>
                      </Space>
                    </div>
                  </Card>
                );
              })}

              {filteredJobs.length === 0 && (
                <div className="text-center py-16 bg-white rounded-2xl border border-zinc-200">
                  <p className="text-sm font-bold text-zinc-800">No matching jobs</p>
                  <p className="text-xs text-zinc-400 mt-1">
                    Try changing your search filter or run a fresh portal scan.
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* View Mode: COMPACT TABLE */
            <AntdTable
              dataSource={filteredJobs.slice(0, 60)}
              columns={tableColumns}
              rowKey={(r, idx) => String(r.pipeline_id ?? r.id ?? idx)}
              size="small"
              pagination={{ pageSize: 15, size: 'small' }}
              onRow={(record) => ({
                onClick: () => setInspectingJob(record),
                className: 'cursor-pointer',
              })}
            />
          )}
        </div>

        {/* ── Column 3: Live Pipeline Match Intelligence Radar (3 cols on lg) ── */}
        <Card
          size="small"
          className="lg:col-span-3 border-zinc-200 shadow-xs space-y-4"
          title={
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-900">Match Radar</span>
              <Tag color="success" className="text-[10px] font-bold uppercase">
                AI Powered
              </Tag>
            </div>
          }
        >
          <div className="space-y-4">
            <Statistic
              title={<span className="text-xs text-zinc-500 font-medium">Average Pipeline Fit</span>}
              value={stats.avgScore}
              suffix="/ 10"
              valueStyle={{ fontSize: 22, fontWeight: 800 }}
            />

            <div className="space-y-1">
              <div className="flex justify-between text-xs font-semibold text-zinc-600">
                <span>Hot Matches (7.0+)</span>
                <span className="font-mono text-emerald-600 font-bold">{stats.hot}</span>
              </div>
              <Progress
                percent={Math.min(100, Math.round((stats.hot / Math.max(1, stats.total)) * 100))}
                strokeColor="#10B981"
                size="small"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs font-semibold text-zinc-600">
                <span>GCC Captives</span>
                <span className="font-mono text-blue-600 font-bold">{stats.gcc}</span>
              </div>
              <Progress
                percent={Math.min(100, Math.round((stats.gcc / Math.max(1, stats.total)) * 100))}
                strokeColor="#3B82F6"
                size="small"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs font-semibold text-zinc-600">
                <span>Applied Jobs</span>
                <span className="font-mono text-zinc-800 font-bold">{stats.applied}</span>
              </div>
              <Progress
                percent={Math.min(100, Math.round((stats.applied / Math.max(1, stats.total)) * 100))}
                strokeColor="#18181B"
                size="small"
              />
            </div>

            <div className="pt-3 border-t border-zinc-100">
              <div className="rounded-xl bg-zinc-50 p-3 border border-zinc-200">
                <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-900">
                  <BulbOutlined className="text-amber-500" />
                  Tailoring Recommendation
                </div>
                <p className="text-[11px] text-zinc-500 leading-relaxed mt-1">
                  Roles scored <strong>7.0+</strong> have high keyword alignment with your master
                  profile. Tailor these for 3x higher callback rates.
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* ── Slide-Over Flyout Job Inspector Drawer ── */}
      <Drawer
        open={Boolean(inspectingJob)}
        onClose={() => setInspectingJob(null)}
        width={480}
        destroyOnClose
        title={
          inspectingJob ? (
            <div className="flex items-center gap-3">
              <JobAvatar company={inspectingJob.company} size="md" />
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  {inspectingJob.company || 'Company'}
                </div>
                <div className="text-sm font-bold text-zinc-900 truncate">
                  {inspectingJob.title || 'Role Title'}
                </div>
              </div>
            </div>
          ) : null
        }
        extra={
          inspectingJob?.url ? (
            <Button
              size="small"
              icon={<ExportOutlined />}
              href={inspectingJob.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Board
            </Button>
          ) : null
        }
        footer={
          inspectingJob ? (
            <div className="flex items-center justify-between gap-2">
              <Button
                icon={<MailOutlined />}
                onClick={() => {
                  onOutreach?.(inspectingJob);
                  setInspectingJob(null);
                }}
              >
                Draft Outreach Email
              </Button>
              <Button
                size="middle"
                type={inspectingJob.is_applied ? 'dashed' : 'default'}
                icon={<CheckCircleOutlined className={inspectingJob.is_applied ? 'text-emerald-600' : ''} />}
                onClick={() => {
                  const id = Number(inspectingJob.pipeline_id ?? inspectingJob.id);
                  onMarkApplied(id, Boolean(inspectingJob.is_applied));
                  setInspectingJob((prev) =>
                    prev ? { ...prev, is_applied: !prev.is_applied } : null
                  );
                }}
              >
                {inspectingJob.is_applied ? 'Mark Unapplied' : 'Mark Applied'}
              </Button>
              <Button
                type="primary"
                icon={<ThunderboltOutlined />}
                onClick={() => {
                  const id = Number(inspectingJob.pipeline_id ?? inspectingJob.id);
                  setInspectingJob(null);
                  onTailor(id);
                }}
              >
                Tailor in Studio
              </Button>
            </div>
          ) : null
        }
      >
        {inspectingJob && (
          <div className="space-y-5">
            {/* Match Score Card */}
            <Card size="small" className="bg-zinc-50 border-zinc-200">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    AI Match Score
                  </div>
                  <div className="text-2xl font-extrabold text-zinc-900 font-mono mt-0.5">
                    {parseNumericScore(inspectingJob.score ?? inspectingJob.score_raw) > 0
                      ? `${parseNumericScore(inspectingJob.score ?? inspectingJob.score_raw).toFixed(1)} / 10`
                      : 'Pending Score'}
                  </div>
                </div>
                {inspectingJob.is_gcc && (
                  <Tag color="blue" className="font-bold text-xs">
                    GCC Captive
                  </Tag>
                )}
              </div>
            </Card>

            {/* Tech Stack Signals */}
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                Detected Stack & Signals
              </div>
              <div className="flex flex-wrap gap-1.5">
                {extractTechTags(inspectingJob.title, inspectingJob.notes).map((tag) => (
                  <Tag key={tag} color="default" className="text-xs font-semibold">
                    {tag}
                  </Tag>
                ))}
              </div>
            </div>

            {/* Posting Overview */}
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                Posting Details & Notes
              </div>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3.5 text-xs text-zinc-600 leading-relaxed max-h-64 overflow-y-auto font-sans">
                {inspectingJob.notes || 'Full JD ingested and ready for AI tailoring.'}
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
