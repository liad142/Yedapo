'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Sidebar } from '@/components/Sidebar';
import { StickyAudioPlayer } from '@/components/player';
import { AskAIProvider } from '@/contexts/AskAIContext';
import { LegalFooter } from '@/components/LegalFooter';
import { useAudioPlayerSafe } from '@/contexts/AudioPlayerContext';
import { useSummarizeQueueOptional } from '@/contexts/SummarizeQueueContext';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

// Dynamic imports for components that only appear on user interaction
const AuthModal = dynamic(() => import('@/components/auth/AuthModal').then(m => ({ default: m.AuthModal })), { ssr: false });
const CompactAuthPrompt = dynamic(() => import('@/components/auth/CompactAuthPrompt').then(m => ({ default: m.CompactAuthPrompt })), { ssr: false });
const QueueToast = dynamic(() => import('@/components/QueueToast').then(m => ({ default: m.QueueToast })), { ssr: false });
const AskAIChatPopup = dynamic(() => import('@/components/insights/AskAIChatPopup').then(m => ({ default: m.AskAIChatPopup })), { ssr: false });
const CookieConsent = dynamic(() => import('@/components/CookieConsent').then(m => ({ default: m.CookieConsent })), { ssr: false });
const UpgradeModal = dynamic(() => import('@/components/UpgradeModal').then(m => ({ default: m.UpgradeModal })), { ssr: false });
const GuestGatePopup = dynamic(() => import('@/components/auth/GuestGatePopup').then(m => ({ default: m.GuestGatePopup })), { ssr: false });
const KeyboardShortcutsModal = dynamic(() => import('@/components/KeyboardShortcutsModal').then(m => ({ default: m.KeyboardShortcutsModal })), { ssr: false });

function AppShellInner({ children }: { children: React.ReactNode }) {
  const player = useAudioPlayerSafe();
  const playerActive = !!(player?.currentTrack);

  return (
    <div className="min-h-screen">
      <Sidebar />
      {/* Main content: offset for desktop sidebar (lg:pl-64), mobile top bar (pt-14).
          Bottom padding: pb-20 for bottom nav only, pb-40 when player is also visible. */}
      <main
        id="main-content"
        className={`lg:pl-64 pt-14 lg:pt-0 min-h-screen ${playerActive ? 'pb-40 lg:pb-36' : 'pb-20 lg:pb-8'}`}
      >
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
        <LegalFooter />
      </main>
    </div>
  );
}

function KeyboardShortcutsManager() {
  const [helpOpen, setHelpOpen] = useState(false);
  useKeyboardShortcuts({ helpModalOpen: helpOpen, setHelpModalOpen: setHelpOpen });
  return <KeyboardShortcutsModal open={helpOpen} onOpenChange={setHelpOpen} />;
}

function UpgradeModalBridge() {
  const queueCtx = useSummarizeQueueOptional();
  if (!queueCtx) return null;
  return (
    <UpgradeModal
      open={queueCtx.showUpgradeModal}
      onClose={() => queueCtx.setShowUpgradeModal(false)}
      rateLimitInfo={queueCtx.rateLimitInfo}
    />
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLanding = pathname === '/';
  const isMarketing = isLanding || pathname === '/pricing';
  const isAdmin = pathname.startsWith('/admin');

  if (isMarketing || isAdmin) {
    return (
      <>
        <main id="main-content" className="min-h-screen">{children}</main>
        {isMarketing && <AuthModal />}
        {isMarketing && <CookieConsent />}
      </>
    );
  }

  return (
    <AskAIProvider>
      <AppShellInner>{children}</AppShellInner>
      <AuthModal />
      <CompactAuthPrompt />
      <GuestGatePopup />
      <QueueToast />
      {/* Audio player z-[45]: above mobile bottom nav (z-30), below modals (z-[55]) */}
      <StickyAudioPlayer />
      <AskAIChatPopup />
      <CookieConsent />
      <UpgradeModalBridge />
      <KeyboardShortcutsManager />
    </AskAIProvider>
  );
}
