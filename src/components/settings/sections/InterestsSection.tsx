'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2,
  Check,
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
  Film,
  Search,
} from 'lucide-react';
import posthog from 'posthog-js';
import { APPLE_PODCAST_GENRES } from '@/types/apple-podcasts';
import { cn } from '@/lib/utils';
import { FieldLabel } from './SectionLabel';
import type { UserProfile } from './types';

const GENRE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  '1301': Palette,
  '1321': Briefcase,
  '1303': Smile,
  '1304': GraduationCap,
  '1483': BookOpen,
  '1511': Landmark,
  '1512': Clock,
  '1305': Heart,
  '1307': Users,
  '1309': Music,
  '1489': Newspaper,
  '1314': Church,
  '1533': FlaskConical,
  '1324': Globe,
  '1545': Trophy,
  '1318': Cpu,
  '1481': Search,
  '1310': Film,
};

interface InterestsSectionProps {
  profile: UserProfile | null;
  isLoading: boolean;
  onProfileChange: (profile: UserProfile) => void;
  onError?: (message: string) => void;
}

export function InterestsSection({
  profile,
  isLoading,
  onProfileChange,
  onError,
}: InterestsSectionProps) {
  const [selectedGenres, setSelectedGenres] = useState<Set<string>>(new Set());
  const [genresDirty, setGenresDirty] = useState(false);
  const [isSavingGenres, setIsSavingGenres] = useState(false);

  // Sync from incoming profile
  useEffect(() => {
    if (profile) {
      setSelectedGenres(new Set(profile.preferred_genres || []));
      setGenresDirty(false);
    }
  }, [profile]);

  const toggleGenre = (id: string) => {
    setSelectedGenres((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setGenresDirty(true);
  };

  const handleSaveGenres = async () => {
    setIsSavingGenres(true);
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferred_genres: Array.from(selectedGenres) }),
      });
      if (res.ok) {
        const d = await res.json();
        onProfileChange(d.profile);
        setGenresDirty(false);
        posthog.capture('profile_updated', {
          field: 'genres',
          genre_count: selectedGenres.size,
        });
      } else {
        onError?.('Failed to save interests.');
      }
    } catch {
      onError?.('Failed to save interests.');
    } finally {
      setIsSavingGenres(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <FieldLabel>Your Interests</FieldLabel>
        <AnimatePresence>
          {genresDirty && (
            <motion.button
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              onClick={handleSaveGenres}
              disabled={isSavingGenres}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold shadow-sm hover:bg-primary/90 transition-colors"
            >
              {isSavingGenres ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Check className="h-3 w-3" />
              )}
              Save
            </motion.button>
          )}
        </AnimatePresence>
      </div>
      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading...
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {APPLE_PODCAST_GENRES.map((genre) => {
            const Icon = GENRE_ICONS[genre.id] || Palette;
            const selected = selectedGenres.has(genre.id);
            return (
              <button
                key={genre.id}
                onClick={() => toggleGenre(genre.id)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
                  selected
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground'
                )}
              >
                <Icon className="h-3 w-3 shrink-0" />
                {genre.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
