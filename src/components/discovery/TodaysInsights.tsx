'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Wrench, GitBranch, Building2, TrendingUp, Lightbulb, Zap, ChevronDown, ChevronUp } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useCountry } from '@/contexts/CountryContext';
import { getRegion, getStrings } from '@/lib/region-data';
import type { UIStrings } from '@/lib/region-data';
import type { BriefItem, BriefCategory, TodaysBriefResponse } from '@/types/brief';

type CategoryConfig = Record<BriefCategory, { label: string; icon: typeof Wrench; color: string; badgeBg: string }>;

const CATEGORY_ICONS: Record<BriefCategory, { icon: typeof Wrench; color: string; badgeBg: string }> = {
  tool:    { icon: Wrench,     color: 'text-blue-500',   badgeBg: 'bg-blue-500/10' },
  repo:    { icon: GitBranch,  color: 'text-green-500',  badgeBg: 'bg-green-500/10' },
  company: { icon: Building2,  color: 'text-purple-500', badgeBg: 'bg-purple-500/10' },
  metric:  { icon: TrendingUp, color: 'text-amber-500',  badgeBg: 'bg-amber-500/10' },
  insight: { icon: Lightbulb,  color: 'text-primary',    badgeBg: 'bg-primary/10' },
};

function buildCategoryConfig(t: UIStrings): CategoryConfig {
  return {
    tool:    { label: t.badgeTool,    ...CATEGORY_ICONS.tool },
    repo:    { label: t.badgeRepo,    ...CATEGORY_ICONS.repo },
    company: { label: t.badgeCompany, ...CATEGORY_ICONS.company },
    metric:  { label: t.badgeMetric,  ...CATEGORY_ICONS.metric },
    insight: { label: t.badgeInsight, ...CATEGORY_ICONS.insight },
  };
}

function buildFilterOptions(t: UIStrings): Array<{ value: BriefCategory | 'all'; label: string }> {
  return [
    { value: 'all', label: t.filterAll },
    { value: 'tool', label: t.filterTools },
    { value: 'repo', label: t.filterRepos },
    { value: 'company', label: t.filterCompanies },
    { value: 'metric', label: t.filterMetrics },
    { value: 'insight', label: t.filterInsights },
  ];
}

const INITIAL_VISIBLE = 4;

function formatDate(dateStr: string, locale: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}

function BriefCard({ item, index, categoryConfig }: { item: BriefItem; index: number; categoryConfig: CategoryConfig }) {
  const router = useRouter();
  const cat = categoryConfig[item.category];
  const Icon = cat.icon;

  const handleClick = () => {
    router.push(`/episode/${item.source.episodeId}/insights`);
  };

  const handleTimestampClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `/episode/${item.source.episodeId}/insights${item.timestampSeconds ? `?t=${item.timestampSeconds}` : ''}`;
    router.push(url);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className="rounded-xl bg-card border border-border hover:border-primary/30 hover:shadow-[var(--shadow-2)] p-4 cursor-pointer transition-all duration-200"
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); } }}
    >
      {/* Category badge */}
      <div className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 mb-2.5', cat.badgeBg)}>
        <Icon className={cn('h-3 w-3', cat.color)} />
        <span className={cn('text-[10px] font-semibold uppercase tracking-wider', cat.color)}>
          {cat.label}
        </span>
      </div>

      {/* Content */}
      <p dir="auto" className="text-h4 text-foreground line-clamp-1 mb-1">
        {item.headline}
      </p>
      <p dir="auto" className="text-xs text-muted-foreground line-clamp-2 min-h-[2lh]">
        {item.whyItMatters}
      </p>

      {/* Source row */}
      <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-border/60">
        <div className="flex items-center gap-1.5 min-w-0 max-w-[65%]">
          {item.source.imageUrl ? (
            <img
              src={item.source.imageUrl}
              alt=""
              className="w-4 h-4 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-4 h-4 rounded-full bg-secondary flex-shrink-0" />
          )}
          <span className="text-caption text-muted-foreground truncate">
            {item.source.name}
          </span>
        </div>
        {item.timestamp && (
          <button
            onClick={handleTimestampClick}
            className="text-caption font-medium text-primary hover:text-primary/80 transition-colors cursor-pointer"
          >
            @{item.timestamp}
          </button>
        )}
      </div>
    </motion.div>
  );
}

function BriefSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {[0, 1, 2, 3].map(i => (
        <div key={i} className="rounded-xl border border-border p-4 space-y-3">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
          <div className="pt-2.5 border-t border-border/60">
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TodaysInsights() {
  const { country } = useCountry();
  const { lang, locale } = getRegion(country);
  const t = getStrings(lang);

  const [data, setData] = useState<TodaysBriefResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<BriefCategory | 'all'>('all');
  const [expanded, setExpanded] = useState(false);

  const categoryConfig = useMemo(() => buildCategoryConfig(t), [t]);
  const filterOptions = useMemo(() => buildFilterOptions(t), [t]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    async function fetchBrief() {
      try {
        const res = await fetch(`/api/discover/todays-insights?country=${country.toLowerCase()}`);
        if (res.ok && !cancelled) {
          const json = await res.json();
          // Handle both new and old response shapes
          if (json.items) {
            setData(json as TodaysBriefResponse);
          }
        }
      } catch {
        // Silently fail — section shows empty state
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    fetchBrief();
    return () => { cancelled = true; };
  }, [country]);

  // Derive available categories
  const availableCategories = useMemo(() => {
    if (!data?.items.length) return new Set<BriefCategory>();
    return new Set(data.items.map(i => i.category));
  }, [data]);

  const showFilters = availableCategories.size >= 2;

  // Filter items
  const filteredItems = useMemo(() => {
    if (!data?.items.length) return [];
    if (activeFilter === 'all') return data.items;
    return data.items.filter(i => i.category === activeFilter);
  }, [data, activeFilter]);

  const visibleItems = expanded ? filteredItems : filteredItems.slice(0, INITIAL_VISIBLE);
  const hiddenCount = filteredItems.length - INITIAL_VISIBLE;

  // Loading state
  if (isLoading) {
    return (
      <section>
        <div className="relative rounded-2xl overflow-hidden bg-secondary/60 dark:bg-secondary/40 border border-border">
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
          <div className="relative px-6 py-6 sm:px-8 sm:py-8">
            <div className="flex items-center gap-2 mb-6">
              <Skeleton className="h-6 w-32" />
            </div>
            <BriefSkeleton />
          </div>
        </div>
      </section>
    );
  }

  // Empty state
  if (!data?.items.length) {
    return null;
  }

  const today = new Date();
  const dateLabel = formatDate(data.date, locale);
  const todayLabel = formatDate(today.toISOString().split('T')[0], locale);
  const displayDate = dateLabel === todayLabel ? t.today : dateLabel;

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
    >
      <div className="relative rounded-2xl overflow-hidden bg-secondary/60 dark:bg-secondary/40 border border-border">
        {/* Subtle top accent line */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

        <div className="relative px-6 py-6 sm:px-8 sm:py-8">
          {/* Header row */}
          <div className="flex items-start justify-between gap-4 mb-1.5">
            <h2 className="text-h3 text-foreground tracking-tight">
              {t.sectionTitle}
            </h2>
          </div>

          {/* Date + count */}
          <div className="flex items-center gap-3 mb-5">
            <span className="inline-flex items-center gap-1 text-caption font-medium text-muted-foreground">
              <Zap className="h-3 w-3 text-amber-500 dark:text-amber-400" />
              {displayDate} &middot; {data.items.length} {t.items}
            </span>
          </div>

          {/* Stale data banner */}
          {data.isStale && (
            <div className="text-caption text-muted-foreground bg-amber-500/5 border border-amber-500/10 rounded-lg px-3 py-1.5 mb-3">
              {t.showingLatestFrom} {formatDate(data.date, locale)}
            </div>
          )}

          {/* Filter pills */}
          {showFilters && (
            <div className="flex items-center gap-1.5 mb-4 overflow-x-auto scrollbar-none">
              {filterOptions
                .filter(f => f.value === 'all' || availableCategories.has(f.value as BriefCategory))
                .map(f => (
                  <button
                    key={f.value}
                    onClick={() => { setActiveFilter(f.value as BriefCategory | 'all'); setExpanded(false); }}
                    className={cn(
                      'px-3 py-1 rounded-full text-[11px] font-medium transition-colors whitespace-nowrap cursor-pointer',
                      activeFilter === f.value
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80'
                    )}
                  >
                    {f.label}
                  </button>
                ))}
            </div>
          )}

          {/* Card grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {visibleItems.map((item, i) => (
              <BriefCard key={item.id} item={item} index={i} categoryConfig={categoryConfig} />
            ))}
          </div>

          {/* Show more / less */}
          {hiddenCount > 0 && !expanded && (
            <button
              onClick={() => setExpanded(true)}
              className="mt-3 w-full flex items-center justify-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer py-2"
            >
              <ChevronDown className="h-3.5 w-3.5" />
              {t.showMore.replace('{n}', String(hiddenCount))}
            </button>
          )}
          {expanded && filteredItems.length > INITIAL_VISIBLE && (
            <button
              onClick={() => setExpanded(false)}
              className="mt-3 w-full flex items-center justify-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer py-2"
            >
              <ChevronUp className="h-3.5 w-3.5" />
              {t.showLess}
            </button>
          )}
        </div>
      </div>
    </motion.section>
  );
}
