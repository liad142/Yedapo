import { createAdminClient } from '@/lib/supabase/admin';
import { fetchYouTubeMetadata } from './metadata-scraper';
import { createLogger } from '@/lib/logger';

const log = createLogger('youtube');

export interface YouTubeMetadataRow {
  episode_id: string;
  video_id: string;
  description: string;
  description_links: { url: string; text: string }[];
  chapters: { title: string; startSeconds: number }[];
  pinned_comment: { author: string; text: string; likeCount: string } | null;
  storyboard_spec: string | null;
  keywords: string[];
  duration_seconds: number | null;
  fetched_at: string;
}

const INNERTUBE_NEXT_URL = 'https://www.youtube.com/youtubei/v1/next?prettyPrint=false';

const WEB_CONTEXT = {
  client: {
    clientName: 'WEB',
    clientVersion: '2.20240101.00.00',
    hl: 'en',
    gl: 'US',
  },
};

/**
 * Fetch the pinned comment for a YouTube video using InnerTube /next API.
 *
 * 1. POST /next with videoId → get comment continuation token
 * 2. POST /next with continuation → get first page of comments
 * 3. Find comment with pinnedCommentBadge
 */
export async function fetchPinnedComment(
  videoId: string
): Promise<{ author: string; text: string; likeCount: string } | null> {
  try {
    // Step 1: Get the comment continuation token from /next
    const nextRes = await fetch(INNERTUBE_NEXT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context: WEB_CONTEXT,
        videoId,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!nextRes.ok) return null;
    const nextData = await nextRes.json();

    // Navigate to the comment section continuation token
    const contents = nextData?.contents?.twoColumnWatchNextResults?.results?.results?.contents;
    if (!Array.isArray(contents)) return null;

    let continuationToken: string | null = null;
    for (const item of contents) {
      const sectionRenderer = item?.itemSectionRenderer;
      if (!sectionRenderer?.contents) continue;
      for (const content of sectionRenderer.contents) {
        const token =
          content?.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token;
        if (token) {
          continuationToken = token;
          break;
        }
      }
      if (continuationToken) break;
    }

    if (!continuationToken) {
      log.warn('No comment continuation token', { videoId });
      return null;
    }

    // Step 2: Fetch first page of comments
    const commentsRes = await fetch(INNERTUBE_NEXT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context: WEB_CONTEXT,
        continuation: continuationToken,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!commentsRes.ok) return null;
    const commentsData = await commentsRes.json();

    // Step 3: Find pinned comment
    const commentActions =
      commentsData?.onResponseReceivedEndpoints;
    if (!Array.isArray(commentActions)) return null;

    for (const action of commentActions) {
      const items =
        action?.reloadContinuationItemsCommand?.continuationItems ||
        action?.appendContinuationItemsAction?.continuationItems;
      if (!Array.isArray(items)) continue;

      for (const item of items) {
        const commentThread = item?.commentThreadRenderer;
        if (!commentThread) continue;

        const comment = commentThread.comment?.commentRenderer;
        if (!comment) continue;

        // Check if pinned
        const isPinned =
          comment.pinnedCommentBadge != null ||
          commentThread.renderingPriority === 'RENDERING_PRIORITY_PINNED_COMMENT';

        if (isPinned) {
          const author =
            comment.authorText?.simpleText || 'Unknown';
          const textRuns = comment.contentText?.runs;
          const text = Array.isArray(textRuns)
            ? textRuns.map((r: { text?: string }) => r.text || '').join('')
            : '';
          const likeCount =
            comment.voteCount?.simpleText || '0';

          return { author, text, likeCount };
        }
      }
    }

    return null;
  } catch (err) {
    log.error('Failed to fetch pinned comment', { videoId, error: String(err) });
    return null;
  }
}

/**
 * Ensure YouTube metadata exists in the DB for the given episode.
 * Fetches from InnerTube if missing or stale (>24h).
 */
export async function ensureYouTubeMetadata(
  episodeId: string,
  videoId: string
): Promise<YouTubeMetadataRow | null> {
  const supabase = createAdminClient();
  // Check if row exists and is recent
  const { data: existing } = await supabase
    .from('youtube_metadata')
    .select('*')
    .eq('episode_id', episodeId)
    .single();

  if (existing) {
    const fetchedAt = new Date(existing.fetched_at).getTime();
    const isRecent = Date.now() - fetchedAt < 24 * 60 * 60 * 1000; // 24h
    if (isRecent) {
      return existing as YouTubeMetadataRow;
    }
  }

  // Fetch fresh metadata from InnerTube
  const [metadata, pinnedComment] = await Promise.all([
    fetchYouTubeMetadata(videoId),
    fetchPinnedComment(videoId),
  ]);

  if (!metadata) {
    log.warn('Failed to fetch metadata', { videoId });
    return existing as YouTubeMetadataRow | null;
  }

  const row: Omit<YouTubeMetadataRow, 'fetched_at'> & { fetched_at: string } = {
    episode_id: episodeId,
    video_id: videoId,
    description: metadata.description,
    description_links: metadata.descriptionLinks,
    chapters: metadata.chapters,
    pinned_comment: pinnedComment,
    storyboard_spec: metadata.storyboardSpec,
    keywords: metadata.keywords,
    duration_seconds: metadata.duration || null,
    fetched_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('youtube_metadata')
    .upsert(row, { onConflict: 'episode_id' });

  if (error) {
    log.error('Failed to upsert metadata', { episodeId, error: String(error) });
    return existing as YouTubeMetadataRow | null;
  }

  return row;
}
