'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Lightbulb, Share2, Bookmark, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

interface TodayInsight {
  text: string;
  sourceName: string;
  episodeTitle: string;
  episodeId: string;
  timestamp?: string;
  timestampSeconds?: number;
  type: 'podcast' | 'youtube';
}

export function TodaysInsights() {
  const router = useRouter();
  const [insights, setInsights] = useState<TodayInsight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  useEffect(() => {
    async function fetchInsights() {
      try {
        const res = await fetch('/api/discover/todays-insights');
        if (res.ok) {
          const data = await res.json();
          setInsights(data.insights || []);
        }
      } catch {
        // Silently fail — section just won't show
      } finally {
        setIsLoading(false);
      }
    }
    fetchInsights();
  }, []);

  const handleShare = async (insight: TodayInsight, index: number) => {
    const text = `"${insight.text}"\n— ${insight.sourceName}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {
      // Fallback: no clipboard API
    }
  };

  // Don't render if no insights or still loading
  if (isLoading || insights.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="mb-4">
        <h2 className="text-h2 text-foreground">Today&apos;s Insights</h2>
        <p className="text-body-sm text-muted-foreground">PodCatch distilled the internet for you today</p>
      </div>

      <div className="bg-card/50 border border-border rounded-2xl p-6 space-y-4">
        {insights.map((insight, i) => (
          <motion.div
            key={`${insight.episodeId}-${i}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={cn(
              'group',
              i < insights.length - 1 && 'pb-4 border-b border-border/50'
            )}
          >
            {/* Insight text */}
            <div className="flex gap-3">
              <Lightbulb className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-body-sm text-foreground leading-relaxed">
                  &ldquo;{insight.text}&rdquo;
                </p>
                {/* Source */}
                <button
                  onClick={() => router.push(`/episode/${insight.episodeId}/insights`)}
                  className="mt-1.5 flex items-center gap-1 text-caption text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                >
                  <span>— {insight.sourceName}</span>
                  {insight.timestamp && (
                    <span className="text-primary/60">@{insight.timestamp}</span>
                  )}
                  <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              </div>

              {/* Actions */}
              <div className="flex items-start gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleShare(insight, i)}
                  className="p-1.5 rounded-full hover:bg-secondary transition-colors cursor-pointer"
                  title={copiedIndex === i ? 'Copied!' : 'Copy insight'}
                >
                  <Share2 className={cn(
                    'h-3.5 w-3.5',
                    copiedIndex === i ? 'text-primary' : 'text-muted-foreground'
                  )} />
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}
