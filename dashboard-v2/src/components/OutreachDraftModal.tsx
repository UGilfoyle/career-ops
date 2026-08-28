'use client';

import { useEffect, useState } from 'react';
import { Modal, Button, Tag, Alert, Spin, Card, Collapse, message } from 'antd';
import {
  CopyOutlined,
  ExportOutlined,
  MailOutlined,
  CheckCircleOutlined,
  GlobalOutlined,
  GithubOutlined,
} from '@ant-design/icons';

export type OutreachTarget = {
  jobId?: number;
  company: string;
  role: string;
  url?: string;
};

type DraftResponse = {
  company: string;
  role: string;
  region?: string;
  domain: string | null;
  emails: string[];
  people: string[];
  notes: string[];
  sources: Array<{ id: string; ok: boolean; skipped?: boolean; summary: string; url?: string }>;
  searchLinks: Array<{ label: string; url: string }>;
  githubAuth?: boolean;
  draft: { subject: string; body: string; hook_used: string };
  llm: boolean;
  error?: string;
  message?: string;
};

type Props = {
  target: OutreachTarget | null;
  onClose: () => void;
};

export function OutreachDraftModal({ target, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DraftResponse | null>(null);

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
    fetch('/api/outreach/research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobId: target.jobId,
        company: target.company,
        role: target.role,
        url: target.url,
      }),
    })
      .then(async (res) => {
        const json = (await res.json()) as DraftResponse;
        if (!res.ok) throw new Error(json.message || json.error || `HTTP ${res.status}`);
        return json;
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Research failed');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [target]);

  const copy = async (kind: string, text: string) => {
    await navigator.clipboard.writeText(text);
    message.success(`Copied ${kind} to clipboard`);
  };

  return (
    <Modal
      open={Boolean(target)}
      onCancel={onClose}
      footer={[
        <Button key="close" type="primary" icon={<MailOutlined />} onClick={onClose}>
          Done
        </Button>,
      ]}
      width={640}
      destroyOnClose
      centered
      title={
        target ? (
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              Outreach Intelligence & Draft
            </div>
            <div className="text-base font-bold text-zinc-900">
              {target.company} • {target.role}
            </div>
            <div className="text-xs text-zinc-500 font-normal">
              Public sources only. No LinkedIn login, no Hunter. Ready to review and send.
            </div>
          </div>
        ) : null
      }
    >
      <div className="pt-2 space-y-4 max-h-[72vh] overflow-y-auto">
        {loading && (
          <div className="py-12 text-center">
            <Spin tip="Reading job page, Wikipedia, Wikidata, GitHub, news, DNS..." />
          </div>
        )}

        {error && <Alert type="error" message={error} showIcon />}

        {data && (
          <div className="space-y-4">
            {/* Meta Tags */}
            <div className="flex flex-wrap gap-1.5">
              {data.region && <Tag color="purple">{data.region}</Tag>}
              {data.githubAuth && <Tag icon={<GithubOutlined />} color="default">GitHub Auth</Tag>}
              {data.sources.map((s) => (
                <Tag
                  key={`${s.id}-${s.url || s.summary.slice(0, 12)}`}
                  color={s.ok ? 'success' : s.skipped ? 'warning' : 'default'}
                >
                  {s.id}
                  {s.skipped ? ' skip' : ''}
                </Tag>
              ))}
              {data.domain && <Tag color="blue">@{data.domain}</Tag>}
              {!data.llm && <Tag color="warning">Template Draft</Tag>}
            </div>

            {/* Subject */}
            <Card
              size="small"
              title={<span className="text-[11px] font-bold uppercase text-zinc-400">Subject</span>}
              extra={
                <Button
                  type="link"
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={() => copy('Subject', data.draft.subject)}
                >
                  Copy
                </Button>
              }
            >
              <div className="text-sm font-semibold text-zinc-900">{data.draft.subject}</div>
            </Card>

            {/* Email Body */}
            <Card
              size="small"
              title={<span className="text-[11px] font-bold uppercase text-zinc-400">Email Draft</span>}
              extra={
                <Button
                  type="link"
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={() =>
                    copy('Full Email', `Subject: ${data.draft.subject}\n\n${data.draft.body}`)
                  }
                >
                  Copy All
                </Button>
              }
            >
              <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-zinc-800 m-0">
                {data.draft.body}
              </pre>
            </Card>

            {/* Public contacts */}
            {data.emails.length > 0 && (
              <div className="text-xs text-zinc-600">
                <span className="font-semibold text-zinc-800">Public emails found:</span>{' '}
                {data.emails.join(', ')}
              </div>
            )}
            {data.people.length > 0 && (
              <div className="text-xs text-zinc-600">
                <span className="font-semibold text-zinc-800">Key contacts / GitHub:</span>{' '}
                {data.people.join('; ')}
              </div>
            )}

            {/* Direct Search Links */}
            <div>
              <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                Direct Search Shortcuts
              </div>
              <div className="flex flex-wrap gap-1.5">
                {data.searchLinks.map((l) => (
                  <Button
                    key={l.url}
                    size="small"
                    icon={<ExportOutlined />}
                    href={l.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {l.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Source Notes */}
            {data.notes.length > 0 && (
              <Collapse
                ghost
                size="small"
                items={[
                  {
                    key: 'notes',
                    label: <span className="text-xs font-semibold text-zinc-700">Source notes & metadata</span>,
                    children: (
                      <ul className="m-0 list-disc pl-4 text-xs text-zinc-500 space-y-1">
                        {data.notes.map((n, idx) => (
                          <li key={`${idx}-${n.slice(0, 30)}`}>{n}</li>
                        ))}
                      </ul>
                    ),
                  },
                ]}
              />
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
