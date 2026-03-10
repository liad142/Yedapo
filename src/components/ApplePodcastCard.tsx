'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Heart } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

export interface ApplePodcast {
  id: string;
  name: string;
  artistName: string;
  description?: string;
  artworkUrl: string;
  genres?: string[];
  trackCount?: number;
  contentAdvisoryRating?: string;
  feedUrl?: string;
}

interface ApplePodcastCardProps {
  podcast: ApplePodcast;
  priority?: boolean;
  className?: string;
}

export const ApplePodcastCard = React.memo(function ApplePodcastCard({ podcast, priority = false, className }: ApplePodcastCardProps) {
  const { user, setShowAuthModal } = useAuth();
  const { isSubscribed, subscribe, unsubscribe } = useSubscription();
  const [isLoading, setIsLoading] = useState(false);
  const imageUrl = podcast.artworkUrl?.replace('100x100', '400x400') || '/placeholder-podcast.png';

  const subscribed = isSubscribed(podcast.id.toString());

  const handleLove = async (e: React.MouseEvent) => {
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
        await unsubscribe(podcast.id.toString());
      } else {
        await subscribe(podcast.id.toString());
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Link href={`/browse/podcast/${podcast.id}`} className={cn('block group', className)}>
      <Card className="overflow-hidden transition-all duration-300 hover:-translate-y-1" interactive>
        <div className="relative aspect-square overflow-hidden bg-secondary">
          <Image
            src={imageUrl}
            alt={podcast.name}
            fill
            sizes="(max-width: 640px) 160px, 180px"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            priority={priority}
          />
          {podcast.contentAdvisoryRating === 'Explicit' && (
            <Badge
              variant="destructive"
              className="absolute top-2 left-2 px-1.5 py-0.5 text-[10px] uppercase tracking-wider font-bold shadow-sm"
            >
              Explicit
            </Badge>
          )}
          {/* Love Button */}
          <button
            onClick={handleLove}
            disabled={isLoading}
            className={cn(
              "absolute top-2 right-2 p-2 rounded-full transition-all duration-300 shadow-sm opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0",
              isLoading ? 'opacity-50 cursor-not-allowed' : '',
              subscribed
                ? 'bg-card text-rose-500 opacity-100 translate-y-0 shadow-md'
                : 'bg-card/90 text-muted-foreground hover:text-rose-500 hover:bg-card'
            )}
            title={subscribed ? 'Remove from My Podcasts' : 'Add to My Podcasts'}
          >
            <Heart className={cn("w-4 h-4", subscribed && "fill-current")} />
          </button>
        </div>
        <div className="p-4 space-y-1.5">
          <h3 className="font-bold text-foreground text-sm line-clamp-2 leading-tight group-hover:text-primary transition-colors">
            {podcast.name}
          </h3>
          <p className="text-xs text-muted-foreground font-medium line-clamp-1">
            {podcast.artistName}
          </p>
          {podcast.genres && podcast.genres.length > 0 && (
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold line-clamp-1">
              {podcast.genres[0]}
            </p>
          )}
        </div>
      </Card>
    </Link>
  );
});
