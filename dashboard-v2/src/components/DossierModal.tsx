'use client';

import { useEffect, useState } from 'react';
import { Modal, Button, Input, Switch, message, Tag } from 'antd';
import {
  LinkOutlined,
  CopyOutlined,
  ExportOutlined,
  CheckCircleOutlined,
  SafetyCertificateOutlined,
  ShareAltOutlined,
} from '@ant-design/icons';

type Props = {
  open: boolean;
  onClose: () => void;
};

type DossierState = {
  slug: string;
  isCustomSlug: boolean;
  enabled: boolean;
  publicUrl: string;
  custom: Record<string, unknown>;
};

export function DossierModal({ open, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<DossierState | null>(null);
  const [slugInput, setSlugInput] = useState('');
  const [enabledInput, setEnabledInput] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch('/api/profile/dossier')
      .then((res) => res.json())
      .then((json) => {
        if (json && !json.error) {
          setData(json);
          setSlugInput(json.slug || '');
          setEnabledInput(Boolean(json.enabled));
        }
      })
      .catch(() => {
        message.error('Failed to load dossier settings');
      })
      .finally(() => setLoading(false));
  }, [open]);

  const handleCopy = () => {
    if (!data?.publicUrl) return;
    void navigator.clipboard.writeText(data.publicUrl);
    setCopied(true);
    message.success('Dossier link copied to clipboard!');
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSave = async () => {
    const clean = slugInput.trim().toLowerCase();
    if (clean.length < 3) {
      message.error('Vanity URL must be at least 3 characters');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/profile/dossier', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: clean,
          enabled: enabledInput,
        }),
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || 'Failed to update vanity URL');
      }

      message.success('Dossier settings updated successfully!');
      setData((prev) => (prev ? { ...prev, slug: json.slug, publicUrl: json.publicUrl, enabled: enabledInput } : prev));
      setSlugInput(json.slug);
    } catch (err: unknown) {
      message.error((err as Error).message || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const hostPrefix = typeof window !== 'undefined' ? `${window.location.origin}/p/` : 'https://careerops.dpdns.org/p/';

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={560}
      title={
        <div className="flex items-center gap-2 text-sm font-bold text-zinc-900">
          <SafetyCertificateOutlined className="text-emerald-600" />
          <span>Public Candidate Dossier</span>
          <Tag color="green" className="text-[10px] font-mono uppercase">Phase 1</Tag>
        </div>
      }
      centered
    >
      <div className="pt-2 pb-1 space-y-5">
        {/* Intro */}
        <p className="text-xs text-zinc-600 leading-relaxed">
          Your public engineer dossier is a verified, high-signal web portfolio with ATS badges, production proof-of-work, and 1-click verified resume download.
        </p>

        {/* Live Link Card */}
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold text-zinc-500 uppercase">Your Shareable URL</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-zinc-500">Public:</span>
              <Switch
                size="small"
                checked={enabledInput}
                onChange={setEnabledInput}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1 bg-white border border-zinc-300 rounded-lg px-3 py-2 text-xs font-mono text-zinc-800 truncate select-all">
              {data ? data.publicUrl : `${hostPrefix}...`}
            </div>
            <Button
              icon={copied ? <CheckCircleOutlined className="text-emerald-600" /> : <CopyOutlined />}
              onClick={handleCopy}
              disabled={!data?.enabled}
              className="shrink-0"
            >
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <Button
              type="primary"
              icon={<ExportOutlined />}
              href={data?.publicUrl}
              target="_blank"
              disabled={!data?.enabled}
              className="shrink-0 bg-zinc-900 hover:bg-zinc-800"
            >
              Open
            </Button>
          </div>
        </div>

        {/* Vanity Slug Customization */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-zinc-700 block">
            Customize Vanity Slug
          </label>
          <div className="flex items-center gap-2">
            <Input
              addonBefore={hostPrefix}
              placeholder="akash"
              value={slugInput}
              onChange={(e) => setSlugInput(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ''))}
              maxLength={32}
              className="font-mono text-xs"
            />
            <Button
              onClick={handleSave}
              loading={saving}
              disabled={loading || slugInput === data?.slug && enabledInput === data?.enabled}
            >
              Save
            </Button>
          </div>
          <p className="text-[11px] text-zinc-500">
            Min 3 characters. Use alphanumeric, dashes, or underscores.
          </p>
        </div>

        {/* Viral Tip Box */}
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-3.5 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
            <ShareAltOutlined className="text-emerald-700" />
            <span>Where to use this link</span>
          </div>
          <ul className="text-[11px] text-emerald-800 space-y-1 list-disc list-inside">
            <li>Paste in your <strong>LinkedIn Featured</strong> section or Bio.</li>
            <li>Use as your <strong>Portfolio / Website link</strong> on job applications.</li>
            <li>Share with hiring managers for instant proof of work & verified ATS CV.</li>
          </ul>
        </div>
      </div>
    </Modal>
  );
}
