const MAX_BYTES = 12 * 1024 * 1024;

export async function extractDocumentText(bytes: Buffer, filename: string): Promise<string> {
  if (bytes.byteLength > MAX_BYTES) {
    throw new Error(`File too large. Max ${Math.round(MAX_BYTES / (1024 * 1024))}MB`);
  }
  const lower = (filename || '').toLowerCase();
  if (lower.endsWith('.txt') || lower.endsWith('.md')) {
    return bytes.toString('utf8').trim();
  }
  if (lower.endsWith('.pdf')) {
    const { extractText } = await import('unpdf');
    const uint8 = new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const result = await extractText(uint8);
    return (Array.isArray(result?.text) ? result.text.join('\n') : '').trim();
  }
  if (lower.endsWith('.docx')) {
    const mammothMod: { default?: { extractRawText: (o: { buffer: Buffer }) => Promise<{ value?: string }> } } =
      await import('mammoth');
    const mammoth =
      (mammothMod?.default || mammothMod) as {
        extractRawText: (o: { buffer: Buffer }) => Promise<{ value?: string }>;
      };
    const result = await mammoth.extractRawText({ buffer: bytes });
    return (result.value || '').trim();
  }
  throw new Error('Unsupported file type (use .txt, .md, .pdf, or .docx)');
}

export function inferTitleFromJd(jdText: string): string {
  const lines = jdText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 8);
  for (const line of lines) {
    if (line.length > 8 && line.length < 120 && !/^https?:\/\//i.test(line)) {
      return line.replace(/^#+\s*/, '').slice(0, 120);
    }
  }
  return 'Pasted role';
}
