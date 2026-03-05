import { useState, useEffect } from 'react';
import type { PodcastDetailEpisode, SummaryAvailability } from '@/types/podcast';

export function useSummaryAvailability(episodes: PodcastDetailEpisode[]) {
  const [summaryAvailability, setSummaryAvailability] = useState<Map<string, SummaryAvailability>>(new Map());

  useEffect(() => {
    async function checkSummaries() {
      const audioUrls = episodes
        .map(e => e.audioUrl)
        .filter((url): url is string => !!url);

      if (audioUrls.length === 0) return;

      try {
        const response = await fetch('/api/summaries/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audioUrls }),
        });

        if (!response.ok) return;

        const data = await response.json();
        const availabilityMap = new Map<string, SummaryAvailability>();
        for (const item of data.availability) {
          availabilityMap.set(item.audioUrl, item);
        }
        setSummaryAvailability(availabilityMap);
      } catch (err) {
        console.error('Error checking summaries:', err);
      }
    }

    if (episodes.length > 0) {
      checkSummaries();
    }
  }, [episodes]);

  const getEpisodeSummaryInfo = (episode: PodcastDetailEpisode): SummaryAvailability | null => {
    // For local DB episodes, the episode.id IS the episodeId
    if (episode.isFromDb) {
      const info = episode.audioUrl ? summaryAvailability.get(episode.audioUrl) : null;
      return {
        audioUrl: episode.audioUrl || '',
        episodeId: episode.id,
        hasQuickSummary: info?.hasQuickSummary || false,
        hasDeepSummary: info?.hasDeepSummary || false,
        quickStatus: info?.quickStatus || null,
        deepStatus: info?.deepStatus || null,
      };
    }

    if (!episode.audioUrl) return null;
    return summaryAvailability.get(episode.audioUrl) || null;
  };

  return { summaryAvailability, setSummaryAvailability, getEpisodeSummaryInfo };
}
