"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { Podcast } from "@/types/database";
import { Mic2, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface PodcastCardProps {
  podcast: Podcast & { episode_count?: number; new_episode_count?: number };
  onRemove?: (id: string) => void;
  hasNewEpisodes?: boolean;
}

export const PodcastCard = React.memo(function PodcastCard({ podcast, onRemove, hasNewEpisodes }: PodcastCardProps) {
  const [isRemoving, setIsRemoving] = useState(false);

  const handleRemove = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isRemoving || !onRemove) return;

    setIsRemoving(true);
    try {
      const response = await fetch(`/api/podcasts/${podcast.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        onRemove(podcast.id);
      } else {
        console.error('Failed to remove podcast');
      }
    } catch (err) {
      console.error('Error removing podcast:', err);
    } finally {
      setIsRemoving(false);
    }
  };
  // Handle image_url that might be an array or invalid
  let imageUrl: string | null = null;
  const rawImageUrl = podcast.image_url;

  if (rawImageUrl) {
    try {
      // If it's already an array, get the first element
      if (Array.isArray(rawImageUrl)) {
        imageUrl = rawImageUrl[0] || null;
      }
      // If it's a JSON array string, extract the first URL
      else if (typeof rawImageUrl === 'string' && rawImageUrl.startsWith('[')) {
        const parsed = JSON.parse(rawImageUrl);
        imageUrl = Array.isArray(parsed) ? parsed[0] : rawImageUrl;
      }
      // Otherwise, use it as-is
      else {
        imageUrl = rawImageUrl;
      }

      // Validate URL
      if (imageUrl) {
        new URL(imageUrl);
      }
    } catch {
      imageUrl = null;
    }
  }

  // Link to browse page for Apple podcasts, internal page for others
  const podcastHref = podcast.rss_feed_url?.startsWith('apple:')
    ? `/browse/podcast/${podcast.rss_feed_url.replace('apple:', '')}`
    : `/podcast/${podcast.id}`;

  return (
    <Link href={podcastHref} className="block h-full">
      <div className="group h-full bg-card dark:border dark:border-white/5 rounded-2xl overflow-hidden transition-all duration-300 shadow-sm hover:shadow-md dark:shadow-none dark:hover:shadow-none hover:scale-[1.02]">
        <div className="relative aspect-square w-full bg-secondary">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={podcast.title}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-secondary">
              <Mic2 className="h-12 w-12 text-muted-foreground/40" />
            </div>
          )}

          {/* Green dot for new episodes */}
          {hasNewEpisodes && (
            <div className="absolute top-3 left-3 w-3 h-3 rounded-full bg-green-500 shadow-sm z-10 ring-2 ring-black/20" />
          )}

          {/* Remove Button - visible on hover (desktop) or always on touch */}
          {onRemove && (
            <button
              onClick={handleRemove}
              disabled={isRemoving}
              className={cn(
                'absolute top-3 right-3 p-1.5 rounded-full transition-all duration-200 z-20',
                'bg-black/60 backdrop-blur-sm text-white',
                'md:opacity-0 md:group-hover:opacity-100',
                'hover:bg-black/80',
                isRemoving && '!opacity-100 cursor-wait'
              )}
              aria-label="Remove from My Podcasts"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="p-3 sm:p-5">
          <h3 className="text-sm sm:text-h4 leading-tight tracking-tight text-foreground line-clamp-2 sm:line-clamp-1 mb-0.5 sm:mb-1 group-hover:text-primary transition-colors">
            {podcast.title}
          </h3>

          {podcast.author && (
            <p className="text-[11px] sm:text-xs text-muted-foreground line-clamp-1 mb-2 sm:mb-4">
              {podcast.author}
            </p>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            {podcast.episode_count !== undefined && (
              <span className="text-[11px] sm:text-xs text-muted-foreground font-medium">
                {podcast.episode_count} eps
              </span>
            )}

            {podcast.language && (
              <span className="inline-flex items-center justify-center px-1.5 sm:px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-medium bg-secondary text-muted-foreground">
                {podcast.language.toUpperCase()}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
});
