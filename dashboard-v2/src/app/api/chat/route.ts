import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { auth } from '@/auth';
import { formatRetryHint } from '@/lib/rate-limit';
import { checkCopilotRateLimit } from '@/lib/billing/entitlements';
import { resolvePlanForCountry, planSubtitle } from '@/lib/billing/plans';
import { countryFromRequest } from '@/lib/billing/geo';

export const dynamic = 'force-dynamic';

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

/** Stale GitHub PATs cannot auth against DeepSeek/OpenRouter/etc. */
function isGithubPatKey(key: string): boolean {
  return /^gh[pousr]_|github_pat_/i.test(String(key || '').trim());
}

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = Number.parseInt(String(session.user.id), 10);

    const copilotLimit = await checkCopilotRateLimit(userId, session.user.email);
    if (!copilotLimit.ok) {
      const country = countryFromRequest(req);
      const plan = resolvePlanForCountry(country);
      return NextResponse.json(
        {
          error: 'copilot_rate_limit',
          message: copilotLimit.pro
            ? `Copilot limit reached. ${formatRetryHint(copilotLimit.retryAfterSec)}`
            : `Free Copilot limit: 10 messages every 2 hours. ${formatRetryHint(copilotLimit.retryAfterSec)} Upgrade to Pro for unlimited coaching.`,
          retryAfterSec: copilotLimit.retryAfterSec,
          remaining: copilotLimit.remaining,
          upgrade: !copilotLimit.pro,
          plan: { display: plan.display, subtitle: planSubtitle(plan) },
        },
        { status: 429 },
      );
    }

    // 2. Parse request payload
    const { messages } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Messages are required' }, { status: 400 });
    }

    // 3. Fetch user profile context
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

    const mistralKey = process.env.MISTRAL_API_KEY || '';
    const deepseekKey = process.env.DEEPSEEK_API_KEY || '';
    const geminiKey = process.env.GEMINI_API_KEY || '';
    const hfToken = process.env.HUGGINGFACE_TOKEN || userHfToken || '';
    let openrouterKey = process.env.OPENROUTER_API_KEY || '';
    const groqKey = process.env.GROQ_API_KEY || '';
    const togetherKey = process.env.TOGETHER_API_KEY || '';
    const fallbackUrl = process.env.FALLBACK_BASE_URL || '';
    const fallbackKeyRaw = process.env.FALLBACK_API_KEY || '';
    const fallbackKey =
      fallbackKeyRaw && !isGithubPatKey(fallbackKeyRaw) ? fallbackKeyRaw : '';
    const fallbackModel = process.env.FALLBACK_MODEL || 'deepseek-chat';
    if (fallbackKeyRaw && isGithubPatKey(fallbackKeyRaw)) {
      console.warn(
        'Ignoring FALLBACK_API_KEY: GitHub PAT cannot auth against non-GitHub LLM APIs. Use OPENROUTER_API_KEY / DEEPSEEK_API_KEY instead.',
      );
    }

    // Resolve system OpenRouter key from Neon DB if not present in env
    if (!openrouterKey) {
      try {
        const sysRows = await sql`
          SELECT value FROM system_config WHERE key = 'system_openrouter_key' LIMIT 1
        `;
        if (sysRows?.[0]?.value) {
          openrouterKey = String(sysRows[0].value).trim();
        }
      } catch (e) {
        console.warn('[chat] Failed to resolve system_openrouter_key from DB:', e);
      }
    }

    // GitHub Models retired 2026-07-30. Prefer OpenRouter free tier, then other live providers.
    const attempts: Array<() => Promise<{ content: string; provider: string }>> = [];

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
              ...messages.map((m: { role: string; content: string }) => ({
                role: m.role,
                content: m.content,
              })),
            ],
            temperature: 0.7,
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
        return {
          content: result.choices?.[0]?.message?.content || '',
          provider: `${name} (${model})`,
        };
      });
    };

    const openRouterHeaders = {
      'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'https://careerops.dpdns.org',
      'X-Title': process.env.OPENROUTER_APP_NAME || 'career-ops',
    };

    // ── Mistral AI (primary when MISTRAL_API_KEY is set) ──
    pushOpenAiCompat(
      'Mistral',
      mistralKey,
      'https://api.mistral.ai/v1',
      process.env.MISTRAL_MODEL || 'mistral-small-latest',
    );

    // ── OpenRouter free models ──
    const openRouterModels = (
      process.env.OPENROUTER_MODELS
      || process.env.OPENROUTER_MODEL
      || 'openrouter/free,nvidia/nemotron-3.5-lightning:free,liquid/lfm-2.5-2.6b:free,minimax/minimax-m3:free'
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

    // ── Gemini (direct API) ──
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
    // DeepSeek last — often 402 on empty balance
    pushOpenAiCompat(
      'DeepSeek',
      deepseekKey,
      'https://api.deepseek.com',
      process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      {},
      (status, body) => status === 402 || /insufficient balance/i.test(body),
    );

    // ── Hugging Face Router (only when HUGGINGFACE_MODEL is explicitly set) ──
    const hfModel = (process.env.HUGGINGFACE_MODEL || '').trim();
    if (hfToken && !isPlaceholderKey(hfToken) && hfModel) {
      attempts.push(async () => {
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

    // ── Custom OpenAI-compatible fallback (never GitHub Models) ──
    if (
      fallbackKey
      && !isPlaceholderKey(fallbackKey)
      && fallbackUrl
      && !isGithubModelsUrl(fallbackUrl)
    ) {
      pushOpenAiCompat('Custom', fallbackKey, fallbackUrl, fallbackModel);
    }

    let finalResult = null;
    const errors: string[] = [];

    for (let i = 0; i < attempts.length; i++) {
      try {
        finalResult = await attempts[i]();
        break;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`Attempt ${i + 1} failed: ${message}`);
        if (!message.includes(' skipped (')) {
          errors.push(message);
        }
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
          'No LLM Provider configured. Set MISTRAL_API_KEY, OPENROUTER_API_KEY, '
          + 'GEMINI_API_KEY, GROQ_API_KEY, or DEEPSEEK_API_KEY on Vercel (Production). '
          + 'GitHub Models (models.github.ai) is permanently retired.',
      },
      { status: 400 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
