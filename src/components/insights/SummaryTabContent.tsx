"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { isRTLText } from "@/lib/rtl";
import type { QuickSummaryContent, DeepSummaryContent, SummaryStatus } from "@/types/database";
import { Sparkles, CheckCircle, Clock, Loader2, RefreshCw, BookOpen, Lightbulb, Users, Tag, FileText } from "lucide-react";
import { useUserPlan } from "@/hooks/useUserPlan";
import { PaywallOverlay, PaywallList } from "@/components/PaywallOverlay";
import { AiDisclosure } from "@/components/AiDisclosure";

interface SummaryTabContentProps {
  summaries: {
    quick?: { status: SummaryStatus; content?: QuickSummaryContent };
    deep?: { status: SummaryStatus; content?: DeepSummaryContent };
  };
  isLoading: boolean;
  onGenerate: (level: 'quick' | 'deep') => void;
}

export function SummaryTabContent({ summaries, isLoading, onGenerate }: SummaryTabContentProps) {
  const [activeLevel, setActiveLevel] = useState<'quick' | 'deep'>('quick');

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <div className="flex gap-2">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-20" />
        </div>
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const currentSummary = activeLevel === 'quick' ? summaries.quick : summaries.deep;
  const isProcessing = currentSummary && ['queued', 'transcribing', 'summarizing'].includes(currentSummary.status);
  const isReady = currentSummary?.status === 'ready';
  const isFailed = currentSummary?.status === 'failed';

  return (
    <div className="space-y-4 p-4">
      {/* Level Toggle */}
      <div className="flex gap-2">
        <Button
          variant={activeLevel === 'quick' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveLevel('quick')}
          className="gap-2"
        >
          <Sparkles className="h-4 w-4" />
          Quick
          {summaries.quick?.status === 'ready' && (
            <CheckCircle className="h-3 w-3 text-green-500" />
          )}
        </Button>
        <Button
          variant={activeLevel === 'deep' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveLevel('deep')}
          className="gap-2"
        >
          <BookOpen className="h-4 w-4" />
          Deep
          {summaries.deep?.status === 'ready' && (
            <CheckCircle className="h-3 w-3 text-green-500" />
          )}
        </Button>
      </div>

      {/* Status / Generate Button */}
      {!isReady && (
        <div className="rounded-lg border p-4 text-center space-y-3">
          {isProcessing ? (
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>
                {currentSummary?.status === 'transcribing' && 'Transcribing audio...'}
                {currentSummary?.status === 'summarizing' && 'Generating summary...'}
                {currentSummary?.status === 'queued' && 'Queued for processing...'}
              </span>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {activeLevel === 'quick'
                  ? 'Get a quick overview with key takeaways'
                  : 'Get a detailed analysis with sections and resources'}
              </p>
              <Button onClick={() => onGenerate(activeLevel)} className="gap-2">
                {isFailed ? <RefreshCw className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                {isFailed ? 'Retry' : `Generate ${activeLevel === 'quick' ? 'Quick' : 'Deep'} Summary`}
              </Button>
            </>
          )}
        </div>
      )}

      {/* AI Disclosure */}
      {isReady && <AiDisclosure />}

      {/* Quick Summary Content */}
      {isReady && activeLevel === 'quick' && summaries.quick?.content && (
        <QuickSummaryView content={summaries.quick.content} />
      )}

      {/* Deep Summary Content */}
      {isReady && activeLevel === 'deep' && summaries.deep?.content && (
        <DeepSummaryView content={summaries.deep.content} />
      )}
    </div>
  );
}

function QuickSummaryView({ content }: { content: QuickSummaryContent }) {
  // Detect RTL from content
  const isRTL = useMemo(() => {
    const allText = [content.hook_headline, content.executive_brief, content.golden_nugget, content.perfect_for].join(' ');
    return isRTLText(allText);
  }, [content]);

  return (
    <div className="space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Hook Headline */}
      {content.hook_headline && (
        <div className="rounded-lg bg-primary/5 border border-primary/20 p-4">
          <h2 className={cn("text-lg font-bold", isRTL && "text-right")}>{content.hook_headline}</h2>
        </div>
      )}

      {/* Executive Brief */}
      <div className="rounded-lg border p-4">
        <div className={cn("flex items-center gap-2 mb-2", isRTL && "flex-row-reverse")}>
          <FileText className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">Executive Brief</span>
        </div>
        <p className={cn("text-sm leading-relaxed", isRTL && "text-right")}>{content.executive_brief}</p>
      </div>

      {/* Golden Nugget */}
      {content.golden_nugget && (
        <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 p-4">
          <div className={cn("flex items-center gap-2 mb-2", isRTL && "flex-row-reverse")}>
            <Sparkles className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />
            <span className="font-semibold text-sm text-yellow-900 dark:text-yellow-100">✨ Golden Nugget</span>
          </div>
          <p className={cn("text-sm leading-relaxed italic", isRTL && "text-right")}>{content.golden_nugget}</p>
        </div>
      )}

      {/* Perfect For */}
      <div className="rounded-lg border p-4">
        <div className={cn("flex items-center gap-2 mb-2", isRTL && "flex-row-reverse")}>
          <Users className="h-4 w-4 text-blue-500" />
          <span className="font-semibold text-sm">Perfect For</span>
        </div>
        <p className={cn("text-sm text-muted-foreground", isRTL && "text-right")}>{content.perfect_for}</p>
      </div>

      {/* Tags */}
      {content.tags && content.tags.length > 0 && (
        <div className={cn("flex flex-wrap gap-2", isRTL && "justify-end")}>
          {content.tags.map((tag, i) => (
            <Badge key={i} variant="secondary" className="gap-1">
              <Tag className="h-3 w-3" />
              {tag}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function DeepSummaryView({ content }: { content: DeepSummaryContent }) {
  const { cutoffs, isGuest } = useUserPlan();

  // Detect RTL from content
  const isRTL = useMemo(() => {
    const allText = [
      content.comprehensive_overview,
      ...content.core_concepts.flatMap(c => [c.concept, c.explanation]),
      ...content.chronological_breakdown.flatMap(cb => [cb.title || cb.timestamp_description || '', cb.content]),
      ...content.contrarian_views,
      ...content.actionable_takeaways.map(a => typeof a === 'string' ? a : a.text)
    ].join(' ');
    return isRTLText(allText);
  }, [content]);

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Comprehensive Overview */}
      {(() => {
        const paragraphs = content.comprehensive_overview.split('\n').filter(p => p.trim());
        const visibleParagraphs = isGuest ? paragraphs.slice(0, cutoffs.deepSummaryParagraphs) : paragraphs;
        const hiddenParagraphs = isGuest ? paragraphs.slice(cutoffs.deepSummaryParagraphs) : [];
        const isGated = isGuest && hiddenParagraphs.length > 0;
        return (
          <div className="rounded-lg bg-primary/5 border border-primary/20 p-4">
            <div className={cn("flex items-center gap-2 mb-3", isRTL && "flex-row-reverse")}>
              <FileText className="h-4 w-4 text-primary" />
              <span className="font-semibold">Comprehensive Overview</span>
            </div>
            <PaywallOverlay
              isGated={isGated}
              module="deep summary"
              teaser={isGated ? (
                <div className={cn("prose prose-sm dark:prose-invert max-w-none", isRTL && "text-right")}>
                  {hiddenParagraphs.slice(0, 2).map((paragraph, i) => (
                    <p key={i} className="mb-3 last:mb-0 leading-relaxed">{paragraph}</p>
                  ))}
                </div>
              ) : undefined}
            >
              <div className={cn("prose prose-sm dark:prose-invert max-w-none", isRTL && "text-right")}>
                {visibleParagraphs.map((paragraph, i) => (
                  <p key={i} className="mb-3 last:mb-0 leading-relaxed">{paragraph}</p>
                ))}
              </div>
            </PaywallOverlay>
          </div>
        );
      })()}

      {/* Core Concepts */}
      {content.core_concepts.length > 0 && (
        <div className="space-y-4">
          <h3 className={cn("font-semibold flex items-center gap-2", isRTL && "flex-row-reverse")}>
            <Lightbulb className="h-4 w-4 text-yellow-500" />
            Core Concepts
          </h3>
          <PaywallList
            items={content.core_concepts}
            visibleCount={cutoffs.coreConcepts}
            isGated={isGuest}
            module="core concepts"
            className="space-y-4"
            renderItem={(concept, i) => (
              <div key={i} className="rounded-lg border p-4 space-y-2">
                <h4 className={cn("font-medium text-primary", isRTL && "text-right")}>{concept.concept}</h4>
                <p className={cn("text-sm text-muted-foreground leading-relaxed", isRTL && "text-right")}>
                  {concept.explanation}
                </p>
                {concept.quote_reference && (
                  <blockquote className={cn(
                    "border-l-4 border-primary/30 pl-4 italic text-sm mt-2",
                    isRTL && "border-l-0 border-r-4 pr-4 pl-0 text-right"
                  )}>
                    "{concept.quote_reference}"
                  </blockquote>
                )}
              </div>
            )}
          />
        </div>
      )}

      {/* Chronological Breakdown */}
      {content.chronological_breakdown.length > 0 && (
        <div className="space-y-3">
          <h3 className={cn("font-semibold flex items-center gap-2", isRTL && "flex-row-reverse")}>
            <Clock className="h-4 w-4" />
            Episode Flow
          </h3>
          <PaywallList
            items={content.chronological_breakdown}
            visibleCount={cutoffs.chapters}
            isGated={isGuest}
            module="episode flow"
            className="space-y-3"
            renderItem={(section, i) => (
              <div key={i} className="rounded-lg bg-muted/30 p-4 space-y-2">
                <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
                  <Badge variant="outline" className="text-xs">
                    {section.title || section.timestamp_description}
                  </Badge>
                </div>
                <p className={cn("text-sm leading-relaxed", isRTL && "text-right")}>{section.content}</p>
              </div>
            )}
          />
        </div>
      )}

      {/* Counterpoints */}
      {content.contrarian_views.length > 0 && (
        <PaywallOverlay isGated={isGuest} module="counterpoints">
          <div className="space-y-2">
            <h3 className={cn("font-semibold flex items-center gap-2", isRTL && "flex-row-reverse")}>
              <Sparkles className="h-4 w-4 text-primary" />
              Counterpoints
            </h3>
            <div className="space-y-2">
              {content.contrarian_views.map((view, i) => (
                <div key={i} className={cn(
                  "rounded-lg bg-primary/5 dark:bg-primary/10 border border-primary/20 dark:border-primary/20 p-3",
                  isRTL ? "border-r-4 border-r-primary" : "border-l-4 border-l-primary"
                )}>
                  <p className={cn("text-sm", isRTL && "text-right")}>{view}</p>
                </div>
              ))}
            </div>
          </div>
        </PaywallOverlay>
      )}

      {/* Actionable Takeaways */}
      {content.actionable_takeaways.length > 0 && (
        <div className="space-y-2">
          <h3 className={cn("font-semibold flex items-center gap-2", isRTL && "flex-row-reverse")}>
            <CheckCircle className="h-4 w-4 text-green-500" />
            Actionable Takeaways
          </h3>
          <PaywallList
            items={content.actionable_takeaways}
            visibleCount={cutoffs.takeaways}
            isGated={isGuest}
            module="takeaways"
            className="space-y-2"
            renderItem={(action, i) => (
              <div key={i} className={cn(
                "rounded-lg bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 p-3",
                isRTL ? "border-r-4 border-r-green-500" : "border-l-4 border-l-green-500"
              )}>
                <div className={cn("flex gap-2 items-start", isRTL && "flex-row-reverse text-right")}>
                  <span className="text-green-600 dark:text-green-400 font-bold text-sm">{i + 1}.</span>
                  <p className="text-sm flex-1">{typeof action === 'string' ? action : action.text}</p>
                </div>
              </div>
            )}
          />
        </div>
      )}
    </div>
  );
}
