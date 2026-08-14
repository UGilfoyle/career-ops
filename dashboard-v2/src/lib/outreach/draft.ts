import { fallbackDraft, parseDraftJson, type OutreachDraft } from './parse';
import type { ResearchBundle } from './research';

function isPlaceholderKey(key: string): boolean {
  if (!key) return true;
  const lower = key.toLowerCase();
  return lower.includes('your_') || lower.includes('placeholder') || lower.startsWith('your');
}

function isGithubModelsUrl(url: string): boolean {
  return String(url || '').includes('models.github.ai');
}

async function completeChat(system: string, user: string): Promise<string | null> {
  const mistralKey = process.env.MISTRAL_API_KEY || '';
  const deepseekKey = process.env.DEEPSEEK_API_KEY || '';
  const geminiKey = process.env.GEMINI_API_KEY || '';
  const openrouterKey = process.env.OPENROUTER_API_KEY || '';
  const groqKey = process.env.GROQ_API_KEY || '';

  type Attempt = () => Promise<string>;
  const attempts: Attempt[] = [];

  const pushOpenAi = (apiKey: string, baseUrl: string, model: string, extra: Record<string, string> = {}) => {
    if (!apiKey || isPlaceholderKey(apiKey) || isGithubModelsUrl(baseUrl)) return;
    attempts.push(async () => {
      let url = baseUrl.trim().replace(/\/$/, '');
      if (!url.endsWith('/chat/completions')) url = `${url}/chat/completions`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          ...extra,
        },
        body: JSON.stringify({
          model,
          temperature: 0.4,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
      });
      const bodyText = await response.text();
      if (!response.ok) throw new Error(`${response.status} ${bodyText.slice(0, 200)}`);
      const result = JSON.parse(bodyText) as { choices?: Array<{ message?: { content?: string } }> };
      const content = result.choices?.[0]?.message?.content || '';
      if (!content) throw new Error('empty');
      return content;
    });
  };

  pushOpenAi(mistralKey, 'https://api.mistral.ai/v1', process.env.MISTRAL_MODEL || 'mistral-small-latest');
  if (openrouterKey) {
    pushOpenAi(
      openrouterKey,
      'https://openrouter.ai/api/v1',
      (process.env.OPENROUTER_MODEL || 'openrouter/free').split(',')[0].trim(),
      {
        'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'https://careerops.dpdns.org',
        'X-Title': process.env.OPENROUTER_APP_NAME || 'career-ops',
      },
    );
  }
  if (geminiKey && !isPlaceholderKey(geminiKey)) {
    attempts.push(async () => {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: 'user', parts: [{ text: user }] }],
            generationConfig: { temperature: 0.4 },
          }),
        },
      );
      if (!response.ok) throw new Error(`gemini ${response.status}`);
      const result = await response.json();
      const content = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (!content) throw new Error('empty');
      return content;
    });
  }
  pushOpenAi(groqKey, 'https://api.groq.com/openai/v1', process.env.GROQ_MODEL || 'llama-3.3-70b-versatile');
  pushOpenAi(deepseekKey, 'https://api.deepseek.com', process.env.DEEPSEEK_MODEL || 'deepseek-chat');

  for (const attempt of attempts) {
    try {
      return await attempt();
    } catch {
      /* next provider */
    }
  }
  return null;
}

export async function draftOutreach(opts: {
  research: ResearchBundle;
  resumeContext?: unknown;
  candidateName?: string;
}): Promise<{ draft: OutreachDraft; llm: boolean }> {
  const { research } = opts;
  const proof = extractProofLine(opts.resumeContext);
  const system = `You write short hiring outreach emails. Use only facts in the research notes. Never invent metrics, titles, or people. No em-dashes. No cliches (passionate, leveraged, spearheaded). JSON only: {"subject":"...","body":"...","hook_used":"..."}. Body under 150 words, 4 short paragraphs, sign with the candidate first name if given.`;
  const user = [
    `Company: ${research.company}`,
    `Role: ${research.role}`,
    `Candidate: ${opts.candidateName || 'the candidate'}`,
    `Proof line: ${proof || '(use a generic production-systems line, no fake numbers)'}`,
    `JD snippet: ${research.jdSnippet || '(none)'}`,
    `Research notes:\n${research.notes.slice(0, 12).join('\n')}`,
  ].join('\n');

  const raw = await completeChat(system, user);
  const parsed = raw ? parseDraftJson(raw) : null;
  if (parsed) return { draft: parsed, llm: true };
  return {
    draft: fallbackDraft({
      company: research.company,
      role: research.role,
      candidateName: opts.candidateName,
      hook: research.notes[0]?.replace(/^[a-z]+:\s*/i, '').slice(0, 180),
      proof: proof || undefined,
    }),
    llm: false,
  };
}

function extractProofLine(resumeContext: unknown): string {
  if (!resumeContext || typeof resumeContext !== 'object') return '';
  const ctx = resumeContext as Record<string, unknown>;
  const exp = ctx.experience || ctx.roles || ctx.work;
  if (Array.isArray(exp) && exp[0]) {
    const first = exp[0] as Record<string, unknown>;
    const bullets = first.bullets || first.highlights || first.achievements;
    if (Array.isArray(bullets) && bullets[0]) return String(bullets[0]).slice(0, 280);
    if (first.summary) return String(first.summary).slice(0, 280);
  }
  if (typeof ctx.summary === 'string') return ctx.summary.slice(0, 280);
  return '';
}
