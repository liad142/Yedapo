"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MiniLoadingAnimation } from "@/components/animations";
import { cn } from "@/lib/utils";
import type { ShownotesSection } from "@/types/database";
import { List, Check, Sparkles, Clock, ExternalLink, ChevronDown, ChevronRight, FileDown } from "lucide-react";
import { useUserPlan } from "@/hooks/useUserPlan";
import { PaywallOverlay } from "@/components/PaywallOverlay";
import { AiDisclosure } from "@/components/AiDisclosure";

// Detect if text is primarily RTL (Hebrew, Arabic, etc.)
function isRTLText(text: string): boolean {
  const rtlChars = /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g;
  const rtlMatches = (text.match(rtlChars) || []).length;
  const latinChars = /[a-zA-Z]/g;
  const latinMatches = (text.match(latinChars) || []).length;
  return rtlMatches > latinMatches;
}

interface ShownotesTabContentProps {
  shownotes: ShownotesSection[] | undefined;
  isLoading: boolean;
  isGenerating: boolean;
  onGenerate: () => void;
}

export function ShownotesTabContent({
  shownotes,
  isLoading,
  isGenerating,
  onGenerate
}: ShownotesTabContentProps) {
  const { isFree } = useUserPlan();
  const [copied, setCopied] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0]));

  const toggleSection = (index: number) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedSections(newExpanded);
  };

  const expandAll = () => {
    if (shownotes) {
      setExpandedSections(new Set(shownotes.map((_, i) => i)));
    }
  };

  const collapseAll = () => {
    setExpandedSections(new Set());
  };

  const copyAsMarkdown = async () => {
    if (!shownotes) return;

    const markdown = shownotes.map((section, i) => {
      let text = `## ${i + 1}. ${section.title}`;
      if (section.timestamp) {
        text += ` (${section.timestamp})`;
      }
      text += `\n\n${section.content}`;
      if (section.links && section.links.length > 0) {
        text += `\n\n**Links:**\n`;
        section.links.forEach(link => {
          text += `- [${link.label}](${link.url})\n`;
        });
      }
      return text;
    }).join('\n\n---\n\n');

    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (isGenerating) {
    return <MiniLoadingAnimation message="Generating shownotes..." />;
  }

  // Detect RTL from shownotes content
  const isRTL = useMemo(() => {
    if (!shownotes) return false;
    const allText = shownotes.map(s => s.title + ' ' + s.content).join(' ');
    return isRTLText(allText);
  }, [shownotes]);

  if (!shownotes || shownotes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] text-center p-4">
        <List className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">No shownotes generated yet</p>
        <p className="text-sm text-muted-foreground mt-1 mb-4">
          Generate insights to create structured shownotes
        </p>
        <Button onClick={onGenerate} className="gap-2">
          <Sparkles className="h-4 w-4" />
          Generate Insights
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header with actions */}
      <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-background z-10">
        <h3 className="font-semibold flex items-center gap-2">
          <List className="h-4 w-4" />
          Shownotes
          <Badge variant="outline">{shownotes.length} sections</Badge>
          <AiDisclosure />
        </h3>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={expandAll}>
            Expand All
          </Button>
          <Button variant="ghost" size="sm" onClick={collapseAll}>
            Collapse
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={copyAsMarkdown}
            className="gap-1"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-green-500" />
                Copied
              </>
            ) : (
              <>
                <FileDown className="h-3 w-3" />
                Export
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Sections List */}
      <PaywallOverlay isGated={isFree} module="shownotes">
        <div className="flex-1 overflow-auto p-4">
          <div className="space-y-2">
            {shownotes.map((section, i) => {
              const isExpanded = expandedSections.has(i);
              return (
                <div
                  key={i}
                  className="rounded-lg border overflow-hidden"
                >
                  {/* Section Header */}
                  <button
                    className={cn(
                      "w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors",
                      isExpanded && "border-b bg-muted/30",
                      isRTL ? "text-right flex-row-reverse" : "text-left"
                    )}
                    onClick={() => toggleSection(i)}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className={cn("h-4 w-4 shrink-0 text-muted-foreground", isRTL && "rotate-180")} />
                    )}

                    <span className="text-xs font-mono text-muted-foreground w-6 shrink-0">
                      {String(i + 1).padStart(2, '0')}
                    </span>

                    <span className={cn("font-medium flex-1 truncate", isRTL && "text-right")}>
                      {section.title}
                    </span>

                    {section.timestamp && (
                      <Badge variant="secondary" className="gap-1 shrink-0">
                        <Clock className="h-3 w-3" />
                        {section.timestamp}
                      </Badge>
                    )}
                  </button>

                  {/* Section Content */}
                  {isExpanded && (
                    <div className="p-4 space-y-3">
                      <p className={cn("text-sm text-muted-foreground leading-relaxed", isRTL && "text-right")}>
                        {section.content}
                      </p>

                      {section.links && section.links.length > 0 && (
                        <div className="space-y-2 pt-2 border-t">
                          <span className={cn("text-xs font-semibold text-muted-foreground", isRTL && "block text-right")}>
                            Related Links:
                          </span>
                          <div className={cn("flex flex-wrap gap-2", isRTL && "justify-end")}>
                            {section.links.map((link, j) => (
                              <a
                                key={j}
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                              >
                                <ExternalLink className="h-3 w-3" />
                                {link.label}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </PaywallOverlay>

      {/* Timeline View Hint */}
      <div className="p-3 border-t text-center">
        <p className="text-xs text-muted-foreground">
          Use timestamps to navigate through the episode
        </p>
      </div>
    </div>
  );
}
