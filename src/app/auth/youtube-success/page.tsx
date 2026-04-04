'use client';

import { useEffect } from 'react';

function YouTubeSuccessContent() {
  useEffect(() => {
    // Notify opener that YouTube was connected (restrict to same origin)
    if (window.opener) {
      window.opener.postMessage('youtube-connected', window.location.origin);
    }
    setTimeout(() => window.close(), 1500);
  }, []);

  return (
    <div className="text-center space-y-3">
      <div className="text-4xl text-green-500">&#10003;</div>
      <p className="text-lg font-semibold text-foreground">YouTube Connected</p>
      <p className="text-sm text-muted-foreground">This window will close automatically...</p>
    </div>
  );
}

export default function YouTubeSuccessPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <YouTubeSuccessContent />
    </div>
  );
}
