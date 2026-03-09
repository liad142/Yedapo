import { createLogger } from "@/lib/logger";
import type { DiarizedTranscript, Utterance } from "@/types/deepgram";

const log = createLogger('podcast');

const APPLE_BEARER_TOKEN = process.env.APPLE_PODCASTS_BEARER_TOKEN;

// Pre-compiled regex for TTML parsing
const TTML_TAG_RE = /<[^>]+>/g;
const MULTI_SPACE_RE = /\s+/g;
const TTML_P_RE = /<p[^>]*>([\s\S]*?)<\/p>/gi;
const TTML_SPAN_RE = /<span[^>]*podcasts:unit="word"[^>]*>([\s\S]*?)<\/span>/gi;
const TTML_SPAN_FALLBACK_RE = /<span[^>]*>([\s\S]*?)<\/span>/gi;
const TTML_BEGIN_RE = /begin="([^"]+)"/;
const TTML_END_RE = /end="([^"]+)"/;
const TTML_AGENT_RE = /ttm:agent="([^"]+)"/;
const TTML_SPEAKER_NUM_RE = /SPEAKER_(\d+)/;

interface AppleSearchResult {
  trackId: number;
  trackName: string;
  collectionName: string;
  artistName: string;
}

/**
 * Search the iTunes Search API for a podcast episode by title.
 * This is a FREE public API, no auth needed.
 * Returns the Apple episode trackId or null if not found.
 */
export async function searchAppleEpisode(
  podcastTitle: string,
  episodeTitle: string
): Promise<number | null> {
  // Combine podcast + episode title for better matching
  const searchTerm = `${podcastTitle} ${episodeTitle}`.substring(0, 200);

  const url = new URL('https://itunes.apple.com/search');
  url.searchParams.set('term', searchTerm);
  url.searchParams.set('entity', 'podcastEpisode');
  url.searchParams.set('limit', '5');

  log.info('Searching iTunes API for episode', {
    podcastTitle: podcastTitle.substring(0, 50),
    episodeTitle: episodeTitle.substring(0, 50),
  });

  try {
    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': 'Yedapo/1.0' },
    });

    if (!response.ok) {
      log.info('iTunes search failed', { status: response.status });
      return null;
    }

    const data = await response.json();
    const results: AppleSearchResult[] = data.results || [];

    if (results.length === 0) {
      log.info('No iTunes results found');
      return null;
    }

    // Find best match by title similarity
    const match = findBestMatch(results, podcastTitle, episodeTitle);
    if (match) {
      log.info('Found Apple episode match', {
        trackId: match.trackId,
        trackName: match.trackName.substring(0, 60),
      });
      return match.trackId;
    }

    log.info('No suitable match found in iTunes results');
    return null;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log.info('iTunes search error', { error: errorMsg });
    return null;
  }
}

/**
 * Find the best matching episode from iTunes results.
 * Uses simple title similarity (normalized Jaccard-like comparison).
 */
function findBestMatch(
  results: AppleSearchResult[],
  podcastTitle: string,
  episodeTitle: string
): AppleSearchResult | null {
  const normalizedEpTitle = normalize(episodeTitle);

  let bestMatch: AppleSearchResult | null = null;
  let bestScore = 0;

  for (const result of results) {
    const normalizedResult = normalize(result.trackName);

    // Calculate word overlap score
    const score = wordOverlapScore(normalizedEpTitle, normalizedResult);

    // Bonus if podcast name matches
    const podcastScore = wordOverlapScore(
      normalize(podcastTitle),
      normalize(result.collectionName || result.artistName)
    );

    const combinedScore = score * 0.7 + podcastScore * 0.3;

    if (combinedScore > bestScore) {
      bestScore = combinedScore;
      bestMatch = result;
    }
  }

  // Require minimum 30% overlap to accept a match
  return bestScore >= 0.3 ? bestMatch : null;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(MULTI_SPACE_RE, ' ')
    .trim();
}

function wordOverlapScore(a: string, b: string): number {
  const wordsA = new Set(a.split(' ').filter(w => w.length > 1));
  const wordsB = new Set(b.split(' ').filter(w => w.length > 1));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let overlap = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) overlap++;
  }

  // Jaccard-like: overlap / union
  const union = new Set([...wordsA, ...wordsB]).size;
  return union > 0 ? overlap / union : 0;
}

/**
 * Fetch a transcript from Apple Podcasts using the bearer token.
 * The Apple Podcasts transcript API returns TTML (Timed Text Markup Language).
 *
 * API endpoint: /v1/catalog/us/podcast-episodes/{id}/transcripts
 * Response: { data: [{ attributes: { ttmlAssetUrls: { ttml: "signed CDN URL" } } }] }
 */
export async function fetchAppleTranscript(
  appleEpisodeId: number
): Promise<string | null> {
  if (!APPLE_BEARER_TOKEN) {
    log.info('No Apple bearer token configured, skipping');
    return null;
  }

  const url = `https://amp-api.podcasts.apple.com/v1/catalog/us/podcast-episodes/${appleEpisodeId}/transcripts?fields=ttmlToken,ttmlAssetUrls&l=en-US&with=entitlements`;

  log.info('Fetching Apple transcript metadata', { episodeId: appleEpisodeId });

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: {
        'Authorization': `Bearer ${APPLE_BEARER_TOKEN}`,
        'Origin': 'https://podcasts.apple.com',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    });

    if (response.status === 401 || response.status === 403) {
      log.info('Apple bearer token expired or invalid', { status: response.status });
      return null;
    }

    if (response.status === 404) {
      log.info('No transcript available for this Apple episode');
      return null;
    }

    if (!response.ok) {
      log.info('Apple transcript API error', { status: response.status });
      return null;
    }

    const data = await response.json();
    const attrs = data?.data?.[0]?.attributes;

    // Get the signed TTML CDN URL from ttmlAssetUrls.ttml
    const ttmlUrl = attrs?.ttmlAssetUrls?.ttml;

    if (!ttmlUrl) {
      log.info('No TTML URL in Apple response', {
        hasData: !!data?.data?.length,
        hasAttrs: !!attrs,
        keys: attrs ? Object.keys(attrs) : [],
      });
      return null;
    }

    log.info('Got TTML URL, fetching transcript...', { urlLength: ttmlUrl.length });

    // Fetch the actual TTML file from Apple's CDN
    const ttmlResponse = await fetch(ttmlUrl, {
      signal: AbortSignal.timeout(30000), // 30s for large transcripts
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    });

    if (!ttmlResponse.ok) {
      log.info('Failed to fetch TTML file', { status: ttmlResponse.status });
      return null;
    }

    const ttml = await ttmlResponse.text();

    if (ttml && ttml.length > 100) {
      log.info('Apple TTML fetched', { ttmlLength: ttml.length });
      return ttml;
    }

    log.info('Apple TTML too short', { length: ttml?.length });
    return null;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log.info('Apple transcript fetch error', { error: errorMsg });
    return null;
  }
}

/**
 * Parse Apple TTML (Timed Text Markup Language) to plain text with timestamps and speakers.
 *
 * Apple's TTML format:
 * <p begin="1.980" end="3.960" ttm:agent="SPEAKER_1">
 *   <span podcasts:unit="sentence">
 *     <span podcasts:unit="word">Joe</span>
 *     <span podcasts:unit="word">Rogan</span>
 *   </span>
 * </p>
 */
export function parseTtmlToText(ttml: string): string {
  const paragraphs: { begin: string | null; speaker: string | null; text: string }[] = [];

  let pMatch;
  TTML_P_RE.lastIndex = 0;
  while ((pMatch = TTML_P_RE.exec(ttml)) !== null) {
    const pTag = pMatch[0];
    const pContent = pMatch[1];

    // Extract begin timestamp and speaker from the <p> tag
    const beginMatch = pTag.match(TTML_BEGIN_RE);
    const begin = beginMatch ? beginMatch[1] : null;
    const agentMatch = pTag.match(TTML_AGENT_RE);
    const speaker = agentMatch ? agentMatch[1] : null;

    // Extract word-level spans (Apple uses podcasts:unit="word")
    let text = '';
    let spanMatch;
    TTML_SPAN_RE.lastIndex = 0;
    const words: string[] = [];
    while ((spanMatch = TTML_SPAN_RE.exec(pContent)) !== null) {
      const word = spanMatch[1].replace(TTML_TAG_RE, '').trim();
      if (word) words.push(word);
    }

    if (words.length > 0) {
      text = words.join(' ');
    } else {
      // Fallback: try any span
      TTML_SPAN_FALLBACK_RE.lastIndex = 0;
      const spans: string[] = [];
      while ((spanMatch = TTML_SPAN_FALLBACK_RE.exec(pContent)) !== null) {
        const spanText = spanMatch[1].replace(TTML_TAG_RE, '').trim();
        if (spanText) spans.push(spanText);
      }
      text = spans.length > 0 ? spans.join(' ') : pContent.replace(TTML_TAG_RE, '').trim();
    }

    if (text) {
      paragraphs.push({ begin, speaker, text });
    }
  }

  if (paragraphs.length > 0) {
    // Merge consecutive paragraphs from the same speaker into blocks
    const blocks: { begin: string | null; speaker: string | null; texts: string[] }[] = [];
    let current: typeof blocks[0] | null = null;

    for (const p of paragraphs) {
      if (current && current.speaker === p.speaker) {
        current.texts.push(p.text);
      } else {
        if (current) blocks.push(current);
        current = { begin: p.begin, speaker: p.speaker, texts: [p.text] };
      }
    }
    if (current) blocks.push(current);

    return blocks
      .map(b => {
        const parts: string[] = [];
        if (b.begin) parts.push(`[${formatTtmlTimestamp(b.begin)}]`);
        if (b.speaker) parts.push(`[${b.speaker}]`);
        parts.push(b.texts.join(' '));
        return parts.join(' ');
      })
      .join('\n');
  }

  // Fallback: strip all XML tags
  return ttml
    .replace(TTML_TAG_RE, ' ')
    .replace(MULTI_SPACE_RE, ' ')
    .trim();
}

/**
 * Convert TTML timestamp format (HH:MM:SS.mmm or MM:SS.mmm) to MM:SS
 */
function formatTtmlTimestamp(timestamp: string): string {
  // Handle HH:MM:SS.mmm format
  const parts = timestamp.split(':');
  if (parts.length === 3) {
    const hours = parseInt(parts[0]);
    const mins = parseInt(parts[1]);
    const secs = parseFloat(parts[2]);
    const totalMins = hours * 60 + mins;
    return `${totalMins.toString().padStart(2, '0')}:${Math.floor(secs).toString().padStart(2, '0')}`;
  }
  if (parts.length === 2) {
    const mins = parseInt(parts[0]);
    const secs = parseFloat(parts[1]);
    return `${mins.toString().padStart(2, '0')}:${Math.floor(secs).toString().padStart(2, '0')}`;
  }
  return '00:00';
}

/**
 * Convert a TTML timestamp (seconds like "1.980" or "HH:MM:SS.mmm") to numeric seconds.
 */
function parseTtmlTimestampToSeconds(timestamp: string): number {
  const parts = timestamp.split(':');
  if (parts.length === 3) {
    const hours = parseInt(parts[0]);
    const mins = parseInt(parts[1]);
    const secs = parseFloat(parts[2]);
    return hours * 3600 + mins * 60 + secs;
  }
  if (parts.length === 2) {
    const mins = parseInt(parts[0]);
    const secs = parseFloat(parts[1]);
    return mins * 60 + secs;
  }
  // Plain seconds (e.g. "1.980")
  return parseFloat(timestamp) || 0;
}

/**
 * Parse Apple TTML into a structured DiarizedTranscript with proper speaker diarization.
 *
 * Extracts each <p> element's timestamps and speaker label (SPEAKER_1 → speaker ID 1),
 * building a full Utterance[] array suitable for identifySpeakers() and
 * formatTranscriptWithSpeakerNames().
 */
export function parseTtmlToDiarized(ttml: string): DiarizedTranscript | null {
  const utterances: Utterance[] = [];
  const speakerIds = new Set<number>();

  let pMatch;
  TTML_P_RE.lastIndex = 0;
  while ((pMatch = TTML_P_RE.exec(ttml)) !== null) {
    const pTag = pMatch[0];
    const pContent = pMatch[1];

    // Extract begin/end timestamps
    const beginMatch = pTag.match(TTML_BEGIN_RE);
    const endMatch = pTag.match(TTML_END_RE);
    const start = beginMatch ? parseTtmlTimestampToSeconds(beginMatch[1]) : 0;
    const end = endMatch ? parseTtmlTimestampToSeconds(endMatch[1]) : start;

    // Extract speaker: SPEAKER_1 → 1, SPEAKER_3 → 3
    const agentMatch = pTag.match(TTML_AGENT_RE);
    let speaker = 0;
    if (agentMatch) {
      const numMatch = agentMatch[1].match(TTML_SPEAKER_NUM_RE);
      if (numMatch) {
        speaker = parseInt(numMatch[1]);
      }
    }
    speakerIds.add(speaker);

    // Extract text from word-level spans
    let text = '';
    let spanMatch;
    TTML_SPAN_RE.lastIndex = 0;
    const words: string[] = [];
    while ((spanMatch = TTML_SPAN_RE.exec(pContent)) !== null) {
      const word = spanMatch[1].replace(TTML_TAG_RE, '').trim();
      if (word) words.push(word);
    }

    if (words.length > 0) {
      text = words.join(' ');
    } else {
      // Fallback: try any span
      TTML_SPAN_FALLBACK_RE.lastIndex = 0;
      const spans: string[] = [];
      while ((spanMatch = TTML_SPAN_FALLBACK_RE.exec(pContent)) !== null) {
        const spanText = spanMatch[1].replace(TTML_TAG_RE, '').trim();
        if (spanText) spans.push(spanText);
      }
      text = spans.length > 0 ? spans.join(' ') : pContent.replace(TTML_TAG_RE, '').trim();
    }

    if (text) {
      utterances.push({ start, end, speaker, text, confidence: 1.0 });
    }
  }

  if (utterances.length === 0) {
    return null;
  }

  // Some TTMLs pack entire speaker turns into a single <p> element, producing
  // very few but huge utterances (e.g., 3 utterances for a 46-min episode).
  // This starves Gemini of timestamp markers, resulting in chapters without times.
  // Fix: split long utterances into sentence-level chunks with interpolated timestamps.
  const MAX_UTTERANCE_CHARS = 500;
  const splitUtterances: Utterance[] = [];

  for (const u of utterances) {
    if (u.text.length <= MAX_UTTERANCE_CHARS) {
      splitUtterances.push(u);
      continue;
    }

    // Split on sentence boundaries (. ! ? followed by space + capital letter)
    const sentences = u.text.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) || [u.text];
    const totalChars = u.text.length;
    const timeSpan = u.end - u.start;
    let charOffset = 0;

    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (!trimmed) continue;

      // Interpolate timestamp proportionally based on character position
      const ratio = totalChars > 0 ? charOffset / totalChars : 0;
      const sentenceStart = u.start + timeSpan * ratio;
      const nextCharOffset = charOffset + sentence.length;
      const nextRatio = totalChars > 0 ? nextCharOffset / totalChars : 1;
      const sentenceEnd = u.start + timeSpan * nextRatio;

      splitUtterances.push({
        start: sentenceStart,
        end: sentenceEnd,
        speaker: u.speaker,
        text: trimmed,
        confidence: u.confidence,
      });

      charOffset = nextCharOffset;
    }
  }

  const finalUtterances = splitUtterances.length > 0 ? splitUtterances : utterances;
  const fullText = finalUtterances.map(u => u.text).join(' ');
  const duration = finalUtterances[finalUtterances.length - 1].end || finalUtterances[finalUtterances.length - 1].start;

  log.info('parseTtmlToDiarized result', {
    rawUtterances: utterances.length,
    afterSplit: finalUtterances.length,
    speakerCount: speakerIds.size,
    duration,
  });

  return {
    utterances: finalUtterances,
    fullText,
    duration,
    speakerCount: speakerIds.size,
  };
}

/**
 * Full pipeline: search for the episode on Apple, then fetch its transcript.
 * Returns a DiarizedTranscript with speaker diarization, or falls back to plain text.
 */
export async function getAppleTranscript(
  podcastTitle: string,
  episodeTitle: string
): Promise<{ text: string; diarized: DiarizedTranscript | null; provider: 'apple-podcasts' } | null> {
  if (!APPLE_BEARER_TOKEN) {
    return null;
  }

  const appleId = await searchAppleEpisode(podcastTitle, episodeTitle);
  if (!appleId) {
    return null;
  }

  const ttml = await fetchAppleTranscript(appleId);
  if (!ttml) {
    return null;
  }

  // Try structured diarized parsing first
  const diarized = parseTtmlToDiarized(ttml);
  if (diarized && diarized.utterances.length > 0) {
    log.info('Parsed Apple TTML to diarized transcript', {
      utterances: diarized.utterances.length,
      speakerCount: diarized.speakerCount,
      duration: diarized.duration,
    });
    return { text: diarized.fullText, diarized, provider: 'apple-podcasts' };
  }

  // Fallback to plain text parsing
  const text = parseTtmlToText(ttml);
  if (text && text.length > 100) {
    log.info('Fell back to plain text TTML parsing', { textLength: text.length });
    return { text, diarized: null, provider: 'apple-podcasts' };
  }

  return null;
}
