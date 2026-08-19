'use client';

import React, { useMemo } from 'react';
import { Check, Copy } from 'lucide-react';

function renderInline(text: string): React.ReactNode[] {
  // Regex to split by inline code (`code`), bold (**text**), italic (*text*), and links ([text](url))
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // 1. Inline code: `code`
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      parts.push(
        <code
          key={key++}
          className="rounded bg-[#F5F5F0] border border-[#E5E5E0] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-emerald-800"
        >
          {codeMatch[1]}
        </code>
      );
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    // 2. Bold + Italic: ***text***
    const boldItalicMatch = remaining.match(/^(\*\*\*|___)(.*?)\1/);
    if (boldItalicMatch) {
      parts.push(
        <strong key={key++} className="font-bold italic text-[#1C1C1E]">
          {renderInline(boldItalicMatch[2])}
        </strong>
      );
      remaining = remaining.slice(boldItalicMatch[0].length);
      continue;
    }

    // 3. Bold: **text** or __text__
    const boldMatch = remaining.match(/^(\*\*|__)(.*?)\1/);
    if (boldMatch) {
      parts.push(
        <strong key={key++} className="font-bold text-[#1C1C1E]">
          {renderInline(boldMatch[2])}
        </strong>
      );
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // 4. Italic: *text* or _text_ (excluding markdown bullets at start of line)
    const italicMatch = remaining.match(/^(\*|_)([^*_]+?)\1/);
    if (italicMatch) {
      parts.push(
        <em key={key++} className="italic text-[#374151]">
          {renderInline(italicMatch[2])}
        </em>
      );
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    // 5. Links: [label](url)
    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      parts.push(
        <a
          key={key++}
          href={linkMatch[2]}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-emerald-700 underline underline-offset-2 hover:text-emerald-900 transition-colors"
        >
          {linkMatch[1]}
        </a>
      );
      remaining = remaining.slice(linkMatch[0].length);
      continue;
    }

    // Find index of next special token
    const nextSpecial = remaining.search(/[`*_\[]/);
    if (nextSpecial === -1) {
      parts.push(remaining);
      break;
    } else if (nextSpecial === 0) {
      // Unmatched token, push single character and move forward
      parts.push(remaining[0]);
      remaining = remaining.slice(1);
    } else {
      parts.push(remaining.slice(0, nextSpecial));
      remaining = remaining.slice(nextSpecial);
    }
  }

  return parts;
}

function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative my-3 overflow-hidden rounded-xl border border-[#313244] bg-[#181825] text-[#CDD6F4]">
      {language ? (
        <div className="flex items-center justify-between border-b border-[#313244] bg-[#11111B] px-3.5 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-[#A6ADC8]">
          <span>{language}</span>
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 text-[#A6ADC8] hover:text-white transition-colors"
          >
            {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      ) : null}
      <pre className="overflow-x-auto p-3.5 font-mono text-xs leading-5">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function MarkdownMessage({ content }: { content: string }) {
  const renderedElements = useMemo(() => {
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let inCodeBlock = false;
    let codeLanguage = '';
    let codeContent: string[] = [];
    let currentList: { type: 'ul' | 'ol'; items: string[] } | null = null;

    const flushList = () => {
      if (!currentList) return;
      const key = `list-${elements.length}`;
      if (currentList.type === 'ol') {
        elements.push(
          <ol key={key} className="my-2.5 ml-5 list-decimal space-y-1 text-sm text-[#374151] leading-relaxed">
            {currentList.items.map((item, idx) => (
              <li key={idx}>{renderInline(item)}</li>
            ))}
          </ol>
        );
      } else {
        elements.push(
          <ul key={key} className="my-2.5 ml-5 list-disc space-y-1 text-sm text-[#374151] leading-relaxed">
            {currentList.items.map((item, idx) => (
              <li key={idx}>{renderInline(item)}</li>
            ))}
          </ul>
        );
      }
      currentList = null;
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // 1. Code Block start/end
      if (line.trim().startsWith('```')) {
        flushList();
        if (inCodeBlock) {
          elements.push(
            <CodeBlock
              key={`code-${elements.length}`}
              code={codeContent.join('\n')}
              language={codeLanguage}
            />
          );
          inCodeBlock = false;
          codeLanguage = '';
          codeContent = [];
        } else {
          inCodeBlock = true;
          codeLanguage = line.trim().slice(3).trim();
          codeContent = [];
        }
        continue;
      }

      if (inCodeBlock) {
        codeContent.push(line);
        continue;
      }

      // 2. Empty line
      if (!line.trim()) {
        flushList();
        continue;
      }

      // 3. Horizontal Rule
      if (/^(\*\*\*|---|___)$/.test(line.trim())) {
        flushList();
        elements.push(<hr key={`hr-${elements.length}`} className="my-3 border-t border-[#E5E5E0]" />);
        continue;
      }

      // 4. Headings
      if (line.startsWith('### ')) {
        flushList();
        elements.push(
          <h3 key={`h3-${elements.length}`} className="mt-3.5 mb-1.5 text-sm font-bold text-[#1C1C1E]">
            {renderInline(line.slice(4))}
          </h3>
        );
        continue;
      }
      if (line.startsWith('## ')) {
        flushList();
        elements.push(
          <h2 key={`h2-${elements.length}`} className="mt-4 mb-2 text-base font-extrabold text-[#1C1C1E] tracking-tight">
            {renderInline(line.slice(3))}
          </h2>
        );
        continue;
      }
      if (line.startsWith('# ')) {
        flushList();
        elements.push(
          <h1 key={`h1-${elements.length}`} className="mt-4 mb-2 text-lg font-extrabold text-[#1C1C1E] tracking-tight">
            {renderInline(line.slice(2))}
          </h1>
        );
        continue;
      }

      // 5. Blockquote
      if (line.startsWith('> ')) {
        flushList();
        elements.push(
          <blockquote
            key={`quote-${elements.length}`}
            className="my-2.5 rounded-r-xl border-l-4 border-emerald-500 bg-emerald-50/50 py-2 pl-3.5 pr-3 text-xs italic text-emerald-950 leading-relaxed"
          >
            {renderInline(line.slice(2))}
          </blockquote>
        );
        continue;
      }

      // 6. Numbered list: "1. ", "2. "
      const numMatch = line.match(/^(\d+)\.\s+(.*)$/);
      if (numMatch) {
        if (!currentList || currentList.type !== 'ol') {
          flushList();
          currentList = { type: 'ol', items: [] };
        }
        currentList.items.push(numMatch[2]);
        continue;
      }

      // 7. Bullet list: "- ", "* "
      const bulletMatch = line.match(/^[-*]\s+(.*)$/);
      if (bulletMatch) {
        if (!currentList || currentList.type !== 'ul') {
          flushList();
          currentList = { type: 'ul', items: [] };
        }
        currentList.items.push(bulletMatch[1]);
        continue;
      }

      // 8. Normal Paragraph
      flushList();
      elements.push(
        <p key={`p-${elements.length}`} className="my-1.5 text-sm text-[#374151] leading-relaxed">
          {renderInline(line)}
        </p>
      );
    }

    flushList();

    if (inCodeBlock && codeContent.length > 0) {
      elements.push(
        <CodeBlock
          key={`code-${elements.length}`}
          code={codeContent.join('\n')}
          language={codeLanguage}
        />
      );
    }

    return elements;
  }, [content]);

  return <div className="space-y-1 text-sm leading-relaxed">{renderedElements}</div>;
}
