'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      router.replace('/discover');
      return;
    }

    // Verify admin status via API
    fetch('/api/admin/overview')
      .then(res => {
        if (res.ok) {
          setIsAdmin(true);
        } else {
          router.replace('/discover');
        }
      })
      .catch(() => {
        router.replace('/discover');
      });
  }, [isLoading, router]);

  if (isLoading || isAdmin === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
