'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function MyPodcastsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/my-list');
  }, [router]);
  return null;
}
