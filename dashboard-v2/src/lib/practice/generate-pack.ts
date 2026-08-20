import { createHash } from 'crypto';
import {
  parsePracticePackJson,
  type PracticePackJson,
} from './schema';
import { assessJdPracticeFit, extractPracticeKeywords } from './jd-keywords';
import { buildDeterministicPack, coercePracticePack } from './validate-pack';

function isPlaceholderKey(key: string): boolean {
  if (!key) return true;
  const lower = key.toLowerCase();
  return (
    lower.includes('your_') ||
    lower.includes('placeholder') ||
    lower === 'your' ||
    lower.startsWith('your')
  );
}

function isGithubModelsUrl(url: string): boolean {
  return String(url || '').includes('models.github.ai');
}

function isGithubPatKey(key: string): boolean {
  return /^gh[pousr]_|github_pat_/i.test(String(key || '').trim());
}

export function hashJdText(jdText: string): string {
  return createHash('sha256').update(String(jdText || '').trim()).digest('hex').slice(0, 32);
}

function stripJsonFence(raw: string): string {
  let text = String(raw || '').trim();
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) text = text.slice(start, end + 1);
  return text;
}

async function callLlm(systemPrompt: string, userPrompt: string): Promise<string> {
  const mistralKey = process.env.MISTRAL_API_KEY || '';
  const deepseekKey = process.env.DEEPSEEK_API_KEY || '';
  const geminiKey = process.env.GEMINI_API_KEY || '';
  const openrouterKey = process.env.OPENROUTER_API_KEY || '';
  const groqKey = process.env.GROQ_API_KEY || '';
  const togetherKey = process.env.TOGETHER_API_KEY || '';
  const fallbackUrl = process.env.FALLBACK_BASE_URL || '';
  const fallbackKeyRaw = process.env.FALLBACK_API_KEY || '';
  const fallbackKey =
    fallbackKeyRaw && !isGithubPatKey(fallbackKeyRaw) ? fallbackKeyRaw : '';
  const fallbackModel = process.env.FALLBACK_MODEL || 'deepseek-chat';

  const attempts: Array<() => Promise<string>> = [];

  const pushOpenAiCompat = (
    name: string,
    apiKey: string,
    baseUrl: string,
    model: string,
    extraHeaders: Record<string, string> = {},
    skipIf?: (status: number, body: string) => boolean,
  ) => {
    if (!apiKey || isPlaceholderKey(apiKey) || isGithubModelsUrl(baseUrl)) return;
    attempts.push(async () => {
      let url = baseUrl.trim().replace(/\/$/, '');
      if (!url.endsWith('/chat/completions')) url = `${url}/chat/completions`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          ...extraHeaders,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.4,
        }),
      });
      const bodyText = await response.text();
      if (!response.ok) {
        if (skipIf?.(response.status, bodyText)) {
          throw new Error(`${name} skipped (${response.status})`);
        }
        throw new Error(`${name} failed with status ${response.status}: ${bodyText}`);
      }
      const result = JSON.parse(bodyText);
      return String(result.choices?.[0]?.message?.content || '');
    });
  };

  const openRouterHeaders = {
    'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'https://careerops.dpdns.org',
    'X-Title': process.env.OPENROUTER_APP_NAME || 'career-ops',
  };

  pushOpenAiCompat(
    'Mistral',
    mistralKey,
    'https://api.mistral.ai/v1',
    process.env.MISTRAL_MODEL || 'mistral-small-latest',
  );

  const openRouterModels = (
    process.env.OPENROUTER_MODELS ||
    process.env.OPENROUTER_MODEL ||
    'openrouter/free,google/gemma-2-9b-it:free,meta-llama/llama-3.2-3b-instruct:free'
  )
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);

  for (const model of openRouterModels) {
    pushOpenAiCompat(
      'OpenRouter',
      openrouterKey,
      'https://openrouter.ai/api/v1',
      model,
      openRouterHeaders,
      (status, body) => status === 402 || /insufficient balance/i.test(body),
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
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            generationConfig: { temperature: 0.4 },
          }),
        },
      );
      if (!response.ok) {
        throw new Error(`Gemini failed ${response.status}: ${await response.text()}`);
      }
      const result = await response.json();
      return String(result.candidates?.[0]?.content?.parts?.[0]?.text || '');
    });
  }

  pushOpenAiCompat(
    'Groq',
    groqKey,
    'https://api.groq.com/openai/v1',
    process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
  );
  pushOpenAiCompat(
    'Together',
    togetherKey,
    'https://api.together.xyz/v1',
    process.env.TOGETHER_MODEL || 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
  );
  pushOpenAiCompat(
    'DeepSeek',
    deepseekKey,
    'https://api.deepseek.com',
    process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    {},
    (status, body) => status === 402 || /insufficient balance/i.test(body),
  );

  if (
    fallbackKey &&
    !isPlaceholderKey(fallbackKey) &&
    fallbackUrl &&
    !isGithubModelsUrl(fallbackUrl)
  ) {
    pushOpenAiCompat('Custom', fallbackKey, fallbackUrl, fallbackModel);
  }

  const errors: string[] = [];
  for (let i = 0; i < attempts.length; i++) {
    try {
      const content = await attempts[i]();
      if (content.trim()) return content;
      errors.push(`Attempt ${i + 1}: empty content`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (!message.includes(' skipped (')) errors.push(message);
    }
  }

  if (errors.length > 0) {
    throw new Error(`All LLM providers failed:\n${errors.join('\n')}`);
  }
  throw new Error(
    'No LLM provider configured. Set MISTRAL_API_KEY, OPENROUTER_API_KEY, GEMINI_API_KEY, GROQ_API_KEY, or DEEPSEEK_API_KEY.',
  );
}

function buildSystemPrompt(fitNote: string): string {
  return `You are an interview coach for senior backend / platform engineers.
Generate a JD-linked practice pack as STRICT JSON only (no markdown).

Rules:
- Produce AT LEAST 20 questions: coding 8, systemDesign 5, behavioral 7 (you may add 1–2 extras within max caps).
- Personalize using the candidate profileHints (tech stack, recent employers/roles, competencies). Reference their real stack in coding/systemDesign prompts when relevant.
- Tie behavioral prompts to their experience themes (ownership, incidents, mentoring, cross-team) without inventing fake employers.
- Target interviews for the given company/role from the JD.
- Flavor coding prompts with JD stack keywords when relevant.
- ${fitNote}
- If fit is low (functional/vendor HCM/admin JD): use general backend/platform prompts. Do NOT invent deep Oracle Fusion HCM, BIP, OTB, or admin configuration quizzes.
- coding: exactly 8 items (max 10). Each needs id, title, prompt, outline (short hints, NOT a full solution dump), optional difficulty (easy|medium|hard), optional stackHints[].
- systemDesign: exactly 5 items (max 6) with id, title, prompt, outline.
- behavioral: exactly 7 STAR-style prompts (max 8) with id, title, prompt, outline, optional starHint.
- Include fit: { tier, note } matching the assessed fit.
- Include keywords array (echo provided keywords; do not invent irrelevant vendor skills).
- Keep outlines to concise bullet-style hints (what to cover), not complete code.`;
}

export type PracticeProfileHints = {
  headline?: string;
  superpowers?: string[];
  targetingPositive?: string[];
  competencies?: string[];
  experienceDigest?: Array<{
    company?: string;
    role?: string;
    period?: string;
    bullets?: string[];
  }>;
};

export type GeneratePackInput = {
  jdText: string;
  company?: string;
  role?: string;
  profileHints?: PracticeProfileHints;
};

export type GeneratePackResult = {
  pack: PracticePackJson;
  keywords: string[];
  jdHash: string;
  providerRaw?: string;
};

/** Deterministic pack for tests / offline fallback. */
export function buildOfflinePracticePack(input: {
  jdText?: string;
  company: string;
  role: string;
  keywords: string[];
  fit?: { tier: 'strong' | 'partial' | 'low'; note: string };
}): PracticePackJson {
  const pack = buildDeterministicPack({
    jdText: input.jdText || '',
    company: input.company,
    role: input.role,
    keywords: input.keywords,
  });
  if (input.fit) return parsePracticePackJson({ ...pack, fit: input.fit });
  return pack;
}

export async function generatePracticePack(input: GeneratePackInput): Promise<GeneratePackResult> {
  const jdText = String(input.jdText || '').trim();
  if (jdText.length < 40) {
    throw new Error('JD text too short — paste a fuller job description (40+ chars).');
  }

  const keywords = await extractPracticeKeywords(jdText, 18);
  const fit = assessJdPracticeFit(jdText, keywords);
  const company = String(input.company || '').trim();
  const role = String(input.role || '').trim();
  const jdHash = hashJdText(jdText);

  if (process.env.PRACTICE_OFFLINE_FALLBACK === '1') {
    return {
      pack: buildOfflinePracticePack({ jdText, company, role, keywords, fit }),
      keywords,
      jdHash,
    };
  }

  const systemPrompt = buildSystemPrompt(fit.note);
  const userPrompt = JSON.stringify(
    {
      company,
      role,
      keywords,
      fit,
      profileHints: input.profileHints || {},
      jdExcerpt: jdText.slice(0, 6000),
      outputSchema: {
        company: 'string',
        role: 'string',
        keywords: 'string[]',
        fit: { tier: 'strong|partial|low', note: 'string' },
        coding: '8–10 items',
        systemDesign: '5–6 items',
        behavioral: '7–8 STAR items',
      },
      countsRequired: { coding: 8, systemDesign: 5, behavioral: 7, totalMin: 20 },
    },
    null,
    2,
  );

  try {
    const raw = await callLlm(systemPrompt, userPrompt);
    let parsed: unknown;
    try {
      parsed = JSON.parse(stripJsonFence(raw));
    } catch {
      throw new Error('LLM returned non-JSON practice pack');
    }

    // Ensure fit/keywords/company/role survive weak models
    const merged = {
      ...(parsed as Record<string, unknown>),
      company: (parsed as { company?: string }).company || company,
      role: (parsed as { role?: string }).role || role,
      keywords: Array.isArray((parsed as { keywords?: unknown }).keywords)
        ? (parsed as { keywords: string[] }).keywords
        : keywords,
      fit: (parsed as { fit?: unknown }).fit || fit,
    };

    const coerced = coercePracticePack(merged, {
      jdText,
      company,
      role,
      keywords,
    });
    const pack = coerced || parsePracticePackJson(merged);
    return { pack, keywords, jdHash };
  } catch (err) {
    if (process.env.PRACTICE_REQUIRE_LLM === '1') throw err;
    console.warn(
      '[practice] LLM pack failed, using offline fallback:',
      err instanceof Error ? err.message : err,
    );
    return {
      pack: buildOfflinePracticePack({ jdText, company, role, keywords, fit }),
      keywords,
      jdHash,
    };
  }
}
