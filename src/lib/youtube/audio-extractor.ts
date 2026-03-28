import ytdl from '@distube/ytdl-core';

/**
 * Extract a direct audio stream URL from a YouTube video.
 * Returns null on any failure (never throws).
 */
export async function extractYouTubeAudioUrl(videoId: string): Promise<string | null> {
  try {
    const url = `https://www.youtube.com/watch?v=${videoId}`;

    const info = await Promise.race([
      ytdl.getInfo(url),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('ytdl getInfo timeout')), 15_000)
      ),
    ]);

    // Check for live streams — can't extract a static audio URL
    if (info.videoDetails.isLiveContent && info.videoDetails.liveBroadcastDetails?.isLiveNow) {
      console.warn('[audio-extractor] Video is a live stream, skipping');
      return null;
    }

    // Prefer audio-only formats: itag 140 (m4a 128kbps) or 251 (webm/opus 160kbps)
    const audioFormats = ytdl.filterFormats(info.formats, 'audioonly');

    // Sort by bitrate descending to get best quality
    const sorted = audioFormats.sort((a, b) => (b.audioBitrate ?? 0) - (a.audioBitrate ?? 0));

    if (sorted.length > 0 && sorted[0].url) {
      return sorted[0].url;
    }

    // Fallback: try any format that has audio (video+audio combined)
    const withAudio = info.formats
      .filter((f) => f.hasAudio && f.url)
      .sort((a, b) => (b.audioBitrate ?? 0) - (a.audioBitrate ?? 0));

    if (withAudio.length > 0 && withAudio[0].url) {
      return withAudio[0].url;
    }

    console.warn('[audio-extractor] No audio formats found for video', videoId);
    return null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Expected failures: age-restricted, private, deleted, region-blocked
    console.warn('[audio-extractor] Failed to extract audio URL:', msg);
    return null;
  }
}
