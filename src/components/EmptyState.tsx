'use client';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { elevation } from '@/lib/elevation';
import { 
  Youtube, 
  Radio, 
  Search, 
  Bookmark, 
  Rss,
  PlusCircle,
  RefreshCw
} from 'lucide-react';

export type EmptyStateType = 
  | 'youtube-trending'
  | 'youtube-followed'
  | 'podcasts'
  | 'search'
  | 'saved'
  | 'feed'
  | 'generic';

interface EmptyStateProps {
  type?: EmptyStateType;
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  className?: string;
}

const EMPTY_STATE_CONFIG: Record<EmptyStateType, {
  icon: React.ElementType;
  title: string;
  description: string;
  iconBgColor: string;
  iconColor: string;
}> = {
  'youtube-trending': {
    icon: Youtube,
    title: 'No Trending Videos',
    description: 'Trending videos are taking a break \u2014 check back soon!',
    iconBgColor: 'bg-red-100 dark:bg-red-900/30',
    iconColor: 'text-red-600 dark:text-red-400',
  },
  'youtube-followed': {
    icon: Youtube,
    title: 'No Followed Channels',
    description: 'Your YouTube feed starts here \u2014 follow channels to fill it up.',
    iconBgColor: 'bg-red-100 dark:bg-red-900/30',
    iconColor: 'text-red-600 dark:text-red-400',
  },
  podcasts: {
    icon: Radio,
    title: 'No Podcasts Found',
    description: 'No matches yet \u2014 try different keywords or explore what\'s trending.',
    iconBgColor: 'bg-primary/10',
    iconColor: 'text-primary',
  },
  search: {
    icon: Search,
    title: 'No Results',
    description: 'Hmm, we couldn\'t find that. Try different keywords or explore what\'s trending.',
    iconBgColor: 'bg-blue-100 dark:bg-blue-900/30',
    iconColor: 'text-blue-600 dark:text-blue-400',
  },
  saved: {
    icon: Bookmark,
    title: 'Nothing Saved Yet',
    description: 'Your collection starts here \u2014 save episodes to access their insights anytime.',
    iconBgColor: 'bg-amber-100 dark:bg-amber-900/30',
    iconColor: 'text-amber-600 dark:text-amber-400',
  },
  feed: {
    icon: Rss,
    title: 'Your Feed is Empty',
    description: 'Your personalized feed is ready to grow \u2014 follow podcasts and channels you love.',
    iconBgColor: 'bg-green-100 dark:bg-green-900/30',
    iconColor: 'text-green-600 dark:text-green-400',
  },
  generic: {
    icon: Search,
    title: 'Nothing Here',
    description: 'This space is ready for something great. Start by discovering content you\'ll love.',
    iconBgColor: 'bg-muted',
    iconColor: 'text-muted-foreground',
  },
};

export function EmptyState({
  type = 'generic',
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  className,
}: EmptyStateProps) {
  const config = EMPTY_STATE_CONFIG[type];
  const Icon = config.icon;

  return (
    <div className={cn(
      'flex flex-col items-center justify-center py-12 px-4 text-center rounded-xl',
      elevation.card,
      className
    )}>
      <div className={cn(
        'w-16 h-16 rounded-full flex items-center justify-center mb-4',
        config.iconBgColor
      )}>
        <Icon className={cn('w-8 h-8', config.iconColor)} />
      </div>
      
      <h3 className="text-lg font-semibold text-foreground mb-2">
        {title || config.title}
      </h3>
      
      <p className="text-sm text-muted-foreground max-w-sm mb-6">
        {description || config.description}
      </p>

      <div className="flex items-center gap-3">
        {actionLabel && onAction && (
          <Button onClick={onAction} className="gap-2">
            <PlusCircle className="w-4 h-4" />
            {actionLabel}
          </Button>
        )}
        
        {secondaryActionLabel && onSecondaryAction && (
          <Button variant="outline" onClick={onSecondaryAction} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            {secondaryActionLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
