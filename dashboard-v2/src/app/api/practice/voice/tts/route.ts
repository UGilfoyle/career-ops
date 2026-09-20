import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { auth } from '@/auth';
import { rateLimit, rateLimitResponse, formatRetryHint } from '@/lib/rate-limit';
import { assertPracticeBetaAccess } from '@/lib/practice';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

// Default voice: Sarah (Mature, Reassuring, Confident interviewer - free tier compatible)
const DEFAULT_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL';

// Bounded in-memory LRU Cache (max 80 entries ~8MB max memory footprint, auto-evicted for GC)
const MAX_TTS_CACHE_ITEMS = 80;
const ttsAudioCache = new Map<string, { buffer: ArrayBuffer; expiresAt: number }>();

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

    const rawKeys = process.env.ELEVENLABS_API_KEYS || process.env.ELEVENLABS_API_KEY || '';
    const apiKeys = rawKeys
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);

    if (apiKeys.length === 0) {
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

    // Fast Path: Check in-memory bounded LRU cache first (0ms latency, zero quota used)
    const cacheKey = createHash('sha256')
      .update(`${voiceId}:${modelId}:${text}`)
      .digest('hex');

    const cached = ttsAudioCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return new NextResponse(cached.buffer, {
        status: 200,
        headers: {
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'public, max-age=7200, stale-while-revalidate=86400',
          'X-TTS-Provider': 'elevenlabs-cached',
        },
      });
    }

    // Auto-Failover: Iterate through API key pool until one succeeds
    for (const apiKey of apiKeys) {
      try {
        const response = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
          {
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
            signal: AbortSignal.timeout(6000),
          },
        );

        if (response.ok) {
          const audioBuffer = await response.arrayBuffer();

          // FIFO LRU eviction to prevent memory bloat and enable deterministic V8 GC
          if (ttsAudioCache.size >= MAX_TTS_CACHE_ITEMS) {
            const oldestKey = ttsAudioCache.keys().next().value;
            if (oldestKey) ttsAudioCache.delete(oldestKey);
          }
          ttsAudioCache.set(cacheKey, {
            buffer: audioBuffer,
            expiresAt: Date.now() + 2 * 60 * 60 * 1000, // 2 hours TTL
          });

          return new NextResponse(audioBuffer, {
            status: 200,
            headers: {
              'Content-Type': 'audio/mpeg',
              'Cache-Control': 'public, max-age=7200, stale-while-revalidate=86400',
              'X-TTS-Provider': 'elevenlabs',
            },
          });
        }
      } catch {
        // Continue to next key in pool
      }
    }

    // If all keys exhausted (quota 429/402), signal client to fallback smoothly
    return NextResponse.json(
      { ok: false, fallback: true, reason: 'all_keys_exhausted' },
      { status: 200 },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal TTS Error';
    // Fallback on unexpected server failure so client keeps talking
    return NextResponse.json({ ok: false, fallback: true, error: message }, { status: 200 });
  }
}
