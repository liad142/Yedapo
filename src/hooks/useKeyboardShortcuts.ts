'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useAudioPlayerSafe } from '@/contexts/AudioPlayerContext';

interface UseKeyboardShortcutsOptions {
  helpModalOpen: boolean;
  setHelpModalOpen: (open: boolean) => void;
}

export function useKeyboardShortcuts({ helpModalOpen, setHelpModalOpen }: UseKeyboardShortcutsOptions) {
  const player = useAudioPlayerSafe();
  const pathname = usePathname();

  // Refs so the keydown handler always reads fresh values
  // without re-registering the event listener
  const playerRef = useRef(player);
  playerRef.current = player;
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const helpOpenRef = useRef(helpModalOpen);
  helpOpenRef.current = helpModalOpen;
  const setHelpRef = useRef(setHelpModalOpen);
  setHelpRef.current = setHelpModalOpen;

  useEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
    if (!mq.matches) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Re-check in case device type changed
      if (!mq.matches) return;

      const target = e.target as HTMLElement;
      const tagName = target.tagName;

      // Guard: skip when typing in form elements
      if (
        tagName === 'INPUT' ||
        tagName === 'TEXTAREA' ||
        tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }

      // Guard: skip if Ctrl/Meta/Alt modifiers are held (allow native shortcuts)
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      // Check for open dialogs other than our help modal
      const hasOtherDialog = document.querySelector(
        '[role="dialog"]:not([data-shortcuts-modal])'
      ) !== null;

      switch (e.key) {
        case ' ': {
          // Space = play/pause — skip if BUTTON is focused
          if (target.tagName === 'BUTTON') return;
          if (helpOpenRef.current || hasOtherDialog) return;
          const p = playerRef.current;
          if (!p?.currentTrack) return;
          e.preventDefault();
          p.toggle();
          break;
        }

        case 'ArrowLeft': {
          if (helpOpenRef.current || hasOtherDialog) return;
          const p = playerRef.current;
          if (!p?.currentTrack) return;
          e.preventDefault();
          p.seekRelative(-15);
          break;
        }

        case 'ArrowRight': {
          if (helpOpenRef.current || hasOtherDialog) return;
          const p = playerRef.current;
          if (!p?.currentTrack) return;
          e.preventDefault();
          p.seekRelative(15);
          break;
        }

        case 's':
        case 'S': {
          if (helpOpenRef.current || hasOtherDialog) return;
          if (!pathnameRef.current.startsWith('/episode/')) return;
          e.preventDefault();
          const btn = document.querySelector<HTMLButtonElement>('[data-shortcut="summarize"]');
          if (btn && !btn.disabled) btn.click();
          break;
        }

        case 'Escape': {
          // Layered (Option A): only close our help modal, let existing handlers handle theirs
          if (helpOpenRef.current) {
            e.preventDefault();
            setHelpRef.current(false);
          }
          break;
        }

        case '?': {
          if (hasOtherDialog) return;
          e.preventDefault();
          setHelpRef.current(!helpOpenRef.current);
          break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    // Re-attach if device type changes
    const handleMqChange = () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (mq.matches) {
        document.addEventListener('keydown', handleKeyDown);
      }
    };
    mq.addEventListener('change', handleMqChange);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      mq.removeEventListener('change', handleMqChange);
    };
  }, []);
}
