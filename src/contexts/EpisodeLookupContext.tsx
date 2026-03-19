'use client';

import { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode } from 'react';

interface EpisodeLookupResult {
  episodeId: string;
  summaryStatus: 'not_ready' | 'ready' | 'failed' | 'transcribing' | 'summarizing' | 'queued';
}

interface EpisodeLookupContextValue {
  // Register an audioUrl to be looked up in the next batch
  registerLookup: (audioUrl: string) => void;
  // Get the lookup result for an audioUrl (undefined if not yet fetched)
  getLookupResult: (audioUrl: string) => EpisodeLookupResult | undefined;
  // Check if a lookup is pending
  isLoading: (audioUrl: string) => boolean;
}

const EpisodeLookupContext = createContext<EpisodeLookupContextValue | null>(null);

const BATCH_DELAY_MS = 50; // Wait 50ms to collect all audioUrls before batching

export function EpisodeLookupProvider({ children }: { children: ReactNode }) {
  // Store all lookup results: audioUrl -> result
  const [results, setResults] = useState<Map<string, EpisodeLookupResult>>(new Map());
  
  // Track pending lookups (audioUrls waiting to be fetched)
  const pendingUrls = useRef<Set<string>>(new Set());
  
  // Track which audioUrls are currently being fetched
  const [fetchingUrls, setFetchingUrls] = useState<Set<string>>(new Set());
  
  // Debounce timer
  const batchTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Perform the batch lookup
  const performBatchLookup = useCallback(async () => {
    const urlsToFetch = Array.from(pendingUrls.current);
    pendingUrls.current.clear();

    if (urlsToFetch.length === 0) return;

    // Mark these as fetching
    setFetchingUrls(prev => {
      const next = new Set(prev);
      urlsToFetch.forEach(url => next.add(url));
      return next;
    });

    try {
      const response = await fetch('/api/episodes/batch-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioUrls: urlsToFetch }),
      });

      if (!response.ok) {
        console.error('Batch lookup failed:', response.status);
        return;
      }

      const data = await response.json();
      const batchResults = data.results as Record<string, EpisodeLookupResult>;

      // Update results state
      setResults(prev => {
        const next = new Map(prev);
        
        // Add results for found episodes
        for (const [audioUrl, result] of Object.entries(batchResults)) {
          next.set(audioUrl, result);
        }
        
        // Mark unfound URLs as not having an episode (so we don't re-fetch)
        for (const audioUrl of urlsToFetch) {
          if (!batchResults[audioUrl]) {
            next.set(audioUrl, { episodeId: '', summaryStatus: 'not_ready' });
          }
        }
        
        return next;
      });
    } catch (error) {
      console.error('Error in batch lookup:', error);
    } finally {
      // Remove from fetching
      setFetchingUrls(prev => {
        const next = new Set(prev);
        urlsToFetch.forEach(url => next.delete(url));
        return next;
      });
    }
  }, []);

  // Register an audioUrl for lookup
  const registerLookup = useCallback((audioUrl: string) => {
    if (!audioUrl) return;
    
    // Skip if already have result or already pending
    if (results.has(audioUrl) || pendingUrls.current.has(audioUrl) || fetchingUrls.has(audioUrl)) {
      return;
    }

    pendingUrls.current.add(audioUrl);

    // Debounce: wait for more registrations before firing batch
    if (batchTimerRef.current) {
      clearTimeout(batchTimerRef.current);
    }
    
    batchTimerRef.current = setTimeout(() => {
      performBatchLookup();
    }, BATCH_DELAY_MS);
  }, [results, fetchingUrls, performBatchLookup]);

  // Get lookup result
  const getLookupResult = useCallback((audioUrl: string): EpisodeLookupResult | undefined => {
    const result = results.get(audioUrl);
    // Return undefined if we have an empty placeholder (not found)
    if (result && result.episodeId === '') {
      return undefined;
    }
    return result;
  }, [results]);

  // Check if loading
  const isLoading = useCallback((audioUrl: string): boolean => {
    return fetchingUrls.has(audioUrl) || pendingUrls.current.has(audioUrl);
  }, [fetchingUrls]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current);
      }
    };
  }, []);

  return (
    <EpisodeLookupContext.Provider value={{ registerLookup, getLookupResult, isLoading }}>
      {children}
    </EpisodeLookupContext.Provider>
  );
}

export function useEpisodeLookup() {
  const context = useContext(EpisodeLookupContext);
  if (!context) {
    throw new Error('useEpisodeLookup must be used within EpisodeLookupProvider');
  }
  return context;
}
