"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MiniLoadingAnimation } from "@/components/animations";
import { cn } from "@/lib/utils";
import type { KeywordItem } from "@/types/database";
import { Tags, Sparkles } from "lucide-react";
import { AiDisclosure } from "@/components/AiDisclosure";

// Detect if text is primarily RTL (Hebrew, Arabic, etc.)
function isRTLText(text: string): boolean {
  const rtlChars = /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g;
  const rtlMatches = (text.match(rtlChars) || []).length;
  const latinChars = /[a-zA-Z]/g;
  const latinMatches = (text.match(latinChars) || []).length;
  return rtlMatches > latinMatches;
}

interface KeywordsTabContentProps {
  keywords: KeywordItem[] | undefined;
  isLoading: boolean;
  isGenerating: boolean;
  onGenerate: () => void;
}

type SortMode = 'relevance' | 'frequency' | 'alphabetical';

export function KeywordsTabContent({
  keywords,
  isLoading,
  isGenerating,
  onGenerate
}: KeywordsTabContentProps) {
  const [sortMode, setSortMode] = useState<SortMode>('relevance');

  // Detect RTL from keywords content
  const isRTL = useMemo(() => {
    if (!keywords) return false;
    const allText = keywords.map(k => k.word).join(' ');
    return isRTLText(allText);
  }, [keywords]);

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 20 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-20" />
          ))}
        </div>
      </div>
    );
  }

  if (isGenerating) {
    return <MiniLoadingAnimation message="Generating keywords..." />;
  }

  if (!keywords || keywords.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] text-center p-4">
        <Tags className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">No keywords extracted yet</p>
        <p className="text-sm text-muted-foreground mt-1 mb-4">
          Generate insights to extract keywords from the transcript
        </p>
        <Button onClick={onGenerate} className="gap-2">
          <Sparkles className="h-4 w-4" />
          Generate Insights
        </Button>
      </div>
    );
  }

  // Sort keywords based on selected mode
  const sortedKeywords = [...keywords].sort((a, b) => {
    switch (sortMode) {
      case 'frequency':
        return b.frequency - a.frequency;
      case 'alphabetical':
        return a.word.localeCompare(b.word);
      case 'relevance':
      default:
        const relevanceOrder = { high: 3, medium: 2, low: 1 };
        return relevanceOrder[b.relevance] - relevanceOrder[a.relevance];
    }
  });

  const getRelevanceStyle = (relevance: string) => {
    switch (relevance) {
      case 'high':
        return 'bg-primary text-primary-foreground hover:bg-primary/90';
      case 'medium':
        return 'bg-secondary hover:bg-secondary/80';
      case 'low':
      default:
        return 'bg-muted hover:bg-muted/80';
    }
  };

  const getRelevanceSize = (relevance: string) => {
    switch (relevance) {
      case 'high':
        return 'text-base px-4 py-2';
      case 'medium':
        return 'text-sm px-3 py-1.5';
      case 'low':
      default:
        return 'text-xs px-2 py-1';
    }
  };

  return (
    <div className="p-4 space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Sort Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-muted-foreground">Sort by:</span>
        <div className="flex gap-1">
          {(['relevance', 'frequency', 'alphabetical'] as SortMode[]).map((mode) => (
            <Button
              key={mode}
              variant={sortMode === mode ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSortMode(mode)}
              className="capitalize"
            >
              {mode}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <AiDisclosure />
          <Badge variant="outline">
            {keywords.length} keywords
          </Badge>
        </div>
      </div>

      {/* Keywords Cloud */}
      <div className="flex flex-wrap gap-2 items-center justify-center py-4">
        {sortedKeywords.map((keyword, i) => (
          <span
            key={`${keyword.word}-${i}`}
            className={cn(
              "rounded-full font-medium cursor-default transition-all",
              "hover:scale-105 hover:shadow-md",
              getRelevanceStyle(keyword.relevance),
              getRelevanceSize(keyword.relevance)
            )}
            title={`Relevance: ${keyword.relevance}, Mentioned ~${keyword.frequency} times`}
          >
            {keyword.word}
          </span>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 pt-4 border-t text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-primary" />
          High
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-secondary" />
          Medium
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-muted border" />
          Low
        </div>
      </div>
    </div>
  );
}
