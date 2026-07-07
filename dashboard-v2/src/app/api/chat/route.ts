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
      SELECT resume_context, targeting_keywords
      FROM user_profiles
      WHERE user_id = ${userId}
      LIMIT 1
    `;
    const profile = profileRows[0] || {};
    const resumeContext = profile.resume_context || {};
    const targetingKeywords = profile.targeting_keywords || { positive: [], negative: [] };

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

    // 5. Select API Key & LLM Provider
    const deepseekKey = process.env.DEEPSEEK_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;

    if (deepseekKey) {
      // ── Use DeepSeek Chat API ──
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
        const errText = await response.text();
        return NextResponse.json({ error: `DeepSeek API error: ${errText}` }, { status: response.status });
      }

      const result = await response.json();
      const reply = result.choices?.[0]?.message?.content || '';
      return NextResponse.json({ content: reply, provider: 'DeepSeek' });
    } else if (geminiKey) {
      // ── Use Gemini API ──
      // Format messages into Gemini API contents structure
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
        const errText = await response.text();
        return NextResponse.json({ error: `Gemini API error: ${errText}` }, { status: response.status });
      }

      const result = await response.json();
      const reply = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return NextResponse.json({ content: reply, provider: 'Gemini' });
    } else {
      return NextResponse.json(
        { error: 'No LLM Provider configured. Please set DEEPSEEK_API_KEY or GEMINI_API_KEY in environment.' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
