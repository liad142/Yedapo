'use client';

import { motion } from 'framer-motion';
import {
  Palette,
  Briefcase,
  Smile,
  GraduationCap,
  BookOpen,
  Landmark,
  Clock,
  Heart,
  Users,
  Music,
  Newspaper,
  Church,
  FlaskConical,
  Globe,
  Trophy,
  Cpu,
  Search,
  Film,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const GENRE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  '1301': Palette,       // Arts
  '1321': Briefcase,     // Business
  '1303': Smile,         // Comedy
  '1304': GraduationCap, // Education
  '1483': BookOpen,      // Fiction
  '1511': Landmark,      // Government
  '1512': Clock,         // History
  '1305': Heart,         // Health & Fitness
  '1307': Users,         // Kids & Family
  '1309': Music,         // Music
  '1489': Newspaper,     // News
  '1314': Church,        // Religion & Spirituality
  '1533': FlaskConical,  // Science
  '1324': Globe,         // Society & Culture
  '1545': Trophy,        // Sports
  '1318': Cpu,           // Technology
  '1481': Search,        // True Crime
  '1310': Film,          // TV & Film
};

interface GenreCardProps {
  id: string;
  name: string;
  selected: boolean;
  onToggle: (id: string) => void;
}

export function GenreCard({ id, name, selected, onToggle }: GenreCardProps) {
  const Icon = GENRE_ICONS[id] || Palette;

  return (
    <motion.button
      type="button"
      onClick={() => onToggle(id)}
      whileTap={{ scale: 0.95 }}
      className={cn(
        'flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        'min-h-[80px] sm:min-h-[100px]',
        selected
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-border hover:border-primary/50 text-muted-foreground hover:text-foreground'
      )}
    >
      <Icon className={cn('h-6 w-6', selected && 'text-primary')} />
      <span className="text-sm font-medium text-center leading-tight">{name}</span>
    </motion.button>
  );
}
