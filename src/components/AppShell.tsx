'use client';

import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Sidebar } from '@/components/Sidebar';
import { StickyAudioPlayer } from '@/components/player';
import { AskAIProvider } from '@/contexts/AskAIContext';
import { LegalFooter } from '@/components/LegalFooter';

// Dynamic imports for components that only appear on user interaction
const AuthModal = dynamic(() => import('@/components/auth/AuthModal').then(m => ({ default: m.AuthModal })), { ssr: false });
const CompactAuthPrompt = dynamic(() => import('@/components/auth/CompactAuthPrompt').then(m => ({ default: m.CompactAuthPrompt })), { ssr: false });
const QueueToast = dynamic(() => import('@/components/QueueToast').then(m => ({ default: m.QueueToast })), { ssr: false });
const AskAIChatPopup = dynamic(() => import('@/components/insights/AskAIChatPopup').then(m => ({ default: m.AskAIChatPopup })), { ssr: false });
const CookieConsent = dynamic(() => import('@/components/CookieConsent').then(m => ({ default: m.CookieConsent })), { ssr: false });

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith('/admin');

  if (isAdmin) {
    return <main className="min-h-screen">{children}</main>;
  }

  return (
    <AskAIProvider>
      <div className="min-h-screen">
        <Sidebar />
        {/* Main content: offset for desktop sidebar (lg:pl-64), mobile top bar (pt-14), mobile bottom nav + player space (pb-28) */}
        <main className="lg:pl-64 pt-14 lg:pt-0 min-h-screen pb-28 lg:pb-24">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
          <LegalFooter />
        </main>
      </div>
      <AuthModal />
      <CompactAuthPrompt />
      <QueueToast />
      {/* Audio player z-40: above mobile bottom nav (z-30), below modals */}
      <StickyAudioPlayer />
      <AskAIChatPopup />
      <CookieConsent />
    </AskAIProvider>
  );
}
