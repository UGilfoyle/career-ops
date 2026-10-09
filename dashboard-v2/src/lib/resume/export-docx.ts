import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  HeadingLevel,
  ExternalHyperlink,
} from 'docx';
import type { ResumeContext, ExperienceEntry, EducationEntry } from './types';
import { extractTechFromTexts, renderCategorizedSkills } from './skills-html-bridge';
import { formatEducationLine } from '../education-format';

interface TemplateTheme {
  font: string;
  primaryColor: string;
  ruleColor: string;
  nameAlign: (typeof AlignmentType)[keyof typeof AlignmentType];
  contactAlign: (typeof AlignmentType)[keyof typeof AlignmentType];
  isExecutive?: boolean;
}

const TEMPLATE_THEMES: Record<string, TemplateTheme> = {
  'ats-mit': {
    font: 'Georgia',
    primaryColor: '000000',
    ruleColor: '000000',
    nameAlign: AlignmentType.CENTER,
    contactAlign: AlignmentType.CENTER,
  },
  'ats-berkeley': {
    font: 'Calibri',
    primaryColor: '003262',
    ruleColor: '003262',
    nameAlign: AlignmentType.LEFT,
    contactAlign: AlignmentType.LEFT,
  },
  'ats-wharton': {
    font: 'Georgia',
    primaryColor: '1E3A8A',
    ruleColor: '1E3A8A',
    nameAlign: AlignmentType.CENTER,
    contactAlign: AlignmentType.CENTER,
    isExecutive: true,
  },
  'ats-iit': {
    font: 'Arial',
    primaryColor: '111827',
    ruleColor: '111827',
    nameAlign: AlignmentType.LEFT,
    contactAlign: AlignmentType.LEFT,
  },
  'ats-stanford': {
    font: 'Arial',
    primaryColor: '8C1515',
    ruleColor: '8C1515',
    nameAlign: AlignmentType.LEFT,
    contactAlign: AlignmentType.LEFT,
  },
  'ats-faang': {
    font: 'Arial',
    primaryColor: '111827',
    ruleColor: '111827',
    nameAlign: AlignmentType.LEFT,
    contactAlign: AlignmentType.LEFT,
  },
  'ats-executive': {
    font: 'Georgia',
    primaryColor: '1F2937',
    ruleColor: '374151',
    nameAlign: AlignmentType.CENTER,
    contactAlign: AlignmentType.CENTER,
    isExecutive: true,
  },
  'ats-ivy': {
    font: 'Georgia',
    primaryColor: '1F2937',
    ruleColor: '4B5563',
    nameAlign: AlignmentType.CENTER,
    contactAlign: AlignmentType.CENTER,
  },
};

const DEFAULT_THEME: TemplateTheme = {
  font: 'Calibri',
  primaryColor: '111827',
  ruleColor: '111827',
  nameAlign: AlignmentType.LEFT,
  contactAlign: AlignmentType.LEFT,
};

function getTheme(templateId?: string): TemplateTheme {
  if (!templateId) return DEFAULT_THEME;
  return TEMPLATE_THEMES[templateId] || DEFAULT_THEME;
}

function cleanText(raw?: string): string {
  if (!raw) return '';
  return String(raw)
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/^[•\-*▸►▶]\s*/, '')
    .replace(/[\u00ad\u200b-\u200d\uFEFF\uFFFD]/g, '')
    .trim();
}

/**
 * Creates an ATS-safe section heading paragraph with bottom border.
 */
function createSectionHeader(title: string, theme: TemplateTheme): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 180, after: 80 },
    border: {
      bottom: {
        style: BorderStyle.SINGLE,
        size: 12, // 1.5 pt
        color: theme.ruleColor,
      },
    },
    children: [
      new TextRun({
        text: title.toUpperCase(),
        bold: true,
        font: theme.font,
        size: 20, // 10pt
        color: theme.ruleColor,
      }),
    ],
  });
}

/**
 * Generates an ECMA-376 compliant, single-column, 100% ATS-unblockable DOCX resume.
 */
export async function generateResumeDocx(
  ctx: ResumeContext,
  opts?: { templateId?: string; jdText?: string }
): Promise<Buffer> {
  const templateId = opts?.templateId || ctx.studio?.template_id || 'ats-professional';
  const theme = getTheme(templateId);

  const candidate = ctx.candidate || {};
  const narrative = ctx.narrative || {};
  const experience = (ctx.experience || []).filter((e) => e && (e.role || e.company));
  const education = (ctx.education || []).filter((e) => e && (e.degree || e.school));

  const docChildren: (Paragraph | Table)[] = [];

  // ── 1. CANDIDATE HEADER (Name & Subtitle) ──
  const fullName = candidate.full_name || 'Candidate Name';
  docChildren.push(
    new Paragraph({
      alignment: theme.nameAlign,
      spacing: { before: 0, after: 60 },
      children: [
        new TextRun({
          text: fullName,
          bold: true,
          font: theme.font,
          size: 38, // 19pt
          color: theme.primaryColor,
        }),
      ],
    })
  );

  if (theme.isExecutive || narrative.headline) {
    const subtitle = narrative.headline || 'EXECUTIVE LEADERSHIP & STRATEGIC INNOVATION';
    docChildren.push(
      new Paragraph({
        alignment: theme.nameAlign,
        spacing: { before: 0, after: 60 },
        children: [
          new TextRun({
            text: subtitle.toUpperCase(),
            bold: true,
            font: theme.font,
            size: 17, // 8.5pt
            color: theme.ruleColor,
          }),
        ],
      })
    );
  }

  // ── 2. CONTACT BAR ──
  const contactParts: (TextRun | ExternalHyperlink)[] = [];
  const addSeparator = () => {
    if (contactParts.length > 0) {
      contactParts.push(
        new TextRun({
          text: '  ·  ',
          font: theme.font,
          size: 17, // 8.5pt
          color: '9CA3AF',
        })
      );
    }
  };

  if (candidate.location) {
    addSeparator();
    contactParts.push(
      new TextRun({
        text: candidate.location,
        font: theme.font,
        size: 17,
        color: '4B5563',
      })
    );
  }

  if (candidate.phone) {
    addSeparator();
    contactParts.push(
      new TextRun({
        text: candidate.phone,
        font: theme.font,
        size: 17,
        color: '4B5563',
      })
    );
  }

  if (candidate.email) {
    addSeparator();
    contactParts.push(
      new ExternalHyperlink({
        children: [
          new TextRun({
            text: candidate.email,
            font: theme.font,
            size: 17,
            color: '2563EB',
            underline: {},
          }),
        ],
        link: `mailto:${candidate.email}`,
      })
    );
  }

  if (candidate.linkedin) {
    addSeparator();
    const cleanLink = candidate.linkedin.replace(/^https?:\/\//i, '').replace(/\/$/, '');
    contactParts.push(
      new ExternalHyperlink({
        children: [
          new TextRun({
            text: cleanLink,
            font: theme.font,
            size: 17,
            color: '2563EB',
            underline: {},
          }),
        ],
        link: candidate.linkedin.startsWith('http') ? candidate.linkedin : `https://${candidate.linkedin}`,
      })
    );
  }

  if (candidate.github) {
    addSeparator();
    const cleanGh = candidate.github.replace(/^https?:\/\//i, '').replace(/\/$/, '');
    contactParts.push(
      new ExternalHyperlink({
        children: [
          new TextRun({
            text: cleanGh,
            font: theme.font,
            size: 17,
            color: '2563EB',
            underline: {},
          }),
        ],
        link: candidate.github.startsWith('http') ? candidate.github : `https://${candidate.github}`,
      })
    );
  }

  if (contactParts.length > 0) {
    docChildren.push(
      new Paragraph({
        alignment: theme.contactAlign,
        spacing: { before: 0, after: 140 },
        children: contactParts,
      })
    );
  }

  // ── 3. SUMMARY SECTION ──
  const summaryText = narrative.exit_story || '';
  if (summaryText.trim()) {
    const summaryHeader = theme.isExecutive ? 'Executive Profile & Strategic Vision' : 'Professional Summary';
    docChildren.push(createSectionHeader(summaryHeader, theme));
    docChildren.push(
      new Paragraph({
        spacing: { before: 40, after: 120 },
        children: [
          new TextRun({
            text: cleanText(summaryText),
            font: theme.font,
            size: 19, // 9.5pt
            color: '374151',
          }),
        ],
      })
    );
  }

  // ── 4. TECHNICAL SKILLS & COMPETENCIES ──
  const extractedTech = extractTechFromTexts(experience.flatMap((e) => e.bullets || []));
  const skillHtml = renderCategorizedSkills(
    narrative.superpowers || [],
    extractedTech,
    opts?.jdText || ''
  );

  const categoryMatches = Array.from(
    skillHtml.matchAll(/<span class="skill-label">([^<]+)<\/span>\s*([^<]+)<\/div>/g)
  );

  if (categoryMatches.length > 0 || (narrative.superpowers && narrative.superpowers.length > 0)) {
    const skillsHeader = theme.isExecutive
      ? 'Strategic Competencies & Expertise'
      : 'Core Technical Competencies';
    docChildren.push(createSectionHeader(skillsHeader, theme));

    if (categoryMatches.length > 0) {
      for (const match of categoryMatches) {
        const label = match[1].trim();
        const items = match[2].trim();
        docChildren.push(
          new Paragraph({
            spacing: { before: 30, after: 30 },
            children: [
              new TextRun({
                text: label.endsWith(':') ? `${label} ` : `${label}: `,
                bold: true,
                font: theme.font,
                size: 18, // 9pt
                color: theme.primaryColor,
              }),
              new TextRun({
                text: items,
                font: theme.font,
                size: 18,
                color: '374151',
              }),
            ],
          })
        );
      }
    } else if (narrative.superpowers && narrative.superpowers.length > 0) {
      docChildren.push(
        new Paragraph({
          spacing: { before: 30, after: 30 },
          children: [
            new TextRun({
              text: 'Key Expertise: ',
              bold: true,
              font: theme.font,
              size: 18,
              color: theme.primaryColor,
            }),
            new TextRun({
              text: narrative.superpowers.join(' · '),
              font: theme.font,
              size: 18,
              color: '374151',
            }),
          ],
        })
      );
    }
  }

  // ── 5. PROFESSIONAL EXPERIENCE ──
  if (experience.length > 0) {
    docChildren.push(createSectionHeader('Professional Experience', theme));

    for (const exp of experience) {
      const role = exp.role || 'Role';
      const company = exp.company || 'Company';
      const period = exp.period || '';
      const location = exp.location || '';

      // Two-column single-row table without borders (Left: Role & Company, Right: Period & Location)
      const noBorder = {
        style: BorderStyle.NONE,
        size: 0,
        color: 'auto',
      };
      const bordersNone = {
        top: noBorder,
        bottom: noBorder,
        left: noBorder,
        right: noBorder,
      };

      const expHeaderTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: bordersNone,
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 68, type: WidthType.PERCENTAGE },
                borders: bordersNone,
                children: [
                  new Paragraph({
                    spacing: { before: 80, after: 20 },
                    children: [
                      new TextRun({
                        text: role,
                        bold: true,
                        font: theme.font,
                        size: 19, // 9.5pt
                        color: '111827',
                      }),
                      new TextRun({
                        text: `  —  ${company}`,
                        font: theme.font,
                        size: 19,
                        color: '4B5563',
                      }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                width: { size: 32, type: WidthType.PERCENTAGE },
                borders: bordersNone,
                children: [
                  new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    spacing: { before: 80, after: 20 },
                    children: [
                      new TextRun({
                        text: location ? `${location} | ${period}` : period,
                        font: theme.font,
                        size: 17, // 8.5pt
                        color: '6B7280',
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      });

      docChildren.push(expHeaderTable);

      // Bullets
      const bullets = exp.bullets || [];
      for (const bullet of bullets) {
        const cleaned = cleanText(bullet);
        if (!cleaned) continue;

        docChildren.push(
          new Paragraph({
            bullet: { level: 0 },
            spacing: { before: 20, after: 20 },
            children: [
              new TextRun({
                text: cleaned,
                font: theme.font,
                size: 18, // 9pt
                color: '374151',
              }),
            ],
          })
        );
      }
    }
  }

  // ── 6. SELECTED ACHIEVEMENTS ──
  const proofPoints = narrative.proof_points || [];
  if (proofPoints.length > 0) {
    const achHeader = theme.isExecutive
      ? 'Strategic Achievements & Business Impact'
      : 'Selected Technical Achievements';
    docChildren.push(createSectionHeader(achHeader, theme));

    for (const p of proofPoints) {
      const name = p.name || '';
      const metric = p.hero_metric || '';
      if (!name && !metric) continue;

      docChildren.push(
        new Paragraph({
          bullet: { level: 0 },
          spacing: { before: 20, after: 20 },
          children: [
            new TextRun({
              text: metric ? `${metric}: ` : '',
              bold: true,
              font: theme.font,
              size: 18,
              color: theme.primaryColor,
            }),
            new TextRun({
              text: cleanText(name),
              font: theme.font,
              size: 18,
              color: '374151',
            }),
          ],
        })
      );
    }
  }

  // ── 7. EDUCATION ──
  if (education.length > 0) {
    docChildren.push(createSectionHeader('Education & Credentials', theme));

    for (const edu of education) {
      const formatted = formatEducationLine(edu as any);
      docChildren.push(
        new Paragraph({
          spacing: { before: 40, after: 40 },
          children: [
            new TextRun({
              text: formatted || `${edu.degree || ''} — ${edu.school || ''} (${edu.period || ''})`,
              font: theme.font,
              size: 18, // 9pt
              color: '374151',
            }),
          ],
        })
      );
    }
  }

  // Assemble full Word document
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 720, // 0.5 in
              bottom: 720,
              left: 720,
              right: 720,
            },
          },
        },
        children: docChildren,
      },
    ],
  });

  return await Packer.toBuffer(doc);
}
