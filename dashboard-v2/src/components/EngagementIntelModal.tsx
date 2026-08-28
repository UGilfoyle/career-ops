'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Modal, Card, Statistic, Tag, Button, Spin, Alert, message } from 'antd';
import {
  LineChartOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CopyOutlined,
  ExportOutlined,
  GlobalOutlined,
  MailOutlined,
  AimOutlined,
  LinkOutlined,
} from '@ant-design/icons';

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

type Props = {
  target: EngagementIntelTarget;
  onClose: () => void;
  onCopyStealthLink?: (appId: number) => void;
};

export function EngagementIntelModal({ target, onClose, onCopyStealthLink }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TelemetryPayload | null>(null);

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

  const copyText = async (key: string, text: string) => {
    await navigator.clipboard.writeText(text);
    message.success(`Copied ${key} to clipboard`);
  };

  return (
    <Modal
      open={Boolean(target)}
      onCancel={onClose}
      footer={null}
      width={560}
      destroyOnClose
      centered
      title={
        target ? (
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              Private Application Intel
            </div>
            <div className="text-base font-bold text-zinc-900">{target.company}</div>
            <div className="text-xs text-zinc-500 font-normal">{target.role}</div>
          </div>
        ) : null
      }
    >
      <div className="pt-2 space-y-4 max-h-[75vh] overflow-y-auto">
        {loading && (
          <div className="py-12 text-center">
            <Spin tip="Loading engagement intel..." />
          </div>
        )}

        {error && <Alert type="error" message={error} showIcon />}

        {!loading && data && !data.has_tracking && (
          <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 p-6 text-center">
            <p className="text-sm font-semibold text-zinc-900">No stealth link generated yet</p>
            <p className="mt-1 text-xs text-zinc-500">
              Copy a stealth tracking link and paste it as your Portfolio / Website URL on the application.
            </p>
            {onCopyStealthLink && target && (
              <Button
                type="primary"
                icon={<LinkOutlined />}
                onClick={() => onCopyStealthLink(target.appId)}
                className="mt-4"
              >
                Copy Stealth Link
              </Button>
            )}
          </div>
        )}

        {!loading && data?.tracking && (
          <>
            {/* Stat Cards */}
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <Card size="small" className="text-center">
                <Statistic
                  title={<span className="text-[11px] font-medium text-zinc-500">VIEWS</span>}
                  value={data.tracking.view_count}
                  prefix={<LineChartOutlined className="text-blue-500" />}
                  valueStyle={{ fontSize: 18, fontWeight: 700 }}
                />
              </Card>
              <Card size="small" className="text-center">
                <Statistic
                  title={<span className="text-[11px] font-medium text-zinc-500">CLICKS</span>}
                  value={data.tracking.click_count}
                  prefix={<AimOutlined className="text-emerald-500" />}
                  valueStyle={{ fontSize: 18, fontWeight: 700 }}
                />
              </Card>
              <Card size="small" className="text-center">
                <Statistic
                  title={<span className="text-[11px] font-medium text-zinc-500">DWELL</span>}
                  value={formatDwell(data.tracking.total_dwell_sec)}
                  prefix={<ClockCircleOutlined className="text-amber-500" />}
                  valueStyle={{ fontSize: 18, fontWeight: 700 }}
                />
              </Card>
              <Card size="small" className="text-center">
                <Statistic
                  title={<span className="text-[11px] font-medium text-zinc-500">LAST ACTIVE</span>}
                  value={formatWhen(data.tracking.last_engaged_at)}
                  prefix={<GlobalOutlined className="text-purple-500" />}
                  valueStyle={{ fontSize: 14, fontWeight: 600 }}
                />
              </Card>
            </div>

            {/* Breakdown */}
            {data.breakdown && (
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3.5">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Interest Breakdown
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <Tag color="blue">Page views: {data.breakdown.page_views}</Tag>
                  <Tag color="purple">GitHub: {data.breakdown.clicks_gh}</Tag>
                  <Tag color="cyan">LinkedIn: {data.breakdown.clicks_li}</Tag>
                  {data.breakdown.clicks_portfolio > 0 && (
                    <Tag color="green">Portfolio: {data.breakdown.clicks_portfolio}</Tag>
                  )}
                </div>
                {data.breakdown.countries.length > 0 && (
                  <p className="mt-2 text-xs text-zinc-500">
                    Origin: {data.breakdown.countries.map((c) => `${c.country} (${c.count})`).join(' · ')}
                  </p>
                )}
              </div>
            )}

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-2">
              <Button
                icon={<CopyOutlined />}
                size="small"
                onClick={() => copyText('Stealth URL', data.tracking!.url)}
              >
                Copy Stealth URL
              </Button>
              <Button
                icon={<ExportOutlined />}
                size="small"
                href={data.tracking.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open Companion Page
              </Button>
            </div>

            {/* Follow-up Section */}
            {data.followup ? (
              <Card
                size="small"
                title={
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-800">Contextual Follow-up</span>
                    <Tag
                      color={
                        data.followup.priority === 'now'
                          ? 'success'
                          : data.followup.priority === 'wait'
                          ? 'warning'
                          : 'processing'
                      }
                      className="font-bold uppercase text-[10px]"
                    >
                      {data.followup.priority === 'now'
                        ? 'Follow Up Now'
                        : data.followup.priority === 'wait'
                        ? `Wait ~${data.followup.suggested_wait_hours}h`
                        : `Soon (~${data.followup.suggested_wait_hours}h)`}
                    </Tag>
                  </div>
                }
              >
                <p className="text-xs text-zinc-500 mb-2">{data.followup.reason}</p>
                <div className="mb-2 text-xs font-semibold text-zinc-800">Hook: {data.followup.hook}</div>

                <div className="rounded-lg bg-zinc-50 p-2.5 mb-2 border border-zinc-100">
                  <div className="text-[10px] font-bold uppercase text-zinc-400">Subject</div>
                  <div className="text-xs font-medium text-zinc-900">{data.followup.subject}</div>
                </div>

                <div className="rounded-lg bg-zinc-50 p-2.5 mb-3 border border-zinc-100">
                  <div className="text-[10px] font-bold uppercase text-zinc-400">Body</div>
                  <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-zinc-800">
                    {data.followup.body}
                  </pre>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="small"
                    icon={<CopyOutlined />}
                    onClick={() => copyText('Subject', data.followup!.subject)}
                  >
                    Subject
                  </Button>
                  <Button
                    size="small"
                    icon={<MailOutlined />}
                    onClick={() => copyText('Body', data.followup!.body)}
                  >
                    Body
                  </Button>
                  <Button
                    type="primary"
                    size="small"
                    icon={<CopyOutlined />}
                    onClick={() =>
                      copyText('All', `Subject: ${data.followup!.subject}\n\n${data.followup!.body}`)
                    }
                  >
                    Copy Full Message
                  </Button>
                </div>
              </Card>
            ) : (
              <Alert
                type="info"
                message="No engagement yet — follow-up draft unlocks automatically after a recruiter opens your link."
                showIcon
              />
            )}

            {/* Events Log */}
            {data.events.length > 0 && (
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Recent Telemetry Events
                </p>
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {data.events.slice(0, 12).map((ev, i) => (
                    <div
                      key={`${ev.created_at}-${i}`}
                      className="flex items-center justify-between gap-2 rounded-lg border border-zinc-100 bg-white px-3 py-1.5 text-xs"
                    >
                      <span className="font-medium text-zinc-800">
                        {ev.event_type === 'PAGE_VIEW'
                          ? `View · ${formatDwell(Number(ev.dwell_seconds || 0))}`
                          : `Click · ${ev.target || 'out'}`}
                        {ev.country && <span className="ml-1.5 text-zinc-400">{ev.country}</span>}
                      </span>
                      <span className="font-mono text-[10px] text-zinc-400">
                        {formatWhen(ev.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
