'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { springBouncy } from '@/lib/motion';
import { Heart, BookOpen, Target, Clock } from 'lucide-react';
import { DiscoverySummarizeButton } from './DiscoverySummarizeButton';
import { PlayButton, InlinePlayButton } from '@/components/PlayButton';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useMemo } from 'react';

interface InsightCardProps {
  episodeId: string;
  title: string;
  description: string;
  publishedAt: Date;
  audioUrl?: string;
  duration?: number;
  podcastId: string;
  podcastName: string;
  podcastArtist?: string;
  podcastArtwork: string;
  podcastFeedUrl?: string;
  summaryPreview?: {
    hookHeadline?: string;
    takeawayCount?: number;
    chapterCount?: number;
  };
}

function formatDate(date: Date): string {
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export const InsightCard = React.memo(function InsightCard({
  episodeId,
  title,
  description,
  publishedAt,
  audioUrl,
  duration,
  podcastId,
  podcastName,
  podcastArtist,
  podcastArtwork,
  podcastFeedUrl,
  summaryPreview,
}: InsightCardProps) {
  const { user, setShowAuthModal } = useAuth();
  const { isSubscribed, subscribe, unsubscribe } = useSubscription();
  const [isLoading, setIsLoading] = useState(false);
  const subscribed = isSubscribed(podcastId);
  const imageUrl = podcastArtwork?.replace('100x100', '200x200') || '/placeholder-podcast.png';

  // Prepare track data for the audio player
  const track = useMemo(() => {
    if (!audioUrl) return null;
    return {
      id: episodeId,
      title: title,
      artist: podcastName,
      artworkUrl: imageUrl,
      audioUrl: audioUrl,
      duration: duration,
    };
  }, [episodeId, title, podcastName, imageUrl, audioUrl, duration]);

  const handleSubscribe = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      setShowAuthModal(true, 'Sign up to follow your favourite podcasts and never miss an episode.');
      return;
    }
    if (isLoading) return;
    setIsLoading(true);
    try {
      if (subscribed) {
        await unsubscribe(podcastId);
      } else {
        await subscribe(podcastId);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="bg-card border border-border rounded-2xl shadow-[var(--shadow-1)] p-5"
    >
      {/* Header: Podcast Info */}
      <div className="flex items-center gap-3">
        <div className="relative flex-shrink-0 group">
          <Link href={`/browse/podcast/${podcastId}`}>
            <div className="relative w-10 h-10 rounded-full overflow-hidden border border-border">
              <Image
                src={imageUrl}
                alt={podcastName}
                fill
                className="object-cover"
                sizes="40px"
              />
            </div>
          </Link>
          {/* Play button overlay on artwork */}
          {track && (
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <PlayButton track={track} size="sm" variant="overlay" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 flex items-center gap-1.5">
          <Link href={`/browse/podcast/${podcastId}`} className="hover:underline">
            <p className="text-body-sm font-medium text-foreground leading-tight">{podcastName}</p>
          </Link>
          <span className="text-muted-foreground">&#183;</span>
          <p className="text-body-sm text-muted-foreground">
            {formatDate(publishedAt)}
          </p>
        </div>
        <motion.button
          onClick={handleSubscribe}
          disabled={isLoading}
          className="p-2 rounded-full transition-all cursor-pointer"
          title={subscribed ? 'Unsubscribe' : 'Subscribe'}
          whileTap={{ scale: 1.3 }}
          transition={springBouncy}
        >
          <Heart className={`h-5 w-5 ${subscribed ? 'fill-current text-red-500' : 'text-muted-foreground'}`} />
        </motion.button>
      </div>

      {/* Main Content: Episode Title */}
      <h3 className="text-h4 text-foreground line-clamp-2 mt-2">
        {title}
      </h3>

      {/* Description / Value Preview */}
      <p className="text-body-sm text-muted-foreground line-clamp-3 mt-1">
        {summaryPreview?.hookHeadline || description}
      </p>

      {/* Stats row */}
      {summaryPreview && (summaryPreview.takeawayCount || summaryPreview.chapterCount) && (
        <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
          {summaryPreview.takeawayCount && summaryPreview.takeawayCount > 0 && (
            <span className="flex items-center gap-1">
              <Target className="h-3 w-3" />
              {summaryPreview.takeawayCount} takeaways
            </span>
          )}
          {summaryPreview.chapterCount && summaryPreview.chapterCount > 0 && (
            <span className="flex items-center gap-1">
              <BookOpen className="h-3 w-3" />
              {summaryPreview.chapterCount} chapters
            </span>
          )}
          {duration && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {Math.ceil(duration / 60 / 4)} min read
            </span>
          )}
        </div>
      )}

      {/* Actions: Play & Summarize */}
      <div className="mt-3 flex items-center gap-3">
        {track && (
          <InlinePlayButton track={track} />
        )}
        <DiscoverySummarizeButton
          externalEpisodeId={episodeId}
          episodeTitle={title}
          episodeDescription={description}
          episodePublishedAt={publishedAt.toISOString()}
          episodeDuration={duration}
          audioUrl={audioUrl}
          externalPodcastId={podcastId}
          podcastName={podcastName}
          podcastArtist={podcastArtist || podcastName}
          podcastArtwork={podcastArtwork}
          podcastFeedUrl={podcastFeedUrl}
        />
      </div>
    </motion.article>
  );
});
