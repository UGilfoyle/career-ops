export type JdSectionType =
  | 'overview'
  | 'responsibilities'
  | 'requirements'
  | 'preferred'
  | 'stack'
  | 'compensation'
  | 'other';

export type JdSection = {
  id: string;
  title: string;
  type: JdSectionType;
  items: string[];
  rawBody: string;
};

export type StructuredJd = {
  title?: string;
  company?: string;
  location?: string;
  sections: JdSection[];
  techStack: string[];
  metrics: {
    wordCount: number;
    charCount: number;
    readingTimeMinutes: number;
    bulletCount: number;
  };
  isBlockedOrThin: boolean;
  blockedReason?: string;
  rawText: string;
};

const COMMON_TECH_LIST: string[] = [
  'Python', 'TypeScript', 'JavaScript', 'Golang', 'Go', 'Java', 'C++', 'C#', '.NET',
  'Rust', 'Ruby', 'PHP', 'Swift', 'Kotlin', 'Scala', 'SQL',
  'React', 'Next.js', 'Vue', 'Angular', 'Node.js', 'Express', 'NestJS', 'FastAPI', 'Django', 'Spring Boot',
  'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Elasticsearch', 'ClickHouse', 'DynamoDB', 'Cassandra', 'Snowflake',
  'Docker', 'Kubernetes', 'AWS', 'GCP', 'Azure', 'Terraform', 'Kafka', 'RabbitMQ', 'GraphQL', 'REST', 'gRPC',
  'Git', 'CI/CD', 'GitHub Actions', 'Linux', 'Microservices', 'Distributed Systems', 'System Design'
];

export function cleanHtmlToStructuredJd(html: string): string {
  if (!html) return '';
  return String(html)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, ' ')
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, ' ')
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, ' ')
    .replace(/<h[1-2][^>]*>([\s\S]*?)<\/h[1-2]>/gi, '\n\n## $1\n\n')
    .replace(/<h[3-6][^>]*>([\s\S]*?)<\/h[3-6]>/gi, '\n\n### $1\n\n')
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '\n• $1')
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&bull;/g, '•')
    .replace(/&middot;/g, '•')
    .replace(/[ \t]+/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n\s*•/g, '\n•')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function detectKnownTech(text: string): string[] {
  if (!text || text.length < 20) return [];
  const found: string[] = [];
  for (const tech of COMMON_TECH_LIST) {
    const escaped = tech.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?:^|[^a-zA-Z0-9_#+])${escaped}(?:$|[^a-zA-Z0-9_#+])`, 'i');
    if (regex.test(text)) {
      found.push(tech);
    }
  }
  return found;
}

function classifySectionTitle(title: string): JdSectionType {
  const t = title.toLowerCase().trim();
  if (/^(?:about (?:the |this )?(?:role|job|company|team|us)|job summary|overview|who we are|what you will be doing|position summary)/i.test(t)) {
    return 'overview';
  }
  if (/^(?:key |core )?(?:responsibilities|duties|what you will do|what you'll do|day to day|role & responsibilities|scope of work|what you'll be working on)/i.test(t)) {
    return 'responsibilities';
  }
  if (/^(?:minimum |basic |core )?(?:requirements|qualifications|what we are looking for|what you(?:'ll| will)? bring|skills & experience|who you are|must have|what you need)/i.test(t)) {
    return 'requirements';
  }
  if (/^(?:preferred|nice to have|bonus|desired|additional qualifications)/i.test(t)) {
    return 'preferred';
  }
  if (/^(?:tech(?:nology)? stack|tools & tech|technologies used|technical skills|stack)/i.test(t)) {
    return 'stack';
  }
  if (/^(?:compensation|salary|benefits|what we offer|perks|why join us)/i.test(t)) {
    return 'compensation';
  }
  return 'other';
}

function extractBulletsFromBlock(block: string): string[] {
  const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
  const bullets: string[] = [];
  for (const line of lines) {
    const cleanLine = line.replace(/^[•*\-–—▪▫►✦✔✓\u2022\u2023\u25E6\u2043\u2219]|\d+\.\s*/, '').trim();
    if (cleanLine.length > 5) {
      bullets.push(cleanLine);
    }
  }
  return bullets;
}

export function parseJdSections(rawInput: string | null | undefined): StructuredJd {
  const rawText = cleanHtmlToStructuredJd(String(rawInput || '').trim());
  if (!rawText || rawText.length < 25) {
    return {
      sections: [],
      techStack: [],
      metrics: {
        wordCount: 0,
        charCount: 0,
        readingTimeMinutes: 0,
        bulletCount: 0,
      },
      isBlockedOrThin: true,
      blockedReason: 'No job description text captured yet.',
      rawText: '',
    };
  }

  if (/access denied|edgesuite\.net|don't have permission to access|cloudflare|captcha|security check|forbidden|403\s+forbidden/i.test(rawText)) {
    return {
      sections: [],
      techStack: [],
      metrics: {
        wordCount: rawText.split(/\s+/).length,
        charCount: rawText.length,
        readingTimeMinutes: 1,
        bulletCount: 0,
      },
      isBlockedOrThin: true,
      blockedReason: 'Job board access blocked by automated gatekeeper. Open the posting URL directly.',
      rawText,
    };
  }

  const words = rawText.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const charCount = rawText.length;
  const readingTimeMinutes = Math.max(1, Math.ceil(wordCount / 200));

  let extractedTitle: string | undefined;
  let extractedCompany: string | undefined;
  let extractedLocation: string | undefined;

  const headerMatch = rawText.match(/Job Title:\s*([^\n]+)/i);
  if (headerMatch) extractedTitle = headerMatch[1].trim();

  const companyMatch = rawText.match(/Company:\s*([^\n]+)/i);
  if (companyMatch) extractedCompany = companyMatch[1].trim();

  const locationMatch = rawText.match(/Location:\s*([^\n]+)/i);
  if (locationMatch) extractedLocation = locationMatch[1].trim();

  const sections: JdSection[] = [];
  const rawBlocks = rawText.split(/\n\s*\n/);
  let sectionIdx = 0;

  for (const block of rawBlocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    const firstLineEnd = trimmed.indexOf('\n');
    const firstLine = (firstLineEnd !== -1 ? trimmed.slice(0, firstLineEnd) : trimmed).trim();
    const restOfBlock = firstLineEnd !== -1 ? trimmed.slice(firstLineEnd).trim() : '';

    const cleanHeadingCandidate = firstLine
      .replace(/^#{1,6}\s+/, '')
      .replace(/:\s*$/, '')
      .trim();

    const isMarkdownHeading = /^#{1,6}\s+/.test(firstLine);
    const isColonHeading = /:\s*$/.test(firstLine) && cleanHeadingCandidate.length <= 60 && !/[.!?]$/.test(cleanHeadingCandidate);
    const isClassifiedHeading = cleanHeadingCandidate.length <= 60 && classifySectionTitle(cleanHeadingCandidate) !== 'other';

    if (isMarkdownHeading || isColonHeading || isClassifiedHeading) {
      const type = classifySectionTitle(cleanHeadingCandidate);
      const items = extractBulletsFromBlock(restOfBlock);
      sections.push({
        id: `sec-${sectionIdx++}`,
        title: cleanHeadingCandidate,
        type,
        items,
        rawBody: restOfBlock,
      });
    } else {
      const items = extractBulletsFromBlock(trimmed);
      if (sections.length > 0) {
        const lastSec = sections[sections.length - 1];
        lastSec.items.push(...items);
        lastSec.rawBody = lastSec.rawBody ? `${lastSec.rawBody}\n\n${trimmed}` : trimmed;
      } else {
        sections.push({
          id: `sec-${sectionIdx++}`,
          title: 'Role Overview',
          type: 'overview',
          items: items.length > 0 ? items : [trimmed],
          rawBody: trimmed,
        });
      }
    }
  }

  let totalBullets = 0;
  for (const s of sections) {
    totalBullets += s.items.length;
  }

  const techStack = detectKnownTech(rawText);

  return {
    title: extractedTitle,
    company: extractedCompany,
    location: extractedLocation,
    sections,
    techStack,
    metrics: {
      wordCount,
      charCount,
      readingTimeMinutes,
      bulletCount: totalBullets,
    },
    isBlockedOrThin: wordCount < 30,
    blockedReason: wordCount < 30 ? 'Job description content is very short or thin.' : undefined,
    rawText,
  };
}
