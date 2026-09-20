import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { rateLimit, rateLimitResponse, formatRetryHint } from '@/lib/rate-limit';
import { assertPracticeBetaAccess } from '@/lib/practice';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

// Default voice: Rachel (calm, professional interviewer). Fallback: Adam or custom via env.
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const betaBlock = assertPracticeBetaAccess(session.user.email);
    if (betaBlock) return betaBlock;

    const userId = String(session.user.id);
    const rl = await rateLimit(`practice-tts:${userId}`, { windowMs: 60 * 1000, max: 25 });
    if (!rl.ok) {
      return rateLimitResponse(rl, `TTS rate limit reached. ${formatRetryHint(rl.retryAfterSec)}`);
    }

    const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
    if (!apiKey) {
      // Key not configured — signal client to silently fallback to browser SpeechSynthesis
      return NextResponse.json({ ok: false, fallback: true, reason: 'unconfigured' }, { status: 200 });
    }

    const body = await req.json().catch(() => ({}));
    const rawText = String(body.text || '').trim();
    if (!rawText) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    // Sanitize & bound text to prevent credit exhaustion attacks
    const text = rawText.slice(0, 800);
    const voiceId = process.env.ELEVENLABS_VOICE_ID?.trim() || DEFAULT_VOICE_ID;
    const modelId = process.env.ELEVENLABS_MODEL_ID?.trim() || 'eleven_flash_v2_5';

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true,
        },
      }),
    });

    if (!response.ok) {
      // If ElevenLabs quota is exhausted (429/401) or temporary outage, signal client to fallback smoothly
      return NextResponse.json(
        { ok: false, fallback: true, reason: 'upstream_error', status: response.status },
        { status: 200 }
      );
    }

    const audioBuffer = await response.arrayBuffer();
    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store, max-age=0',
        'X-TTS-Provider': 'elevenlabs',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal TTS Error';
    // Fallback on unexpected server failure so client keeps talking
    return NextResponse.json({ ok: false, fallback: true, error: message }, { status: 200 });
  }
}
