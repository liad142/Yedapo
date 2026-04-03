import { NextRequest, NextResponse } from 'next/server';
import { fetchChannelVideos } from '@/lib/youtube/api';
import { getCached, setCached, checkRateLimit } from '@/lib/cache';
import { getAuthUser } from '@/lib/auth-helpers';
import { createAdminClient } from '@/lib/supabase/admin';

const YT_API_BASE = 'https://www.googleapis.com/youtube/v3';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: channelId } = await params;

  // Rate limit per IP
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
  const allowed = await checkRateLimit(`yt-channel:${ip}`, 30, 60);
  if (!allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const pageToken = request.nextUrl.searchParams.get('pageToken') || undefined;
  const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') || '12', 10), 50);

  // Check cache (first page only)
  const cacheKey = `yt-channel:${channelId}`;
  if (!pageToken) {
    const cached = await getCached<any>(cacheKey);
    if (cached) {
      const user = await getAuthUser();
      const followStatus = user ? await checkIsFollowing(user.id, channelId) : { following: false, dbId: null };
      if (cached.videos?.length) {
        await enrichVideosWithSummaryStatus(cached.videos);
      }
      return NextResponse.json({ ...cached, isFollowing: followStatus.following, channelDbId: followStatus.dbId });
    }
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'YouTube API not configured' }, { status: 500 });
  }

  try {
    // Fetch channel info + videos in parallel
    const [channelRes, videosResult] = await Promise.all([
      fetch(`${YT_API_BASE}/channels?${new URLSearchParams({
        part: 'snippet,statistics',
        id: channelId,
        key: apiKey,
      })}`),
      fetchChannelVideos(channelId, limit, pageToken),
    ]);

    if (!channelRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch channel' }, { status: 502 });
    }

    const channelData = await channelRes.json();
    const item = channelData.items?.[0];
    if (!item) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
    }

    const channel = {
      title: item.snippet.title,
      description: item.snippet.description || '',
      thumbnailUrl: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || '',
      subscriberCount: item.statistics?.subscriberCount,
    };

    const videoItems = videosResult.videos.map((v) => ({
      videoId: v.videoId,
      title: v.title,
      description: v.description,
      thumbnailUrl: v.thumbnailUrl,
      publishedAt: v.publishedAt,
      channelName: v.channelTitle,
      channelId: v.channelId,
      url: `https://www.youtube.com/watch?v=${v.videoId}`,
    }));

    await enrichVideosWithSummaryStatus(videoItems);

    const result = {
      channel,
      videos: videoItems,
      nextPageToken: videosResult.nextPageToken || null,
      totalResults: videosResult.totalResults || videoItems.length,
    };

    // Only cache first page (no pageToken)
    if (!pageToken) {
      await setCached(cacheKey, result, 900);
    }

    // Check follow status
    const user = await getAuthUser();
    const followStatus = user ? await checkIsFollowing(user.id, channelId) : { following: false, dbId: null };

    return NextResponse.json({ ...result, isFollowing: followStatus.following, channelDbId: followStatus.dbId }, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    console.error('YouTube channel API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch channel' },
      { status: 500 }
    );
  }
}

async function checkIsFollowing(userId: string, channelId: string): Promise<{ following: boolean; dbId: string | null }> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from('youtube_channels')
      .select('id')
      .eq('channel_id', channelId)
      .single();

    if (!data) return { following: false, dbId: null };

    const { data: follow } = await supabase
      .from('youtube_channel_follows')
      .select('id')
      .eq('user_id', userId)
      .eq('channel_id', data.id)
      .single();

    return { following: !!follow, dbId: follow ? data.id : null };
  } catch {
    return { following: false, dbId: null };
  }
}

async function enrichVideosWithSummaryStatus(videos: any[]): Promise<void> {
  if (!videos.length) return;
  const supabase = createAdminClient();
  const videoUrls = videos.map((v: any) => v.url).filter(Boolean);
  if (!videoUrls.length) return;

  const { data: episodes } = await supabase
    .from('episodes')
    .select('id, audio_url')
    .in('audio_url', videoUrls);

  if (!episodes?.length) return;

  const urlToEpId = new Map(episodes.map(e => [e.audio_url, e.id]));
  const epIds = episodes.map(e => e.id);

  // Get the best summary status per episode (ready > summarizing > transcribing > queued)
  const { data: summaries } = await supabase
    .from('summaries')
    .select('episode_id, status')
    .in('episode_id', epIds)
    .in('level', ['quick', 'deep']);

  const STATUS_PRIORITY: Record<string, number> = { ready: 4, summarizing: 3, transcribing: 2, queued: 1 };
  const epBestStatus = new Map<string, string>();
  for (const s of summaries || []) {
    const current = epBestStatus.get(s.episode_id);
    if (!current || (STATUS_PRIORITY[s.status] || 0) > (STATUS_PRIORITY[current] || 0)) {
      epBestStatus.set(s.episode_id, s.status);
    }
  }

  for (const v of videos) {
    const epId = urlToEpId.get(v.url);
    if (epId) {
      v.episodeId = epId;
      v.summaryStatus = epBestStatus.get(epId) || 'not_ready';
    }
  }
}
