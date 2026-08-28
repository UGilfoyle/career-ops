'use client';

import { useRef, useState } from 'react';
import { Button, Tag, Badge, Space, Tooltip, Typography, Divider } from 'antd';
import {
  UndoOutlined,
  RedoOutlined,
  AppstoreOutlined,
  UploadOutlined,
  FileTextOutlined,
  CodeOutlined,
  RightOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import type { SaveStatus } from './useResumeStudioStore';
import { MatchProgressRing } from './MatchProgressRing';

const { Text } = Typography;

type StudioToolbarProps = {
  saveStatus: SaveStatus;
  saveError: string | null;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onImportFile: (file: File) => Promise<void>;
  onExportJson: () => void;
  onExportPdf: () => Promise<void>;
  exportingPdf: boolean;
  templateLabel?: string;
  onOpenTemplates?: () => void;
  jobContext?: {
    company?: string;
    title?: string;
  } | null;
  atsScore?: number | null;
  atsSource?: 'jd' | 'structure' | null;
};

export function StudioToolbar({
  saveStatus,
  saveError,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onImportFile,
  onExportJson,
  onExportPdf,
  exportingPdf,
  templateLabel,
  onOpenTemplates,
  jobContext,
  atsScore,
  atsSource,
}: StudioToolbarProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [importing, setImporting] = useState(false);

  const saveColor =
    saveStatus === 'error'
      ? 'error'
      : saveStatus === 'saved'
      ? 'success'
      : saveStatus === 'dirty' || saveStatus === 'saving'
      ? 'warning'
      : 'default';

  const saveLabel =
    saveStatus === 'saving'
      ? 'Saving…'
      : saveStatus === 'saved'
      ? 'Saved'
      : saveStatus === 'dirty'
      ? 'Unsaved changes'
      : saveStatus === 'error'
      ? 'Save failed'
      : 'Ready';

  const hasBreadcrumb = Boolean(jobContext?.company || jobContext?.title);

  return (
    <div className="flex flex-col border-b border-zinc-200 bg-white">
      {/* ── Row 1: Header + Context Breadcrumbs + Score ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-base font-bold text-zinc-900 m-0">Resume Studio</h2>
              {hasBreadcrumb && (
                <>
                  <RightOutlined className="text-zinc-400 text-xs" />
                  <span className="text-xs font-semibold text-zinc-600 truncate max-w-[260px]">
                    {jobContext?.title || 'Role'} @ {jobContext?.company || 'Company'}
                  </span>
                </>
              )}
            </div>
            <p className="text-xs text-zinc-500 font-medium m-0">
              {hasBreadcrumb
                ? 'Tailoring for selected job vacancy'
                : 'Master resume — canonical source for all tailored outputs'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {atsScore != null && (
            <div className="flex items-center gap-2">
              <MatchProgressRing value={atsScore} size={34} strokeWidth={3} label={`${atsScore}`} />
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                {atsSource === 'jd' ? 'JD ATS' : 'ATS'}
              </span>
            </div>
          )}

          <Tag color={saveColor} className="font-bold uppercase text-[10px] m-0">
            {saveLabel}
          </Tag>

          {saveError && (
            <span className="max-w-[180px] truncate text-[10px] text-red-600" title={saveError}>
              {saveError}
            </span>
          )}
        </div>
      </div>

      {/* ── Row 2: Action Controls Bar ── */}
      <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 px-4 py-2 bg-zinc-50/50">
        <Space size="small">
          <Tooltip title="Undo (⌘Z)">
            <Button
              size="small"
              icon={<UndoOutlined />}
              disabled={!canUndo}
              onClick={onUndo}
            />
          </Tooltip>
          <Tooltip title="Redo (⌘⇧Z)">
            <Button
              size="small"
              icon={<RedoOutlined />}
              disabled={!canRedo}
              onClick={onRedo}
            />
          </Tooltip>
        </Space>

        <Divider type="vertical" className="h-4 my-auto" />

        <Button
          size="small"
          icon={<AppstoreOutlined />}
          onClick={onOpenTemplates}
        >
          {templateLabel || 'Templates'}
        </Button>

        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            setImporting(true);
            try {
              await onImportFile(file);
            } finally {
              setImporting(false);
            }
          }}
        />
        <Button
          size="small"
          icon={importing ? <LoadingOutlined /> : <UploadOutlined />}
          disabled={importing}
          onClick={() => inputRef.current?.click()}
        >
          {importing ? 'Importing…' : 'Import'}
        </Button>

        <div className="ml-auto flex items-center gap-2">
          <Button
            size="small"
            icon={<CodeOutlined />}
            onClick={onExportJson}
          >
            JSON
          </Button>

          <Button
            type="primary"
            size="small"
            icon={exportingPdf ? <LoadingOutlined /> : <FileTextOutlined />}
            disabled={exportingPdf}
            onClick={() => void onExportPdf()}
          >
            {exportingPdf ? 'Exporting…' : 'Export PDF'}
          </Button>
        </div>
      </div>
    </div>
  );
}
