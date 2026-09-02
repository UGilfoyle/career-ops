const MAX_BYTES = 12 * 1024 * 1024;

export async function extractDocumentText(bytes: Buffer, filename: string): Promise<string> {
  if (bytes.byteLength > MAX_BYTES) {
    throw new Error(`File too large. Max ${Math.round(MAX_BYTES / (1024 * 1024))}MB`);
  }
  const lower = (filename || "").toLowerCase();
  if (lower.endsWith(".txt") || lower.endsWith(".md")) {
    return bytes.toString("utf8").trim();
  }
  if (lower.endsWith(".pdf")) {
    const { extractText } = await import("unpdf");
    const uint8 = new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const result = await extractText(uint8);
    return (Array.isArray(result?.text) ? result.text.join("\n") : "").trim();
  }
  if (lower.endsWith(".docx")) {
    const mammothMod: { default?: { extractRawText: (o: { buffer: Buffer }) => Promise<{ value?: string }> } } =
      await import("mammoth");
    const mammoth =
      (mammothMod?.default || mammothMod) as {
        extractRawText: (o: { buffer: Buffer }) => Promise<{ value?: string }>;
      };
    const result = await mammoth.extractRawText({ buffer: bytes });
    return (result.value || "").trim();
  }
  throw new Error("Unsupported file type (use .txt, .md, .pdf, or .docx)");
}

export function inferCompanyAndTitleFromJd(jdText: string): { company: string | null; title: string | null } {
  if (!jdText?.trim()) return { company: null, title: null };
  const text = jdText.trim();
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  let detectedCompany: string | null = null;
  let detectedTitle: string | null = null;

  // 1. Explicit labels
  for (const line of lines.slice(0, 20)) {
    const compMatch = line.match(/^(?:company|employer|organization|client)\s*[:\-]\s*([^\n|]+)/i);
    if (compMatch && !detectedCompany) {
      detectedCompany = compMatch[1].trim().replace(/^[\*\-_#\s]+|[\*\-_#\s]+$/g, "");
    }
    const titleMatch = line.match(/^(?:job\s*title|position|role|designation)\s*[:\-]\s*([^\n|]+)/i);
    if (titleMatch && !detectedTitle) {
      detectedTitle = titleMatch[1].trim().replace(/^[\*\-_#\s]+|[\*\-_#\s]+$/g, "");
    }
  }

  // 2. Recruiter pattern: "Hi TCS is hiring Java Fullstack Developer..." or "TCS is hiring for ..."
  if (!detectedCompany || !detectedTitle) {
    const head = lines.slice(0, 8).join(" ");
    const hiringMatch = head.match(/(?:(?:hi|hey|hello)\s+)?([A-Za-z0-9&.\s]{2,35}?)\s+is\s+hiring\s+(?:for\s+)?(?:a\s+|an\s+)?([A-Za-z0-9\s/+\-_()]+?)(?:\s+(?:in|at|for|location|experience|exp|ctc|notice)|\s*[.!\n]|$)/i);
    if (hiringMatch) {
      if (!detectedCompany) detectedCompany = hiringMatch[1].trim();
      if (!detectedTitle && hiringMatch[2]?.length >= 3) detectedTitle = hiringMatch[2].trim();
    }
  }

  // 3. "At <Company>, we..." or "<Company> is a ..."
  if (!detectedCompany) {
    for (const line of lines.slice(0, 10)) {
      const atMatch = line.match(/^(?:About\s+|Join\s+)?(?:At\s+)([A-Za-z0-9&.\s]{2,35}?)(?:,\s*|\s+we\b|\s+is\b)/i);
      if (atMatch && !/^(the|our|this|a|an)\b/i.test(atMatch[1].trim())) {
        detectedCompany = atMatch[1].trim();
        break;
      }
      const isCoMatch = line.match(/^([A-Za-z0-9&.\s]{2,30}?)\s+is\s+(?:an?\s+)?(?:fast-growing|global|leading|pioneering|venture|seed|scale-up|transformation|technology|software|ai|fintech|b2b|b2c|saas|healthcare|consulting)\b/i);
      if (isCoMatch && !/^(it|this|there|he|she|they|we|our|who|which)\b/i.test(isCoMatch[1].trim())) {
        detectedCompany = isCoMatch[1].trim();
        break;
      }
    }
  }

  // 4. LinkedIn public copied text: line 0 = Role, line 1 = Company Location
  if (!detectedCompany || !detectedTitle) {
    const cleanLines = lines.filter((l) => !/^(skip to|linkedin|jobs|clear text|sign in|join now|apply|save|about the job|overview)/i.test(l));
    if (cleanLines.length >= 2) {
      const l0 = cleanLines[0];
      const l1 = cleanLines[1];
      if (/(?:engineer|developer|architect|lead|manager|consultant|analyst|specialist|head|director)/i.test(l0) && l0.length < 100) {
        if (!detectedTitle) detectedTitle = l0;
        if (!detectedCompany && l1.length < 80) {
          const compCandidate = l1.split(/[·\t]|  /)[0].trim();
          if (compCandidate && compCandidate.length >= 2 && !/^(full-time|remote|contract|part-time)/i.test(compCandidate)) {
            detectedCompany = compCandidate;
          }
        }
      }
    }
  }

  // 5. Fallback title from clean lines
  if (!detectedTitle) {
    for (const line of lines.slice(0, 15)) {
      const clean = line.replace(/^#+\s*/, "").replace(/^[\*\-_]+\s*/, "").trim();
      if (
        clean.length >= 4 &&
        clean.length <= 100 &&
        !/^https?:\/\//i.test(clean) &&
        !/^(overview|job description|about us|who we are|responsibilities|qualifications|full job description|summary|key responsibilities):?$/i.test(clean) &&
        !/\b(?:we’re|we are|reshaping|leading|fast-growing|founded|headquartered)\b/i.test(clean) &&
        /(?:engineer|developer|architect|lead|manager|analyst|scientist|designer|consultant|technician|administrator|specialist|intern)/i.test(clean)
      ) {
        detectedTitle = clean;
        break;
      }
    }
  }

  if (!detectedTitle) {
    for (const line of lines.slice(0, 8)) {
      if (line.length > 8 && line.length < 100 && !/^https?:\/\//i.test(line) && !/^(overview|job description):?$/i.test(line)) {
        detectedTitle = line.replace(/^#+\s*/, "").slice(0, 100);
        break;
      }
    }
  }

  return {
    company: detectedCompany ? detectedCompany.slice(0, 50) : null,
    title: detectedTitle ? detectedTitle.slice(0, 100) : null,
  };
}

export function inferTitleFromJd(jdText: string): string {
  const inferred = inferCompanyAndTitleFromJd(jdText);
  return inferred.title || "Pasted role";
}
