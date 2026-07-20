'use client';

import { useRef, useState } from 'react';
import {
  Download,
  FileJson,
  FileText,
  LayoutTemplate,
  Loader2,
  Redo2,
  Undo2,
  Upload,
} from 'lucide-react';
import type { SaveStatus } from './useResumeStudioStore';

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
}: {
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
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [importing, setImporting] = useState(false);

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

  const saveColor =
    saveStatus === 'error'
      ? 'text-rose-600'
      : saveStatus === 'saved'
        ? 'text-emerald-600'
        : saveStatus === 'dirty'
          ? 'text-amber-700'
          : 'text-[#9CA3AF]';

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E5E0] bg-white px-4 py-3">
      <div>
        <h2 className="text-lg font-bold text-[#1C1C1E]">Master Resume</h2>
        <p className="text-xs text-[#6B6B6B] font-medium">
          Canonical profile — used for all tailoring
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest ${saveColor}`}>
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              saveStatus === 'saved'
                ? 'bg-emerald-500'
                : saveStatus === 'dirty' || saveStatus === 'saving'
                  ? 'bg-amber-500'
                  : saveStatus === 'error'
                    ? 'bg-rose-500'
                    : 'bg-[#d4d4d8]'
            }`}
          />
          {saveLabel}
        </span>
        {saveError ? (
          <span className="max-w-[180px] truncate text-[10px] text-rose-600" title={saveError}>
            {saveError}
          </span>
        ) : null}

        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          className="rounded-xl border border-[#E5E5E0] bg-white p-2 text-[#1C1C1E] disabled:opacity-40 hover:bg-[#FAFAF8]"
          title="Undo (⌘Z)"
        >
          <Undo2 size={14} />
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          className="rounded-xl border border-[#E5E5E0] bg-white p-2 text-[#1C1C1E] disabled:opacity-40 hover:bg-[#FAFAF8]"
          title="Redo (⌘⇧Z)"
        >
          <Redo2 size={14} />
        </button>

        <button
          type="button"
          onClick={onOpenTemplates}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[#E5E5E0] bg-white px-3 py-2 text-xs font-bold text-[#1C1C1E] hover:bg-[#FAFAF8]"
        >
          <LayoutTemplate size={14} />
          {templateLabel || 'Templates'}
        </button>

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
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={importing}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[#E5E5E0] bg-white px-3 py-2 text-xs font-bold text-[#1C1C1E] hover:bg-[#FAFAF8] disabled:opacity-50"
        >
          {importing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          Import
        </button>

        <button
          type="button"
          onClick={onExportJson}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[#E5E5E0] bg-white px-3 py-2 text-xs font-bold text-[#1C1C1E] hover:bg-[#FAFAF8]"
        >
          <FileJson size={14} />
          JSON
        </button>

        <button
          type="button"
          onClick={() => void onExportPdf()}
          disabled={exportingPdf}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#1C1C1E] px-3 py-2 text-xs font-bold text-white hover:bg-[#27272a] disabled:opacity-50"
        >
          {exportingPdf ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
          PDF
        </button>

        <button
          type="button"
          onClick={() => {
            /* HTML download via same fill path — exposed as secondary through PDF handler if needed */
          }}
          className="hidden"
          aria-hidden
        >
          <Download size={14} />
        </button>
      </div>
    </div>
  );
}
