import { createClient } from '@deepgram/sdk';
import type {
  DeepgramResponse,
  DiarizedTranscript,
  Utterance,
} from '@/types/deepgram';

import { createLogger } from "@/lib/logger";

const log = createLogger('deepgram');

const deepgram = createClient(process.env.DEEPGRAM_API_KEY!);

/**
 * Race a promise against a timeout. Rejects with a descriptive error on expiry.
 */
function withDeepgramTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Deepgram timeout after ${ms}ms: ${label}`)), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
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
      // Don't retry on client errors (4xx)
      if (error?.status >= 400 && error?.status < 500) throw error;
      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        log.warn(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

// Audio file extensions that indicate direct URLs (no redirects needed)
const DIRECT_AUDIO_EXTENSIONS = ['.mp3', '.m4a', '.wav', '.ogg', '.flac', '.aac', '.opus'];

/**
 * Check if URL appears to be a direct audio file (no tracking redirect needed)
 */
function isDirectAudioUrl(url: string): boolean {
  const urlLower = url.toLowerCase();
  // Check file extension
  if (DIRECT_AUDIO_EXTENSIONS.some(ext => urlLower.includes(ext))) {
    // Make sure it's not a tracking URL that contains the extension in the path
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.toLowerCase();
    if (DIRECT_AUDIO_EXTENSIONS.some(ext => pathname.endsWith(ext))) {
      return true;
    }
  }
  return false;
}

/**
 * Check if a Deepgram error is a remote content error (host blocked the request)
 */
function isRemoteContentError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes('REMOTE_CONTENT_ERROR') || msg.includes('403 Forbidden');
}

/**
 * Follow redirects to get the final audio URL
 * Many podcast URLs go through tracking services that Deepgram can't fetch
 * Optimized: skips redirect following for direct audio URLs and uses timeouts
 */
async function resolveAudioUrl(url: string, maxRedirects = 5): Promise<string> {
  // Skip redirect following for direct audio URLs (common case)
  if (isDirectAudioUrl(url)) {
    log.info('URL appears to be direct audio, skipping redirect resolution');
    return url;
  }

  let currentUrl = url;
  let redirectCount = 0;
  const REDIRECT_TIMEOUT = 3000; // 3 second timeout per redirect

  while (redirectCount < maxRedirects) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REDIRECT_TIMEOUT);
    try {
      const response = await fetch(currentUrl, {
        method: 'HEAD',
        redirect: 'manual', // Don't auto-follow, we want to track
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        signal: controller.signal,
      });

      // Check if it's a redirect (3xx status)
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) {
          log.info('Redirect without location header, using current URL');
          break;
        }

        // Handle relative URLs
        currentUrl = location.startsWith('http')
          ? location
          : new URL(location, currentUrl).toString();

        redirectCount++;
        log.info(`Following redirect ${redirectCount}`, { to: currentUrl.substring(0, 80) + '...' });

        // If we've resolved to a direct audio URL, stop here
        if (isDirectAudioUrl(currentUrl)) {
          log.info('Resolved to direct audio URL, stopping redirect chain');
          break;
        }
      } else {
        // Not a redirect, we're done
        break;
      }
    } catch (error) {
      // On timeout or error, use current URL and continue
      if (error instanceof Error && error.name === 'AbortError') {
        log.info('Redirect request timed out, using current URL');
      } else {
        log.warn('Error resolving URL, using current', { error: String(error) });
      }
      break;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  if (redirectCount > 0) {
    log.info(`Resolved URL after ${redirectCount} redirects`, {
      original: url.substring(0, 60) + '...',
      resolved: currentUrl.substring(0, 60) + '...'
    });
  }

  return currentUrl;
}

/**
 * Force-resolve a URL by always following redirects, even for .mp3 URLs.
 * Used as a fallback when the initial attempt fails.
 */
async function forceResolveAudioUrl(url: string, maxRedirects = 10): Promise<string> {
  let currentUrl = url;
  let redirectCount = 0;
  const REDIRECT_TIMEOUT = 5000;

  while (redirectCount < maxRedirects) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REDIRECT_TIMEOUT);
    try {
      const response = await fetch(currentUrl, {
        method: 'HEAD',
        redirect: 'manual',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'audio/mpeg, audio/*, */*',
        },
        signal: controller.signal,
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) break;

        currentUrl = location.startsWith('http')
          ? location
          : new URL(location, currentUrl).toString();
        redirectCount++;
        log.info(`Force-resolve redirect ${redirectCount}`, { to: currentUrl.substring(0, 80) + '...' });
      } else {
        break;
      }
    } catch {
      break;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return currentUrl;
}

/**
 * Download audio from URL into a Buffer (our server fetches it, not Deepgram).
 * This bypasses any host-level blocking of Deepgram's IPs.
 */
async function downloadAudioBuffer(url: string): Promise<Buffer> {
  const DOWNLOAD_TIMEOUT = 45_000; // 45s — aligned with pipeline budget
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'audio/mpeg, audio/*, */*',
      },
      redirect: 'follow',
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Download failed: ${response.status} ${response.statusText}`);
    }

    // Check Content-Length before downloading (reject files >200MB)
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > 200 * 1024 * 1024) {
      throw new Error(`Audio file too large: ${contentLength} bytes (max 200MB)`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Build Deepgram transcription config
 */
function buildDeepgramConfig(language?: string): Record<string, unknown> {
  const config: Record<string, unknown> = {
    model: 'nova-3',
    diarize: true,
    utterances: true,
    smart_format: true,
    punctuate: true,
    detect_language: false,
  };

  // Map deprecated ISO 639-1 codes to modern equivalents
  const langMap: Record<string, string> = { iw: 'he', in: 'id', ji: 'yi' };
  const lang = language || 'en';
  config.language = langMap[lang] || lang;
  return config;
}

function parseDeepgramResponse(response: DeepgramResponse): DiarizedTranscript {
  const utterances: Utterance[] = [];
  let fullText = '';

  // Try to get utterances first (preferred - has speaker diarization)
  if (response.results.utterances && response.results.utterances.length > 0) {
    for (const utt of response.results.utterances) {
      utterances.push({
        start: utt.start,
        end: utt.end,
        speaker: utt.speaker,
        text: utt.transcript,
        confidence: utt.confidence,
      });
    }
    fullText = utterances.map(u => u.text).join(' ');
  }
  // Fallback: Get transcript from channels if no utterances
  else if (response.results.channels?.[0]?.alternatives?.[0]) {
    const channel = response.results.channels[0];
    const alternative = channel.alternatives[0];
    fullText = alternative.transcript || '';

    // Create a single utterance from the full transcript if we have words with timing
    if (alternative.words && alternative.words.length > 0) {
      // Group words by speaker for diarization
      let currentSpeaker = 0;
      let currentStart = alternative.words[0].start;
      let currentText: string[] = [];

      for (const word of alternative.words) {
        const wordSpeaker = word.speaker ?? 0;

        if (wordSpeaker !== currentSpeaker && currentText.length > 0) {
          // Save current utterance
          utterances.push({
            start: currentStart,
            end: word.start,
            speaker: currentSpeaker,
            text: currentText.join(' '),
            confidence: 0.9,
          });
          currentText = [];
          currentStart = word.start;
          currentSpeaker = wordSpeaker;
        }
        currentText.push(word.punctuated_word || word.word);
      }

      // Save last utterance
      if (currentText.length > 0) {
        const lastWord = alternative.words[alternative.words.length - 1];
        utterances.push({
          start: currentStart,
          end: lastWord.end,
          speaker: currentSpeaker,
          text: currentText.join(' '),
          confidence: 0.9,
        });
      }
    } else if (fullText) {
      // No word-level timing, create single utterance
      utterances.push({
        start: 0,
        end: response.metadata.duration,
        speaker: 0,
        text: fullText,
        confidence: 0.9,
      });
    }
  }

  // Count unique speakers
  const speakerSet = new Set(utterances.map(u => u.speaker));

  // Get detected language from first channel
  const detectedLanguage = (response.results.channels?.[0] as { detected_language?: string })?.detected_language;

  log.info('parseDeepgramResponse result', {
    hasUtterances: response.results.utterances?.length ?? 0,
    parsedUtterances: utterances.length,
    fullTextLength: fullText.length,
    detectedLanguage
  });

  return {
    utterances,
    fullText,
    duration: response.metadata.duration,
    speakerCount: speakerSet.size || 1,
    detectedLanguage,
  };
}

/**
 * Transcribe audio with a 2-step fallback chain:
 *  1. Pass URL directly to Deepgram (fast path, works for most podcasts)
 *  2. If fails: download audio ourselves and send raw bytes to Deepgram
 *
 * Each Deepgram API call is wrapped with a 60s timeout to stay within the 240s pipeline budget.
 */
export async function transcribeFromUrl(
  audioUrl: string,
  language?: string // Optional: 'en', 'he', etc. If not provided, Deepgram auto-detects
): Promise<DiarizedTranscript> {
  log.info('transcribeFromUrl started', {
    audioUrl: audioUrl.substring(0, 100) + '...',
    language: language || 'auto-detect'
  });

  const startTime = Date.now();
  const config = buildDeepgramConfig(language);

  // ── Step 1: Try with resolved URL (optimized path) ──
  try {
    log.info('Step 1: Resolving audio URL (following redirects)...');
    const resolvedUrl = await resolveAudioUrl(audioUrl);

    log.info('Sending to Deepgram API...', config);

    const { result, error } = await withDeepgramTimeout(
      withRetry(() =>
        deepgram.listen.prerecorded.transcribeUrl(
          { url: resolvedUrl },
          config
        )
      ),
      60_000,
      'Step 1 transcribeUrl'
    );

    if (error) {
      throw new Error(`Deepgram API error: ${JSON.stringify(error)}`);
    }

    const duration = Date.now() - startTime;
    log.info('Step 1 succeeded', {
      durationMs: duration,
      audioDuration: result.metadata?.duration,
      utteranceCount: result.results?.utterances?.length || 0,
    });

    return parseDeepgramResponse(result as DeepgramResponse);
  } catch (step1Error) {
    const errorMsg = step1Error instanceof Error ? step1Error.message : String(step1Error);
    log.warn('Step 1 FAILED, trying Step 2 (download audio ourselves)...', { error: errorMsg });
  }

  // ── Step 2: Download audio ourselves and send raw bytes to Deepgram ──
  try {
    log.info('Step 2: Downloading audio to buffer...');
    const downloadStart = Date.now();
    const audioBuffer = await downloadAudioBuffer(audioUrl);
    log.info('Step 2: Audio downloaded', {
      durationMs: Date.now() - downloadStart,
      sizeBytes: audioBuffer.length,
      sizeMB: (audioBuffer.length / (1024 * 1024)).toFixed(1),
    });

    log.info('Step 2: Sending audio buffer to Deepgram...');
    const { result, error } = await withDeepgramTimeout(
      withRetry(() =>
        deepgram.listen.prerecorded.transcribeFile(
          audioBuffer,
          config
        )
      ),
      60_000,
      'Step 2 transcribeFile'
    );

    if (error) {
      throw new Error(`Deepgram API error: ${JSON.stringify(error)}`);
    }

    const duration = Date.now() - startTime;
    log.info('Step 2 succeeded', {
      totalDurationMs: duration,
      audioDuration: result.metadata?.duration,
      utteranceCount: result.results?.utterances?.length || 0,
    });

    return parseDeepgramResponse(result as DeepgramResponse);
  } catch (step2Error) {
    const duration = Date.now() - startTime;
    const errorMsg = step2Error instanceof Error ? step2Error.message : String(step2Error);
    log.error('Both steps FAILED', { totalDurationMs: duration, error: errorMsg });

    throw new (class extends Error { name = 'TranscriptionError'; })(
      `Deepgram transcription failed after all fallbacks: ${errorMsg}`
    );
  }
}

// Helper to format transcript with timestamps for legacy compatibility
export function formatTranscriptWithTimestamps(transcript: DiarizedTranscript): string {
  return transcript.utterances
    .map(u => {
      const mins = Math.floor(u.start / 60);
      const secs = Math.floor(u.start % 60);
      const timestamp = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      return `[${timestamp}] [Speaker ${u.speaker}] ${u.text}`;
    })
    .join('\n');
}

// Format transcript with identified speaker names
// Merges consecutive utterances from the same speaker into paragraphs
export function formatTranscriptWithSpeakerNames(transcript: DiarizedTranscript): string {
  const speakerMap = new Map<number, string>();

  // Build speaker name map
  if (transcript.speakers) {
    for (const speaker of transcript.speakers) {
      speakerMap.set(speaker.id, speaker.name);
    }
  }

  if (transcript.utterances.length === 0) {
    return '';
  }

  // Merge consecutive utterances from the same speaker
  // Only split when: speaker changes OR there's a gap > 5 seconds
  const MAX_GAP_SECONDS = 5;
  const mergedBlocks: { speaker: number; start: number; texts: string[] }[] = [];

  let currentBlock: { speaker: number; start: number; texts: string[] } | null = null;
  let lastEnd = 0;

  for (const u of transcript.utterances) {
    const gap = u.start - lastEnd;
    const shouldStartNewBlock =
      !currentBlock ||
      currentBlock.speaker !== u.speaker ||
      gap > MAX_GAP_SECONDS;

    if (shouldStartNewBlock) {
      if (currentBlock) {
        mergedBlocks.push(currentBlock);
      }
      currentBlock = {
        speaker: u.speaker,
        start: u.start,
        texts: [u.text]
      };
    } else if (currentBlock) {
      currentBlock.texts.push(u.text);
    }

    lastEnd = u.end;
  }

  // Don't forget the last block
  if (currentBlock) {
    mergedBlocks.push(currentBlock);
  }

  // Format merged blocks
  return mergedBlocks
    .map(block => {
      const mins = Math.floor(block.start / 60);
      const secs = Math.floor(block.start % 60);
      const timestamp = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      const speakerName = speakerMap.get(block.speaker) || `Speaker ${block.speaker}`;
      const fullText = block.texts.join(' ');
      return `[${timestamp}] [${speakerName}] ${fullText}`;
    })
    .join('\n');
}
