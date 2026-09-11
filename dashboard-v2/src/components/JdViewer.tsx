'use client';

import React, { useMemo, useState } from 'react';
import {
  Search,
  Copy,
  Check,
  Code2,
  ListChecks,
  AlertCircle,
  Clock,
  FileText,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { parseJdSections, type JdSectionType } from '@/lib/jd-formatter';

interface JdViewerProps {
  jdText?: string | null;
  jobTitle?: string;
  company?: string;
  jobUrl?: string;
  maxHeight?: string | number;
  className?: string;
  initialMode?: 'structured' | 'markdown';
}

function getBadgeColor(type: JdSectionType) {
  switch (type) {
    case 'overview':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'responsibilities':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    case 'requirements':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    case 'preferred':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'stack':
      return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'compensation':
      return 'bg-green-50 text-green-700 border-green-200';
    default:
      return 'bg-zinc-100 text-zinc-700 border-zinc-200';
  }
}

export function JdViewer({
  jdText,
  jobTitle,
  company,
  jobUrl,
  maxHeight = '65vh',
  className = '',
  initialMode = 'structured',
}: JdViewerProps) {
  const [viewMode, setViewMode] = useState<'structured' | 'markdown'>(initialMode);
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const structured = useMemo(() => parseJdSections(jdText), [jdText]);

  const handleCopy = async () => {
    const textToCopy = structured.rawText || jdText || '';
    if (!textToCopy) return;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback if clipboard API unavailable
    }
  };

  const toggleCollapse = (id: string) => {
    setCollapsedSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const query = searchQuery.trim().toLowerCase();

  const filteredSections = useMemo(() => {
    if (!query) return structured.sections;
    return structured.sections
      .map((sec) => {
        const titleMatches = sec.title.toLowerCase().includes(query);
        const matchedItems = sec.items.filter((item) =>
          item.toLowerCase().includes(query)
        );
        const bodyMatches = sec.rawBody.toLowerCase().includes(query);
        if (titleMatches || matchedItems.length > 0 || bodyMatches) {
          return {
            ...sec,
            items: matchedItems.length > 0 ? matchedItems : sec.items,
          };
        }
        return null;
      })
      .filter(Boolean) as typeof structured.sections;
  }, [structured.sections, query]);

  if (structured.isBlockedOrThin) {
    return (
      <div className={`rounded-xl border border-amber-200 bg-amber-50/50 p-5 ${className}`}>
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-amber-900">
              {structured.blockedReason || 'Limited Job Description Available'}
            </h4>
            <p className="text-xs text-amber-700 mt-1 leading-relaxed">
              Automated scraping could not capture the complete text. You can inspect the posting directly or paste the text manually.
            </p>
            {jobUrl && (
              <div className="mt-3">
                <a
                  href={jobUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open Job Posting
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden ${className}`}>
      {/* Controls Header */}
      <div className="p-3 border-b border-zinc-200 bg-zinc-50/80 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 flex-1 min-w-[220px]">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search in JD requirements, skills…"
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white rounded-lg border border-zinc-200 text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex items-center bg-zinc-200/70 p-0.5 rounded-lg text-xs">
            <button
              type="button"
              onClick={() => setViewMode('structured')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                viewMode === 'structured'
                  ? 'bg-white text-zinc-900 shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <ListChecks className="w-3.5 h-3.5" />
              Sections
            </button>
            <button
              type="button"
              onClick={() => setViewMode('markdown')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                viewMode === 'markdown'
                  ? 'bg-white text-zinc-900 shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              Raw
            </button>
          </div>

          {/* Copy button */}
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-zinc-200 bg-white text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700 font-semibold">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-zinc-500" />
                <span>Copy JD</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Metrics & Stack Strip */}
      <div className="px-3.5 py-2 border-b border-zinc-100 bg-white flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <FileText className="w-3 h-3 text-zinc-400" />
            {structured.metrics.wordCount} words
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-zinc-400" />
            {structured.metrics.readingTimeMinutes} min read
          </span>
          {structured.metrics.bulletCount > 0 && (
            <span className="font-medium text-zinc-700">
              {structured.metrics.bulletCount} requirements & bullets
            </span>
          )}
        </div>

        {structured.techStack.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 max-w-full">
            <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 mr-1">
              Stack:
            </span>
            {structured.techStack.slice(0, 8).map((tech) => (
              <span
                key={tech}
                className="px-1.5 py-0.5 rounded-md bg-zinc-100 text-zinc-700 text-[10px] font-semibold font-mono"
              >
                {tech}
              </span>
            ))}
            {structured.techStack.length > 8 && (
              <span className="text-[10px] text-zinc-400 font-mono">
                +{structured.techStack.length - 8} more
              </span>
            )}
          </div>
        )}
      </div>

      {/* Content Body */}
      <div
        style={{ maxHeight }}
        className="overflow-y-auto p-4 space-y-4 font-sans text-xs leading-relaxed text-zinc-800"
      >
        {viewMode === 'markdown' ? (
          <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-zinc-700 bg-zinc-50 p-3.5 rounded-lg border border-zinc-200">
            {structured.rawText}
          </pre>
        ) : filteredSections.length === 0 ? (
          <div className="text-center py-8 text-zinc-400">
            No matching sections found for &quot;{searchQuery}&quot;
          </div>
        ) : (
          filteredSections.map((section) => {
            const isCollapsed = Boolean(collapsedSections[section.id]);
            return (
              <div
                key={section.id}
                className="rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-2xs"
              >
                <div
                  onClick={() => toggleCollapse(section.id)}
                  className="px-3.5 py-2.5 bg-zinc-50/70 border-b border-zinc-100 flex items-center justify-between cursor-pointer select-none hover:bg-zinc-100/60 transition"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${getBadgeColor(
                        section.type
                      )}`}
                    >
                      {section.type}
                    </span>
                    <h5 className="font-semibold text-zinc-900 text-xs">
                      {section.title}
                    </h5>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-400">
                    <span className="text-[10px]">
                      {section.items.length > 0 ? `${section.items.length} items` : ''}
                    </span>
                    {isCollapsed ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronUp className="w-3.5 h-3.5" />
                    )}
                  </div>
                </div>

                {!isCollapsed && (
                  <div className="p-3.5">
                    {section.items.length > 0 ? (
                      <ul className="space-y-2">
                        {section.items.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-zinc-700">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-zinc-400 mt-1.5 shrink-0" />
                            <span className="leading-relaxed">{item}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="whitespace-pre-wrap text-zinc-700 leading-relaxed">
                        {section.rawBody}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
