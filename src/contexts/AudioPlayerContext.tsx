'use client';

import React, { createContext, useContext, useState, useCallback, useRef, useEffect, useMemo } from 'react';
import posthog from 'posthog-js';
import { saveListeningProgress } from '@/hooks/useListeningProgress';
import { useAuth } from '@/contexts/AuthContext';

interface Track {
  id: string;
  title: string;
  artist: string; // Podcast name
  artworkUrl: string;
  audioUrl: string;
  duration?: number;
  chapters?: { title: string; timestamp: string; timestamp_seconds: number }[];
  /** Analytics: UUID of the podcast this episode belongs to */
  podcastId?: string;
  /** Analytics: Where the play was initiated from */
  source?: string;
}

export type { Track };

// Frequently changing state (updates ~60fps during playback)
interface AudioPlayerFrequentState {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  isLoading: boolean;
}

// Stable state + control functions (changes infrequently)
interface AudioPlayerControlsType {
  currentTrack: Track | null;
  volume: number;
  playbackRate: number;
  isExpanded: boolean;
  play: (track?: Track) => void;
  playFromTime: (track: Track, time: number) => void;
  pause: () => void;
  toggle: () => void;
  seek: (time: number) => void;
  seekRelative: (delta: number) => void;
  setVolume: (volume: number) => void;
  setPlaybackRate: (rate: number) => void;
  loadTrack: (track: Track) => void;
  updateTrackMeta: (meta: Partial<Track>) => void;
  clearTrack: () => void;
  toggleExpanded: () => void;
}

// Combined type for backward compatibility
interface AudioPlayerContextType extends AudioPlayerFrequentState, AudioPlayerControlsType {}

// Two separate contexts
const AudioPlayerStateContext = createContext<AudioPlayerFrequentState | null>(null);
const AudioPlayerControlsContext = createContext<AudioPlayerControlsType | null>(null);

// Hook for frequently changing state (currentTime, isPlaying, etc.)
export function useAudioPlayerState() {
  const context = useContext(AudioPlayerStateContext);
  if (!context) {
    throw new Error('useAudioPlayerState must be used within an AudioPlayerProvider');
  }
  return context;
}

// Hook for stable controls and infrequently changing state
export function useAudioPlayerControls() {
  const context = useContext(AudioPlayerControlsContext);
  if (!context) {
    throw new Error('useAudioPlayerControls must be used within an AudioPlayerProvider');
  }
  return context;
}

// Combined hook for backward compatibility
export function useAudioPlayer(): AudioPlayerContextType {
  const state = useAudioPlayerState();
  const controls = useAudioPlayerControls();
  return { ...state, ...controls };
}

// Safe hook that doesn't throw if used outside provider
export function useAudioPlayerSafe(): AudioPlayerContextType | null {
  const state = useContext(AudioPlayerStateContext);
  const controls = useContext(AudioPlayerControlsContext);
  if (!state || !controls) return null;
  return { ...state, ...controls };
}

export function AudioPlayerProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioInitialized = useRef(false);
  const lastSaveRef = useRef<number>(0);
  const pendingCanPlayRef = useRef<(() => void) | null>(null);

  // Frequently changing state
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Infrequently changing state
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [volume, setVolumeState] = useState(0.8);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [isExpanded, setIsExpanded] = useState(false);

  // Use refs for values needed in callbacks to avoid stale closures
  const durationRef = useRef(duration);
  durationRef.current = duration;
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;
  const currentTrackRef = useRef(currentTrack);
  currentTrackRef.current = currentTrack;
  const userRef = useRef(user);
  userRef.current = user;

  // Lazy initialize audio element only when needed
  const initializeAudio = useCallback(() => {
    if (typeof window === 'undefined' || audioRef.current || audioInitialized.current) {
      return audioRef.current;
    }

    audioInitialized.current = true;
    audioRef.current = new Audio();
    audioRef.current.volume = 0.8;
    audioRef.current.playbackRate = 1;

    // Event listeners
    const audio = audioRef.current;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      // Debounced save every 30 seconds
      const now = Date.now();
      if (now - lastSaveRef.current >= 30000 && currentTrackRef.current?.id) {
        lastSaveRef.current = now;
        saveListeningProgress(
          currentTrackRef.current.id,
          audio.currentTime,
          audio.duration || 0,
          userRef.current?.id
        );
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      setIsLoading(false);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      if (currentTrackRef.current?.id) {
        saveListeningProgress(
          currentTrackRef.current.id,
          audio.duration || 0,
          audio.duration || 0,
          userRef.current?.id
        );
      }
      lastSaveRef.current = Date.now();
      setCurrentTime(0);
    };

    const handlePlay = () => {
      setIsPlaying(true);
    };

    const handlePause = () => {
      setIsPlaying(false);
      // Only save if enough time has passed since last save (avoids spam from buffer stalls)
      const now = Date.now();
      if (currentTrackRef.current?.id && audio.currentTime > 0 && now - lastSaveRef.current >= 5000) {
        lastSaveRef.current = now;
        saveListeningProgress(
          currentTrackRef.current.id,
          audio.currentTime,
          audio.duration || 0,
          userRef.current?.id
        );
      }
    };

    const handleWaiting = () => {
      setIsLoading(true);
    };

    const handleCanPlay = () => {
      setIsLoading(false);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('canplay', handleCanPlay);

    return audio;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, []);

  // Save progress on page unload
  useEffect(() => {
    const handleUnload = () => {
      if (currentTrackRef.current?.id && audioRef.current) {
        saveListeningProgress(
          currentTrackRef.current.id,
          audioRef.current.currentTime,
          audioRef.current.duration || 0,
          userRef.current?.id
        );
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, []);

  const loadTrack = useCallback((track: Track) => {
    const audio = initializeAudio();
    if (!audio) return;

    setCurrentTrack(track);
    setIsLoading(true);
    setCurrentTime(0);
    setDuration(track.duration || 0);

    audio.src = track.audioUrl;
    audio.load();
  }, [initializeAudio]);

  /** Remove any previous pending canplay handler and optionally register a new one.
   *  If audio.readyState >= HAVE_CURRENT_DATA (2), invoke the handler immediately. */
  const setCanPlayHandler = useCallback((audio: HTMLAudioElement, handler: (() => void) | null) => {
    // Remove previous listener if any
    if (pendingCanPlayRef.current) {
      audio.removeEventListener('canplay', pendingCanPlayRef.current);
      pendingCanPlayRef.current = null;
    }
    if (handler) {
      // Already loaded — fire immediately
      if (audio.readyState >= 2) {
        handler();
      } else {
        pendingCanPlayRef.current = handler;
        audio.addEventListener('canplay', handler);
      }
    }
  }, []);

  const play = useCallback((track?: Track) => {
    const audio = initializeAudio();
    if (!audio) return;

    if (track) {
      loadTrack(track);
      posthog.capture('episode_played', { episode_id: track.id, podcast_name: track.artist });
      const onCanPlay = () => {
        // Clean up ref since we're executing
        if (pendingCanPlayRef.current === onCanPlay) {
          audio.removeEventListener('canplay', onCanPlay);
          pendingCanPlayRef.current = null;
        }
        // Resume from saved position
        const saved = localStorage.getItem(`lp:${track.id}`);
        if (saved) {
          try {
            const { ct, d, c } = JSON.parse(saved);
            // Only resume if not completed and has meaningful progress (>5s)
            if (!c && ct > 5 && d > 0 && ct / d < 0.95) {
              audio.currentTime = ct;
            }
          } catch {}
        }
        audio.play().catch(() => {});
      };
      setCanPlayHandler(audio, onCanPlay);
    } else {
      audio.play().catch(() => {});
    }
  }, [loadTrack, initializeAudio, setCanPlayHandler]);

  const playFromTime = useCallback((track: Track, time: number) => {
    const audio = initializeAudio();
    if (!audio) return;

    loadTrack(track);
    const onCanPlay = () => {
      // Clean up ref since we're executing
      if (pendingCanPlayRef.current === onCanPlay) {
        audio.removeEventListener('canplay', onCanPlay);
        pendingCanPlayRef.current = null;
      }
      audio.currentTime = Math.max(0, time);
      audio.play().catch(() => {});
    };
    setCanPlayHandler(audio, onCanPlay);
  }, [loadTrack, initializeAudio, setCanPlayHandler]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  const toggle = useCallback(() => {
    if (isPlayingRef.current) {
      audioRef.current?.pause();
    } else {
      const audio = initializeAudio();
      audio?.play().catch(() => {});
    }
  }, [initializeAudio]);

  const seek = useCallback((time: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(0, Math.min(time, durationRef.current));
  }, []);

  const seekRelative = useCallback((delta: number) => {
    if (!audioRef.current) return;
    const newTime = Math.max(0, Math.min(audioRef.current.currentTime + delta, durationRef.current));
    audioRef.current.currentTime = newTime;
  }, []);

  const setVolume = useCallback((vol: number) => {
    const clampedVolume = Math.max(0, Math.min(1, vol));
    setVolumeState(clampedVolume);
    if (audioRef.current) {
      audioRef.current.volume = clampedVolume;
    }
  }, []);

  const setPlaybackRate = useCallback((rate: number) => {
    setPlaybackRateState(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  }, []);

  const updateTrackMeta = useCallback((meta: Partial<Track>) => {
    setCurrentTrack(prev => prev ? { ...prev, ...meta } : prev);
  }, []);

  const clearTrack = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    setCurrentTrack(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, []);

  const toggleExpanded = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  // Memoize the frequently changing state value
  const stateValue = useMemo<AudioPlayerFrequentState>(() => ({
    currentTime,
    duration,
    isPlaying,
    isLoading,
  }), [currentTime, duration, isPlaying, isLoading]);

  // Memoize the controls value - only changes when stable state changes
  const controlsValue = useMemo<AudioPlayerControlsType>(() => ({
    currentTrack,
    volume,
    playbackRate,
    isExpanded,
    play,
    playFromTime,
    pause,
    toggle,
    seek,
    seekRelative,
    setVolume,
    setPlaybackRate,
    loadTrack,
    updateTrackMeta,
    clearTrack,
    toggleExpanded,
  }), [
    currentTrack,
    volume,
    playbackRate,
    isExpanded,
    play,
    playFromTime,
    pause,
    toggle,
    seek,
    seekRelative,
    setVolume,
    setPlaybackRate,
    loadTrack,
    updateTrackMeta,
    clearTrack,
    toggleExpanded,
  ]);

  return (
    <AudioPlayerControlsContext.Provider value={controlsValue}>
      <AudioPlayerStateContext.Provider value={stateValue}>
        {children}
      </AudioPlayerStateContext.Provider>
    </AudioPlayerControlsContext.Provider>
  );
}
