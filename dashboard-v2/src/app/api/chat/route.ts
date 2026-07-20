import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';

/** Normalize GitHub Models base URL → .../inference/chat/completions */
function resolveGithubModelsUrl(baseUrl: string): string {
  let u = (baseUrl || 'https://models.github.ai/inference').trim().replace(/\/$/, '');
  if (u.endsWith('/chat/completions')) return u;
  // OpenAI-compat clients often append /v1 — GitHub Models does not use it
  u = u.replace(/\/v1$/, '');
  if (u.includes('models.github.ai') && !u.includes('/inference')) {
    u = 'https://models.github.ai/inference';
  }
  return `${u}/chat/completions`;
}

/** GitHub Models requires {publisher}/{model} (e.g. openai/gpt-4o-mini) */
function resolveGithubModelId(model: string): string {
  const m = (model || 'openai/gpt-4o-mini').trim();
  if (m.includes('/')) return m;
  return `openai/${m}`;
}

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

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = Number.parseInt(String(session.user.id), 10);

    // 2. Parse request payload
    const { messages } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Messages are required' }, { status: 400 });
    }

    // 3. Fetch user profile context (include GitHub PAT + openai_key for Models)
    const profileRows = await sql`
      SELECT resume_context, targeting_keywords, hf_token, openai_key
      FROM user_profiles
      WHERE user_id = ${userId}
      LIMIT 1
    `;
    const profile = profileRows[0] || {};
    const resumeContext = profile.resume_context || {};
    const targetingKeywords = profile.targeting_keywords || { positive: [], negative: [] };
    const userHfToken = profile.hf_token || '';
    const githubPatFromProfile =
      (resumeContext as { github_settings?: { pat?: string } })?.github_settings?.pat || '';
    const openaiKeyFromProfile = profile.openai_key || '';

    // 4. Construct System Instructions
    const systemPrompt = `You are Career-Ops Copilot, an elite AI career strategist and job coach. Your job is to help the user navigate their job search, prepare for interviews, analyze skill gaps, draft cover letters, and suggest outreach messages (e.g., for LinkedIn).

Here is the user's uploaded career profile (resume context):
${JSON.stringify(resumeContext, null, 2)}

Here are their targeting keywords (keywords they look for or avoid in jobs):
Positive: ${JSON.stringify(targetingKeywords.positive || [])}
Negative: ${JSON.stringify(targetingKeywords.negative || [])}

Instructions:
1. Always reference the user's specific experience and skills naturally.
2. Keep your answers professional, actionable, and structured (use bullet points and markdown where helpful).
3. If the user asks for LinkedIn outreach messages, draft messages that are concise, conversational, and personalized. Avoid spammy-sounding templates.
4. If writing code snippets, explain them briefly.`;

    // 5. Resolve GitHub Models credentials (env → profile PAT → openai_key)
    const fallbackKey =
      process.env.FALLBACK_API_KEY ||
      process.env.GITHUB_PAT ||
      process.env.GITHUB_TOKEN ||
      githubPatFromProfile ||
      openaiKeyFromProfile ||
      '';
    const fallbackUrl = process.env.FALLBACK_BASE_URL || 'https://models.github.ai/inference';
    const fallbackModel = resolveGithubModelId(process.env.FALLBACK_MODEL || 'openai/gpt-4o-mini');

    const deepseekKey = process.env.DEEPSEEK_API_KEY || '';
    const geminiKey = process.env.GEMINI_API_KEY || '';
    const hfToken = process.env.HUGGINGFACE_TOKEN || userHfToken || '';

    // Attempt providers in priority order. Prefer GitHub Models (included with GitHub).
    const attempts: Array<() => Promise<{ content: string; provider: string }>> = [];

    // ── Attempt 1: GitHub Models ──
    if (!isPlaceholderKey(fallbackKey)) {
      attempts.push(async () => {
        const cleanUrl = resolveGithubModelsUrl(fallbackUrl);
        const response = await fetch(cleanUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            Authorization: `Bearer ${fallbackKey}`,
          },
          body: JSON.stringify({
            model: fallbackModel,
            messages: [
              { role: 'system', content: systemPrompt },
              ...messages.map((m: { role: string; content: string }) => ({
                role: m.role,
                content: m.content,
              })),
            ],
            temperature: 0.7,
          }),
        });

        if (!response.ok) {
          throw new Error(`GitHub Models failed with status ${response.status}: ${await response.text()}`);
        }
        const result = await response.json();
        return {
          content: result.choices?.[0]?.message?.content || '',
          provider: `GitHub Models (${fallbackModel})`,
        };
      });
    }

    // ── Attempt 2: Gemini ──
    if (geminiKey && !isPlaceholderKey(geminiKey)) {
      attempts.push(async () => {
        const contents = messages.map((m: { role: string; content: string }) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        }));

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              systemInstruction: {
                parts: [{ text: systemPrompt }],
              },
              contents,
              generationConfig: {
                temperature: 0.7,
              },
            }),
          }
        );

        if (!response.ok) {
          throw new Error(`Gemini API failed with status ${response.status}: ${await response.text()}`);
        }
        const result = await response.json();
        return { content: result.candidates?.[0]?.content?.parts?.[0]?.text || '', provider: 'Gemini' };
      });
    }

    // ── Attempt 3: DeepSeek Chat ──
    if (deepseekKey && !isPlaceholderKey(deepseekKey)) {
      attempts.push(async () => {
        const response = await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${deepseekKey}`,
          },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [
              { role: 'system', content: systemPrompt },
              ...messages.map((m: { role: string; content: string }) => ({
                role: m.role,
                content: m.content,
              })),
            ],
            temperature: 0.7,
          }),
        });

        if (!response.ok) {
          const body = await response.text();
          throw new Error(`DeepSeek API failed with status ${response.status}: ${body}`);
        }
        const result = await response.json();
        return { content: result.choices?.[0]?.message?.content || '', provider: 'DeepSeek' };
      });
    }

    // ── Attempt 4: Hugging Face Router (working free-tier model) ──
    if (hfToken && !isPlaceholderKey(hfToken)) {
      attempts.push(async () => {
        const hfModel = process.env.HUGGINGFACE_MODEL || 'HuggingFaceH4/zephyr-7b-beta';
        const response = await fetch('https://router.huggingface.co/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${hfToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: hfModel,
            messages: [
              { role: 'system', content: systemPrompt },
              ...messages.map((m: { role: string; content: string }) => ({
                role: m.role,
                content: m.content,
              })),
            ],
            temperature: 0.7,
            max_tokens: 2048,
          }),
        });

        if (!response.ok) {
          throw new Error(`HuggingFace API failed with status ${response.status}: ${await response.text()}`);
        }
        const result = await response.json();
        return {
          content: result.choices?.[0]?.message?.content || '',
          provider: `HuggingFace (${hfModel})`,
        };
      });
    }

    // Run attempts sequentially. If one fails, catch and log, then move to the next.
    let finalResult = null;
    const errors: string[] = [];

    for (let i = 0; i < attempts.length; i++) {
      try {
        finalResult = await attempts[i]();
        break;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`Attempt ${i + 1} failed: ${message}`);
        errors.push(message);
      }
    }

    if (finalResult) {
      return NextResponse.json(finalResult);
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { error: `All configured LLM providers failed:\n${errors.join('\n')}` },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        error:
          'No LLM Provider configured. Set FALLBACK_API_KEY (GitHub PAT with models:read), or add a GitHub PAT in Settings → GitHub Automation. Optionally: GEMINI_API_KEY, DEEPSEEK_API_KEY, HUGGINGFACE_TOKEN.',
      },
      { status: 400 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
