export interface DbPodcast {
  id: string;
  title: string;
  author: string | null;
  description: string | null;
  rss_feed_url: string;
  image_url: string | null;
  language: string;
  created_at: string;
  latest_episode_date: string | null;
  apple_id: string | null;
}

/** @deprecated Use DbPodcast for DB row types. Alias kept for backward compatibility. */
export type Podcast = DbPodcast;

export interface Episode {
  id: string;
  podcast_id: string;
  title: string;
  description: string | null;
  audio_url: string;
  duration_seconds: number | null;
  published_at: string | null;
  created_at: string;
  transcript_url: string | null;      // From RSS <podcast:transcript> tag (FREE transcription!)
  transcript_language: string | null;  // Language code from transcript tag or channel language
}

export interface Transcript {
  id: string;
  episode_id: string;
  full_text: string;
  language: string;
  provider: string;
  created_at: string;
}

// Status types for the new summary system
export type TranscriptStatus = 'queued' | 'transcribing' | 'ready' | 'failed';
export type SummaryStatus = 'not_ready' | 'queued' | 'transcribing' | 'summarizing' | 'ready' | 'failed';
export type SummaryLevel = 'quick' | 'deep' | 'insights';

// Quick summary content structure
export interface QuickSummaryContent {
  hook_headline: string;   // New field!
  executive_brief: string; // Was 'tldr'
  golden_nugget: string;   // The "Wow" factor
  perfect_for: string;     // More specific target audience
  tags: string[];
}

// Structured action item with resource names (no AI-generated URLs)
export interface ActionItemResource {
  name: string;       // "LangChain", "The Pragmatic Programmer"
  type: 'github' | 'tool' | 'book' | 'person' | 'paper' | 'website';
  context?: string;   // "Python framework for LLM apps discussed by the guest"
}

export interface ActionItem {
  text: string;
  category: 'tool' | 'repo' | 'concept' | 'strategy' | 'resource' | 'habit';
  priority?: 'high' | 'medium' | 'low';
  resources?: ActionItemResource[];
}

// New chronological breakdown section with timestamps
export interface ChronologicalSection {
  // New fields (from diarized transcript timestamps)
  timestamp?: string;          // "12:34" (MM:SS from transcript)
  timestamp_seconds?: number;  // 754 (for seek())
  title?: string;              // "The AI Safety Debate"
  hook?: string;               // 1-sentence teaser
  // Legacy field (still supported)
  timestamp_description?: string; // "The Opening Argument" (old format)
  // Common field
  content: string;             // Detailed paragraph
}

export interface DeepSummaryContent {
  topic_tags?: string[]; // 3-5 tags from fixed taxonomy for related episodes matching
  comprehensive_overview: string; // May contain <<highlighted>> markers
  core_concepts: Array<{
    concept: string;
    explanation: string;
    quote_reference?: string;
  }>;
  chronological_breakdown: ChronologicalSection[];
  contrarian_views: string[];
  actionable_takeaways: (string | ActionItem)[];  // Backward compat: old=string[], new=ActionItem[]
  section_labels?: {
    comprehensive_overview: string;
    core_concepts: string;
    episode_flow: string;
    counterpoints: string;
    actionable_takeaways: string;
    counterpoints_subtitle: string;
    transcript: string;
    action_items: string;
    discussion: string;
  };
}

// Extended transcript with status
export interface TranscriptWithStatus extends Transcript {
  status: TranscriptStatus;
  error_message?: string;
  updated_at: string;
}

// Summary record in database
export interface SummaryRecord {
  id: string;
  episode_id: string;
  level: SummaryLevel;
  language: string;
  status: SummaryStatus;
  content_json: QuickSummaryContent | DeepSummaryContent | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

// Summary data for API response
export interface SummaryData {
  status: SummaryStatus;
  content?: QuickSummaryContent | DeepSummaryContent;
  created_at?: string;
  updated_at?: string;
}

// API response structure for episode summaries
export interface EpisodeSummariesResponse {
  episode_id: string;
  summaries: {
    quick?: SummaryData;
    deep?: SummaryData;
  };
}

// ============================================
// EPISODE INSIGHTS HUB TYPES
// ============================================

// Insight tab types
export type InsightTab = 'summary' | 'transcript' | 'keywords' | 'highlights' | 'shownotes';

// Keyword structure
export interface KeywordItem {
  word: string;
  frequency: number;
  relevance: 'high' | 'medium' | 'low';
}

// Highlight structure (key quotes/moments)
export interface HighlightItem {
  quote: string;
  timestamp?: string; // "12:34" format
  context?: string;
  importance: 'critical' | 'important' | 'notable';
}

// Shownotes section
export interface ShownotesSection {
  timestamp?: string;
  title: string;
  content: string;
  links?: Array<{ label: string; url: string }>;
}

// Mindmap node for hierarchical view
export interface MindmapNode {
  id: string;
  label: string;
  children?: MindmapNode[];
}

// Complete insights content (stored in content_json)
export interface InsightsContent {
  keywords: KeywordItem[];
  highlights: HighlightItem[];
  shownotes: ShownotesSection[];
  mindmap: MindmapNode;
  generated_at: string;
}

// Insight status (reuses SummaryStatus values)
export type InsightStatus = SummaryStatus;

// YouTube metadata for insights page
export interface YouTubeMetadataResponse {
  description_links: { url: string; text: string }[];
  chapters: { title: string; startSeconds: number }[];
  pinned_comment: { author: string; text: string; likeCount: string } | null;
  storyboard_spec: string | null;
  keywords: string[];
}

// API response for episode insights page
export interface EpisodeInsightsResponse {
  episode_id: string;
  transcript_status: TranscriptStatus | 'not_started';
  transcript_text?: string;
  insights?: {
    status: InsightStatus;
    content?: InsightsContent;
    updated_at?: string;
  };
  summaries: {
    quick?: SummaryData;
    deep?: SummaryData;
  };
  youtube_metadata?: YouTubeMetadataResponse;
}

// Podcast Subscription Types
export interface PodcastSubscription {
  id: string;
  user_id: string;
  podcast_id: string;
  created_at: string;
  last_viewed_at: string;
}

export interface PodcastWithSubscription extends Podcast {
  subscription?: PodcastSubscription;
  has_new_episodes?: boolean;
}

// User plan types
export type { UserPlan } from '@/lib/plans';

export interface UserProfile {
  id: string;
  display_name: string | null;
  preferred_genres: string[] | null;
  preferred_country: string | null;
  onboarding_completed: boolean;
  plan: import('@/lib/plans').UserPlan;
  created_at: string;
}

// ============================================
// EPISODE COMMENTS TYPES
// ============================================

export interface EpisodeComment {
  id: string;
  episode_id: string;
  user_id: string;
  parent_id: string | null;
  body: string;
  edited_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EpisodeCommentWithAuthor extends EpisodeComment {
  author: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  replies?: EpisodeCommentWithAuthor[];
}

export interface EpisodeCommentsResponse {
  comments: EpisodeCommentWithAuthor[];
  total: number;
  limit: number;
  offset: number;
}

// Re-export notification types for convenience
export type { NotificationRequest, TelegramConnection, NotificationChannel, NotificationStatus } from './notifications';
