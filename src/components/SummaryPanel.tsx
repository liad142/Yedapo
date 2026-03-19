"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAudioPlayerSafe } from '@/contexts/AudioPlayerContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SummaryStatusBadge } from "./SummaryStatusBadge";
import type { 
  QuickSummaryContent, 
  DeepSummaryContent, 
  SummaryStatus,
  EpisodeSummariesResponse 
} from "@/types/database";
import {
  Sparkles,
  Zap,
  BookOpen,
  Loader2,
  RefreshCw,
  ChevronRight,
  ExternalLink,
  Lightbulb,
  Target,
  FileText,
  Link as LinkIcon,
  Lock,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserPlan } from "@/hooks/useUserPlan";
import { useUsage } from "@/contexts/UsageContext";
import { createLogger } from '@/lib/logger';

const log = createLogger('summary');
import { PaywallOverlay, PaywallList } from "@/components/PaywallOverlay";
import { getTimeUntilReset } from "@/lib/time-utils";

interface SummaryPanelProps {
  episodeId: string;
  episodeTitle?: string;
  onClose?: () => void;
  onChapterClick?: (seconds: number) => void;
  currentVideoTime?: number;
}

type TabType = 'quick' | 'deep';

export function SummaryPanel({ episodeId, episodeTitle, onClose, onChapterClick, currentVideoTime }: SummaryPanelProps) {
  const { user, setShowAuthModal } = useAuth();
  const { usage } = useUsage();
  const [activeTab, setActiveTab] = useState<TabType>('quick');
  const [data, setData] = useState<EpisodeSummariesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState<TabType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const player = useAudioPlayerSafe();
  const hasActivePlayer = !!player?.currentTrack;

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/episodes/${episodeId}/summaries`);
      if (!res.ok) throw new Error('Failed to fetch');
      const result = await res.json();
      setData(result);
      return result;
    } catch (err) {
      log.error('Error fetching summaries', err);
      setError('Failed to load summaries');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [episodeId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Polling when processing
  useEffect(() => {
    const quickStatus = data?.summaries?.quick?.status;
    const deepStatus = data?.summaries?.deep?.status;
    const isProcessing = ['queued', 'transcribing', 'summarizing'].includes(quickStatus || '') ||
                         ['queued', 'transcribing', 'summarizing'].includes(deepStatus || '');

    if (!isProcessing) return;

    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [data, fetchStatus]);

  const handleGenerate = async (level: TabType) => {
    setIsGenerating(level);
    setError(null);

    try {
      const res = await fetch(`/api/episodes/${episodeId}/summaries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Generation failed');
      }

      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsGenerating(null);
    }
  };

  const quickSummary = data?.summaries?.quick;
  const deepSummary = data?.summaries?.deep;
  const currentStatus = activeTab === 'quick' ? quickSummary?.status : deepSummary?.status;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-h3 line-clamp-1">{episodeTitle || 'Episode Summary'}</h2>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
        
        {/* Tabs */}
        <div className="flex gap-2">
          <Button
            variant={activeTab === 'quick' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('quick')}
            className="flex-1"
          >
            <Zap className="mr-2 h-4 w-4" />
            Quick
            {quickSummary?.status === 'ready' && (
              <Badge variant="secondary" className="ml-2 text-xs">Ready</Badge>
            )}
          </Button>
          <Button
            variant={activeTab === 'deep' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('deep')}
            className="flex-1"
          >
            <BookOpen className="mr-2 h-4 w-4" />
            Deep
            {deepSummary?.status === 'ready' && (
              <Badge variant="secondary" className="ml-2 text-xs">Ready</Badge>
            )}
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className={`flex-1 overflow-y-auto p-4 ${hasActivePlayer ? 'pb-32' : ''}`}>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-destructive mb-4">{error}</p>
            <Button variant="outline" onClick={() => fetchStatus()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </div>
        ) : !user ? (
          <GuestSummaryGate onSignUp={() => setShowAuthModal(true, 'Sign up to read full AI summaries and insights.')} />
        ) : activeTab === 'quick' ? (
          <QuickSummaryView
            summary={quickSummary?.content as QuickSummaryContent | undefined}
            status={quickSummary?.status || 'not_ready'}
            isGenerating={isGenerating === 'quick'}
            onGenerate={() => handleGenerate('quick')}
            summaryUsage={usage ? usage.summary : undefined}
          />
        ) : (
          <DeepSummaryView
            summary={deepSummary?.content as DeepSummaryContent | undefined}
            status={deepSummary?.status || 'not_ready'}
            isGenerating={isGenerating === 'deep'}
            onGenerate={() => handleGenerate('deep')}
            onChapterClick={onChapterClick}
            currentVideoTime={currentVideoTime}
            summaryUsage={usage ? usage.summary : undefined}
          />
        )}
      </div>
    </div>
  );
}

// Limit Reached Component
function SummaryLimitReached() {
  const resetTime = getTimeUntilReset();
  return (
    <div className="space-y-3">
      <p className="text-h4 text-red-500 dark:text-red-400">Daily limit reached</p>
      <p className="text-xs text-muted-foreground">
        Resets in {resetTime}
      </p>
      <Button asChild variant="outline" size="sm" className="gap-2">
        <Link href="/pricing">
          <Sparkles className="h-3.5 w-3.5" />
          Upgrade for more
        </Link>
      </Button>
    </div>
  );
}

// Guest Summary Gate Component
function GuestSummaryGate({ onSignUp }: { onSignUp: () => void }) {
  return (
    <div className="text-center py-12 space-y-4">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
        <Lock className="h-8 w-8 text-primary" />
      </div>
      <h3 className="text-h3">Summaries for Members</h3>
      <p className="text-muted-foreground text-sm max-w-xs mx-auto">
        Sign up to access AI-generated summaries, key insights, and deep analysis for any episode.
      </p>
      <Button onClick={onSignUp} className="gap-2">
        <Lock className="h-4 w-4" />
        Sign up to unlock
      </Button>
    </div>
  );
}

// Quick Summary View Component
function QuickSummaryView({
  summary,
  status,
  isGenerating,
  onGenerate,
  summaryUsage,
}: {
  summary?: QuickSummaryContent;
  status: SummaryStatus;
  isGenerating: boolean;
  onGenerate: () => void;
  summaryUsage?: { used: number; limit: number };
}) {
  if (['queued', 'transcribing', 'summarizing'].includes(status)) {
    return (
      <div className="text-center py-12">
        <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
        <p className="text-muted-foreground">
          {status === 'queued' && 'Queued for processing...'}
          {status === 'transcribing' && 'Transcribing audio...'}
          {status === 'summarizing' && 'Generating summary...'}
        </p>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="text-center py-12">
        <p className="text-destructive mb-4">Summary generation failed</p>
        <Button onClick={onGenerate} disabled={isGenerating}>
          {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Retry
        </Button>
      </div>
    );
  }

  if (!summary || status === 'not_ready') {
    const atLimit = summaryUsage && summaryUsage.limit !== -1 && summaryUsage.used >= summaryUsage.limit;
    return (
      <div className="text-center py-12">
        <Zap className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-h3 mb-2">Quick Summary</h3>
        <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
          Get the key points in 30 seconds. Perfect for deciding if this episode is for you.
        </p>
        {atLimit ? (
          <SummaryLimitReached />
        ) : (
          <>
            <Button onClick={onGenerate} disabled={isGenerating}>
              {isGenerating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Create Quick Summary
            </Button>
            {summaryUsage && summaryUsage.limit !== -1 && (
              <p className="text-caption text-muted-foreground mt-2">
                {summaryUsage.limit - summaryUsage.used} summaries left today
              </p>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hook Headline */}
      {summary.hook_headline && (
        <Card className="border-primary/50">
          <CardContent className="pt-6">
            <h2 className="text-h3">{summary.hook_headline}</h2>
          </CardContent>
        </Card>
      )}

      {/* Executive Brief */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Executive Brief
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-foreground">{summary.executive_brief}</p>
        </CardContent>
      </Card>

      {/* Golden Nugget */}
      {summary.golden_nugget && (
        <Card className="bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />
              ✨ Golden Nugget
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-foreground italic">{summary.golden_nugget}</p>
          </CardContent>
        </Card>
      )}

      {/* Perfect For */}
      {summary.perfect_for && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4" />
              Perfect For
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-foreground">{summary.perfect_for}</p>
          </CardContent>
        </Card>
      )}

      {/* Tags */}
      {summary.tags && summary.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {summary.tags.map((tag, i) => (
            <Badge key={i} variant="secondary">{tag}</Badge>
          ))}
        </div>
      )}
    </div>
  );
}

// Deep Summary View Component
function DeepSummaryView({
  summary,
  status,
  isGenerating,
  onGenerate,
  onChapterClick,
  currentVideoTime,
  summaryUsage,
}: {
  summary?: DeepSummaryContent;
  status: SummaryStatus;
  isGenerating: boolean;
  onGenerate: () => void;
  onChapterClick?: (seconds: number) => void;
  currentVideoTime?: number;
  summaryUsage?: { used: number; limit: number };
}) {
  const { cutoffs, isGuest } = useUserPlan();

  if (['queued', 'transcribing', 'summarizing'].includes(status)) {
    return (
      <div className="text-center py-12">
        <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
        <p className="text-muted-foreground">
          {status === 'queued' && 'Queued for processing...'}
          {status === 'transcribing' && 'Transcribing audio...'}
          {status === 'summarizing' && 'Generating deep analysis...'}
        </p>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="text-center py-12">
        <p className="text-destructive mb-4">Deep analysis failed</p>
        <Button onClick={onGenerate} disabled={isGenerating}>
          {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Retry
        </Button>
      </div>
    );
  }

  if (!summary || status === 'not_ready') {
    const atLimit = summaryUsage && summaryUsage.limit !== -1 && summaryUsage.used >= summaryUsage.limit;
    return (
      <div className="text-center py-12">
        <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-h3 mb-2">Deep Analysis</h3>
        <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
          Get a structured breakdown with sections, resources, and actionable next steps.
        </p>
        {atLimit ? (
          <SummaryLimitReached />
        ) : (
          <>
            <Button onClick={onGenerate} disabled={isGenerating}>
              {isGenerating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Generate Deep Analysis
            </Button>
            {summaryUsage && summaryUsage.limit !== -1 && (
              <p className="text-caption text-muted-foreground mt-2">
                {summaryUsage.limit - summaryUsage.used} summaries left today
              </p>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Comprehensive Overview */}
      {(() => {
        const paragraphs = summary.comprehensive_overview.split('\n').filter(p => p.trim());
        const visibleParagraphs = isGuest ? paragraphs.slice(0, cutoffs.deepSummaryParagraphs) : paragraphs;
        return (
          <PaywallOverlay isGated={isGuest && paragraphs.length > cutoffs.deepSummaryParagraphs} module="deep summary">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  {summary.section_labels?.comprehensive_overview ?? 'Comprehensive Overview'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  {visibleParagraphs.map((paragraph, i) => (
                    <p key={i} className="mb-3 last:mb-0">{paragraph}</p>
                  ))}
                </div>
              </CardContent>
            </Card>
          </PaywallOverlay>
        );
      })()}

      {/* Core Concepts */}
      {summary.core_concepts && summary.core_concepts.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Lightbulb className="h-4 w-4" />
            {summary.section_labels?.core_concepts ?? 'Core Concepts'}
          </h3>
          <PaywallList
            items={summary.core_concepts}
            visibleCount={cutoffs.coreConcepts}
            isGated={isGuest}
            module="core concepts"
            renderItem={(concept, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-primary">{concept.concept}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-muted-foreground">{concept.explanation}</p>
                  {concept.quote_reference && (
                    <blockquote className="border-l-4 border-primary/30 pl-4 italic text-sm">
                      "{concept.quote_reference}"
                    </blockquote>
                  )}
                </CardContent>
              </Card>
            )}
          />
        </div>
      )}

      {/* Chronological Breakdown */}
      {summary.chronological_breakdown && summary.chronological_breakdown.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            {summary.section_labels?.episode_flow ?? 'Episode Flow'}
          </h3>
          <PaywallList
            items={summary.chronological_breakdown}
            visibleCount={cutoffs.chapters}
            isGated={isGuest}
            module="chapters"
            renderItem={(section, i) => {
              const isActive = currentVideoTime !== undefined &&
                section.timestamp_seconds !== undefined &&
                section.timestamp_seconds !== null &&
                currentVideoTime >= section.timestamp_seconds &&
                (i === summary.chronological_breakdown!.length - 1 ||
                  currentVideoTime < (summary.chronological_breakdown![i + 1]?.timestamp_seconds ?? Infinity));

              return (
                <Card key={i} className={isActive ? "border-primary bg-primary/5" : undefined}>
                  <CardContent className="pt-4 space-y-2">
                    <div className="flex items-center gap-2">
                      {onChapterClick && section.timestamp_seconds !== undefined && section.timestamp_seconds !== null ? (
                        <button
                          onClick={() => onChapterClick(section.timestamp_seconds!)}
                          className="text-xs bg-secondary hover:bg-secondary/80 px-2 py-1 rounded-md font-mono transition-colors cursor-pointer"
                          aria-label={`Seek to ${section.timestamp_description || section.title}`}
                        >
                          {section.timestamp_description || section.title}
                        </button>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          {section.title || section.timestamp_description}
                        </Badge>
                      )}
                      {isActive && (
                        <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full font-medium">
                          Now Playing
                        </span>
                      )}
                    </div>
                    <p className="text-sm">{section.content}</p>
                  </CardContent>
                </Card>
              );
            }}
          />
        </div>
      )}

      {/* Counterpoints */}
      {summary.contrarian_views && summary.contrarian_views.length > 0 && (
        <PaywallOverlay isGated={isGuest} module="counterpoints">
          <Card className="bg-primary/5 dark:bg-primary/10 border-primary/20 dark:border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                {summary.section_labels?.counterpoints ?? 'Counterpoints'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {summary.contrarian_views.map((view, i) => (
                  <li key={i} className="text-sm">{view}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </PaywallOverlay>
      )}

      {/* Actionable Takeaways */}
      {summary.actionable_takeaways && summary.actionable_takeaways.length > 0 && (
        <Card className="border-primary/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              {summary.section_labels?.actionable_takeaways ?? 'Actionable Takeaways'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PaywallList
              items={summary.actionable_takeaways}
              visibleCount={cutoffs.takeaways}
              isGated={isGuest}
              module="takeaways"
              renderItem={(action, i) => (
                <div key={i} className="flex items-start gap-2 mb-3 last:mb-0">
                  <span className="text-primary font-bold">{i + 1}.</span>
                  <p className="text-sm flex-1">{typeof action === 'string' ? action : action.text}</p>
                </div>
              )}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
