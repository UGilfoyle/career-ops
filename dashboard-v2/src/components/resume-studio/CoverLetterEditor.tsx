'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Save, Wand2 } from 'lucide-react';

type CoverLetterEditorProps = {
  jobId: number;
  profileName?: string;
  company?: string;
  onSaved?: (html: string) => void;
  onPreviewHtml?: (html: string | null) => void;
};

function extractBetween(html: string, openRe: RegExp, closeTag: string): { inner: string; full: string } | null {
  const open = html.match(openRe);
  if (!open || open.index == null) return null;
  const start = open.index + open[0].length;
  const closeIdx = html.toLowerCase().indexOf(closeTag.toLowerCase(), start);
  if (closeIdx < 0) return null;
  return { inner: html.slice(start, closeIdx), full: html.slice(open.index, closeIdx + closeTag.length) };
}

function stripTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function bodyToHtml(text: string): string {
  return text
    .trim()
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\r/g, '').trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n+/g, ' ')}</p>`)
    .join('\n      ');
}

function parseCover(html: string): { name: string; body: string } {
  const nameMatch =
    html.match(/class=["'][^"']*sender-name[^"']*["'][^>]*>([\s\S]*?)<\//i) ||
    html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const name = nameMatch ? stripTags(nameMatch[1]) : '';

  const content = extractBetween(
    html,
    /<div[^>]*class=["'][^"']*\bcontent\b[^"']*["'][^>]*>/i,
    '</div>'
  );
  const body = content ? stripTags(content.inner) : '';
  return { name, body };
}

function applyEdits(html: string, name: string, body: string): string {
  let next = html;
  const safeName = escapeHtml(name.trim());
  const bodyHtml = bodyToHtml(body);

  next = next.replace(
    /(<div[^>]*class=["'][^"']*sender-name[^"']*["'][^>]*>)([\s\S]*?)(<\/div>)/i,
    `$1${safeName}$3`
  );
  next = next.replace(
    /(<div[^>]*class=["'][^"']*signature-name[^"']*["'][^>]*>)([\s\S]*?)(<\/div>)/i,
    `$1${safeName}$3`
  );
  next = next.replace(/<title>[\s\S]*?<\/title>/i, `<title>Cover Letter — ${safeName}</title>`);

  const contentOpen = next.match(/<div[^>]*class=["'][^"']*\bcontent\b[^"']*["'][^>]*>/i);
  if (contentOpen && contentOpen.index != null) {
    const start = contentOpen.index + contentOpen[0].length;
    // Find matching close for this content div (first </div> after paragraphs — cover template is flat)
    const closeIdx = next.toLowerCase().indexOf('</div>', start);
    if (closeIdx > start) {
      next = `${next.slice(0, start)}\n      ${bodyHtml}\n    ${next.slice(closeIdx)}`;
    }
  }

  return next;
}

export function CoverLetterEditor({
  jobId,
  profileName = '',
  company,
  onSaved,
  onPreviewHtml,
}: CoverLetterEditorProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [sourceHtml, setSourceHtml] = useState('');
  const [name, setName] = useState('');
  const [body, setBody] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/job/${jobId}/docs`, { credentials: 'same-origin' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `Load failed (${res.status})`);
      const html = String(json.cover_letter_html || '');
      if (!html) throw new Error('No cover letter saved for this job yet. Run tailor --deep first.');
      const parsed = parseCover(html);
      setSourceHtml(html);
      setName(parsed.name || profileName || '');
      setBody(parsed.body);
      const preview = applyEdits(html, parsed.name || profileName || '', parsed.body);
      onPreviewHtml?.(preview);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load cover letter');
      onPreviewHtml?.(null);
    } finally {
      setLoading(false);
    }
  }, [jobId, profileName, onPreviewHtml]);

  useEffect(() => {
    void load();
  }, [load]);

  const draftHtml = useMemo(() => {
    if (!sourceHtml) return null;
    return applyEdits(sourceHtml, name, body);
  }, [sourceHtml, name, body]);

  useEffect(() => {
    if (draftHtml) onPreviewHtml?.(draftHtml);
  }, [draftHtml, onPreviewHtml]);

  const applyProfileName = () => {
    const clean = profileName.trim();
    if (!clean) {
      setStatus('Set full name in Edit Master Resume → Personal Info first.');
      return;
    }
    setName(clean);
    setStatus(`Name set to “${clean}”. Click Save to persist.`);
  };

  const save = async () => {
    if (!sourceHtml || !draftHtml) return;
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch(`/api/job/${jobId}/docs`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          cover_letter_html: draftHtml,
          invalidate_pdfs: true,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `Save failed (${res.status})`);
      setSourceHtml(draftHtml);
      onSaved?.(draftHtml);
      setStatus('Cover letter saved. PDF cleared — run tailor --deep when you want a fresh PDF.');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-[#E5E5E0] bg-white px-4 py-16 text-sm text-[#6B6B6B]">
        <Loader2 size={16} className="animate-spin" />
        Loading cover letter…
      </div>
    );
  }

  if (error && !sourceHtml) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-6 text-sm font-medium text-rose-900">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-[#E5E5E0] bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">
            Edit cover letter
          </div>
          <p className="mt-0.5 text-sm font-semibold text-[#1C1C1E]">
            {company || 'Company'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={applyProfileName}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#E5E5E0] bg-[#FAFAF8] px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[#1C1C1E] hover:border-[#1C1C1E]"
          >
            <Wand2 size={12} />
            Use profile name
          </button>
          <button
            type="button"
            disabled={saving || !draftHtml}
            onClick={() => void save()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#1C1C1E] px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-white hover:bg-[#27272a] disabled:opacity-50"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            Save
          </button>
        </div>
      </div>

      <label className="block space-y-1.5">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#6B6B6B]">
          Name (header + signature)
        </span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-xl border border-[#E5E5E0] bg-white px-3 py-2.5 text-sm font-medium text-[#1C1C1E] outline-none focus:border-[#1C1C1E]"
          placeholder="Your full name"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#6B6B6B]">
          Letter body
        </span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={14}
          className="w-full resize-y rounded-xl border border-[#E5E5E0] bg-white px-3 py-2.5 text-sm font-normal leading-relaxed text-[#1C1C1E] outline-none focus:border-[#1C1C1E]"
          placeholder="Paragraphs separated by a blank line…"
        />
        <span className="block text-[11px] text-[#9CA3AF]">
          Blank line = new paragraph. Salutation and “Sincerely” stay in the template.
        </span>
      </label>

      {status ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-900">
          {status}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-900">
          {error}
        </div>
      ) : null}
    </div>
  );
}
