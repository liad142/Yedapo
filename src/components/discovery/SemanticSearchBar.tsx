'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import posthog from 'posthog-js';
import { useRouter } from 'next/navigation';
import { Search, Loader2, X, Podcast, Play, Sparkles } from 'lucide-react';
import { YouTubeLogoStatic } from '@/components/YouTubeLogo';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import Image from 'next/image';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

interface SearchPodcast {
  id: string;
  source: string;
  title: string;
  author: string;
  artworkUrl: string;
  itunesId?: number;
}

interface SearchChannel {
  id: string;
  title: string;
  thumbnailUrl: string;
  description: string;
}

interface SearchVideo {
  videoId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  channelId: string;
  channelTitle: string;
}

export function SemanticSearchBar() {
  const router = useRouter();
  const { user, setShowAuthModal } = useAuth();
  // Read initial query from URL without useSearchParams() to avoid dynamic rendering / RSC refetches
  const [query, setQuery] = useState(() => {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get('q') || '';
  });
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchPodcast[]>([]);
  const [channels, setChannels] = useState<SearchChannel[]>([]);
  const [videos, setVideos] = useState<SearchVideo[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [summarizingVideos, setSummarizingVideos] = useState<Record<string, 'idle' | 'loading' | 'done'>>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Close results when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sync query to URL params (skip the initial mount to avoid unnecessary RSC refetch)
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    const params = new URLSearchParams(window.location.search);
    if (query.trim()) {
      params.set('q', query.trim());
    } else {
      params.delete('q');
    }
    const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname;
    // Use native replaceState to update URL without triggering RSC refetches.
    // We call the original (unpatched) history method to avoid Next.js router intercepting it.
    window.history.replaceState(window.history.state, '', newUrl);
  }, [query]);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setChannels([]);
      setVideos([]);
      setShowResults(false);
      return;
    }

    const timer = setTimeout(() => {
      performSearch(query.trim());
    }, 300);

    return () => clearTimeout(timer);
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Extract YouTube video ID from a URL (returns null if not a YouTube URL) */
  const extractYouTubeVideoId = (text: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?.*v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[1];
    }
    return null;
  };

  const performSearch = useCallback(async (term: string) => {
    // Cancel previous request
    if (abortRef.current) {
      abortRef.current.abort();
    }

    const controller = new AbortController();
    abortRef.current = controller;

    setIsSearching(true);
    setShowResults(true);
    setSelectedIndex(-1);

    try {
      // Check if the search term is a direct YouTube URL
      const directVideoId = extractYouTubeVideoId(term);

      const res = await fetch(`/api/search?q=${encodeURIComponent(term)}&limit=8`, {
        signal: controller.signal,
      });

      if (!res.ok) throw new Error('Search failed');

      const data = await res.json();
      setResults(data.podcasts || []);
      setChannels(data.channels || []);

      let videoResults = data.videos || [];

      // If user pasted a YouTube URL but no video results came back,
      // create a synthetic result so they can still summarize it
      if (directVideoId && videoResults.length === 0) {
        videoResults = [{
          videoId: directVideoId,
          title: `YouTube Video (${directVideoId})`,
          description: '',
          thumbnailUrl: `https://img.youtube.com/vi/${directVideoId}/mqdefault.jpg`,
          channelId: '',
          channelTitle: 'YouTube',
        }];
      }

      setVideos(videoResults);
      posthog.capture('search_performed', { query: term, is_direct_url: !!directVideoId });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      console.error('Search error:', err);
      setResults([]);
      setChannels([]);
      setVideos([]);
    } finally {
      if (!controller.signal.aborted) {
        setIsSearching(false);
      }
    }
  }, []);

  // Flat list of all items for keyboard nav
  const allItems = [
    ...results.map((p) => ({ type: 'podcast' as const, data: p })),
    ...channels.map((c) => ({ type: 'channel' as const, data: c })),
    ...videos.map((v) => ({ type: 'video' as const, data: v })),
  ];
  const totalItems = allItems.length;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showResults || totalItems === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev < totalItems - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : totalItems - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < totalItems) {
          const item = allItems[selectedIndex];
          setShowResults(false);
          if (item.type === 'podcast') {
            router.push(getPodcastHref(item.data as SearchPodcast));
          } else if (item.type === 'channel') {
            router.push(`/browse/youtube/${(item.data as SearchChannel).id}`);
          } else if (item.type === 'video') {
            handleVideoClick(item.data as SearchVideo);
          }
        }
        break;
      case 'Escape':
        setShowResults(false);
        inputRef.current?.blur();
        break;
    }
  };

  const handleVideoClick = async (video: SearchVideo) => {
    setShowResults(false);
    posthog.capture('search_video_clicked', { query, video_id: video.videoId, video_title: video.title });
    // Navigate to the channel page so the user can browse all videos
    if (video.channelId) {
      router.push(`/browse/youtube/${video.channelId}`);
    } else {
      window.open(`https://www.youtube.com/watch?v=${video.videoId}`, '_blank', 'noopener,noreferrer');
    }
  };

  const handleVideoSummarize = async (e: React.MouseEvent, video: SearchVideo) => {
    e.preventDefault();
    e.stopPropagation();
    if (summarizingVideos[video.videoId] === 'loading') return;

    // Guest users: show sign-up modal
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    setSummarizingVideos((prev) => ({ ...prev, [video.videoId]: 'loading' }));
    try {
      const res = await fetch(`/api/youtube/${video.videoId}/summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: 'quick',
          title: video.title,
          channelId: video.channelId || '',
          channelTitle: video.channelTitle,
          thumbnailUrl: video.thumbnailUrl,
        }),
      });
      if (res.ok) {
        setSummarizingVideos((prev) => ({ ...prev, [video.videoId]: 'done' }));
        // Brief success animation, then navigate to channel page
        setTimeout(() => {
          setShowResults(false);
          if (video.channelId) {
            router.push(`/browse/youtube/${video.channelId}`);
          }
        }, 800);
      }
    } catch {
      setSummarizingVideos((prev) => ({ ...prev, [video.videoId]: 'idle' }));
    }
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setChannels([]);
    setVideos([]);
    setShowResults(false);
    setSelectedIndex(-1);
    inputRef.current?.focus();
    // Clear URL param without triggering RSC refetch
    const params = new URLSearchParams(window.location.search);
    params.delete('q');
    const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname;
    window.history.replaceState(window.history.state, '', newUrl);
  };

  const hasYouTube = channels.length > 0 || videos.length > 0;
  const hasPodcasts = results.length > 0;
  const hasBothSides = hasPodcasts && hasYouTube;

  // Calculate globalIndex for keyboard nav
  const podcastBaseIndex = 0;
  const channelBaseIndex = results.length;
  const videoBaseIndex = results.length + channels.length;

  return (
    <div ref={containerRef} className="relative max-w-2xl mx-auto">
      {/* Search Input */}
      <div className="relative bg-secondary border border-border-strong rounded-xl">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Search podcasts, YouTube videos, or topics..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => totalItems > 0 && setShowResults(true)}
          className="pl-12 pr-12 h-12 text-base bg-transparent border-0 ring-0 focus-visible:ring-0 placeholder:text-muted-foreground transition-all"
        />
        {query ? (
          <button
            onClick={clearSearch}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 hover:bg-muted rounded-full transition-colors cursor-pointer"
            aria-label="Clear search"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        ) : null}
      </div>

      {/* Screen reader announcement for search results */}
      <div className="sr-only" aria-live="polite" role="status">
        {showResults && !isSearching && totalItems > 0
          ? `${totalItems} result${totalItems === 1 ? '' : 's'} found`
          : showResults && !isSearching && query.trim()
            ? 'No results found'
            : ''}
      </div>

      {/* Results Dropdown */}
      <AnimatePresence>
        {showResults && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 right-0 mt-2 rounded-2xl overflow-hidden z-50 bg-card border border-border shadow-[var(--shadow-floating)]"
          >
            {isSearching ? (
              <div className="p-6 flex items-center justify-center gap-3">
                <Loader2 className="h-5 w-5 text-primary animate-spin" />
                <span className="text-muted-foreground">Searching...</span>
              </div>
            ) : totalItems > 0 ? (
              <div className={`${hasBothSides ? 'flex' : ''}`}>
                {/* Left column: Podcasts */}
                {hasPodcasts && (
                  <div className={`py-2 ${hasBothSides ? 'flex-1 min-w-0 border-r border-border' : 'w-full'}`}>
                    <div className="px-4 py-2 flex items-center gap-1.5">
                      <Podcast className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Podcasts
                      </span>
                    </div>
                    {results.map((podcast, index) => {
                      const globalIndex = podcastBaseIndex + index;
                      return (
                        <motion.div
                          key={podcast.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                        >
                        <Link
                          href={getPodcastHref(podcast)}
                          onClick={() => {
                            posthog.capture('search_result_clicked', { query, podcast_id: podcast.id, podcast_title: podcast.title, result_index: index });
                            setShowResults(false);
                          }}
                          className={`flex items-center gap-3 px-4 py-2.5 transition-colors cursor-pointer ${
                            globalIndex === selectedIndex
                              ? 'bg-secondary'
                              : 'hover:bg-secondary/60'
                          }`}
                        >
                          <div className="relative w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={podcast.artworkUrl || '/placeholder-podcast.png'}
                              alt={podcast.title}
                              className="absolute inset-0 w-full h-full object-cover"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-foreground truncate">{podcast.title}</p>
                            <p className="text-xs text-muted-foreground truncate">{podcast.author}</p>
                          </div>
                        </Link>
                        </motion.div>
                      );
                    })}
                  </div>
                )}

                {/* Right column: YouTube (Channels + Videos) */}
                {hasYouTube && (
                  <div className={`py-2 ${hasBothSides ? 'flex-1 min-w-0' : 'w-full'}`}>
                    {/* YouTube Channels */}
                    {channels.length > 0 && (
                      <>
                        <div className="px-4 py-2 flex items-center gap-1.5">
                          <YouTubeLogoStatic size="xs" />
                          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Channels
                          </span>
                        </div>
                        {channels.map((channel, index) => {
                          const globalIndex = channelBaseIndex + index;
                          return (
                            <motion.div
                              key={channel.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.05 }}
                            >
                            <Link
                              href={`/browse/youtube/${channel.id}`}
                              onClick={() => {
                                posthog.capture('search_channel_clicked', { query, channel_id: channel.id, channel_title: channel.title, result_index: globalIndex });
                                setShowResults(false);
                              }}
                              className={`flex items-center gap-3 px-4 py-2.5 transition-colors cursor-pointer ${
                                globalIndex === selectedIndex
                                  ? 'bg-secondary'
                                  : 'hover:bg-secondary/60'
                              }`}
                            >
                              <div className="relative w-9 h-9 rounded-full overflow-hidden flex-shrink-0 bg-muted">
                                <Image
                                  src={channel.thumbnailUrl || '/placeholder-podcast.png'}
                                  alt={channel.title}
                                  fill
                                  className="object-cover"
                                  sizes="36px"
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm text-foreground truncate">{channel.title}</p>
                                <p className="text-xs text-muted-foreground truncate">{channel.description}</p>
                              </div>
                            </Link>
                            </motion.div>
                          );
                        })}
                      </>
                    )}

                    {/* YouTube Videos */}
                    {videos.length > 0 && (
                      <React.Fragment key="videos-section">
                        {channels.length > 0 && <div className="border-t border-border my-1" />}
                        <div className="px-4 py-2 flex items-center gap-1.5">
                          <Play className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Videos
                          </span>
                        </div>
                        {videos.map((video, index) => {
                          const globalIndex = videoBaseIndex + index;
                          return (
                            <motion.div
                              key={`video-${video.videoId}`}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.05 }}
                            >
                            <div
                              className={`flex flex-col px-4 py-3 transition-colors ${
                                globalIndex === selectedIndex
                                  ? 'bg-secondary'
                                  : 'hover:bg-secondary/60'
                              }`}
                            >
                              <button
                                onClick={() => handleVideoClick(video)}
                                className="flex items-center gap-3 w-full cursor-pointer text-left"
                              >
                                <div className="relative w-14 h-9 rounded-md overflow-hidden flex-shrink-0 bg-muted">
                                  <Image
                                    src={video.thumbnailUrl || '/placeholder-podcast.png'}
                                    alt={video.title}
                                    fill
                                    className="object-cover"
                                    sizes="56px"
                                  />
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                    <Play className="h-3 w-3 text-white fill-white" />
                                  </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm text-foreground line-clamp-2">{video.title}</p>
                                  <p className="text-xs text-muted-foreground truncate">{video.channelTitle}</p>
                                </div>
                              </button>
                              <div className="flex justify-end mt-1.5">
                                <button
                                  onClick={(e) => handleVideoSummarize(e, video)}
                                  disabled={summarizingVideos[video.videoId] === 'loading' || summarizingVideos[video.videoId] === 'done'}
                                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-full transition-all shadow-sm cursor-pointer disabled:cursor-default ${
                                    summarizingVideos[video.videoId] === 'done'
                                      ? 'bg-green-500 shadow-green-500/20 scale-105'
                                      : 'bg-primary shadow-primary/20 hover:shadow-primary/40 hover:scale-105 active:scale-95 disabled:opacity-70'
                                  }`}
                                  title="Summarize"
                                >
                                  {summarizingVideos[video.videoId] === 'loading' ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : summarizingVideos[video.videoId] === 'done' ? (
                                    <Sparkles className="h-3.5 w-3.5 fill-white/40 animate-pulse" />
                                  ) : (
                                    <Sparkles className="h-3.5 w-3.5 fill-white/20" />
                                  )}
                                  <span>
                                    {summarizingVideos[video.videoId] === 'loading'
                                      ? 'Summarizing...'
                                      : summarizingVideos[video.videoId] === 'done'
                                        ? 'Queued!'
                                        : 'Summarize'}
                                  </span>
                                </button>
                              </div>
                            </div>
                            </motion.div>
                          );
                        })}
                      </React.Fragment>
                    )}
                  </div>
                )}

                {/* If only one side has results, no split layout needed — handled by conditionals above */}
              </div>
            ) : (
              <div className="p-6 text-center text-muted-foreground">
                No results found. Try a different search term.
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Get the browse href for a podcast search result.
 * If the podcast has an itunesId (from either source), use the Apple route.
 * Otherwise use the pi: prefixed ID.
 */
function getPodcastHref(podcast: SearchPodcast): string {
  // If the ID already starts with "apple:", extract the numeric part
  if (podcast.id.startsWith('apple:')) {
    return `/browse/podcast/${podcast.id.slice(6)}`;
  }
  // If it has an itunesId, use that for the Apple flow
  if (podcast.itunesId) {
    return `/browse/podcast/${podcast.itunesId}`;
  }
  // PI-only podcast - use the full composite ID
  return `/browse/podcast/${podcast.id}`;
}
