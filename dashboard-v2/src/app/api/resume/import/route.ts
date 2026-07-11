import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

function normalizeText(input: string) {
  return (input || '')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractSection(text: string, heading: RegExp) {
  const m = text.match(heading);
  if (!m || m.index === undefined) return null;
  const start = m.index + m[0].length;
  const rest = text.slice(start);
  const nextHeading = rest.search(/^\s*[A-Z][A-Z &/]{2,}\s*$/m);
  const end = nextHeading >= 0 ? start + nextHeading : text.length;
  return text.slice(start, end).trim();
}

// Role keywords to help identify which part is the role
const ROLE_KEYWORDS = /\b(?:Software|Engineer|Developer|Manager|Architect|Lead|Senior|Junior|Principal|Staff|Director|Head|VP|Analyst|Consultant|Specialist|Administrator|Intern|Trainee|Full-Stack|Back-End|Front-End|DevOps|Data|Machine Learning|Product|Project|QA|Test|Security|Cloud|Infrastructure|Support|Technician|Designer|Writer|Editor|Marketing|Sales|Business|Operations|Finance|HR|Recruiter|Coordinator|Assistant|Associate|Representative|Supervisor|Executive|Officer|Partner|Founder|Owner|Freelance)\b/gi;

function parseExperience(text: string) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const jobs: any[] = [];
  
  // Date pattern: catches "Jul 2025 – Present", "Aug 2023 – Oct 2024", etc.
  const datePattern = /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}\s*[-–—]\s*(?:\d{4}|Present|Current|Now|\w+\s+\d{4}))/i;
  const yearPattern = /\b(20\d{2}|19\d{2})\b/;
  
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    
    // Skip empty or very short lines
    if (line.length < 10) {
      i++;
      continue;
    }
    
    // Check if this line has a date pattern (indicates job header)
    const dateMatch = line.match(datePattern);
    const hasYear = yearPattern.test(line);
    
    if (dateMatch || (hasYear && line.length < 150 && ROLE_KEYWORDS.test(line))) {
      // This looks like a job header line
      let headerText = line;
      let period = '';
      
      // Extract and remove the date portion
      if (dateMatch) {
        period = dateMatch[0].trim();
        headerText = line.slice(0, dateMatch.index).trim();
      }
      
      // Parse role and company from headerText
      // Format is typically: "Role — Company" or "Role | Company" or "Role - Company"
      let role = '';
      let company = '';
      
      // Try various separators (em-dash, en-dash, hyphen, pipe)
      const separators = [' — ', ' – ', ' - ', ' | ', '—', '–', '-'];
      let foundSeparator = false;
      
      for (const sep of separators) {
        const idx = headerText.indexOf(sep);
        if (idx > 0) {
          const part1 = headerText.slice(0, idx).trim();
          const part2 = headerText.slice(idx + sep.length).trim();
          
          // Count role keywords in each part
          const part1Roles = (part1.match(ROLE_KEYWORDS) || []).length;
          const part2Roles = (part2.match(ROLE_KEYWORDS) || []).length;
          
          // The part with MORE role keywords is the role
          // The part with FEWER role keywords is the company
          if (part1Roles >= part2Roles) {
            role = part1;
            company = part2;
          } else {
            role = part2;
            company = part1;
          }
          foundSeparator = true;
          break;
        }
      }
      
      // If no separator found, try to detect by position
      if (!foundSeparator) {
        // Common pattern: "Role at Company" or "Role, Company"
        const atMatch = headerText.match(/(.+?)\s+at\s+(.+)/i);
        if (atMatch) {
          role = atMatch[1].trim();
          company = atMatch[2].trim();
        } else {
          // Last resort: if it has role keywords, use the whole thing as role
          role = headerText;
        }
      }
      
      // Clean up: remove any remaining date patterns
      const cleanRole = (r: string) => r.replace(/\b\d{4}\b/g, '').replace(/\s+/g, ' ').trim();
      const cleanCompany = (c: string) => c.replace(/\b\d{4}\b/g, '').replace(/\s+/g, ' ').trim();
      
      role = cleanRole(role);
      company = cleanCompany(company);
      
      // Skip if this looks like bullet text (starts with verb words)
      const bulletStarters = /^(architected|spearhead|design|enforce|engineered|optimized|automated|developed|analyzed|configured|fortified|built|integrated|constructed|authored|formulated|provisioned)/i;
      if (bulletStarters.test(role) && !company) {
        i++;
        continue;
      }
      
      // Collect bullets - all lines until next job header
      const bullets: string[] = [];
      i++;
      while (i < lines.length) {
        const nextLine = lines[i];
        
        // Stop if we hit another job header (has date + role keywords)
        const nextHasDate = datePattern.test(nextLine);
        const nextHasRole = ROLE_KEYWORDS.test(nextLine);
        const nextHasYear = yearPattern.test(nextLine);
        
        if ((nextHasDate && nextHasRole) || (nextHasYear && nextLine.length < 150 && nextHasRole && nextLine.includes('—'))) {
          // This is a new job header
          break;
        }
        
        // Stop if we hit a new section (all caps heading)
        if (/^[A-Z][A-Z\s&]{3,}$/.test(nextLine)) {
          break;
        }
        
        // This is a bullet point
        const cleanBullet = nextLine.replace(/^[•\-▸*]\s*/, '').trim();
        if (cleanBullet.length > 15) {
          bullets.push(cleanBullet);
        }
        i++;
      }
      
      // Only add if we have meaningful content
      if ((role || company) && bullets.length > 0) {
        jobs.push({
          role,
          company,
          period: period || '',
          bullets
        });
      }
    } else {
      i++;
    }
  }
  
  return jobs;
}

function parseEducation(text: string) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const out: any[] = [];
  
  const degreePattern = /(Bachelor|Master|B\.?A\.?|M\.?A\.?|B\.?S\.?|M\.?S\.?|M\.?Tech|B\.?Tech|Ph\.?D|MBA|MCA|BCA|BSc|MSc|Diploma|Certificate)/i;
  const yearPattern = /(20\d{2}|19\d{2})/g;
  
  for (const line of lines) {
    const hasDegree = degreePattern.test(line);
    const years = line.match(yearPattern);
    
    if (hasDegree && years) {
      const uniqueYears = [...new Set(years.map((y) => parseInt(y, 10)))].sort((a, b) => a - b);
      const period =
        uniqueYears.length === 1
          ? String(uniqueYears[0])
          : `${uniqueYears[0]} – ${uniqueYears[uniqueYears.length - 1]}`;

      // Strip year/date fragments before splitting degree vs school
      const cleanLine = line
        .replace(/\s*\([^)]*\d{4}[^)]*\)/g, '')
        .replace(/\s*\b(19|20)\d{2}\s*[—–-]\s*(19|20)\d{2}\b/g, '')
        .replace(/\s+\b(19|20)\d{2}\b/g, ' ')
        .trim();

      const parts = cleanLine.split(/\s*[-–—|]\s*/);
      const degreePart = (parts[0] || '').trim();
      const schoolPart = (parts[1] || '').trim();

      out.push({
        degree: degreePart,
        school: schoolPart,
        period,
      });
    }
    
    if (out.length >= 6) break;
  }
  
  return out;
}

async function extractPdfText(bytes: Buffer): Promise<string> {
  const { extractText } = await import('unpdf');
  const uint8 = new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const result = await extractText(uint8);
  return Array.isArray(result?.text) ? result.text.join('\n') : '';
}

export async function POST(req: NextRequest) {
  let step = 'auth';
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    step = 'formData';
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    }

    step = 'readFile';
    const name = file.name || 'resume';
    const lower = name.toLowerCase();
    const bytes = Buffer.from(await file.arrayBuffer());
    if (bytes.byteLength > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: `File too large. Max ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))}MB` },
        { status: 413 }
      );
    }

    step = 'parse';
    let text = '';
    if (lower.endsWith('.pdf')) {
      text = await extractPdfText(bytes);
    } else if (lower.endsWith('.docx')) {
      const mammothMod: any = await import('mammoth');
      const mammoth: any = mammothMod?.default || mammothMod;
      const result = await mammoth.extractRawText({ buffer: bytes });
      text = result.value || '';
    } else {
      return NextResponse.json({ error: 'Unsupported file type (use PDF or DOCX)' }, { status: 400 });
    }

    step = 'postProcess';
    text = normalizeText(text);

    const expSection =
      extractSection(text, /^\s*(PROFESSIONAL EXPERIENCE|EXPERIENCE|WORK EXPERIENCE|CAREER HISTORY)\s*$/im) ||
      extractSection(text, /^\s*(EMPLOYMENT|WORK HISTORY)\s*$/im) ||
      '';
    const eduSection =
      extractSection(text, /^\s*(EDUCATION|ACADEMIC|QUALIFICATIONS)\s*$/im) ||
      '';

    const experience = expSection ? parseExperience(expSection) : [];
    const education = eduSection ? parseEducation(eduSection) : [];
    const raw_text_preview = text.slice(0, 2500);

    return NextResponse.json(
      {
        ok: true,
        experience,
        education,
        raw_text_preview,
        extracted: {
          experience,
          education,
          raw_text_preview,
        },
      },
      {
        headers: {
          'X-CareerOps-ResumeImport-Version': 'v4-role-company-fix',
        },
      }
    );
  } catch (e: any) {
    return NextResponse.json(
      {
        error: `Resume import failed at step="${step}": ${e?.message || 'unknown error'}`,
      },
      { status: 500 }
    );
  }
}
