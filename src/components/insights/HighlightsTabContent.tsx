"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MiniLoadingAnimation } from "@/components/animations";
import { cn } from "@/lib/utils";
import { useUserPlan } from "@/hooks/useUserPlan";
import { PaywallList } from "@/components/PaywallOverlay";
import type { HighlightItem } from "@/types/database";
import { Quote, Copy, Check, Sparkles, Lightbulb, AlertCircle, Star, Clock } from "lucide-react";
import { AiDisclosure } from "@/components/AiDisclosure";

// Detect if text is primarily RTL (Hebrew, Arabic, etc.)
function isRTLText(text: string): boolean {
  const rtlChars = /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g;
  const rtlMatches = (text.match(rtlChars) || []).length;
  const latinChars = /[a-zA-Z]/g;
  const latinMatches = (text.match(latinChars) || []).length;
  return rtlMatches > latinMatches;
}

interface HighlightsTabContentProps {
  highlights: HighlightItem[] | undefined;
  isLoading: boolean;
  isGenerating: boolean;
  onGenerate: () => void;
}

export function HighlightsTabContent({
  highlights,
  isLoading,
  isGenerating,
  onGenerate
}: HighlightsTabContentProps) {
  const { cutoffs, isGuest } = useUserPlan();
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Detect RTL from highlights content
  const isRTL = useMemo(() => {
    if (!highlights) return false;
    const allText = highlights.map(h => h.quote + (h.context || '')).join(' ');
    return isRTLText(allText);
  }, [highlights]);

  const handleCopy = async (quote: string, index: number) => {
    await navigator.clipboard.writeText(quote);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  if (isGenerating) {
    return <MiniLoadingAnimation message="Generating highlights..." />;
  }

  if (!highlights || highlights.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] text-center p-4">
        <Lightbulb className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">No highlights extracted yet</p>
        <p className="text-sm text-muted-foreground mt-1 mb-4">
          Generate insights to find key quotes and moments
        </p>
        <Button onClick={onGenerate} className="gap-2">
          <Sparkles className="h-4 w-4" />
          Generate Insights
        </Button>
      </div>
    );
  }

  const getImportanceIcon = (importance: string) => {
    switch (importance) {
      case 'critical':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'important':
        return <Star className="h-4 w-4 text-yellow-500" />;
      default:
        return <Lightbulb className="h-4 w-4 text-blue-500" />;
    }
  };

  const getImportanceBorder = (importance: string, isRTL: boolean) => {
    const side = isRTL ? 'border-r' : 'border-l';
    switch (importance) {
      case 'critical':
        return `${side}-red-500`;
      case 'important':
        return `${side}-yellow-500`;
      default:
        return `${side}-blue-500`;
    }
  };

  return (
    <div className="p-4 space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Quote className="h-4 w-4" />
          Key Highlights
        </h3>
        <div className="flex items-center gap-2">
          <AiDisclosure />
          <Badge variant="outline">{highlights.length} quotes</Badge>
        </div>
      </div>

      {/* Highlights List */}
      <PaywallList
        items={highlights}
        visibleCount={cutoffs.highlights}
        isGated={isGuest}
        module="highlights"
        className="space-y-4"
        renderItem={(highlight, i) => (
          <div
            key={i}
            className={cn(
              "group relative rounded-lg border p-4 transition-all hover:shadow-md",
              isRTL ? "border-r-4" : "border-l-4",
              getImportanceBorder(highlight.importance, isRTL)
            )}
          >
            {/* Quote */}
            <div className={cn("flex items-start gap-3", isRTL && "flex-row-reverse")}>
              <Quote className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className={cn("text-sm leading-relaxed italic", isRTL && "text-right")}>
                  &ldquo;{highlight.quote}&rdquo;
                </p>

                {/* Context */}
                {highlight.context && (
                  <p className={cn("text-sm text-muted-foreground mt-2", isRTL && "text-right")}>
                    {highlight.context}
                  </p>
                )}

                {/* Meta info */}
                <div className={cn("flex items-center gap-3 mt-3 flex-wrap", isRTL && "flex-row-reverse justify-end")}>
                  <Badge variant="secondary" className="gap-1">
                    {getImportanceIcon(highlight.importance)}
                    <span className="capitalize">{highlight.importance}</span>
                  </Badge>

                  {highlight.timestamp && (
                    <Badge variant="outline" className="gap-1">
                      <Clock className="h-3 w-3" />
                      {highlight.timestamp}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Copy Button */}
              <Button
                variant="ghost"
                size="icon"
                className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                onClick={() => handleCopy(highlight.quote, i)}
                title="Copy quote"
              >
                {copiedIndex === i ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        )}
      />

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 pt-4 border-t text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <AlertCircle className="h-3 w-3 text-red-500" />
          Critical
        </div>
        <div className="flex items-center gap-1">
          <Star className="h-3 w-3 text-yellow-500" />
          Important
        </div>
        <div className="flex items-center gap-1">
          <Lightbulb className="h-3 w-3 text-blue-500" />
          Notable
        </div>
      </div>
    </div>
  );
}
