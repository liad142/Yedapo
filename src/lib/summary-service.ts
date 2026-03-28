import { createAdminClient } from "@/lib/supabase/admin";
import { transcribeFromUrl, formatTranscriptWithTimestamps, formatTranscriptWithSpeakerNames } from "./deepgram";
import { isVoxtralSupported, transcribeWithVoxtral } from "./voxtral";
import { getAppleTranscript } from "./apple-transcripts";
import { extractYouTubeVideoId } from "@/lib/youtube/utils";
import { fetchYouTubeTranscript } from "@/lib/youtube/transcripts";
import type { YouTubeMetadata } from "@/lib/youtube/transcripts";
import { ensureYouTubeMetadata } from "@/lib/youtube/metadata";
import { acquireLock, releaseLock } from '@/lib/cache';
import { repairJsonString } from '@/lib/json-repair';
import { getModel, DEFAULT_MODELS, withTimeout, generateWithFallback } from '@/lib/gemini';
import type { DiarizedTranscript } from "@/types/deepgram";
import type {
  SummaryLevel,
  SummaryStatus,
  TranscriptStatus,
  QuickSummaryContent,
  DeepSummaryContent
} from "@/types/database";

// Model fallback chains: primary → fallback(s)
const DEEP_MODELS = DEFAULT_MODELS;
const QUICK_MODELS = DEFAULT_MODELS;

/** Get ordered fallback chain for a summary level */
function getModelChain(level: SummaryLevel): readonly string[] {
  return level === 'deep' ? DEEP_MODELS : QUICK_MODELS;
}

// Stale thresholds — centralized to keep cron and API routes aligned
const STALE_THRESHOLDS = {
  TRANSCRIPT: 10 * 60 * 1000,    // 10 min — transcription can be slow
  SUMMARY: 5 * 60 * 1000,        // 5 min — aligned with cron
  CHECK_EXISTING: 5 * 60 * 1000, // 5 min — aligned with cron
};

// Pre-compiled regex patterns for transcript parsing (Fix 3: avoid recompilation in loops)
const SRT_SEQUENCE_RE = /^\d+$/;
const SRT_TIMESTAMP_RE = /^\d{2}:\d{2}:\d{2}[,\.]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[,\.]\d{3}/;
const VTT_CUE_ID_RE = /^[\w-]+$/;
const VTT_TIMESTAMP_RE = /^\d{2}:\d{2}[:\.]?\d{0,2}[,\.]?\d{0,3}\s*-->\s*\d{2}:\d{2}[:\.]?\d{0,2}[,\.]?\d{0,3}/;
const VTT_VOICE_TAG_RE = /<v\s+[^>]+>/gi;
const VTT_VOICE_CLOSE_RE = /<\/v>/gi;
const VTT_CLASS_TAG_RE = /<c[^>]*>/gi;
const VTT_CLASS_CLOSE_RE = /<\/c>/gi;
const VTT_ANY_TAG_RE = /<[^>]+>/g;
const MULTI_SPACE_RE = /\s+/g;

import { createLogger } from "@/lib/logger";
import { SUMMARY_STATUS_PRIORITY } from "@/lib/status-utils";
import { triggerPendingNotifications } from "@/lib/notifications/trigger";
import { getCached, setCached, deleteCached, CacheKeys, CacheTTL } from "@/lib/cache";

const log = createLogger('summary');

/**
 * Attempt to repair common JSON issues from LLM output:
 * - Trailing commas before } or ]
 * - Unescaped control characters inside strings (newlines, tabs)
 * - Unescaped quotes inside strings (best-effort)
 */
// repairJsonString is now imported from @/lib/json-repair

// Speaker identification types
export interface IdentifiedSpeaker {
  id: number;
  name: string;
  role: 'host' | 'guest' | 'unknown';
}

const SPEAKER_ID_PROMPT = `Analyze this podcast transcript and identify the speakers.

Return ONLY a JSON object with this structure:
{
  "speakers": [
    { "id": 0, "name": "John Smith", "role": "host" },
    { "id": 1, "name": "Sarah Johnson", "role": "guest" }
  ]
}

RULES:
- Look for introductions: "Hi, I'm...", "Welcome to...", "Thanks for having me...", "My name is..."
- Look for names mentioned: "Thanks John", "So Sarah, tell us...", "As Mike said..."
- Role "host" = person who welcomes, introduces, asks questions
- Role "guest" = person being interviewed, sharing expertise
- Role "unknown" = can't determine
- If no name found, use descriptive names like "Host", "Guest", "Interviewer", "Expert"
- IMPORTANT: If the transcript is in Hebrew/Spanish/etc., names should still be extracted in their original form
- Always return valid JSON starting with { and ending with }

Transcript sample:
`;

/**
 * Use Claude to identify speaker names from transcript
 */
export async function identifySpeakers(transcript: DiarizedTranscript): Promise<IdentifiedSpeaker[]> {
  log.info('identifySpeakers starting', { 
    speakerCount: transcript.speakerCount,
    utteranceCount: transcript.utterances.length 
  });

  const startTime = Date.now();

  // Sample the beginning of the transcript (first 5 minutes) where introductions usually happen
  // Plus some from the middle and end for context
  const fiveMinutes = 5 * 60;
  const beginningUtterances = transcript.utterances.filter(u => u.start < fiveMinutes);
  
  // Also get some samples from middle (for name mentions)
  const middleStart = transcript.duration / 3;
  const middleEnd = (transcript.duration / 3) * 2;
  const middleUtterances = transcript.utterances
    .filter(u => u.start >= middleStart && u.start < middleEnd)
    .slice(0, 20);

  const sampleUtterances = [...beginningUtterances, ...middleUtterances];
  
  // Format for Claude
  const formattedSample = sampleUtterances
    .map(u => `[Speaker ${u.speaker}]: ${u.text}`)
    .join('\n')
    .substring(0, 15000); // Limit to ~15k chars

  try {
    const systemPrompt = "You are a JSON-only response bot. Return ONLY valid JSON.";
    const fullPrompt = systemPrompt + "\n\n" + SPEAKER_ID_PROMPT + formattedSample;
    
    // Use Flash model for speaker identification (fast, cheap task)
    const speakerModel = getModel('gemini-3-flash-preview');

    const result = await withTimeout(speakerModel.generateContent(fullPrompt), 30_000, 'identifySpeakers');
    const response = result.response;
    const text = response.text();

    // Parse JSON
    let jsonText = text.trim();
    if (!jsonText.startsWith('{')) {
      const first = jsonText.indexOf('{');
      const last = jsonText.lastIndexOf('}');
      if (first !== -1 && last !== -1 && last > first) {
        jsonText = jsonText.slice(first, last + 1);
      } else {
        throw new Error('No JSON found');
      }
    }

    const parsed = JSON.parse(jsonText);
    const speakers: IdentifiedSpeaker[] = (parsed.speakers || []).map((s: { id: number; name: string; role: string }) => ({
      id: s.id,
      name: s.name || `Speaker ${s.id}`,
      role: (['host', 'guest', 'unknown'].includes(s.role) ? s.role : 'unknown') as IdentifiedSpeaker['role'],
    }));

    const duration = Date.now() - startTime;
    log.info('identifySpeakers completed', { 
      durationMs: duration,
      identifiedSpeakers: speakers.map(s => ({ id: s.id, name: s.name, role: s.role }))
    });

    return speakers;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log.warn('identifySpeakers FAILED', { error: errorMsg });
    
    // Return default speaker names on failure
    const defaultSpeakers: IdentifiedSpeaker[] = [];
    for (let i = 0; i < transcript.speakerCount; i++) {
      defaultSpeakers.push({
        id: i,
        name: i === 0 ? 'Host' : `Guest ${i}`,
        role: i === 0 ? 'host' : 'guest'
      });
    }
    return defaultSpeakers;
  }
}

// System message to enforce JSON-only responses
const SYSTEM_MESSAGE = `You are a JSON-only response bot. You MUST respond with ONLY valid JSON - no explanations, no markdown, no text before or after the JSON. Start your response with { and end with }.

CRITICAL JSON RULES:
1. Escape all double quotes inside string values with backslash: \\"
2. Use \\n for newlines inside strings, never raw newlines
3. No trailing commas after the last item in arrays or objects
4. Never say "Based on" or any other text outside the JSON

CRITICAL: You MUST detect the language of the transcript and respond in THE SAME LANGUAGE. This works for ANY language - Hebrew, Spanish, French, German, Japanese, Arabic, Portuguese, Russian, Chinese, or any other. Match the transcript language exactly.`;

// QUICK summary prompt - returns QuickSummaryContent JSON
const QUICK_PROMPT = `You are a senior editor at a top-tier media outlet (like The Economist or TechCrunch).
Your goal is to write a "Teaser Card" that compels the user to consume the full content.

Return ONLY a JSON object with this exact structure:

{
  "hook_headline": "A punchy, provocative 5-10 word headline that captures the essence. NOT 'Summary of episode'.",

  "executive_brief": "2-3 sharp sentences (max 60 words). Don't describe *what* they talked about, describe the *insight* revealed. Start directly with the core conflict or idea.",

  "golden_nugget": "The single most surprising or valuable fact/quote from the episode. The 'I didn't know that' moment.",

  "perfect_for": "Specific audience targeting. E.g., 'Founders raising capital' instead of 'Business people'.",

  "tags": ["tag1", "tag2", "tag3"]
}

RULES:
1. **Language**: CRITICAL - Write ALL content in the SAME LANGUAGE as the transcript.
2. **No Passive Voice**: Avoid "In this episode it is discussed...". Say "The host argues that...".
3. **Curiosity Gap**: The headline and brief should create curiosity.
4. **Specifics over Generalities**: Use specific numbers or names if available in the text.
5. **Speaker Names**: The transcript may use generic labels like "Speaker 1", "Speaker 2". IGNORE these labels. Instead, identify who each speaker is from conversational context — introductions, name mentions, how they address each other, and their role (host vs guest). Use real names in your output whenever identifiable.
`;

// DEEP summary prompt - returns DeepSummaryContent JSON
export const TOPIC_TAGS = [
  'AI & Machine Learning', 'Technology', 'Business & Startups',
  'Science', 'Politics & Government', 'Health & Wellness',
  'Finance & Investing', 'Entertainment', 'Sports',
  'True Crime', 'History', 'Education', 'Psychology',
  'Relationships', 'Culture & Society', 'Music',
  'Comedy', 'News & Current Events', 'Crypto & Web3',
  'Career & Productivity',
] as const;

const DEEP_PROMPT = `You are an expert Ghostwriter and Analyst with a PhD in the subject matter of the transcript.
Your goal is to write a comprehensive "Executive Briefing" that helps the user decide whether to listen and enhances their understanding of the episode's key ideas.

Return ONLY a JSON object with this EXACT structure. Every field is MANDATORY — do NOT omit any field.

{
  "topic_tags": ["Pick 3-5 tags from ONLY this list: ${TOPIC_TAGS.join(', ')}"],

  "comprehensive_overview": "A detailed, multi-paragraph essay (600-900 words, at least 4 paragraphs). MANDATORY: wrap exactly 3-5 of the most important sentences in <<double angle brackets>>. Example: The central claim is that <<quantum computing will make current encryption obsolete within 5 years>>, which forces a rethink of... The first paragraph must open with the central claim and stakes — never start with 'In this episode...'. Cover the full breadth of the discussion: arguments, counter-arguments, evidence cited, expert opinions, and practical implications.",

  "core_concepts": [
    {
      "concept": "Concept name",
      "explanation": "What it is + why it matters in this episode + what it changes for the listener (3-4 sentences).",
      "quote_reference": "A supporting quote from the episode (optional, omit key if none)"
    }
  ],

  "chronological_breakdown": [
    {
      "timestamp": "05:45",
      "timestamp_seconds": 345,
      "title": "Short chapter title (3-8 words)",
      "hook": "One-line curiosity-driven promise of what this section reveals (MANDATORY — never omit)",
      "content": "Detailed paragraph (90-160 words) covering what was said. Include speaker names and specific examples."
    }
  ],

  "contrarian_views": [
    "A 2-3 sentence view. State the contrarian claim, then pick ONE key term the audience may not know (or that is critical to understanding) and explain it. Example: 'Central banks flooding the market with liquidity may actually *increase* inequality. **Cantillon Effect** — the idea that newly printed money benefits those closest to the source first — means asset holders gain while wage earners fall behind.'"
  ],

  "actionable_takeaways": [
    {
      "text": "Verb-first, specific task the listener can do RIGHT NOW (e.g. 'Set up OpenTelemetry tracing for your Next.js app'). Must be concrete enough that the listener knows exactly what to do — not vague advice like 'think about your strategy'.",
      "why": "One sentence explaining WHY this matters — the payoff. E.g. 'Catches 80% of production bugs before users report them'. This is the motivation to act.",
      "effort": "Realistic time estimate: '5min' | '30min' | '1hr' | '2hrs' | 'half-day' | 'ongoing'. Be honest — don't say 5min for something that takes hours.",
      "category": "tool",
      "priority": "high",
      "resources": [
        { "name": "OpenTelemetry", "type": "tool", "url": "https://opentelemetry.io", "context": "Monitoring framework discussed as the backbone for distributed tracing" }
      ]
    }
  ],

  "section_labels": {
    "comprehensive_overview": "<translate 'Comprehensive Overview' to transcript language>",
    "core_concepts": "<translate 'Core Concepts' to transcript language>",
    "episode_flow": "<translate 'Episode Flow' to transcript language>",
    "counterpoints": "<translate 'Counterpoints' to transcript language>",
    "actionable_takeaways": "<translate 'Actionable Takeaways' to transcript language>",
    "counterpoints_subtitle": "<translate 'Alternative perspectives worth considering' to transcript language>",
    "transcript": "<translate 'Transcript' to transcript language>",
    "action_items": "<translate 'Action Items' to transcript language>",
    "discussion": "<translate 'Discussion' to transcript language>"
  }
}

HARD RULES (violations = invalid output):

1. **Language**: ALL content MUST be in the SAME LANGUAGE as the transcript. Hebrew transcript → Hebrew output. No exceptions. No mixing languages within a field.

2. **<<Highlights>> are MANDATORY**: comprehensive_overview MUST contain exactly 3-5 sentences wrapped in <<double angle brackets>>. If your output has zero << >> markers, it is INVALID. Count them before responding.

3. **hook is MANDATORY**: Every item in chronological_breakdown MUST have a non-empty "hook" field. A hook is a one-line promise/insight that makes the reader want to read the section (e.g., "Why the CEO thinks remote work is dead"). If you omit hook from any chapter, the output is INVALID.

4. **Action items MUST be objects with resources, why, and effort**: Every item in actionable_takeaways MUST be a JSON object with "text", "why", "effort", "category", "priority", and "resources" fields. NEVER return a plain string.
   - "text" MUST start with a verb and be specific enough that someone can act on it immediately. BAD: "Consider using AI tools". GOOD: "Install Cursor IDE and migrate your VS Code settings to test AI-assisted coding for one week".
   - "why" MUST explain the concrete payoff in one sentence. BAD: "It's useful". GOOD: "Reduces code review time by ~40% based on the guest's team metrics".
   - "effort" MUST be a realistic time estimate: "5min" | "15min" | "30min" | "1hr" | "2hrs" | "half-day" | "ongoing".
   - Categories: tool/repo/concept/strategy/resource/habit. Priority: high/medium/low.
   - "resources" array MUST contain at least 1 resource per action item. If the episode or video description mentions a URL, include it in the "url" field. Otherwise omit "url" and let the app generate a search link. IMPORTANT: Check the VIDEO DESCRIPTION and DESCRIPTION LINKS sections for real URLs to include.
   - An empty resources array is INVALID.

5. **Contrarian views**: 4-8 views. Each view MUST be 2-3 sentences: state the contrarian claim, then bold ONE key term (**Term**) and interpret it for the reader. Every view must contain exactly one **bolded term** with an explanation.

6. **Core concepts**: 4-8 concept cards. Each explanation should cover what it is, why it matters here, and what it implies for the listener.

7. **Timestamps**: The transcript may include [MM:SS] timestamps. Set "timestamp" to the EXACT [MM:SS] where the topic begins, and "timestamp_seconds" to total seconds. If no timestamps exist, use "00:00" and 0.

8. **Tone**: Professional, analytical, engaging. Write directly: "Israel's geopolitical situation is shifting because..." — never "The speakers discussed..."

9. **No fluff**: Never start with "In this interesting/fascinating episode...". Dive straight into the content.

10. **Speaker Names**: The transcript may use generic labels like "Speaker 1", "Speaker 2". IGNORE these labels — they carry no meaning. Instead, identify who each speaker is from conversational context: introductions ("I'm Joe Rogan"), name mentions ("So Rachel, what do you think?"), how guests are addressed, and their role (host vs guest). ALWAYS use real names in your output (chronological_breakdown content, quotes, etc.). Never write "Speaker 1 said..." — write "Joe Rogan said..." or "the host argued...".

11. **section_labels MUST be translated**: The section_labels object MUST contain all 9 keys with their values translated into the transcript's language. Hebrew transcript → Hebrew labels. English transcript → English labels. Never leave the placeholder text.

12. **topic_tags**: Select exactly 3-5 tags from the provided list. Use ONLY tags from the list — do not invent new ones. Tags must be in English regardless of transcript language.

SELF-CHECK before responding:
- Does topic_tags contain 3-5 tags from the provided list? If not → fix it.
- Does comprehensive_overview contain 3-5 << >> markers? If not → fix it.
- Does every chronological_breakdown item have a non-empty "hook"? If not → fix it.
- Is every actionable_takeaway an object with text/why/effort/category/priority/resources where resources has ≥1 item? If not → fix it.
- Is ALL text in the transcript's language? If not → fix it.
- Are section_labels values translated to the transcript's language? If not → fix it.
- Does any text say "Speaker 1" or "Speaker 2"? If so → replace with real names from context, or "the host"/"the guest" if unidentifiable.
`;


/**
 * Fetch transcript text from a URL (supports SRT, VTT, plain text formats)
 * This is the FREE option - no Deepgram costs!
 */
async function fetchTranscriptFromUrl(transcriptUrl: string): Promise<string | null> {
  log.info('Attempting to fetch transcript from RSS URL (FREE)', { url: transcriptUrl.substring(0, 100) });
  
  try {
    const response = await fetch(transcriptUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    if (!response.ok) {
      log.warn('Transcript fetch failed', { status: response.status, statusText: response.statusText });
      return null;
    }

    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();

    if (!text || text.trim().length < 50) {
      log.info('Transcript too short or empty', { length: text?.length });
      return null;
    }

    // Parse based on content type or file extension
    let parsed: string;
    if (contentType.includes('srt') || transcriptUrl.toLowerCase().endsWith('.srt')) {
      parsed = parseSrtToText(text);
    } else if (contentType.includes('vtt') || transcriptUrl.toLowerCase().endsWith('.vtt')) {
      parsed = parseVttToText(text);
    } else if (contentType.includes('json') || transcriptUrl.toLowerCase().endsWith('.json')) {
      parsed = parseJsonTranscript(text);
    } else {
      // Assume plain text - just clean it up
      parsed = text.trim();
    }

    log.info('Transcript fetched and parsed successfully (FREE)', { 
      originalLength: text.length, 
      parsedLength: parsed.length,
      format: contentType || 'unknown'
    });

    return parsed;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log.error('Transcript fetch error', { error: errorMsg });
    return null;
  }
}

/**
 * Parse SRT format to plain text
 * SRT format: sequential number, timestamp line, text lines, blank line
 */
function parseSrtToText(srt: string): string {
  const lines = srt.split('\n');
  const textLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip sequence numbers (just digits)
    if (SRT_SEQUENCE_RE.test(trimmed)) {
      continue;
    }

    // Skip timestamp lines (00:00:00,000 --> 00:00:00,000)
    if (SRT_TIMESTAMP_RE.test(trimmed)) {
      continue;
    }

    // Skip empty lines
    if (trimmed === '') {
      continue;
    }

    // This is actual text content
    textLines.push(trimmed);
  }

  return textLines.join(' ').replace(MULTI_SPACE_RE, ' ').trim();
}

/**
 * Parse VTT format to plain text
 * VTT format similar to SRT but with WEBVTT header
 */
function parseVttToText(vtt: string): string {
  const lines = vtt.split('\n');
  const textLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip WEBVTT header and metadata
    if (trimmed.startsWith('WEBVTT') || trimmed.startsWith('NOTE') || trimmed.startsWith('STYLE')) {
      continue;
    }

    // Skip cue identifiers (if present)
    if (VTT_CUE_ID_RE.test(trimmed) && !trimmed.includes(' ')) {
      continue;
    }

    // Skip timestamp lines (00:00:00.000 --> 00:00:00.000)
    if (VTT_TIMESTAMP_RE.test(trimmed)) {
      continue;
    }

    // Skip empty lines
    if (trimmed === '') {
      continue;
    }

    // Strip VTT tags like <v Speaker Name>, <c>, </c>, etc.
    const cleanedLine = trimmed
      .replace(VTT_VOICE_TAG_RE, '')   // Voice tags
      .replace(VTT_VOICE_CLOSE_RE, '')
      .replace(VTT_CLASS_TAG_RE, '')   // Class tags
      .replace(VTT_CLASS_CLOSE_RE, '')
      .replace(VTT_ANY_TAG_RE, '')     // Any other tags
      .trim();

    if (cleanedLine) {
      textLines.push(cleanedLine);
    }
  }

  return textLines.join(' ').replace(MULTI_SPACE_RE, ' ').trim();
}

/**
 * Parse JSON transcript formats (various schemas)
 */
function parseJsonTranscript(json: string): string {
  try {
    const data = JSON.parse(json);
    
    // Handle array of segments
    if (Array.isArray(data)) {
      return data
        .map((item: unknown) => {
          if (typeof item === 'string') return item;
          if (typeof item === 'object' && item !== null) {
            const obj = item as Record<string, unknown>;
            return obj.text || obj.transcript || obj.content || '';
          }
          return '';
        })
        .filter(Boolean)
        .join(' ');
    }

    // Handle object with segments/utterances array
    if (data.segments || data.utterances || data.results) {
      const segments = data.segments || data.utterances || data.results;
      if (Array.isArray(segments)) {
        return segments
          .map((s: unknown) => {
            if (typeof s === 'object' && s !== null) {
              const obj = s as Record<string, unknown>;
              return obj.text || obj.transcript || '';
            }
            return '';
          })
          .filter(Boolean)
          .join(' ');
      }
    }

    // Handle object with direct text/transcript field
    if (data.text) return String(data.text);
    if (data.transcript) return String(data.transcript);

    // Fallback - stringify and clean
    return JSON.stringify(data);
  } catch {
    return json; // Return as-is if not valid JSON
  }
}

export async function ensureTranscript(
  episodeId: string,
  audioUrl: string,
  language = 'en',
  transcriptUrl?: string,  // Optional RSS transcript URL (FREE option!)
  metadata?: { podcastTitle: string; episodeTitle: string }  // For Apple Podcasts lookup
): Promise<{
  status: TranscriptStatus;
  text?: string;
  transcript?: DiarizedTranscript;
  pendingSpeakerIdentification?: boolean;
  error?: string;
}> {
  const supabase = createAdminClient();
  const startTime = Date.now();
  log.info('ensureTranscript started', {
    episodeId,
    audioUrl: audioUrl.substring(0, 80) + '...',
    language,
    hasTranscriptUrl: !!transcriptUrl
  });

  // Check if transcript exists
  log.info('Checking for existing transcript...');
  const dbCheckStart = Date.now();
  const { data: existing } = await supabase
    .from('transcripts')
    .select('id, episode_id, status, language, full_text, diarized_json, error_message, created_at, updated_at')
    .eq('episode_id', episodeId)
    .eq('language', language)
    .single();
  log.info('DB check completed', { durationMs: Date.now() - dbCheckStart, found: !!existing, status: existing?.status });

  if (existing) {
    if (existing.status === 'ready' && existing.full_text) {
      log.info('Returning cached transcript', { textLength: existing.full_text.length });
      // Also return diarized_json if available
      const diarizedTranscript = existing.diarized_json as DiarizedTranscript | null;
      return {
        status: 'ready',
        text: existing.full_text,
        transcript: diarizedTranscript || undefined
      };
    }
    if (existing.status === 'failed') {
      log.info('Previous transcript failed, will retry', { error: existing.error_message });
      // Don't return early - allow retry by continuing to transcription
    }
    if (existing.status === 'queued' || existing.status === 'transcribing') {
      const updatedAt = existing.updated_at ? new Date(existing.updated_at).getTime() : 0;
      const isStale = Date.now() - updatedAt > STALE_THRESHOLDS.TRANSCRIPT;

      if (isStale) {
        log.warn('Transcript is STALE - resetting to retry', {
          status: existing.status,
          updatedAt: existing.updated_at,
          staleForMs: Date.now() - updatedAt
        });
        await supabase
          .from('transcripts')
          .update({ status: 'failed', updated_at: new Date().toISOString() })
          .eq('episode_id', episodeId)
          .eq('language', language);
        // Fall through to retry
      } else {
        log.info('Transcript already in progress', { status: existing.status });
        return { status: existing.status };
      }
    }
  }

  // Create or update transcript record directly as transcribing (Fix 1: single DB write)
  log.info('Creating transcript record (transcribing)...');
  const { error: upsertError } = await supabase
    .from('transcripts')
    .upsert({
      episode_id: episodeId,
      language,
      status: 'transcribing',
      updated_at: new Date().toISOString()
    }, { onConflict: 'episode_id,language' });

  if (upsertError) {
    log.error('DB upsert error', { error: upsertError });
    return { status: 'failed', error: 'Database error' };
  }

  try {
    let transcriptText: string | null = null;
    let provider = 'deepgram';
    let diarizedTranscript: DiarizedTranscript | null = null;
    let pendingSpeakerIdentification = false;

    // ============================================
    // PRIORITY 0: YouTube captions (FREE, fast)
    // YouTube watch URLs are HTML pages, not audio — audio transcription will always fail.
    // Instead, fetch captions directly via youtube-transcript-plus package.
    // ============================================
    const youtubeVideoId = extractYouTubeVideoId(audioUrl);
    if (!transcriptText && youtubeVideoId) {
      log.info('PRIORITY 0: YouTube URL detected, fetching captions...', { youtubeVideoId });
      try {
        const ytResult = await fetchYouTubeTranscript(youtubeVideoId);
        if (ytResult) {
          transcriptText = ytResult.text;
          provider = 'youtube-captions';
          diarizedTranscript = {
            utterances: [{ start: 0, end: 0, speaker: 0, text: transcriptText, confidence: 1.0 }],
            fullText: transcriptText,
            duration: 0,
            speakerCount: 1,
            detectedLanguage: language,
          };
          log.info('SUCCESS: Got YouTube captions!', { textLength: transcriptText.length });
        } else {
          log.warn('PRIORITY 0 FAILED: No YouTube captions available');
        }
      } catch (ytError) {
        const errorMsg = ytError instanceof Error ? ytError.message : String(ytError);
        log.error('PRIORITY 0 ERROR: YouTube caption fetch failed', { error: errorMsg });
      }
    }

    // ============================================
    // PRIORITY A+: Try Apple Podcasts transcript (FREE, instant!)
    // Apple has 125M+ episodes already transcribed
    // ============================================
    if (metadata?.podcastTitle && metadata?.episodeTitle) {
      log.info('PRIORITY A+: Attempting Apple Podcasts transcript (FREE, instant)...');
      try {
        const appleResult = await getAppleTranscript(metadata.podcastTitle, metadata.episodeTitle);
        if (appleResult) {
          provider = appleResult.provider;

          if (appleResult.diarized && appleResult.diarized.speakerCount > 1) {
            // Multi-speaker: defer identifySpeakers to run in parallel with summary generation
            diarizedTranscript = appleResult.diarized;
            diarizedTranscript.detectedLanguage = language;
            // Use generic "Speaker X" labels for now — real names will be identified
            // concurrently with summary generation in requestSummary
            transcriptText = formatTranscriptWithSpeakerNames(diarizedTranscript);
            pendingSpeakerIdentification = true;
            log.info('Apple diarized transcript ready (speaker names deferred for parallel execution)', {
              speakerCount: diarizedTranscript.speakerCount,
              utterances: diarizedTranscript.utterances.length,
            });
          } else if (appleResult.diarized) {
            // Single speaker: use diarized structure but skip speaker identification
            diarizedTranscript = appleResult.diarized;
            diarizedTranscript.detectedLanguage = language;
            transcriptText = appleResult.text;
          } else {
            // Fallback: plain text only (no diarization available)
            transcriptText = appleResult.text;
            diarizedTranscript = {
              utterances: [{ start: 0, end: 0, speaker: 0, text: transcriptText, confidence: 1.0 }],
              fullText: transcriptText,
              duration: 0,
              speakerCount: 1,
              detectedLanguage: language,
            };
          }

          log.info('SUCCESS: Got FREE transcript from Apple Podcasts!', {
            textLength: transcriptText.length,
            speakerCount: diarizedTranscript.speakerCount,
            hasSpeakerNames: !!diarizedTranscript.speakers?.length,
            saved: 'Deepgram/Voxtral API costs + ~5 min transcription time',
          });
        } else {
          log.warn('PRIORITY A+ FAILED: Apple transcript not available, trying RSS...');
        }
      } catch (appleError) {
        const errorMsg = appleError instanceof Error ? appleError.message : String(appleError);
        log.error('PRIORITY A+ ERROR: Apple transcript fetch failed', { error: errorMsg });
      }
    }

    // ============================================
    // PRIORITY A: Try to fetch transcript from RSS URL (FREE!)
    // ============================================
    if (!transcriptText && transcriptUrl) {
      log.info('PRIORITY A: Attempting FREE transcript fetch from RSS URL...');
      transcriptText = await fetchTranscriptFromUrl(transcriptUrl);
      
      if (transcriptText && transcriptText.length > 100) {
        provider = 'rss-transcript';
        log.info('SUCCESS: Got FREE transcript from RSS!', { 
          textLength: transcriptText.length,
          saved: 'Deepgram API costs'
        });
        
        // Create a simple diarized transcript structure for RSS transcripts
        diarizedTranscript = {
          utterances: [{
            start: 0,
            end: 0,
            speaker: 0,
            text: transcriptText,
            confidence: 1.0
          }],
          fullText: transcriptText,
          duration: 0,
          speakerCount: 1,
          detectedLanguage: language
        };
      } else {
        log.warn('PRIORITY A FAILED: RSS transcript fetch failed or too short, falling back to Deepgram');
      }
    }

    // ============================================
    // PRIORITY B1: Use Voxtral if language is supported (cheaper, built-in diarization)
    // Skip for YouTube URLs — they return HTML, not audio
    // ============================================
    if (!transcriptText && !youtubeVideoId && isVoxtralSupported(language)) {
      log.info('PRIORITY B1: Language supported by Voxtral, attempting Voxtral transcription...', { language });
      try {
        const voxtralStart = Date.now();
        diarizedTranscript = await transcribeWithVoxtral(audioUrl, language);
        provider = 'voxtral';
        log.info('Voxtral transcription succeeded', {
          durationMs: Date.now() - voxtralStart,
          utteranceCount: diarizedTranscript.utterances.length,
          speakerCount: diarizedTranscript.speakerCount,
        });

        // Check if transcription produced content
        if (!diarizedTranscript.fullText || diarizedTranscript.fullText.trim().length === 0) {
          log.info('Voxtral returned empty transcript, falling back to Deepgram');
          diarizedTranscript = null;
          provider = 'deepgram';
        } else {
          // Voxtral gives speaker labels (speaker_0, speaker_1) but NOT names.
          // Still call identifySpeakers() for name extraction from transcript context.
          log.info('Identifying speakers with LLM (Voxtral path)...');
          const speakers = await identifySpeakers(diarizedTranscript);
          diarizedTranscript.speakers = speakers;
          transcriptText = formatTranscriptWithSpeakerNames(diarizedTranscript);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        log.warn('Voxtral transcription FAILED, falling back to Deepgram', { error: errorMsg });
        // Reset for Deepgram fallback
        diarizedTranscript = null;
        provider = 'deepgram';
      }
    } else if (!transcriptText && !youtubeVideoId) {
      log.info('PRIORITY B1: Language not supported by Voxtral, skipping to Deepgram', { language });
    }

    // ============================================
    // PRIORITY B2: Use Deepgram with explicit language (fallback)
    // Skip for YouTube URLs — they return HTML, not audio
    // ============================================
    if (!transcriptText && !youtubeVideoId) {
      log.info('PRIORITY B: Starting transcription via Deepgram with explicit language...');
      const transcribeStart = Date.now();
      
      // ALWAYS pass language explicitly to Deepgram - this avoids paying for language detection
      // and improves transcription accuracy
      log.info('Passing explicit language to Deepgram', { language });
      diarizedTranscript = await transcribeFromUrl(audioUrl, language);
      
      const formattedText = formatTranscriptWithTimestamps(diarizedTranscript);
      log.info('Deepgram transcription completed', {
        durationMs: Date.now() - transcribeStart,
        durationSec: ((Date.now() - transcribeStart) / 1000).toFixed(1),
        textLength: formattedText.length,
        utteranceCount: diarizedTranscript.utterances.length,
        speakerCount: diarizedTranscript.speakerCount,
        detectedLanguage: diarizedTranscript.detectedLanguage
      });

      // Check if transcription produced any content
      if (!diarizedTranscript.fullText || diarizedTranscript.fullText.trim().length === 0) {
        const errorMsg = 'Transcription returned empty - audio may be unsupported or corrupted';
        log.info('Transcription returned empty content', { 
          utteranceCount: diarizedTranscript.utterances.length,
          fullTextLength: diarizedTranscript.fullText?.length || 0
        });
        await supabase
          .from('transcripts')
          .update({ status: 'failed', error_message: errorMsg })
          .eq('episode_id', episodeId)
          .eq('language', language);
        return { status: 'failed', error: errorMsg };
      }

      // Identify speakers using LLM
      log.info('Identifying speakers with LLM...');
      const speakers = await identifySpeakers(diarizedTranscript);
      diarizedTranscript.speakers = speakers;

      // Re-format transcript with identified speaker names
      transcriptText = formatTranscriptWithSpeakerNames(diarizedTranscript);
    }

    // If we still have no transcript at this point, fail gracefully
    if (!transcriptText) {
      const errorMsg = youtubeVideoId
        ? 'YouTube captions not available for this video'
        : 'All transcription methods failed';
      log.error('No transcript obtained', { errorMsg });
      await supabase
        .from('transcripts')
        .update({ status: 'failed', error_message: errorMsg })
        .eq('episode_id', episodeId)
        .eq('language', language);
      return { status: 'failed', error: errorMsg };
    }

    // Save transcript to DB (language is known from RSS feed)
    log.info('Saving transcript to DB...', { provider, language });
    const saveStart = Date.now();
    await supabase
      .from('transcripts')
      .update({
        status: 'ready',
        full_text: transcriptText,
        diarized_json: diarizedTranscript,
        provider
      })
      .eq('episode_id', episodeId)
      .eq('language', language);
    log.info('Transcript saved', { durationMs: Date.now() - saveStart });

    log.info('ensureTranscript completed successfully', { 
      totalDurationMs: Date.now() - startTime,
      language,
      provider,
      wasFree: provider === 'rss-transcript' || provider === 'apple-podcasts'
    });
    return { status: 'ready', text: transcriptText, transcript: diarizedTranscript || undefined, pendingSpeakerIdentification };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Transcription failed';
    log.error('Transcription FAILED', { error: errorMsg, totalDurationMs: Date.now() - startTime });
    await supabase
      .from('transcripts')
      .update({ status: 'failed', error_message: errorMsg })
      .eq('episode_id', episodeId)
      .eq('language', language);

    return { status: 'failed', error: errorMsg };
  }
}

export async function generateSummaryForLevel(
  episodeId: string,
  level: SummaryLevel,
  transcriptText: string,
  language = 'en',
  diarizedTranscript?: DiarizedTranscript,
  youtubeContext?: { description: string; chapters: { title: string; startSeconds: number }[]; descriptionLinks: { url: string; text: string }[] }
): Promise<{ status: SummaryStatus; content?: QuickSummaryContent | DeepSummaryContent; error?: string }> {
  const supabase = createAdminClient();
  const startTime = Date.now();
  log.info('generateSummaryForLevel started', { episodeId, level, language, transcriptLength: transcriptText.length });

  // Update status to summarizing
  log.info('Updating status to summarizing...');
  await supabase
    .from('summaries')
    .update({ status: 'summarizing' })
    .eq('episode_id', episodeId)
    .eq('level', level)
    .eq('language', language);

  try {
    const prompt = level === 'quick' ? QUICK_PROMPT : DEEP_PROMPT;

    // Use up to 150k characters of transcript (leaves room for prompt and response)
    const maxTranscriptChars = 150000;

    // For deep summaries, use diarized transcript with timestamps when available
    // This enables Gemini to extract real timestamps for chronological_breakdown
    let inputTranscript = transcriptText;
    if (level === 'deep' && diarizedTranscript?.utterances && diarizedTranscript.utterances.length > 0) {
      const timestampedTranscript = formatTranscriptWithTimestamps(diarizedTranscript);
      if (timestampedTranscript.length > 0) {
        inputTranscript = timestampedTranscript;
        log.info('Using diarized transcript with timestamps for deep summary', {
          utteranceCount: diarizedTranscript.utterances.length,
          timestampedLength: timestampedTranscript.length
        });
      }
    }

    let truncatedTranscript = inputTranscript.length > maxTranscriptChars
      ? inputTranscript.substring(0, maxTranscriptChars) + '\n\n[... transcript truncated for length ...]'
      : inputTranscript;

    // Append YouTube context to give the AI real data about links, chapters, and description
    if (youtubeContext) {
      const contextParts: string[] = ['\n\n--- VIDEO DESCRIPTION ---', youtubeContext.description.substring(0, 3000)];

      if (youtubeContext.chapters.length > 0) {
        contextParts.push('\n--- CREATOR CHAPTERS ---');
        contextParts.push(youtubeContext.chapters.map(ch => {
          const mins = Math.floor(ch.startSeconds / 60);
          const secs = ch.startSeconds % 60;
          return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')} - ${ch.title}`;
        }).join('\n'));
      }

      if (youtubeContext.descriptionLinks.length > 0) {
        contextParts.push('\n--- DESCRIPTION LINKS ---');
        contextParts.push(youtubeContext.descriptionLinks.slice(0, 20).map(l => l.url).join('\n'));
      }

      truncatedTranscript += contextParts.join('\n');
      log.info('Appended YouTube context to prompt', {
        descriptionLength: youtubeContext.description.length,
        chapterCount: youtubeContext.chapters.length,
        linkCount: youtubeContext.descriptionLinks.length,
      });
    }

    const inputLength = (prompt + truncatedTranscript).length;
    log.info(`Generating ${level.toUpperCase()} Summary via Gemini...`, {
      models: getModelChain(level),
      level,
      inputLength,
      transcriptTruncated: inputTranscript.length > maxTranscriptChars,
      usedDiarizedTranscript: level === 'deep' && inputTranscript !== transcriptText
    });

    const apiStart = Date.now();
    const fullPrompt = SYSTEM_MESSAGE + "\n\n" + prompt + truncatedTranscript;

    const { text, modelUsed } = await generateWithFallback(fullPrompt, getModelChain(level));

    log.info(`Gemini API completed for ${level.toUpperCase()} Summary`, {
      model: modelUsed,
      durationMs: Date.now() - apiStart,
      durationSec: ((Date.now() - apiStart) / 1000).toFixed(1)
    });

    log.info('Parsing JSON response...', { responseLength: text.length });

    // Try to extract JSON from the response (in case model added text before/after)
    let jsonText = text.trim();

    // If response doesn't start with {, try to find JSON in the response
    if (!jsonText.startsWith('{')) {
      const first = jsonText.indexOf('{');
      const last = jsonText.lastIndexOf('}');
      if (first !== -1 && last !== -1 && last > first) {
        log.info('Extracted JSON from wrapped response');
        jsonText = jsonText.slice(first, last + 1);
      } else {
        log.info('No JSON found in response', { responsePreview: text.substring(0, 500) });
        throw new Error('No JSON object found in response');
      }
    }

    // Try to parse JSON, with repair on failure
    let content: QuickSummaryContent | DeepSummaryContent;
    try {
      content = JSON.parse(jsonText);
    } catch (parseError) {
      const parseMsg = parseError instanceof Error ? parseError.message : String(parseError);
      // Log the area around the failure for debugging
      const posMatch = parseMsg.match(/position (\d+)/);
      const failPos = posMatch ? parseInt(posMatch[1]) : -1;
      log.warn('Initial JSON parse failed, attempting repair...', {
        error: parseMsg,
        failContext: failPos >= 0 ? jsonText.substring(Math.max(0, failPos - 60), failPos + 60) : undefined
      });
      const repaired = repairJsonString(jsonText);
      try {
        content = JSON.parse(repaired);
        log.info('JSON repair succeeded');
      } catch (repairError) {
        const repairMsg = repairError instanceof Error ? repairError.message : String(repairError);
        log.error('JSON repair also failed', { error: repairMsg });
        throw new Error(`Invalid JSON from Gemini (repair failed): ${parseMsg}`);
      }
    }

    log.info('Saving summary to DB...');
    const saveStart = Date.now();
    await supabase
      .from('summaries')
      .update({
        status: 'ready',
        content_json: content,
        error_message: null
      })
      .eq('episode_id', episodeId)
      .eq('level', level)
      .eq('language', language);
    log.info('Summary saved', { durationMs: Date.now() - saveStart });

    // Invalidate stale status caches so the insights page picks up the new summary
    try {
      const { deleteCached, CacheKeys } = await import('@/lib/cache');
      await Promise.all([
        deleteCached(CacheKeys.insightsStatus(episodeId, language)),
        deleteCached(CacheKeys.summaryStatus(episodeId, language)),
      ]);
      log.info('Invalidated status caches', { episodeId, language });
    } catch (cacheErr) {
      log.warn('Cache invalidation failed (non-blocking)', { error: String(cacheErr) });
    }

    // Trigger pending notifications (non-blocking)
    try {
      await triggerPendingNotifications(episodeId);
    } catch (notifError) {
      log.warn('Notification trigger failed (non-blocking)', { episodeId, error: String(notifError) });
    }

    log.info('generateSummaryForLevel completed successfully', {
      level,
      totalDurationMs: Date.now() - startTime,
      totalDurationSec: ((Date.now() - startTime) / 1000).toFixed(1)
    });
    return { status: 'ready', content };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Summary generation failed';
    log.error('Summary generation FAILED', { error: errorMsg, totalDurationMs: Date.now() - startTime });
    await supabase
      .from('summaries')
      .update({ status: 'failed', error_message: errorMsg })
      .eq('episode_id', episodeId)
      .eq('level', level)
      .eq('language', language);

    // Invalidate stale caches so polling sees the failure
    try {
      const { deleteCached, CacheKeys } = await import('@/lib/cache');
      await Promise.all([
        deleteCached(CacheKeys.insightsStatus(episodeId, language)),
        deleteCached(CacheKeys.summaryStatus(episodeId, language)),
      ]);
    } catch {}

    return { status: 'failed', error: errorMsg };
  }
}

/**
 * Quick check for existing summary — returns immediately without starting generation.
 * Used by the API route to return cached/in-progress results without blocking.
 */
export async function checkExistingSummary(
  episodeId: string,
  level: SummaryLevel,
  language = 'en'
): Promise<{ status: SummaryStatus; content?: QuickSummaryContent | DeepSummaryContent } | null> {
  const supabase = createAdminClient();
  const { data: existingSummaries } = await supabase
    .from('summaries')
    .select('id, status, content_json, updated_at')
    .eq('episode_id', episodeId)
    .eq('level', level)
    .eq('language', language);

  if (!existingSummaries || existingSummaries.length === 0) return null;

  // Find the best summary by status priority
  let best: any = null;
  let bestPriority = 0;
  for (const summary of existingSummaries) {
    const priority = SUMMARY_STATUS_PRIORITY[summary.status] || 0;
    if (priority > bestPriority) {
      bestPriority = priority;
      best = summary;
    }
  }

  if (!best) return null;

  if (best.status === 'ready' && best.content_json) {
    return { status: 'ready', content: best.content_json };
  }
  if (['transcribing', 'summarizing'].includes(best.status)) {
    // Check for stale summaries
    const updatedAt = best.updated_at ? new Date(best.updated_at).getTime() : 0;
    if (Date.now() - updatedAt > STALE_THRESHOLDS.CHECK_EXISTING) {
      return null; // Stale — let requestSummary retry
    }
    return { status: best.status as SummaryStatus };
  }
  // 'queued' means eagerly created — don't treat as in-progress, let generation proceed
  // Failed or other — let requestSummary retry
  return null;
}

export async function requestSummary(
  episodeId: string,
  level: SummaryLevel,
  audioUrl: string,
  language = 'en',
  transcriptUrl?: string,
  metadata?: { podcastTitle: string; episodeTitle: string }
): Promise<{ status: SummaryStatus; content?: QuickSummaryContent | DeepSummaryContent }> {
  const supabase = createAdminClient();
  const startTime = Date.now();
  log.info('=== requestSummary STARTED ===', { episodeId, level, language, hasTranscriptUrl: !!transcriptUrl, hasMetadata: !!metadata });

  // Check existing summary
  log.info('Checking for existing summary...');
  const checkStart = Date.now();
  
  // Fetch ALL summaries for this episode/level/language (not .single() to handle duplicates)
  const { data: existingSummaries } = await supabase
    .from('summaries')
    .select('id, episode_id, level, status, language, content_json, error_message, created_at, updated_at')
    .eq('episode_id', episodeId)
    .eq('level', level)
    .eq('language', language);
  
  // Find the BEST summary (highest priority status)
  let existing: any = null;
  let bestPriority = 0;
  
  if (existingSummaries && existingSummaries.length > 0) {
    for (const summary of existingSummaries) {
      const priority = SUMMARY_STATUS_PRIORITY[summary.status] || 0;
      if (priority > bestPriority) {
        bestPriority = priority;
        existing = summary;
      }
    }
  }
  
  log.info('Existing summary check completed', { 
    durationMs: Date.now() - checkStart, 
    found: !!existing,
    totalFound: existingSummaries?.length || 0,
    status: existing?.status 
  });

  if (existing) {
    if (existing.status === 'ready' && existing.content_json) {
      log.info('Returning cached summary', { totalDurationMs: Date.now() - startTime });
      return { status: 'ready', content: existing.content_json };
    }
    if (['transcribing', 'summarizing'].includes(existing.status)) {
      // Check for stale summaries stuck in processing
      const updatedAt = existing.updated_at ? new Date(existing.updated_at).getTime() : 0;
      const isStale = Date.now() - updatedAt > STALE_THRESHOLDS.SUMMARY;

      if (isStale) {
        log.info('Summary is STALE - resetting to retry', {
          status: existing.status,
          updatedAt: existing.updated_at,
          staleForMs: Date.now() - updatedAt
        });
        // Reset to failed so it gets retried below
        await supabase
          .from('summaries')
          .update({ status: 'failed', updated_at: new Date().toISOString() })
          .eq('id', existing.id);
      } else {
        log.info('Summary already in progress', { status: existing.status, totalDurationMs: Date.now() - startTime });
        return { status: existing.status as SummaryStatus };
      }
    }
    // 'queued' means the API route eagerly created the row — proceed to generation
    log.info('Summary exists but needs retry', { status: existing.status });
    // If failed or not_ready, we'll try again
  }

  // Acquire distributed lock to prevent duplicate generation
  const lockKey = `lock:summary:${episodeId}:${level}:${language}`;
  // 90s TTL: enough for Hobby 60s timeout + buffer, expires fast if function dies
  const gotLock = await acquireLock(lockKey, 90);
  if (!gotLock) {
    log.info('Summary generation already in progress (locked)', { episodeId, level });
    return { status: 'transcribing' as SummaryStatus };
  }

  try {
    // Create summary record directly as transcribing (Fix 1: single DB write)
    log.info('Creating summary record (transcribing)...');
    await supabase
      .from('summaries')
      .upsert({
        episode_id: episodeId,
        level,
        language,
        status: 'transcribing',
        updated_at: new Date().toISOString()
      }, { onConflict: 'episode_id,level,language' });

    // Ensure transcript exists (this is blocking for now, could be async)
    log.info('Calling ensureTranscript...', { hasTranscriptUrl: !!transcriptUrl, hasMetadata: !!metadata });
    const transcriptResult = await ensureTranscript(episodeId, audioUrl, language, transcriptUrl, metadata);
    log.info('ensureTranscript returned', { status: transcriptResult.status, hasText: !!transcriptResult.text, hasTranscript: !!transcriptResult.transcript, error: transcriptResult.error });

    if (transcriptResult.status !== 'ready' || !transcriptResult.text) {
      // Update summary status to match transcript status
      const summaryStatus: SummaryStatus = transcriptResult.status === 'failed' ? 'failed' : 'transcribing';
      log.info('Transcript not ready, updating summary status', { summaryStatus });
      await supabase
        .from('summaries')
        .update({
          status: summaryStatus,
          error_message: transcriptResult.error || null
        })
        .eq('episode_id', episodeId)
        .eq('level', level)
        .eq('language', language);

      log.info('=== requestSummary ENDED (transcript not ready) ===', { totalDurationMs: Date.now() - startTime });
      return { status: summaryStatus };
    }

    // Fetch YouTube metadata context if this is a YouTube episode
    let youtubeContext: { description: string; chapters: { title: string; startSeconds: number }[]; descriptionLinks: { url: string; text: string }[] } | undefined;
    const ytVideoId = extractYouTubeVideoId(audioUrl);
    if (ytVideoId) {
      try {
        const ytMeta = await ensureYouTubeMetadata(episodeId, ytVideoId);
        if (ytMeta) {
          youtubeContext = {
            description: ytMeta.description,
            chapters: ytMeta.chapters,
            descriptionLinks: ytMeta.description_links,
          };
          log.info('YouTube metadata context loaded for summary generation', {
            chapters: ytMeta.chapters.length,
            links: ytMeta.description_links.length,
          });
        }
      } catch (err) {
        log.warn('YouTube metadata fetch failed (non-blocking)', { error: String(err) });
      }
    }

    // Generate the summary (language is known from RSS feed)
    // If speaker identification is pending (Apple multi-speaker), run it in parallel
    // with summary generation to save ~20s
    if (transcriptResult.pendingSpeakerIdentification && transcriptResult.transcript) {
      log.info('Running identifySpeakers in PARALLEL with generateSummaryForLevel...', { language });
      const [result, speakers] = await Promise.all([
        generateSummaryForLevel(episodeId, level, transcriptResult.text, language, transcriptResult.transcript, youtubeContext),
        identifySpeakers(transcriptResult.transcript),
      ]);

      // Update transcript in DB with real speaker names (non-blocking for the response)
      if (speakers.length > 0) {
        transcriptResult.transcript.speakers = speakers;
        const namedTranscript = formatTranscriptWithSpeakerNames(transcriptResult.transcript);
        log.info('Updating transcript with identified speaker names...', {
          speakers: speakers.map(s => ({ id: s.id, name: s.name, role: s.role })),
        });
        const { error: speakerUpdateError } = await supabase
          .from('transcripts')
          .update({
            full_text: namedTranscript,
            diarized_json: transcriptResult.transcript,
          })
          .eq('episode_id', episodeId)
          .eq('language', transcriptResult.transcript.detectedLanguage || 'en');
        if (speakerUpdateError) log.error('Failed to update transcript with speaker names', { error: speakerUpdateError });
        else log.info('Transcript updated with speaker names');
      }

      log.info('=== requestSummary ENDED ===', {
        status: result.status,
        language,
        parallelSpeakerIdentification: true,
        totalDurationMs: Date.now() - startTime,
        totalDurationSec: ((Date.now() - startTime) / 1000).toFixed(1),
      });
      return result;
    }

    log.info('Calling generateSummaryForLevel...', { language });
    const result = await generateSummaryForLevel(
      episodeId,
      level,
      transcriptResult.text,
      language,
      transcriptResult.transcript,
      youtubeContext
    );
    log.info('=== requestSummary ENDED ===', {
      status: result.status,
      language,
      totalDurationMs: Date.now() - startTime,
      totalDurationSec: ((Date.now() - startTime) / 1000).toFixed(1)
    });
    return result;
  } finally {
    await releaseLock(lockKey);
  }
}

export async function getSummariesStatus(episodeId: string, language = 'en') {
  const supabase = createAdminClient();
  // Check Redis cache for terminal states
  const { getCached, setCached, CacheKeys, CacheTTL } = await import('@/lib/cache');
  const cacheKey = CacheKeys.summaryStatus(episodeId, language);
  const cached = await getCached<any>(cacheKey);
  if (cached) return cached;

  // Find transcript in ANY language for this episode (handles auto-detected languages)
  const { data: transcripts } = await supabase
    .from('transcripts')
    .select('status, language')
    .eq('episode_id', episodeId)
    .order('created_at', { ascending: false });

  const transcript = transcripts?.[0] || null;
  const actualLanguage = transcript?.language || language;

  // Fetch summaries with the actual language
  const { data: summaries } = await supabase
    .from('summaries')
    .select('id, episode_id, level, status, language, content_json, updated_at')
    .eq('episode_id', episodeId)
    .eq('language', actualLanguage)
    .in('level', ['quick', 'deep']);

  const quick = summaries?.find(s => s.level === 'quick');
  const deep = summaries?.find(s => s.level === 'deep');

  const result = {
    episodeId,
    detected_language: actualLanguage,
    transcript: transcript ? { status: transcript.status, language: transcript.language } : null,
    summaries: {
      quick: quick ? {
        status: quick.status,
        content: quick.status === 'ready' ? quick.content_json : undefined,
        updatedAt: quick.updated_at
      } : null,
      deep: deep ? {
        status: deep.status,
        content: deep.status === 'ready' ? deep.content_json : undefined,
        updatedAt: deep.updated_at
      } : null
    }
  };

  // Cache based on state
  const hasAnySummary = !!(quick || deep);
  const quickTerminal = !quick || quick.status === 'ready' || quick.status === 'failed';
  const deepTerminal = !deep || deep.status === 'ready' || deep.status === 'failed';

  if (hasAnySummary && quickTerminal && deepTerminal) {
    // Terminal states: cache for a long time
    await setCached(cacheKey, result, CacheTTL.STATUS_TERMINAL);
  } else if (hasAnySummary) {
    // In-progress states: cache for 10 seconds to reduce DB polling pressure
    await setCached(cacheKey, result, 10);
  }

  return result;
}
