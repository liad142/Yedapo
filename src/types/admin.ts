export interface TimeSeriesPoint {
  date: string;
  value: number;
}

export interface LabeledCount {
  label: string;
  count: number;
}

export interface OverviewStats {
  totalUsers: number;
  totalPodcasts: number;
  totalEpisodes: number;
  summariesReady: number;
  queueDepth: number;
  failureRate: number;
  totalSubscriptions: number;
  totalFollows: number;
  signupsOverTime: TimeSeriesPoint[];
  aiStatusBreakdown: LabeledCount[];
  recentActivity: {
    type: string;
    description: string;
    timestamp: string;
  }[];
}

export interface UserAnalytics {
  totalUsers: number;
  usersThisWeek: number;
  onboardingRate: number;
  signupsOverTime: TimeSeriesPoint[];
  genreDistribution: LabeledCount[];
  countryDistribution: LabeledCount[];
  planDistribution: LabeledCount[];
  recentUsers: {
    id: string;
    email: string;
    display_name: string | null;
    created_at: string;
    onboarding_completed: boolean;
    plan: string;
  }[];
}

export interface ContentAnalytics {
  totalPodcasts: number;
  totalEpisodes: number;
  youtubeChannels: number;
  episodesOverTime: TimeSeriesPoint[];
  podcastsByLanguage: LabeledCount[];
  topPodcasts: {
    id: string;
    title: string;
    episode_count: number;
    image_url: string | null;
  }[];
  topYoutubeChannels: {
    id: string;
    title: string;
    follow_count: number;
  }[];
}

export interface AiAnalyticsFailure {
  episode_id: string;
  episode_title: string;
  type: 'summary' | 'transcript';
  level?: string;
  error_message: string | null;
  failed_at: string;
}

export interface YouTubePipelineRow {
  episode_id: string;
  episode_title: string;
  podcast_id: string;
  podcast_title: string;
  rss_feed_url: string | null;
  video_url: string | null;
  summary_id: string | null;
  transcript_id: string | null;
  level: string;
  language: string | null;
  summary_status: string | null;
  transcript_status: string | null;
  transcript_provider: string | null;
  summary_error: string | null;
  transcript_error: string | null;
  updated_at: string;
  requested_by_user_id: string | null;
  requested_by_email: string | null;
  requested_at: string | null;
}

export interface AiAnalytics {
  totalSummaries: number;
  totalTranscripts: number;
  queueDepth: number;
  failureRate: number;
  summariesByLevelAndStatus: {
    level: string;
    status: string;
    count: number;
  }[];
  transcriptsByStatus: LabeledCount[];
  generationOverTime: TimeSeriesPoint[];
  recentFailures: AiAnalyticsFailure[];
  youtubeSummaryHealth: {
    totalSummaries: number;
    queuedSummaries: number;
    failedSummaries: number;
    failureRate: number;
    totalTranscripts: number;
    failedTranscripts: number;
    youtubeChannels: number;
    recentFailures: AiAnalyticsFailure[];
  };
}

export type TodoStatus = 'idea' | 'planned' | 'in_progress' | 'done';
export type TodoPriority = 'low' | 'medium' | 'high';

export interface AdminTodo {
  id: string;
  title: string;
  description: string;
  status: TodoStatus;
  priority: TodoPriority;
  plan_prompt: string | null;
  images: string[];
  created_at: string;
  updated_at: string;
}

export interface PostHogAnalytics {
  dau: number;
  wau: number;
  mau: number;
  dauMauRatio: number;
  activeUsersTrend: TimeSeriesPoint[];
  topEvents: { event: string; count: number; uniqueUsers: number }[];
  featureAdoption: { event: string; uniqueUsers: number; totalFires: number; adoptionPct: number }[];
  funnel: { step: string; count: number; conversionPct: number }[];
  correlation: {
    totalRegistered: number;
    completedOnboarding: number;
    hasPlayed: number;
    hasSubscribed: number;
    onboardingRate: number;
    playRate: number;
    subscribeRate: number;
  };
  lastUpdated: string;
}

export interface SystemHealth {
  redis: {
    connected: boolean;
    latencyMs: number;
    cacheKeys: number;
  };
  recentErrors: {
    type: string;
    message: string;
    timestamp: string;
    episode_id?: string;
  }[];
  errorGroups: {
    message: string;
    count: number;
    lastSeen: string;
    type: string;
  }[];
}
