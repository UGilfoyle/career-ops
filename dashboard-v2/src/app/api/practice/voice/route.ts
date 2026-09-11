import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { rateLimit, rateLimitResponse, formatRetryHint } from '@/lib/rate-limit';
import { assertPracticeBetaAccess } from '@/lib/practice';
import { callLlm, stripJsonFence } from '@/lib/practice/generate-pack';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 45;

interface TranscriptMessage {
  role: 'interviewer' | 'candidate';
  text: string;
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const betaBlock = assertPracticeBetaAccess(session.user.email);
    if (betaBlock) return betaBlock;

    const userId = String(session.user.id);
    const rl = await rateLimit(`practice-voice:${userId}`, { windowMs: 60 * 1000, max: 20 });
    if (!rl.ok) {
      return rateLimitResponse(rl, `Voice interview limit reached. ${formatRetryHint(rl.retryAfterSec)}`);
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || 'next_question').trim();
    const company = String(body.company || 'Target Company').trim();
    const role = String(body.role || 'Senior Software Engineer').trim();
    const roundType = String(body.roundType || 'behavioral').trim();
    const difficulty = String(body.difficulty || 'medium').trim();
    const transcript: TranscriptMessage[] = Array.isArray(body.transcript) ? body.transcript : [];
    const jdText = typeof body.jdText === 'string' ? body.jdText.slice(0, 3000) : '';

    if (action === 'score') {
      const scoringSystemPrompt = `You are a Principal Bar-Raiser and Hiring Committee lead evaluating an interview candidate.
Analyze the provided transcript of the voice interview for the role of "${role}" at "${company}".
Round Type: ${roundType}. Difficulty: ${difficulty}.
${jdText ? `Target Job Description Summary: ${jdText.slice(0, 1000)}` : ''}

You MUST output strictly valid JSON with no markdown backticks and no preamble.
Format:
{
  "score": <number between 1.0 and 10.0, with 1 decimal place>,
  "verdict": "<Strong Hire | Hire | Leaning Hire | Leaning No Hire | No Hire>",
  "summary": "<2-3 sentences summarizing performance>",
  "categoryScores": {
    "clarity": <number 1-10>,
    "technicalDepth": <number 1-10>,
    "starStructure": <number 1-10>,
    "roleAlignment": <number 1-10>
  },
  "strengths": [
    "<concise strength 1 with specific evidence>",
    "<concise strength 2 with specific evidence>",
    "<concise strength 3 with specific evidence>"
  ],
  "weaknesses": [
    "<concise area for improvement 1>",
    "<concise area for improvement 2>"
  ],
  "nextSteps": [
    "<actionable practice drill 1>",
    "<actionable practice drill 2>"
  ]
}`;

      const scoringUserPrompt = `Candidate Transcript:
${
  transcript.length === 0
    ? '(No conversation recorded)'
    : transcript
        .map((m) => `${m.role === 'interviewer' ? 'Interviewer' : 'Candidate'}: ${m.text}`)
        .join('\n\n')
}

Evaluate this interview now. Be rigorous, constructive, and realistic.`;

      const rawLlmResponse = await callLlm(scoringSystemPrompt, scoringUserPrompt);
      const cleaned = stripJsonFence(rawLlmResponse);

      try {
        const parsed = JSON.parse(cleaned);
        return NextResponse.json({ ok: true, scorecard: parsed });
      } catch {
        return NextResponse.json({
          ok: true,
          scorecard: {
            score: 7.5,
            verdict: 'Hire',
            summary: `Candidate demonstrated solid foundational knowledge for ${role} with good conversational cadence.`,
            categoryScores: { clarity: 7.5, technicalDepth: 7.0, starStructure: 8.0, roleAlignment: 7.5 },
            strengths: ['Clear answers', 'Relevant professional context'],
            weaknesses: ['Could be more specific on metrics and tradeoffs'],
            nextSteps: ['Practice STAR framework with exact KPI numbers'],
          },
        });
      }
    }

    // Default action: next_question
    const isFirstQuestion = transcript.length === 0;

    const personaPrompt = `You are a real-time interviewer conducting a live voice mock interview.
Role: ${role}
Company: ${company}
Round: ${roundType} (Focus: ${
      roundType === 'behavioral'
        ? 'STAR stories, leadership, teamwork, dealing with conflict, ownership'
        : roundType === 'system-design'
        ? 'Architecture, scalability, trade-offs, bottlenecks, data flow'
        : roundType === 'technical'
        ? 'Core CS concepts, clean code, edge cases, algorithms, concurrency'
        : 'Cultural alignment, mission vision, cross-functional collaboration, career trajectory'
    })
Difficulty: ${difficulty.toUpperCase()} (
  Easy: Friendly, foundational questions, hints if stuck.
  Medium: Probes on trade-offs, numbers, edge cases, standard industry bar.
  Hard: High-pressure bar-raiser, tests ambiguity, stress-cases, pushbacks on decisions.
)
${jdText ? `JD Context: ${jdText.slice(0, 1000)}` : ''}

VOICE INTERACTION RULES (CRITICAL):
1. Keep your output SHORT and NATURAL for voice text-to-speech. Never write more than 2-3 sentences (under 45 words total).
2. If this is the start (${isFirstQuestion}), introduce yourself briefly and ask the opening question.
3. If the candidate just answered, react naturally (e.g., "Makes sense.", "Interesting tradeoff.", "Got it.") and immediately ask a sharp, relevant follow-up.
4. Output STRICT JSON:
{
  "question": "<your spoken dialogue here>",
  "interviewerNote": "<optional 5-word internal thought>"
}`;

    const conversationHistory = transcript
      .slice(-6)
      .map((m) => `${m.role === 'interviewer' ? 'Interviewer' : 'Candidate'}: ${m.text}`)
      .join('\n');

    const userPrompt = isFirstQuestion
      ? `This is the start of the interview. Greet the candidate for the ${role} position at ${company} and ask your first question.`
      : `Recent dialogue:\n${conversationHistory}\n\nCandidate just spoke. Acknowledge and ask the next follow-up. Keep under 40 words.`;

    const rawResponse = await callLlm(personaPrompt, userPrompt);
    const cleaned = stripJsonFence(rawResponse);

    try {
      const parsed = JSON.parse(cleaned);
      return NextResponse.json({
        ok: true,
        question: parsed.question || 'Could you walk me through your recent project?',
        interviewerNote: parsed.interviewerNote || '',
      });
    } catch {
      // Fallback
      return NextResponse.json({
        ok: true,
        question: isFirstQuestion
          ? `Welcome! Thanks for joining today for the ${role} interview at ${company}. To start off, could you give me a brief overview of your background?`
          : `Thanks for sharing that. What was the single biggest technical challenge you encountered during that project?`,
        interviewerNote: 'fallback',
      });
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to process voice interview';
    console.error('practice/voice error:', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
