'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Globe,
  Loader2,
  Mail,
  MousePointerClick,
  X,
} from 'lucide-react';

export type EngagementIntelTarget = {
  appId: number;
  company: string;
  role: string;
} | null;

type Followup = {
  subject: string;
  body: string;
  hook: string;
  priority: 'now' | 'soon' | 'wait';
  suggested_wait_hours: number;
  reason: string;
};

type TelemetryPayload = {
  ok: boolean;
  has_tracking: boolean;
  tracking: {
    slug: string;
    url: string;
    company: string;
    role: string;
    view_count: number;
    click_count: number;
    total_dwell_sec: number;
    last_engaged_at: string | null;
    application_status?: string;
  } | null;
  breakdown: {
    page_views: number;
    clicks_gh: number;
    clicks_li: number;
    clicks_portfolio: number;
    countries: Array<{ country: string; count: number }>;
  } | null;
  events: Array<{
    event_type: string;
    target: string | null;
    dwell_seconds: number;
    country: string | null;
    created_at: string;
  }>;
  followup: Followup | null;
  error?: string;
};

function formatDwell(sec: number): string {
  if (!sec) return '0s';
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? `${m}m ${s}s` : `${m}m`;
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  return d.toLocaleString();
}

function priorityStyles(p: Followup['priority']) {
  if (p === 'now') return 'bg-emerald-50 text-emerald-800 border-emerald-200';
  if (p === 'wait') return 'bg-amber-50 text-amber-800 border-amber-200';
  return 'bg-sky-50 text-sky-800 border-sky-200';
}

type Props = {
  target: EngagementIntelTarget;
  onClose: () => void;
  onCopyStealthLink?: (appId: number) => void;
};

export function EngagementIntelModal({ target, onClose, onCopyStealthLink }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TelemetryPayload | null>(null);
  const [copied, setCopied] = useState<'subject' | 'body' | 'all' | 'link' | null>(null);

  useEffect(() => {
    if (!target) {
      setData(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);
    fetch(`/api/applications/${target.appId}/telemetry`)
      .then(async (res) => {
        const json = (await res.json()) as TelemetryPayload;
        if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
        return json;
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load intel');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [target]);

  const copyText = async (key: 'subject' | 'body' | 'all' | 'link', text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 1800);
  };

  return (
    <AnimatePresence>
      {target ? (
        <motion.div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Application engagement intel"
            className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-[#E5E5E0] bg-white shadow-2xl sm:rounded-2xl"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-[#F0F0EB] px-5 py-4">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#9CA3AF]">
                  Private application intel
                </p>
                <h2 className="mt-1 truncate text-lg font-bold text-[#1C1C1E]">{target.company}</h2>
                <p className="truncate text-sm text-[#6B6B6B]">{target.role}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-[#E5E5E0] p-2 text-[#6B6B6B] hover:bg-[#F5F5F0]"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-16 text-sm text-[#6B6B6B]">
                  <Loader2 size={16} className="animate-spin" /> Loading engagement…
                </div>
              ) : null}

              {error ? (
                <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </div>
              ) : null}

              {!loading && data && !data.has_tracking ? (
                <div className="rounded-xl border border-dashed border-[#E5E5E0] bg-[#FAFAF8] px-4 py-8 text-center">
                  <p className="text-sm font-medium text-[#1C1C1E]">No stealth link yet</p>
                  <p className="mt-1 text-xs text-[#6B6B6B]">
                    Copy a stealth link and paste it as Portfolio / Website on the application.
                  </p>
                  {onCopyStealthLink ? (
                    <button
                      type="button"
                      onClick={() => onCopyStealthLink(target.appId)}
                      className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#1C1C1E] px-3 py-2 text-xs font-bold text-white"
                    >
                      <Copy size={12} /> Copy Stealth Link
                    </button>
                  ) : null}
                </div>
              ) : null}

              {!loading && data?.tracking ? (
                <>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Stat label="Views" value={String(data.tracking.view_count)} icon={<Activity size={14} />} />
                    <Stat label="Clicks" value={String(data.tracking.click_count)} icon={<MousePointerClick size={14} />} />
                    <Stat
                      label="Dwell"
                      value={formatDwell(data.tracking.total_dwell_sec)}
                      icon={<Clock size={14} />}
                    />
                    <Stat
                      label="Last active"
                      value={formatWhen(data.tracking.last_engaged_at)}
                      icon={<Globe size={14} />}
                    />
                  </div>

                  {data.breakdown ? (
                    <div className="rounded-xl border border-[#E5E5E0] bg-[#FAFAF8] p-3">
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]">
                        Interest breakdown
                      </p>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <Chip label={`Page views ${data.breakdown.page_views}`} />
                        <Chip label={`GitHub ${data.breakdown.clicks_gh}`} />
                        <Chip label={`LinkedIn ${data.breakdown.clicks_li}`} />
                        {data.breakdown.clicks_portfolio > 0 ? (
                          <Chip label={`Portfolio ${data.breakdown.clicks_portfolio}`} />
                        ) : null}
                      </div>
                      {data.breakdown.countries.length > 0 ? (
                        <p className="mt-2 text-xs text-[#6B6B6B]">
                          Origin:{' '}
                          {data.breakdown.countries
                            .map((c) => `${c.country} (${c.count})`)
                            .join(' · ')}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => copyText('link', data.tracking!.url)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E5E0] px-3 py-2 text-xs font-bold text-[#1C1C1E] hover:bg-[#F5F5F0]"
                    >
                      {copied === 'link' ? <CheckCircle2 size={12} className="text-emerald-600" /> : <Copy size={12} />}
                      {copied === 'link' ? 'Copied' : 'Copy stealth URL'}
                    </button>
                    <a
                      href={data.tracking.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E5E0] px-3 py-2 text-xs font-bold text-[#1C1C1E] hover:bg-[#F5F5F0]"
                    >
                      <ExternalLink size={12} /> Open companion
                    </a>
                  </div>

                  {data.followup ? (
                    <div className="rounded-xl border border-[#E5E5E0] p-3 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]">
                            Contextual follow-up
                          </p>
                          <p className="mt-1 text-xs text-[#6B6B6B]">{data.followup.reason}</p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${priorityStyles(data.followup.priority)}`}
                        >
                          {data.followup.priority === 'now'
                            ? 'Follow up now'
                            : data.followup.priority === 'wait'
                              ? `Wait ~${data.followup.suggested_wait_hours}h`
                              : `Soon (~${data.followup.suggested_wait_hours}h)`}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-[#1C1C1E]">Hook: {data.followup.hook}</p>
                      <div className="rounded-lg bg-[#FAFAF8] px-3 py-2">
                        <p className="text-[10px] font-bold uppercase text-[#9CA3AF]">Subject</p>
                        <p className="text-sm text-[#1C1C1E]">{data.followup.subject}</p>
                      </div>
                      <div className="rounded-lg bg-[#FAFAF8] px-3 py-2">
                        <p className="text-[10px] font-bold uppercase text-[#9CA3AF]">Body</p>
                        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-[#1C1C1E]">
                          {data.followup.body}
                        </pre>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => copyText('subject', data.followup!.subject)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E5E0] px-3 py-2 text-xs font-bold hover:bg-[#F5F5F0]"
                        >
                          {copied === 'subject' ? <CheckCircle2 size={12} /> : <Copy size={12} />} Subject
                        </button>
                        <button
                          type="button"
                          onClick={() => copyText('body', data.followup!.body)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E5E0] px-3 py-2 text-xs font-bold hover:bg-[#F5F5F0]"
                        >
                          {copied === 'body' ? <CheckCircle2 size={12} /> : <Mail size={12} />} Body
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            copyText(
                              'all',
                              `Subject: ${data.followup!.subject}\n\n${data.followup!.body}`
                            )
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[#1C1C1E] px-3 py-2 text-xs font-bold text-white"
                        >
                          {copied === 'all' ? <CheckCircle2 size={12} /> : <Copy size={12} />} Copy all
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-[#E5E5E0] px-4 py-3 text-xs text-[#6B6B6B]">
                      No engagement yet — follow-up draft unlocks after a recruiter opens the link.
                    </div>
                  )}

                  {data.events.length > 0 ? (
                    <div>
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]">
                        Recent events
                      </p>
                      <ul className="space-y-1.5">
                        {data.events.slice(0, 12).map((ev, i) => (
                          <li
                            key={`${ev.created_at}-${i}`}
                            className="flex items-center justify-between gap-2 rounded-lg border border-[#F0F0EB] px-3 py-2 text-xs"
                          >
                            <span className="font-medium text-[#1C1C1E]">
                              {ev.event_type === 'PAGE_VIEW'
                                ? `View · ${formatDwell(Number(ev.dwell_seconds || 0))}`
                                : `Click · ${ev.target || 'out'}`}
                              {ev.country ? (
                                <span className="ml-1.5 font-normal text-[#9CA3AF]">{ev.country}</span>
                              ) : null}
                            </span>
                            <span className="shrink-0 font-mono text-[10px] text-[#9CA3AF]">
                              {formatWhen(ev.created_at)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[#E5E5E0] bg-white px-3 py-2.5">
      <div className="flex items-center gap-1 text-[#9CA3AF]">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <p className="mt-1 text-sm font-bold tabular-nums text-[#1C1C1E]">{value}</p>
    </div>
  );
}

function Chip({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-[#E5E5E0] bg-white px-2.5 py-1 font-medium text-[#1C1C1E]">
      {label}
    </span>
  );
}
