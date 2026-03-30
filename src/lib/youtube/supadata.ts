import { createLogger } from '@/lib/logger';

const log = createLogger('supadata');

const SUPADATA_API_KEY = process.env.SUPADATA_API_KEY;
const SUPADATA_BASE_URL = 'https://api.supadata.ai/v1';

export interface SupadataTranscriptResult {
  text: string;
  language: string;
}

/**
 * Fetch YouTube captions via the Supadata API.
 *
 * Returns the joined transcript text + detected language on success,
 * or null when captions are unavailable (206 / transcript-unavailable).
 * Throws on unexpected errors so callers can log and continue.
 */
export async function fetchSupadataTranscript(
  videoId: string,
  language?: string,
): Promise<SupadataTranscriptResult | null> {
  if (!SUPADATA_API_KEY) {
    log.warn('SUPADATA_API_KEY not set, skipping Supadata transcript fetch');
    return null;
  }

  const lang = language || 'en';
  const url = `${SUPADATA_BASE_URL}/youtube/transcript?videoId=${encodeURIComponent(videoId)}&lang=${encodeURIComponent(lang)}`;

  log.info('Fetching YouTube transcript via Supadata', { videoId, lang });

  const res = await fetch(url, {
    headers: { 'x-api-key': SUPADATA_API_KEY },
    signal: AbortSignal.timeout(20_000),
  });

  // 206 = no captions available
  if (res.status === 206) {
    const body = await res.json().catch(() => ({}));
    if (body?.error === 'transcript-unavailable') {
      log.info('Supadata: no captions available for video', { videoId });
      return null;
    }
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    log.error('Supadata API error', { videoId, status: res.status, body: text.slice(0, 200) });
    return null;
  }

  const data = await res.json() as {
    content?: { text: string; offset: number; duration: number; lang: string }[];
    lang?: string;
  };

  if (!data.content || data.content.length === 0) {
    log.warn('Supadata returned empty content', { videoId });
    return null;
  }

  const fullText = data.content
    .map((seg) => seg.text)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!fullText) {
    log.warn('Supadata transcript text empty after join', { videoId });
    return null;
  }

  const detectedLang = data.lang || lang;

  log.success('Got transcript via Supadata', {
    videoId,
    lang: detectedLang,
    segments: data.content.length,
    chars: fullText.length,
  });

  return { text: fullText, language: detectedLang };
}
