'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center py-12">
        <p className="text-destructive">Failed to load episode</p>
        <div className="flex justify-center gap-3 mt-4">
          <Button variant="outline" onClick={reset}>
            Try again
          </Button>
          <Link href="/discover">
            <Button variant="outline">Return to Discover</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
