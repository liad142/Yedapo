import { createAdminClient } from '@/lib/supabase/admin';
import { fetchSupadataTranscript } from './supadata';
import { generateSummaryForLevel } from '@/lib/summary-service';
import { generateInsights } from '@/lib/insights-service';
import { ensureYouTubeMetadata } from './metadata';
import { acquireLock, releaseLock } from '@/lib/cache';
import { createLogger } from '@/lib/logger';
import type { SummaryLevel, SummaryStatus } from '@/types/database';

const log = createLogger('youtube');

/**
 * Request a summary for a YouTube video.
 *
 * 1. Checks for existing summary at the given level
 * 2. Ensures a transcript exists (fetches YouTube captions if needed)
 * 3. Creates/updates summary row, then calls generateSummaryForLevel()
 */
export async function requestYouTubeSummary(
  episodeId: string,
  videoId: string,
  level: SummaryLevel,
  language: string = 'en'
): Promise<{ status: SummaryStatus; error?: string }> {
  const supabase = createAdminClient();

  // Distributed lock to prevent duplicate Gemini calls from concurrent requests
  const lockKey = `lock:yt-summary:${episodeId}:${level}`;
  const locked = await acquireLock(lockKey, 300); // 5 min TTL
  if (!locked) {
    return { status: 'summarizing' as SummaryStatus };
  }

  try {
  // Check for existing summary
  const { data: existingSummary } = await supabase
    .from('summaries')
    .select('status')
    .eq('episode_id', episodeId)
    .eq('level', level)
    .eq('language', language)
    .single();

  if (existingSummary?.status === 'ready') {
    return { status: 'ready' };
  }

  if (existingSummary?.status === 'summarizing' || existingSummary?.status === 'transcribing') {
    return { status: existingSummary.status as SummaryStatus };
  }

  // Ensure transcript exists
  const { data: existingTranscript } = await supabase
    .from('transcripts')
    .select('full_text, status')
    .eq('episode_id', episodeId)
    .eq('language', language)
    .single();

  let transcriptText: string;

  if (existingTranscript?.status === 'ready' && existingTranscript.full_text) {
    transcriptText = existingTranscript.full_text;
  } else {
    // Fetch YouTube captions via Supadata
    const ytTranscript = await fetchSupadataTranscript(videoId, language);

    if (!ytTranscript) {
      // Update summary status to failed
      await supabase
        .from('summaries')
        .upsert(
          {
            episode_id: episodeId,
            level,
            language,
            status: 'failed',
            error_message: 'No captions available for this video',
          },
          { onConflict: 'episode_id,level,language' }
        );
      return { status: 'failed', error: 'No captions available for this video' };
    }

    // Store transcript
    await supabase
      .from('transcripts')
      .upsert(
        {
          episode_id: episodeId,
          language,
          full_text: ytTranscript.text,
          status: 'ready',
          provider: 'youtube-captions',
        },
        { onConflict: 'episode_id,language' }
      );

    transcriptText = ytTranscript.text;
  }

  // Ensure summary row exists with 'queued' status
  await supabase
    .from('summaries')
    .upsert(
      {
        episode_id: episodeId,
        level,
        language,
        status: 'queued',
      },
      { onConflict: 'episode_id,level,language' }
    );

  // Fetch YouTube metadata context for richer AI prompts
  let youtubeContext: { description: string; chapters: { title: string; startSeconds: number }[]; descriptionLinks: { url: string; text: string }[] } | undefined;
  try {
    const ytMeta = await ensureYouTubeMetadata(episodeId, videoId);
    if (ytMeta) {
      youtubeContext = {
        description: ytMeta.description,
        chapters: ytMeta.chapters,
        descriptionLinks: ytMeta.description_links,
      };
    }
  } catch {
    // Non-blocking — metadata is optional enrichment
  }

  // Generate summary
  const result = await generateSummaryForLevel(
    episodeId,
    level,
    transcriptText,
    language,
    undefined,
    youtubeContext
  );

  // After quick summary succeeds, fire-and-forget deep + insights generation
  // This runs server-side, bypassing API rate limits
  if (level === 'quick' && result.status === 'ready') {
    const bgTranscript = transcriptText;
    const bgContext = youtubeContext;

    // Check which levels already exist before triggering
    const { data: existingLevels } = await supabase
      .from('summaries')
      .select('level, status')
      .eq('episode_id', episodeId)
      .in('level', ['deep', 'insights']);

    const deepExists = existingLevels?.find(s => s.level === 'deep' && s.status === 'ready');
    const insightsExists = existingLevels?.find(s => s.level === 'insights' && s.status === 'ready');

    // Deep summary (fire-and-forget, only if not already ready)
    if (!deepExists) {
      (async () => {
        try {
          await supabase.from('summaries').upsert(
            { episode_id: episodeId, level: 'deep' as SummaryLevel, language, status: 'queued' },
            { onConflict: 'episode_id,level,language' }
          );
          const r = await generateSummaryForLevel(episodeId, 'deep', bgTranscript, language, undefined, bgContext);
          log.success(`Deep summary completed for ${episodeId}`, { status: r.status });
        } catch (e) {
          log.error(`Deep summary failed for ${episodeId}`, e);
        }
      })();
    }

    // Insights (fire-and-forget, only if not already ready)
    if (!insightsExists) {
      (async () => {
        try {
          await supabase.from('summaries').upsert(
            { episode_id: episodeId, level: 'insights' as SummaryLevel, language, status: 'queued' },
            { onConflict: 'episode_id,level,language' }
          );
          const r = await generateInsights(episodeId, bgTranscript, language);
          log.success(`Insights completed for ${episodeId}`, { status: r.status });
        } catch (e) {
          log.error(`Insights failed for ${episodeId}`, e);
        }
      })();
    }
  }

  return { status: result.status, error: result.error };
  } finally {
    await releaseLock(lockKey);
  }
}
