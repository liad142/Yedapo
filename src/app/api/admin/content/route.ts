import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ContentAnalytics } from '@/types/admin';

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const admin = createAdminClient();

  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { count: totalPodcasts },
    { count: totalEpisodes },
    { count: youtubeChannels },
    { data: podcasts },
    { data: recentEpisodes },
    { data: topEpisodeIds },
    { data: channelFollows },
  ] = await Promise.all([
    admin.from('podcasts').select('*', { count: 'exact', head: true }),
    admin.from('episodes').select('*', { count: 'exact', head: true }),
    admin.from('youtube_channels').select('*', { count: 'exact', head: true }),
    admin.from('podcasts').select('id, title, language, image_url').limit(1000),
    // Episodes over time: bounded to last 90 days (no arbitrary limit)
    admin.from('episodes')
      .select('id, created_at')
      .gte('created_at', ninetyDaysAgo)
      .order('created_at', { ascending: true }),
    // Top podcasts: 500 most recent episodes for ranking
    admin.from('episodes')
      .select('podcast_id')
      .order('created_at', { ascending: false })
      .limit(500),
    admin.from('youtube_channel_follows').select('channel_id, youtube_channels(id, channel_name)').limit(1000),
  ]);

  // Podcasts by language
  const langCounts: Record<string, number> = {};
  (podcasts ?? []).forEach((p: { language: string }) => {
    const lang = p.language || 'Unknown';
    langCounts[lang] = (langCounts[lang] || 0) + 1;
  });
  const podcastsByLanguage = Object.entries(langCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([label, count]) => ({ label, count }));

  // Episodes over time (by week) — bounded to last 90 days
  const episodesByWeek: Record<string, number> = {};
  (recentEpisodes ?? []).forEach((e: { created_at: string }) => {
    const date = new Date(e.created_at);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    const key = weekStart.toISOString().split('T')[0];
    episodesByWeek[key] = (episodesByWeek[key] || 0) + 1;
  });
  const episodesOverTime = Object.entries(episodesByWeek)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date, value }));

  // Top podcasts by episode count (from 500 most recent episodes)
  const podcastEpisodeCounts: Record<string, number> = {};
  (topEpisodeIds ?? []).forEach((e: { podcast_id: string }) => {
    podcastEpisodeCounts[e.podcast_id] = (podcastEpisodeCounts[e.podcast_id] || 0) + 1;
  });
  const topPodcastIds = Object.entries(podcastEpisodeCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);
  const podcastMap = new Map((podcasts ?? []).map((p: { id: string; title: string; image_url: string | null }) => [p.id, p]));
  const topPodcasts = topPodcastIds.map(([id, episode_count]) => {
    const p = podcastMap.get(id) as { id: string; title: string; image_url: string | null } | undefined;
    return {
      id,
      title: p?.title ?? 'Unknown',
      episode_count,
      image_url: p?.image_url ?? null,
    };
  });

  // Top YouTube channels by follow count
  const channelFollowCounts: Record<string, { title: string; count: number }> = {};
  (channelFollows ?? []).forEach((f: { channel_id: string; youtube_channels: { id: string; channel_name: string } | { id: string; channel_name: string }[] | null }) => {
    const channel = Array.isArray(f.youtube_channels) ? f.youtube_channels[0] : f.youtube_channels;
    if (channel) {
      if (!channelFollowCounts[f.channel_id]) {
        channelFollowCounts[f.channel_id] = { title: channel.channel_name, count: 0 };
      }
      channelFollowCounts[f.channel_id].count++;
    }
  });
  const topYoutubeChannels = Object.entries(channelFollowCounts)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 10)
    .map(([id, { title, count }]) => ({ id, title, follow_count: count }));

  const data: ContentAnalytics = {
    totalPodcasts: totalPodcasts ?? 0,
    totalEpisodes: totalEpisodes ?? 0,
    youtubeChannels: youtubeChannels ?? 0,
    episodesOverTime,
    podcastsByLanguage,
    topPodcasts,
    topYoutubeChannels,
  };

  return NextResponse.json(data);
}
