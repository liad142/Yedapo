import { useState } from 'react';
import { useUsage } from '@/contexts/UsageContext';
import { useSummarizeQueue } from '@/contexts/SummarizeQueueContext';
import type { PodcastDetailEpisode, SummaryAvailability } from '@/types/podcast';

interface PodcastInfo {
  externalId: string;
  name: string;
  artistName: string;
  artworkUrl: string;
  feedUrl?: string;
}

export function useEpisodeImport(
  podcastInfo: PodcastInfo | null,
  summaryAvailability: Map<string, SummaryAvailability>,
  setSummaryAvailability: React.Dispatch<React.SetStateAction<Map<string, SummaryAvailability>>>,
  addToQueue: (episodeId: string) => void
) {
  const [importingEpisodeId, setImportingEpisodeId] = useState<string | null>(null);
  const { usage, incrementSummary } = useUsage();
  const { setShowUpgradeModal } = useSummarizeQueue();

  const handleSummarize = async (episode: PodcastDetailEpisode) => {
    if (!podcastInfo || !episode.audioUrl) return;

    // Block if at quota limit — show upgrade modal instead of importing/queuing
    const atQuotaLimit = usage && usage.summary.limit !== -1 && usage.summary.used >= usage.summary.limit;
    if (atQuotaLimit) {
      setShowUpgradeModal(true);
      return;
    }

    // If episode is from local DB, it already has the correct ID
    if (episode.isFromDb) {
      addToQueue(episode.id);
      incrementSummary();
      return;
    }

    const availability = summaryAvailability.get(episode.audioUrl);
    if (availability?.episodeId) {
      addToQueue(availability.episodeId);
      incrementSummary();
      return;
    }

    setImportingEpisodeId(episode.id);

    try {
      const response = await fetch('/api/episodes/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          episode: {
            externalId: episode.id,
            title: episode.title,
            description: episode.description,
            publishedAt: episode.publishedAt,
            duration: episode.duration,
            audioUrl: episode.audioUrl,
          },
          podcast: podcastInfo,
        }),
      });

      if (!response.ok) throw new Error('Failed to import episode');

      const { episodeId } = await response.json();

      setSummaryAvailability(prev => {
        const updated = new Map(prev);
        updated.set(episode.audioUrl!, {
          audioUrl: episode.audioUrl!,
          episodeId,
          hasQuickSummary: false,
          hasDeepSummary: false,
          quickStatus: null,
          deepStatus: null,
        });
        return updated;
      });

      addToQueue(episodeId);
      incrementSummary();
    } catch (err) {
      console.error('Error importing episode:', err);
    } finally {
      setImportingEpisodeId(null);
    }
  };

  return { importingEpisodeId, handleSummarize };
}
