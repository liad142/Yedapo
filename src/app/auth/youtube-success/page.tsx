'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

function YouTubeSuccessContent() {
  const searchParams = useSearchParams();
  const code = searchParams.get('code');
  const [status, setStatus] = useState<'exchanging' | 'success' | 'error'>(code ? 'exchanging' : 'success');

  useEffect(() => {
    if (!code) {
      setTimeout(() => window.close(), 1500);
      return;
    }

    fetch('/api/youtube/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })
      .then(res => {
        if (!res.ok) throw new Error('Exchange failed');
        setStatus('success');
        // Notify opener that YouTube was connected
        if (window.opener) window.opener.postMessage('youtube-connected', '*');
        setTimeout(() => window.close(), 1500);
      })
      .catch(() => {
        setStatus('error');
        setTimeout(() => window.close(), 3000);
      });
  }, [code]);

  return (
    <div className="text-center space-y-3">
      {status === 'exchanging' && (
        <>
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-lg font-semibold text-foreground">Connecting YouTube...</p>
        </>
      )}
      {status === 'success' && (
        <>
          <div className="text-4xl text-green-500">&#10003;</div>
          <p className="text-lg font-semibold text-foreground">YouTube Connected</p>
          <p className="text-sm text-muted-foreground">This window will close automatically...</p>
        </>
      )}
      {status === 'error' && (
        <>
          <div className="text-4xl text-red-500">&#10007;</div>
          <p className="text-lg font-semibold text-foreground">Connection Failed</p>
          <p className="text-sm text-muted-foreground">Please try again from Settings.</p>
        </>
      )}
    </div>
  );
}

export default function YouTubeSuccessPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Suspense fallback={<Loader2 className="h-8 w-8 animate-spin text-primary" />}>
        <YouTubeSuccessContent />
      </Suspense>
    </div>
  );
}
