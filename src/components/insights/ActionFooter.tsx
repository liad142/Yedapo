"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  Wrench,
  GitBranch,
  Lightbulb,
  Target,
  BookOpen,
  Repeat,
  Github,
  User,
  FileText,
  Globe,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { normalizeActionItems, getResourceSearchUrl } from "@/lib/summary-normalize";
import type { Episode, Podcast, ActionItem } from "@/types/database";

interface ActionFooterProps {
  episode: Episode & { podcast?: Podcast };
  actionPrompts?: (string | ActionItem)[];
  summaryReady?: boolean;
  sectionLabel?: string;
  isRTL?: boolean;
}

// Category icon mapping
function getCategoryIcon(category: string) {
  switch (category) {
    case "tool":
      return Wrench;
    case "repo":
      return GitBranch;
    case "concept":
      return Lightbulb;
    case "strategy":
      return Target;
    case "resource":
      return BookOpen;
    case "habit":
      return Repeat;
    default:
      return Lightbulb;
  }
}

// Category label
function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    tool: "Tool",
    repo: "Repository",
    concept: "Concept",
    strategy: "Strategy",
    resource: "Resource",
    habit: "Habit",
  };
  return labels[category] || "Insight";
}

// Priority styling
function getPriorityStyles(priority?: string) {
  switch (priority) {
    case "high":
      return {
        label: "High priority",
        className: "bg-red-500/10 text-red-500 border-0",
      };
    case "low":
      return {
        label: "Quick win",
        className: "bg-blue-500/10 text-blue-500 border-0",
      };
    default:
      return null; // medium = no pill
  }
}

// Resource type icon
function getResourceIcon(type: string) {
  switch (type) {
    case "github":
      return Github;
    case "book":
      return BookOpen;
    case "tool":
      return Wrench;
    case "person":
      return User;
    case "paper":
      return FileText;
    case "website":
      return Globe;
    default:
      return ExternalLink;
  }
}

// localStorage key for checked state
const STORAGE_PREFIX = 'yedapo:actions:';
const LEGACY_STORAGE_PREFIX = 'podcatch:actions:';

function getStorageKey(episodeId: string) {
  return `${STORAGE_PREFIX}${episodeId}`;
}

function getLegacyStorageKey(episodeId: string) {
  return `${LEGACY_STORAGE_PREFIX}${episodeId}`;
}

export function ActionFooter({ episode, actionPrompts, summaryReady = false, sectionLabel, isRTL }: ActionFooterProps) {
  const actions = useMemo(() => normalizeActionItems(actionPrompts), [actionPrompts]);

  // Sort: high priority first, then medium, then low
  const sortedActions = useMemo(() => {
    const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    return [...actions].sort(
      (a, b) => (priorityOrder[a.priority || "medium"] ?? 1) - (priorityOrder[b.priority || "medium"] ?? 1)
    );
  }, [actions]);

  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());
  const [showAll, setShowAll] = useState(false);

  // Load checked state from localStorage
  useEffect(() => {
    try {
      let stored = localStorage.getItem(getStorageKey(episode.id));
      if (!stored) {
        const legacy = localStorage.getItem(getLegacyStorageKey(episode.id));
        if (legacy) {
          stored = legacy;
          localStorage.setItem(getStorageKey(episode.id), legacy);
        }
      }
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setCheckedItems(new Set(parsed));
        }
      }
    } catch {
      // ignore
    }
  }, [episode.id]);

  // Save checked state to localStorage
  const toggleItem = (index: number) => {
    const newChecked = new Set(checkedItems);
    if (newChecked.has(index)) {
      newChecked.delete(index);
    } else {
      newChecked.add(index);
    }
    setCheckedItems(newChecked);
    try {
      localStorage.setItem(
        getStorageKey(episode.id),
        JSON.stringify([...newChecked])
      );
    } catch {
      // ignore
    }
  };

  const INITIAL_SHOW = 3;
  const visibleActions = showAll ? sortedActions : sortedActions.slice(0, INITIAL_SHOW);
  const hiddenCount = sortedActions.length - INITIAL_SHOW;

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, delay: 0.4 }}
        className="space-y-5"
      >
        {/* Section heading */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-h2 text-foreground flex items-center gap-2">
            <CheckSquare className="h-5 w-5 text-green-500" />
            {sectionLabel ?? 'Action Items'}
          </h2>
          {sortedActions.length > 0 && (
            <span className="text-caption text-muted-foreground font-medium">
              {checkedItems.size}/{sortedActions.length} done
            </span>
          )}
        </div>

        {/* Structured Action Items */}
        {sortedActions.length > 0 && (
          <div className="bg-card border border-border rounded-2xl shadow-[var(--shadow-1)] p-5">
            <div>
              {visibleActions.map((action, displayIndex) => {
                const actualIndex = sortedActions.indexOf(action);
                const isChecked = checkedItems.has(actualIndex);
                const CategoryIcon = getCategoryIcon(action.category);
                const priorityStyles = getPriorityStyles(action.priority);

                return (
                  <motion.div
                    key={actualIndex}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: displayIndex * 0.05 }}
                    className={cn(
                      "flex items-start gap-4 py-4 border-b border-border last:border-0 transition-all",
                      isChecked && "opacity-60"
                    )}
                  >
                    {/* Checkbox */}
                    <button
                      onClick={() => toggleItem(actualIndex)}
                      className="shrink-0 mt-0.5 transition-transform active:scale-95"
                    >
                      {isChecked ? (
                        <div className="w-5 h-5 rounded-md bg-green-500 border-2 border-green-500 flex items-center justify-center">
                          <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-md border-2 border-border-strong cursor-pointer hover:border-green-400 transition-colors" />
                      )}
                    </button>

                    <div className="flex-1 min-w-0 space-y-2">
                      {/* Header: category + priority */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className="text-caption">
                          {getCategoryLabel(action.category)}
                        </Badge>
                        {priorityStyles && (
                          <Badge
                            variant="outline"
                            className={cn("text-caption h-5 px-1.5 shrink-0 font-medium", priorityStyles.className)}
                          >
                            {priorityStyles.label}
                          </Badge>
                        )}
                      </div>

                      {/* Action text */}
                      <p
                        className={cn(
                          "text-body text-foreground",
                          isChecked && "line-through text-muted-foreground"
                        )}
                      >
                        {action.text}
                      </p>

                      {/* Why + Effort row */}
                      {(action.why || action.effort) && (
                        <div className="flex items-start gap-3 text-caption text-muted-foreground">
                          {action.why && (
                            <span className="flex-1 italic">{action.why}</span>
                          )}
                          {action.effort && (
                            <Badge variant="outline" className="shrink-0 text-[11px] h-5 px-1.5 font-medium">
                              ⏱ {action.effort}
                            </Badge>
                          )}
                        </div>
                      )}

                      {/* Resource pills */}
                      {action.resources && action.resources.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-1">
                          {action.resources.map((resource, ri) => {
                            const ResourceIcon = getResourceIcon(resource.type);
                            const href = resource.url || getResourceSearchUrl(resource);
                            const hasDirectUrl = !!resource.url;
                            return (
                              <a
                                key={ri}
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={cn(
                                  "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-caption font-medium transition-all",
                                  hasDirectUrl
                                    ? "bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20"
                                    : "bg-secondary border border-border text-muted-foreground hover:text-primary hover:border-primary"
                                )}
                                title={resource.context || (hasDirectUrl ? resource.url : `Search for ${resource.name}`)}
                              >
                                <ResourceIcon className="h-3 w-3" />
                                {resource.name}
                                {hasDirectUrl && <ExternalLink className="h-2.5 w-2.5 opacity-60" />}
                              </a>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Show more button */}
            {hiddenCount > 0 && !showAll && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAll(true)}
                className="w-full gap-2 text-muted-foreground hover:text-foreground mt-2"
              >
                <ChevronDown className="h-4 w-4" />
                Show {hiddenCount} more
              </Button>
            )}
          </div>
        )}

      </motion.div>

    </div>
  );
}
