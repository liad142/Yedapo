"use client";

import { useRef, useCallback } from "react";
import { type LucideIcon, FileText, ScrollText, Tags, Lightbulb, List } from "lucide-react";
import { cn } from "@/lib/utils";
import type { InsightTab } from "@/types/database";

interface Tab {
  id: InsightTab;
  label: string;
  icon: LucideIcon;
}

const tabs: Tab[] = [
  { id: 'summary', label: 'Summary', icon: FileText },
  { id: 'transcript', label: 'Transcript', icon: ScrollText },
  { id: 'keywords', label: 'Keywords', icon: Tags },
  { id: 'highlights', label: 'Highlights', icon: Lightbulb },
  { id: 'shownotes', label: 'Shownotes', icon: List },
];

interface StickyTabNavProps {
  activeTab: InsightTab;
  onChange: (tab: InsightTab) => void;
  className?: string;
}

export function StickyTabNav({ activeTab, onChange, className }: StickyTabNavProps) {
  const mobileTablistRef = useRef<HTMLDivElement>(null);
  const desktopTablistRef = useRef<HTMLDivElement>(null);

  const handleTabKeyDown = useCallback((e: React.KeyboardEvent<HTMLButtonElement>, tablistRef: React.RefObject<HTMLDivElement | null>) => {
    const tabIds = tabs.map(t => t.id);
    const currentIndex = tabIds.indexOf(activeTab);
    let newIndex = currentIndex;

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      newIndex = (currentIndex + 1) % tabIds.length;
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      newIndex = (currentIndex - 1 + tabIds.length) % tabIds.length;
    } else if (e.key === 'Home') {
      e.preventDefault();
      newIndex = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      newIndex = tabIds.length - 1;
    } else {
      return;
    }

    onChange(tabIds[newIndex]);
    // Focus the new active tab button
    const buttons = tablistRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    buttons?.[newIndex]?.focus();
  }, [activeTab, onChange]);

  return (
    <>
      {/* Mobile: Sticky bottom navigation */}
      <nav className={cn(
        "md:hidden fixed bottom-0 left-0 right-0 z-30 bg-background border-t",
        "pb-[env(safe-area-inset-bottom)]",
        className
      )}>
        <div ref={mobileTablistRef} className="flex justify-around items-center h-16" role="tablist">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                onClick={() => onChange(tab.id)}
                onKeyDown={(e) => handleTabKeyDown(e, mobileTablistRef)}
                className={cn(
                  "flex flex-col items-center justify-center flex-1 h-full px-1 transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className={cn("h-5 w-5 mb-1", isActive && "text-primary")} />
                <span className="text-[10px] font-medium truncate max-w-[60px]">
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Desktop: Horizontal scrollable tabs */}
      <nav className={cn(
        "hidden md:block border-b sticky top-0 bg-background z-40",
        className
      )}>
        <div ref={desktopTablistRef} className="flex items-center gap-1 px-4 overflow-x-auto scrollbar-hide" role="tablist">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                onClick={() => onChange(tab.id)}
                onKeyDown={(e) => handleTabKeyDown(e, desktopTablistRef)}
                className={cn(
                  "flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap",
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="text-sm font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
