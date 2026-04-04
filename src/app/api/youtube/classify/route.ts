import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-helpers';
import { fetchChannelTopics } from '@/lib/youtube/api';
import { extractGenresFromTopicCategories, extractGenresFromTopicIds } from '@/lib/youtube/topic-genre-map';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { APPLE_PODCAST_GENRES } from '@/types/apple-podcasts';
import { createLogger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/cache';

const log = createLogger('yt-classify');

/**
 * Gemini fallback classifier for channels that lack YouTube topic data.
 * Uses the channel title + description to infer matching genres via LLM.
 */
async function classifyWithGemini(
  channels: Array<{ channelId: string; title: string; description: string }>,
  selectedGenres: string[]
): Promise<Record<string, string[]>> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    log.error('GOOGLE_GEMINI_API_KEY not set, skipping Gemini fallback');
    return {};
  }

  const genreList = APPLE_PODCAST_GENRES
    .filter((g) => selectedGenres.includes(g.id))
    .map((g) => `${g.id}: ${g.name}`)
    .join('\n');

  const channelList = channels
    .map((ch) => {
      const desc = ch.description.length > 200
        ? ch.description.slice(0, 200) + '...'
        : ch.description;
      return `- channelId: "${ch.channelId}", title: "${ch.title}", description: "${desc}"`;
    })
    .join('\n');

  const prompt = `You are classifying YouTube channels into podcast genre categories.

Here are the available genre categories (ID: Name):
${genreList}

Here are the YouTube channels to classify:
${channelList}

For each channel, determine which of the above genre categories best match the channel's content based on its title and description. A channel can match zero or more genres.

Return a JSON object mapping each channelId to an array of matching genre IDs (as strings).
Only include genre IDs from the list above. If no genres match, use an empty array.

Example format:
{
  "UC123": ["1318", "1304"],
  "UC456": []
}`;

  try {
    const genai = new GoogleGenerativeAI(apiKey);
    const model = genai.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json' },
    });

    const text = result.response.text();
    const parsed = JSON.parse(text) as Record<string, string[]>;
    return parsed;
  } catch (err) {
    log.error('Gemini classification failed', err);
    return {};
  }
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Rate limit: 5 req/min — this endpoint calls YouTube Data API + Gemini AI
  const rlAllowed = await checkRateLimit(`yt-classify:${user.id}`, 5, 60);
  if (!rlAllowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  let body: { channels?: Array<{ channelId: string; title: string; description: string }>; genres?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { channels, genres } = body;

  if (!channels || !Array.isArray(channels) || !genres || !Array.isArray(genres) || genres.length === 0) {
    return NextResponse.json(
      { error: 'Missing or invalid channels or genres (genres must be non-empty)' },
      { status: 400 }
    );
  }

  // Cap channels to prevent abuse
  if (channels.length > 50) {
    return NextResponse.json(
      { error: 'Maximum 50 channels per request' },
      { status: 400 }
    );
  }

  log.info('Classifying channels', { channelCount: channels.length, genreCount: genres.length });

  const selectedGenres = genres;
  const channelIds = channels.map((ch) => ch.channelId);

  // Batch-fetch YouTube topicDetails for all channels
  const topicData = await fetchChannelTopics(channelIds);

  const classifications: Record<string, string[]> = {};
  const unclassified: Array<{ channelId: string; title: string; description: string }> = [];
  let classified = 0;

  for (const channel of channels) {
    const topics = topicData[channel.channelId];

    if (topics && (topics.topicIds.length > 0 || topics.topicCategories.length > 0)) {
      // Merge genres from both topic ID and category mappings
      const fromIds = extractGenresFromTopicIds(topics.topicIds);
      const fromCategories = extractGenresFromTopicCategories(topics.topicCategories);
      const merged = [...new Set([...fromIds, ...fromCategories])];

      // Filter to only genres the user selected
      classifications[channel.channelId] = merged.filter((g) => selectedGenres.includes(g));
      classified++;
    } else {
      // No topic data available — mark as unclassified
      unclassified.push(channel);
      classifications[channel.channelId] = [];
    }
  }

  log.info('YouTube topics classified', { classified, unclassified: unclassified.length });

  // Fall back to Gemini for unclassified channels
  if (unclassified.length > 0) {
    try {
      const geminiResults = await classifyWithGemini(unclassified, selectedGenres);
      for (const [channelId, genreIds] of Object.entries(geminiResults)) {
        if (Array.isArray(genreIds) && genreIds.length > 0) {
          classifications[channelId] = genreIds;
        }
      }
      log.success('Gemini classified additional channels', { count: Object.keys(geminiResults).length });
    } catch (err) {
      log.error('Gemini fallback error', err);
      // Leave unclassified channels with empty arrays
    }
  }

  return NextResponse.json({ classifications });
}
