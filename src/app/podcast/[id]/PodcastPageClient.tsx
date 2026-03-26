'use client';

import { useState } from 'react';
import Link from 'next/link';
import { SafeImage } from '@/components/SafeImage';
import { Button } from '@/components/ui/button';
import { EpisodeList } from '@/components/EpisodeList';
import { useSummarizeQueue } from '@/contexts/SummarizeQueueContext';
import { useSummaryAvailability } from '@/hooks/useSummaryAvailability';
import { useEpisodeImport } from '@/hooks/useEpisodeImport';
import { formatDate } from '@/lib/formatters';
import type { DbPodcast } from '@/types/database';
import type { PodcastDetailEpisode } from '@/types/podcast';
import { ArrowLeft, Mic2, Calendar, Globe, Rss, Heart, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { NotifyToggle } from '@/components/NotifyToggle';
import { cn, stripHtml } from '@/lib/utils';

interface PodcastPageClientProps {
  podcast: DbPodcast;
  initialEpisodes: PodcastDetailEpisode[];
}

export default function PodcastPageClient({
  podcast,
  initialEpisodes,
}: PodcastPageClientProps) {
  const podcastId = podcast.id;

  const { user, setShowAuthModal } = useAuth();
  const {
    subscribedPodcastIds,
    subscribe,
    unsubscribe,
    getNotificationPrefs,
    updateNotificationPrefs,
  } = useSubscription();
  const isSubscribed = subscribedPodcastIds?.has(podcastId) ?? false;
  const [isTogglingSubscription, setIsTogglingSubscription] = useState(false);

  const handleToggleSubscription = async () => {
    if (!user) {
      setShowAuthModal(true, 'Sign in to follow podcasts');
      return;
    }
    setIsTogglingSubscription(true);
    try {
      if (isSubscribed) {
        await unsubscribe(podcastId);
      } else {
        await subscribe(podcastId);
      }
    } finally {
      setIsTogglingSubscription(false);
    }
  };

  const [episodes] = useState<PodcastDetailEpisode[]>(initialEpisodes);
  const { addToQueue } = useSummarizeQueue();
  const { summaryAvailability, setSummaryAvailability, getEpisodeSummaryInfo } =
    useSummaryAvailability(episodes);

  const podcastInfo = {
    externalId: podcast.rss_feed_url?.startsWith('apple:')
      ? podcast.rss_feed_url.replace('apple:', '')
      : podcastId,
    name: podcast.title,
    artistName: podcast.author || '',
    artworkUrl: typeof podcast.image_url === 'string' ? podcast.image_url : '',
    feedUrl: podcast.rss_feed_url,
  };

  const { importingEpisodeId, handleSummarize } = useEpisodeImport(
    podcastInfo,
    summaryAvailability,
    setSummaryAvailability,
    addToQueue
  );

  return (
    <div className="container mx-auto px-4 py-6">
        {/* Back Button */}
        <div className="mb-6">
          <Link href="/my-list">
            <Button variant="ghost" className="-ml-2">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to My List
            </Button>
          </Link>
        </div>

        <div className="space-y-8">
          {/* Immersive Header */}
          <div className="relative z-10 rounded-3xl bg-slate-900 mb-8 border border-white/10 shadow-2xl">
            {/* Blurred Background Backdrop */}
            <div className="absolute inset-0 z-0 overflow-hidden rounded-3xl">
              {podcast.image_url ? (
                <SafeImage
                  src={
                    Array.isArray(podcast.image_url)
                      ? podcast.image_url[0]
                      : podcast.image_url
                  }
                  alt=""
                  fill
                  className="object-cover blur-3xl scale-110 opacity-60"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-blue-900 via-slate-900 to-black" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />
            </div>

            {/* Content Overlay */}
            <div className="relative z-10 p-8 md:p-12 flex flex-col md:flex-row gap-8 items-center md:items-start text-center md:text-left">
              <div className="w-48 h-48 md:w-56 md:h-56 shrink-0 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/10 rotate-1 md:rotate-0 transition-transform hover:scale-105 duration-500">
                {podcast.image_url ? (
                  <SafeImage
                    src={
                      Array.isArray(podcast.image_url)
                        ? podcast.image_url[0]
                        : podcast.image_url
                    }
                    alt={podcast.title}
                    width={224}
                    height={224}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-white/5">
                    <Mic2 className="h-16 w-16 text-white/40" />
                  </div>
                )}
              </div>

              <div className="flex-1 space-y-4">
                <div>
                  <h1 className="text-h1 md:text-display text-white mb-3 tracking-tight leading-tight drop-shadow-sm">
                    {podcast.title}
                  </h1>
                  {podcast.author && (
                    <p className="text-lg md:text-xl text-slate-300 font-medium tracking-wide">
                      {podcast.author}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap justify-center md:justify-start gap-2">
                  <span className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 text-xs font-semibold text-white/90">
                    {episodes.length} episodes
                  </span>
                  {podcast.language && (
                    <span className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 text-xs font-semibold text-white/90 uppercase flex items-center gap-1">
                      <Globe className="h-3 w-3" />
                      {podcast.language}
                    </span>
                  )}
                  <span className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 text-xs font-semibold text-white/90 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(podcast.created_at)}
                  </span>
                </div>

                {podcast.description && (
                  <p className="text-slate-300 leading-relaxed max-w-2xl line-clamp-3 text-sm md:text-base border-l-2 border-white/20 pl-4">
                    {stripHtml(podcast.description)}
                  </p>
                )}

                {/* Action buttons */}
                <div className="flex items-center gap-1 pt-2 justify-center md:justify-start">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleToggleSubscription}
                    disabled={isTogglingSubscription}
                    className={cn(
                      'rounded-full text-white hover:bg-white/10',
                      isSubscribed && 'text-red-500 hover:text-red-600'
                    )}
                    aria-label={
                      isSubscribed ? 'Remove from library' : 'Save to library'
                    }
                  >
                    {isTogglingSubscription ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Heart
                        className={cn(
                          'h-5 w-5',
                          isSubscribed && 'fill-current'
                        )}
                      />
                    )}
                  </Button>

                  {isSubscribed &&
                    (() => {
                      const prefs = getNotificationPrefs(podcastId);
                      return (
                        <NotifyToggle
                          enabled={prefs.notifyEnabled}
                          channels={prefs.notifyChannels}
                          onUpdate={(enabled, channels) =>
                            updateNotificationPrefs(
                              podcastId,
                              enabled,
                              channels
                            )
                          }
                        />
                      );
                    })()}

                  {podcast.rss_feed_url &&
                    !podcast.rss_feed_url.startsWith('apple:') && (
                      <a
                        href={podcast.rss_feed_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 ml-2 text-xs font-medium text-blue-300 hover:text-blue-200 transition-colors"
                      >
                        <Rss className="h-3.5 w-3.5" />
                        RSS Feed
                      </a>
                    )}
                </div>
              </div>
            </div>
          </div>

          {/* Episodes Section */}
          <section className="bg-secondary/50 md:bg-transparent -mx-4 px-4 py-8 md:px-0 md:mx-0 md:py-0">
            <h2 className="text-h2 tracking-tight text-foreground mb-6">
              Episodes
            </h2>

            <EpisodeList
              episodes={episodes}
              podcastName={podcast.title || podcast.author || 'Unknown'}
              podcastArtworkUrl={
                typeof podcast.image_url === 'string' ? podcast.image_url : ''
              }
              getEpisodeSummaryInfo={getEpisodeSummaryInfo}
              onSummarize={handleSummarize}
              importingEpisodeId={importingEpisodeId}
              isLoading={false}
              hasMore={false}
              isLoadingMore={false}
              totalCount={episodes.length}
              onLoadMore={() => {}}
              variant="card"
            />
          </section>
        </div>
    </div>
  );
}
