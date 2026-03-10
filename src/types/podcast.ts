/**
 * Unified source-agnostic podcast types
 * Used across Apple Podcasts and Podcastindex results
 */

export type PodcastSource = 'apple' | 'podcastindex';

export interface Podcast {
  /** Composite ID: "apple:{itunesId}" or "pi:{feedId}" */
  id: string;
  source: PodcastSource;
  title: string;
  author: string;
  description: string;
  artworkUrl: string;
  feedUrl?: string;
  genres: string[];
  episodeCount: number;
  /** iTunes ID if available (shared across sources for deduplication) */
  itunesId?: number;
  /** Podcastindex feed ID if available */
  podcastIndexId?: number;
  language?: string;
  explicit?: boolean;
}

export interface PodcastEpisode {
  id: string;
  podcastId: string;
  title: string;
  description: string;
  publishedAt: Date;
  duration: number;
  audioUrl?: string;
  artworkUrl?: string;
  episodeNumber?: number;
  seasonNumber?: number;
}

export interface YouTubeChannelResult {
  id: string;
  title: string;
  thumbnailUrl: string;
  description: string;
}

export interface YouTubeVideoResult {
  videoId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  channelTitle: string;
}

export interface SearchResult {
  podcasts: Podcast[];
  channels?: YouTubeChannelResult[];
  videos?: YouTubeVideoResult[];
  query: string;
  source: 'apple' | 'podcastindex' | 'merged';
  count: number;
}

/** Episode shape used by both podcast detail pages */
export interface PodcastDetailEpisode {
  id: string;
  podcastId: string;
  title: string;
  description: string;
  publishedAt: string;
  duration: number;
  audioUrl?: string;
  artworkUrl?: string;
  episodeNumber?: number;
  seasonNumber?: number;
  isFromDb?: boolean;
}

/** Per-episode summary availability info shared across podcast pages */
export interface SummaryAvailability {
  audioUrl: string;
  episodeId: string | null;
  hasQuickSummary: boolean;
  hasDeepSummary: boolean;
  quickStatus: string | null;
  deepStatus: string | null;
}
