import { createLogger } from '@/lib/logger';

const log = createLogger('yt-metadata-scraper');

export interface YouTubeMetadata {
  description: string;
  descriptionLinks: { url: string; text: string }[];
  chapters: { title: string; startSeconds: number }[];
  duration: number;
  keywords: string[];
  storyboardSpec: string | null;
}

const BROWSER_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/**
 * Extract a JSON object assigned to a JavaScript variable from HTML.
 * Handles nested braces and strings correctly.
 */
function extractJsonFromHtml(html: string, varName: string): Record<string, unknown> | null {
  const marker = `var ${varName} = `;
  const idx = html.indexOf(marker);
  if (idx === -1) return null;

  const start = idx + marker.length;
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < html.length && i < start + 2_000_000; i++) {
    const ch = html[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(html.substring(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/**
 * Get player data by scraping the YouTube watch page HTML.
 * Used for metadata extraction (description, keywords, storyboards, chapters).
 * The page embeds `ytInitialPlayerResponse` as a JS variable.
 */
async function fetchPlayerFromPage(videoId: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': BROWSER_USER_AGENT,
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(8_000),
    });

    if (!res.ok) {
      log.error(`Watch page returned ${res.status}`, { videoId });
      return null;
    }

    const html = await res.text();
    const data = extractJsonFromHtml(html, 'ytInitialPlayerResponse');

    if (data) {
      log.success('Watch page scrape succeeded', { videoId });
      return data;
    }

    log.warn('ytInitialPlayerResponse not found in page HTML', { videoId });
    return null;
  } catch (err) {
    log.error('Watch page scrape failed', { videoId, error: String(err) });
    return null;
  }
}

/**
 * Parse chapter timestamps from a YouTube video description.
 * Valid chapters: >=3 timestamp lines, first must start at 0:00.
 * Pattern: `MM:SS Title` or `H:MM:SS Title` with optional dash separator.
 */
function parseChaptersFromDescription(description: string): { title: string; startSeconds: number }[] {
  const lines = description.split('\n');
  const chapterRegex = /^\s*(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\s*[-\u2013\u2014]?\s*(.+)/;
  const matches: { title: string; startSeconds: number }[] = [];

  for (const line of lines) {
    const match = line.match(chapterRegex);
    if (match) {
      const hours = match[1] ? parseInt(match[1]) : 0;
      const minutes = parseInt(match[2]);
      const seconds = parseInt(match[3]);
      const title = match[4].trim();
      matches.push({
        title,
        startSeconds: hours * 3600 + minutes * 60 + seconds,
      });
    }
  }

  // Valid chapters: >=3 entries AND first starts at 0:00
  if (matches.length >= 3 && matches[0].startSeconds === 0) {
    return matches;
  }
  return [];
}

/**
 * Extract URLs from a YouTube video description.
 */
function parseLinksFromDescription(description: string): { url: string; text: string }[] {
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g;
  const links: { url: string; text: string }[] = [];
  const seen = new Set<string>();
  const lines = description.split('\n');

  for (const match of description.matchAll(urlRegex)) {
    let url = match[0].replace(/[.,;:!?)]+$/, ''); // strip trailing punctuation
    if (seen.has(url)) continue;
    seen.add(url);

    // Try to get contextual text from the line
    const line = lines.find(l => l.includes(url));
    const text = line
      ? line.replace(url, '').replace(/[-\u2013\u2014:|\s]+/g, ' ').trim() || url
      : url;

    links.push({ url, text });
  }
  return links;
}

/**
 * Fetch rich metadata from a YouTube video using the watch page scraper.
 * Extracts: description, links, chapters, keywords, storyboard spec, duration.
 */
export async function fetchYouTubeMetadata(videoId: string): Promise<YouTubeMetadata | null> {
  try {
    const playerData = await fetchPlayerFromPage(videoId);
    if (!playerData) {
      log.error('Watch page scrape failed', { videoId });
      return null;
    }

    const videoDetails = (playerData as Record<string, unknown>)?.videoDetails as Record<string, unknown> | undefined;
    if (!videoDetails) {
      log.warn('No videoDetails', { videoId });
      return null;
    }

    const description = String(videoDetails.shortDescription || '');
    const duration = parseInt(String(videoDetails.lengthSeconds || '0'), 10);
    const keywords: string[] = Array.isArray(videoDetails.keywords)
      ? (videoDetails.keywords as string[])
      : [];

    // Extract storyboard spec
    const storyboards = (playerData as Record<string, unknown>)?.storyboards as Record<string, unknown> | undefined;
    const specRenderer = storyboards?.playerStoryboardSpecRenderer as Record<string, unknown> | undefined;
    const storyboardSpec = specRenderer?.spec ? String(specRenderer.spec) : null;

    // Parse description for links and chapters
    const descriptionLinks = parseLinksFromDescription(description);
    const chapters = parseChaptersFromDescription(description);

    return {
      description,
      descriptionLinks,
      chapters,
      duration,
      keywords,
      storyboardSpec,
    };
  } catch (err) {
    log.error('Failed to fetch metadata', { videoId, error: String(err) });
    return null;
  }
}
