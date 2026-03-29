import { Mistral } from '@mistralai/mistralai';
import type { DiarizedTranscript, Utterance } from '@/types/deepgram';
import { createLogger } from '@/lib/logger';

const log = createLogger('voxtral');

const client = new Mistral({
  apiKey: process.env.MISTRAL_API_KEY!,
  timeoutMs: 60_000, // 60s — aligned with pipeline budget
});

export const VOXTRAL_SUPPORTED_LANGUAGES = [
  'en', 'zh', 'hi', 'es', 'ar', 'fr', 'pt', 'ru', 'de', 'ja', 'ko', 'it', 'nl',
] as const;

const supportedSet = new Set<string>(VOXTRAL_SUPPORTED_LANGUAGES);

export function isVoxtralSupported(language: string): boolean {
  return supportedSet.has(language);
}

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 1,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      if (error?.statusCode >= 400 && error?.statusCode < 500) throw error;
      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        log.warn(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

/**
 * Parse a Voxtral speaker label like "speaker_0" into a numeric ID.
 */
function parseSpeakerLabel(label: string | undefined | null): number {
  if (!label) return 0;
  const match = label.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Transcribe audio using Voxtral Transcribe 2 (Mistral).
 * Includes built-in speaker diarization — no separate Gemini call needed for speaker labels.
 */
export async function transcribeWithVoxtral(
  audioUrl: string,
  language: string
): Promise<DiarizedTranscript> {
  log.info('transcribeWithVoxtral started', {
    audioUrl: audioUrl.substring(0, 100) + '...',
    language,
  });

  const startTime = Date.now();

  const result = await withRetry(async () => {
    log.info('Calling Mistral audio.transcriptions.complete()...');
    const response = await client.audio.transcriptions.complete({
      model: 'voxtral-mini-latest',
      fileUrl: audioUrl,
      language: language,
      diarize: true,
      timestampGranularities: ['segment'],
    });
    return response;
  });

  const duration = Date.now() - startTime;

  // Parse segments into our Utterance format
  const utterances: Utterance[] = [];
  const segments = (result as any).segments || [];

  for (const seg of segments) {
    utterances.push({
      start: seg.start ?? 0,
      end: seg.end ?? 0,
      speaker: parseSpeakerLabel(seg.speaker),
      text: seg.text?.trim() || '',
      confidence: 0.95, // Voxtral doesn't provide per-segment confidence
    });
  }

  const fullText = (result as any).text || utterances.map(u => u.text).join(' ');
  const detectedLanguage = (result as any).language || language;
  const speakerSet = new Set(utterances.map(u => u.speaker));

  log.info('transcribeWithVoxtral completed', {
    durationMs: duration,
    segmentCount: segments.length,
    utteranceCount: utterances.length,
    speakerCount: speakerSet.size || 1,
    detectedLanguage,
    fullTextLength: fullText.length,
  });

  return {
    utterances,
    fullText,
    duration: utterances.length > 0 ? utterances[utterances.length - 1].end : 0,
    speakerCount: speakerSet.size || 1,
    detectedLanguage,
  };
}
