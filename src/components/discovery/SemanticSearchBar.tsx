'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import posthog from 'posthog-js';
import { useRouter } from 'next/navigation';
import { Search, Loader2, X } from 'lucide-react';
import { YouTubeLogoStatic } from '@/components/YouTubeLogo';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import Image from 'next/image';
import Link from 'next/link';

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

export function SemanticSearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchPodcast[]>([]);
  const [channels, setChannels] = useState<SearchChannel[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
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

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setChannels([]);
      setShowResults(false);
      return;
    }

    const timer = setTimeout(() => {
      performSearch(query.trim());
    }, 300);

    return () => clearTimeout(timer);
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

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
      const res = await fetch(`/api/search?q=${encodeURIComponent(term)}&limit=8`, {
        signal: controller.signal,
      });

      if (!res.ok) throw new Error('Search failed');

      const data = await res.json();
      setResults(data.podcasts || []);
      setChannels(data.channels || []);
      posthog.capture('search_performed', { query: term });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      console.error('Search error:', err);
      setResults([]);
      setChannels([]);
    } finally {
      if (!controller.signal.aborted) {
        setIsSearching(false);
      }
    }
  }, []);

  const totalItems = results.length + channels.length;

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
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          const podcast = results[selectedIndex];
          setShowResults(false);
          router.push(getPodcastHref(podcast));
        } else if (selectedIndex >= results.length && selectedIndex < totalItems) {
          const channel = channels[selectedIndex - results.length];
          setShowResults(false);
          router.push(`/browse/youtube/${channel.id}`);
        }
        break;
      case 'Escape':
        setShowResults(false);
        inputRef.current?.blur();
        break;
    }
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setChannels([]);
    setShowResults(false);
    setSelectedIndex(-1);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className="relative max-w-2xl mx-auto">
      {/* Search Input */}
      <div className="relative bg-secondary border border-border-strong rounded-xl">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Search podcasts, topics, or creators..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => (results.length > 0 || channels.length > 0) && setShowResults(true)}
          className="pl-12 pr-12 h-12 text-base bg-transparent border-0 ring-0 focus-visible:ring-0 placeholder:text-muted-foreground transition-all"
        />
        {query ? (
          <button
            onClick={clearSearch}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded-full transition-colors"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        ) : null}
      </div>

      {/* Results Dropdown */}
      <AnimatePresence>
        {showResults && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 right-0 mt-2 rounded-2xl overflow-hidden z-50 bg-card border border-border shadow-[var(--shadow-floating)]"
          >
            {isSearching ? (
              <div className="p-6 flex items-center justify-center gap-3">
                <Loader2 className="h-5 w-5 text-primary animate-spin" />
                <span className="text-muted-foreground">Searching...</span>
              </div>
            ) : totalItems > 0 ? (
              <div className="py-2">
                {results.length > 0 && (
                  <>
                    <div className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Podcasts
                    </div>
                    {results.map((podcast, index) => (
                      <Link
                        key={podcast.id}
                        href={getPodcastHref(podcast)}
                        onClick={() => { posthog.capture('search_result_clicked', { query, podcast_id: podcast.id, podcast_title: podcast.title, result_index: index }); setShowResults(false); }}
                        className={`flex items-center gap-3 px-4 py-3 transition-colors ${index === selectedIndex
                          ? 'bg-secondary'
                          : 'hover:bg-secondary/60'
                          }`}
                      >
                        <div className="relative w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 bg-muted">
                          <Image
                            src={podcast.artworkUrl || '/placeholder-podcast.png'}
                            alt={podcast.title}
                            fill
                            className="object-cover"
                            sizes="40px"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate">{podcast.title}</p>
                          <p className="text-sm text-muted-foreground truncate">{podcast.author}</p>
                        </div>
                      </Link>
                    ))}
                  </>
                )}
                {channels.length > 0 && (
                  <>
                    {results.length > 0 && <div className="border-t border-border my-1" />}
                    <div className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <YouTubeLogoStatic size="xs" />
                      Channels
                    </div>
                    {channels.map((channel, index) => {
                      const globalIndex = results.length + index;
                      return (
                        <Link
                          key={channel.id}
                          href={`/browse/youtube/${channel.id}`}
                          onClick={() => { posthog.capture('search_channel_clicked', { query, channel_id: channel.id, channel_title: channel.title, result_index: globalIndex }); setShowResults(false); }}
                          className={`flex items-center gap-3 px-4 py-3 transition-colors ${globalIndex === selectedIndex
                            ? 'bg-secondary'
                            : 'hover:bg-secondary/60'
                            }`}
                        >
                          <div className="relative w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-muted">
                            <Image
                              src={channel.thumbnailUrl || '/placeholder-podcast.png'}
                              alt={channel.title}
                              fill
                              className="object-cover"
                              sizes="40px"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-foreground truncate">{channel.title}</p>
                              <YouTubeLogoStatic size="xs" />
                            </div>
                            <p className="text-sm text-muted-foreground truncate">{channel.description}</p>
                          </div>
                        </Link>
                      );
                    })}
                  </>
                )}
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
