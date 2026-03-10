'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export interface EpisodeProgress {
  currentTime: number;
  duration: number;
  completed: boolean;
  /** 0-1 fraction */
  fraction: number;
}

const LS_PREFIX = 'lp:';

function getLocalProgress(episodeId: string): EpisodeProgress | null {
  try {
    const raw = localStorage.getItem(`${LS_PREFIX}${episodeId}`);
    if (!raw) return null;
    const { ct, d, c } = JSON.parse(raw);
    return { currentTime: ct, duration: d, completed: !!c, fraction: d > 0 ? ct / d : 0 };
  } catch {
    return null;
  }
}

function setLocalProgress(episodeId: string, currentTime: number, duration: number, completed: boolean) {
  try {
    localStorage.setItem(`${LS_PREFIX}${episodeId}`, JSON.stringify({ ct: currentTime, d: duration, c: completed }));
  } catch {
    // Storage full or unavailable
  }
}

/**
 * Fetch listening progress for a batch of episode IDs.
 * Merges DB progress (authenticated) with localStorage (instant/guest).
 */
export function useListeningProgressBatch(episodeIds: string[]) {
  const { user } = useAuth();
  const [progressMap, setProgressMap] = useState<Record<string, EpisodeProgress>>({});
  const fetchedRef = useRef<string>('');

  useEffect(() => {
    const key = episodeIds.sort().join(',');
    if (!key || key === fetchedRef.current) return;
    fetchedRef.current = key;

    // First, load from localStorage for instant display
    const localMap: Record<string, EpisodeProgress> = {};
    for (const id of episodeIds) {
      const lp = getLocalProgress(id);
      if (lp && lp.currentTime > 0) localMap[id] = lp;
    }
    if (Object.keys(localMap).length > 0) {
      setProgressMap(localMap);
    }

    // Then, fetch from DB if authenticated (overrides localStorage)
    if (user) {
      // Only fetch DB IDs (internal UUIDs, not Apple IDs)
      const dbIds = episodeIds.filter(id => id.includes('-'));
      if (dbIds.length > 0) {
        fetch('/api/listening-progress/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ episodeIds: dbIds }),
        })
          .then(r => r.json())
          .then(data => {
            const dbMap: Record<string, EpisodeProgress> = {};
            for (const [id, p] of Object.entries(data.progress || {})) {
              const prog = p as any;
              dbMap[id] = {
                currentTime: prog.currentTime,
                duration: prog.duration,
                completed: prog.completed,
                fraction: prog.duration > 0 ? prog.currentTime / prog.duration : 0,
              };
            }
            // Merge: DB wins over localStorage
            setProgressMap(prev => ({ ...prev, ...dbMap }));
          })
          .catch(() => {});
      }
    }
  }, [episodeIds, user]);

  return progressMap;
}

/**
 * Save progress for a single episode.
 * Saves to localStorage always + DB if authenticated.
 */
export function saveListeningProgress(
  episodeId: string,
  currentTime: number,
  duration: number,
  userId?: string | null
) {
  const completed = duration > 0 && currentTime / duration >= 0.95;

  // Always save to localStorage
  setLocalProgress(episodeId, currentTime, duration, completed);

  // Save to DB if authenticated
  if (userId) {
    fetch('/api/listening-progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ episodeId, currentTime, duration }),
    }).catch(() => {});
  }
}
