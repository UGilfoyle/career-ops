/**
 * Single-column ATS Classic template (mirrors templates/ats-template-professional.html).
 * Kept as a TS string so client preview and server export share one source.
 */
export const ATS_PROFESSIONAL_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{NAME}} - Resume</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @page { size: A4; margin: 0.5in; }
        body {
            font-family: Arial, Helvetica, sans-serif;
            font-size: 10pt;
            line-height: 1.25;
            color: #111;
            background: #fff;
        }
        .container { max-width: 100%; margin: 0 auto; }
        header { text-align: center; margin-bottom: 10px; }
        h1 {
            font-size: 18pt;
            font-weight: 800;
            letter-spacing: 0.5px;
            margin-bottom: 4px;
        }
        .contact { font-size: 9pt; color: #222; margin-bottom: 2px; }
        .contact a { color: #111; text-decoration: none; }
        .top-rule { margin-top: 10px; border-top: 2px solid #111; }
        section { margin-top: 10px; }
        h2 {
            font-size: 9.5pt;
            font-weight: 800;
            letter-spacing: 0.8px;
            text-transform: uppercase;
            margin-bottom: 4px;
        }
        .rule { border-top: 1px solid #111; margin-bottom: 6px; }
        .skills-lines { font-size: 9pt; }
        .skill-line { margin-bottom: 3px; }
        .skill-label { font-weight: 800; }
        .job { margin-bottom: 10px; page-break-inside: avoid; }
        .job-header {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            font-size: 9.5pt;
            margin-bottom: 2px;
        }
        .job-title { font-weight: 800; }
        .job-company { font-weight: 600; }
        .job-dates { font-weight: 700; }
        .job ul { list-style-type: disc; margin-left: 18px; margin-top: 4px; }
        .job li { margin-bottom: 2px; }
        .summary-block {
            font-size: 9.5pt;
            line-height: 1.42;
            color: #222;
            white-space: pre-line;
            text-align: left;
        }
        .edu { font-size: 9.5pt; }
        @media print { a { color: #111; text-decoration: none; } }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>{{NAME}}</h1>
            <div class="contact">{{LOCATION}} · {{EMAIL}} · {{PHONE}}</div>
            <div class="contact">
                <a href="{{LINKEDIN_URL}}">{{LINKEDIN_DISPLAY}}</a>{{PORTFOLIO_LINK}}
            </div>
            <div class="top-rule"></div>
        </header>
        <section>
            <h2>Professional Summary</h2>
            <div class="rule"></div>
            <p class="summary-block">{{SUMMARY_TEXT}}</p>
        </section>
        <section style="display: {{SKILLS_DISPLAY}};">
            <h2>Technical Skills</h2>
            <div class="rule"></div>
            <div class="skills-lines">{{SKILLS_LINES}}</div>
        </section>
        <section style="display: {{EXPERIENCE_DISPLAY}};">
            <h2>Professional Experience</h2>
            <div class="rule"></div>
            {{EXPERIENCE}}
        </section>
        <section style="display: {{ACHIEVEMENTS_DISPLAY}};">
            <h2>Selected Achievements</h2>
            <div class="rule"></div>
            <div class="edu">{{ACHIEVEMENTS}}</div>
        </section>
        <section style="display: {{EDUCATION_DISPLAY}};">
            <h2>Education</h2>
            <div class="rule"></div>
            <div class="edu">{{EDUCATION}}</div>
        </section>
    </div>
</body>
</html>
`;

export const TEMPLATE_REGISTRY: Record<string, string> = {
  'ats-professional': ATS_PROFESSIONAL_TEMPLATE,
};

export function getTemplateHtml(templateId?: string): string {
  const id = templateId || 'ats-professional';
  return TEMPLATE_REGISTRY[id] || ATS_PROFESSIONAL_TEMPLATE;
}
