import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';

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

    // 3. Fetch user profile context
    const profileRows = await sql`
      SELECT resume_context, targeting_keywords, hf_token
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

    // 5. Gather all keys from environment and DB
    const fallbackKey = process.env.FALLBACK_API_KEY || '';
    const fallbackUrl = process.env.FALLBACK_BASE_URL || 'https://models.github.ai/inference/v1';
    const fallbackModel = process.env.FALLBACK_MODEL || 'gpt-4o-mini';

    const deepseekKey = process.env.DEEPSEEK_API_KEY || '';
    const geminiKey = process.env.GEMINI_API_KEY || '';
    const hfToken = process.env.HUGGINGFACE_TOKEN || userHfToken || '';

    // We will attempt providers in priority order. If one fails (e.g., insufficient balance or invalid key), 
    // we log the error and try the next one in the chain.
    const attempts = [];

    // ── Attempt 1: GitHub Models / Custom OpenAI Fallback ──
    if (fallbackKey && !fallbackKey.includes('your_github') && !fallbackKey.includes('placeholder')) {
      attempts.push(async () => {
        const cleanUrl = fallbackUrl.replace(/\/$/, '') + '/chat/completions';
        const response = await fetch(cleanUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${fallbackKey}`,
          },
          body: JSON.stringify({
            model: fallbackModel,
            messages: [
              { role: 'system', content: systemPrompt },
              ...messages.map(m => ({ role: m.role, content: m.content })),
            ],
            temperature: 0.7,
          }),
        });

        if (!response.ok) {
          throw new Error(`GitHub Models failed with status ${response.status}: ${await response.text()}`);
        }
        const result = await response.json();
        return { content: result.choices?.[0]?.message?.content || '', provider: `GitHub Models (${fallbackModel})` };
      });
    }

    // ── Attempt 2: DeepSeek Chat ──
    if (deepseekKey && !deepseekKey.includes('your_deepseek')) {
      attempts.push(async () => {
        const response = await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${deepseekKey}`,
          },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [
              { role: 'system', content: systemPrompt },
              ...messages.map(m => ({ role: m.role, content: m.content })),
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

    // ── Attempt 3: Gemini ──
    if (geminiKey && !geminiKey.includes('your_gemini')) {
      attempts.push(async () => {
        const contents = messages.map(m => ({
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

    // ── Attempt 4: Hugging Face Router ──
    if (hfToken) {
      attempts.push(async () => {
        const hfModel = 'meta-llama/Meta-Llama-3-8B-Instruct';
        const response = await fetch('https://router.huggingface.co/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${hfToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: hfModel,
            messages: [
              { role: 'system', content: systemPrompt },
              ...messages.map(m => ({ role: m.role, content: m.content })),
            ],
            temperature: 0.7,
            max_tokens: 2048,
          }),
        });

        if (!response.ok) {
          throw new Error(`HuggingFace API failed with status ${response.status}: ${await response.text()}`);
        }
        const result = await response.json();
        return { content: result.choices?.[0]?.message?.content || '', provider: `HuggingFace (${hfModel})` };
      });
    }

    // Run attempts sequentially. If one fails, catch and log, then move to the next.
    let finalResult = null;
    const errors = [];

    for (let i = 0; i < attempts.length; i++) {
      try {
        finalResult = await attempts[i]();
        break; // Successfully got a response, break loop!
      } catch (err: any) {
        console.warn(`Attempt ${i + 1} failed: ${err.message}`);
        errors.push(err.message);
      }
    }

    if (finalResult) {
      return NextResponse.json(finalResult);
    }

    // If all configured attempts failed
    if (errors.length > 0) {
      return NextResponse.json(
        { error: `All configured LLM providers failed:\n${errors.join('\n')}` },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { error: 'No LLM Provider configured. Please set DEEPSEEK_API_KEY, GEMINI_API_KEY, HUGGINGFACE_TOKEN, or FALLBACK_API_KEY in environment.' },
      { status: 400 }
    );

  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
