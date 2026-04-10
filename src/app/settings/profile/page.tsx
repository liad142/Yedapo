'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { LogIn, LogOut, Loader2, Shield } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Toast } from '@/components/ui/toast';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { AppearanceSection } from '@/components/settings/sections/AppearanceSection';
import { AccountCard } from '@/components/settings/sections/AccountCard';
import { PlanSummaryCard } from '@/components/settings/sections/PlanSummaryCard';
import { InterestsSection } from '@/components/settings/sections/InterestsSection';
import { RegionSelector } from '@/components/settings/sections/RegionSelector';
import { DangerZone } from '@/components/settings/sections/DangerZone';
import { SectionLabel } from '@/components/settings/sections/SectionLabel';
import type { UserProfile } from '@/components/settings/sections/types';

export default function ProfilePage() {
  const { user, isLoading: authLoading, signOut, setShowAuthModal } = useAuth();
  const isAdmin = useIsAdmin();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  // Single source of truth for profile — fetched once, passed down to sections
  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setIsLoadingProfile(true);
      try {
        const res = await fetch('/api/user/profile');
        if (!res.ok) throw new Error('Failed to load profile');
        const data = await res.json();
        if (!cancelled) setProfile(data.profile);
      } catch {
        if (!cancelled) setErrorToast('Failed to load profile.');
      } finally {
        if (!cancelled) setIsLoadingProfile(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <div className="space-y-8">
      {/* ── APPEARANCE (works for everyone, signed-in or not) ── */}
      <AppearanceSection />

      {/* ── ACCOUNT ── */}
      <section>
        <SectionLabel>Account</SectionLabel>
        {authLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground mt-3">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading...
          </div>
        ) : !user ? (
          <div className="mt-3 rounded-2xl border border-border bg-card p-6 text-center">
            <p className="text-muted-foreground text-sm mb-4">
              Sign up to manage your account and personalize your experience.
            </p>
            <Button onClick={() => setShowAuthModal(true)} className="gap-2">
              <LogIn className="h-4 w-4" /> Sign Up
            </Button>
          </div>
        ) : (
          <div className="mt-3 space-y-6">
            <AccountCard
              profile={profile}
              onProfileChange={setProfile}
              onError={setErrorToast}
            />

            <PlanSummaryCard />

            <InterestsSection
              profile={profile}
              isLoading={isLoadingProfile}
              onProfileChange={setProfile}
              onError={setErrorToast}
            />

            <RegionSelector
              profile={profile}
              onProfileChange={setProfile}
              onError={setErrorToast}
            />

            {/* Sign out */}
            <div className="pt-2 border-t border-border">
              <Button
                variant="ghost"
                onClick={signOut}
                className="gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive px-0"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            </div>

            {/* Danger zone */}
            <DangerZone onError={setErrorToast} />
          </div>
        )}
      </section>

      {/* ── ADMIN ── */}
      {isAdmin && (
        <section>
          <SectionLabel>Administration</SectionLabel>
          <div className="mt-3 rounded-2xl border border-border bg-card p-5">
            <p className="text-muted-foreground text-sm mb-4">
              Access analytics, queue management, and platform controls.
            </p>
            <Button asChild variant="outline" className="gap-2">
              <Link href="/admin/overview">
                <Shield className="h-4 w-4" />
                Open Admin Panel
              </Link>
            </Button>
          </div>
        </section>
      )}

      {/* Error Toast */}
      <Toast open={!!errorToast} onOpenChange={() => setErrorToast(null)} position="top">
        <p className="text-sm text-destructive font-medium">{errorToast}</p>
      </Toast>
    </div>
  );
}
