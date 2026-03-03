import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { createAdminClient } from '@/lib/supabase/admin';
import type { UserAnalytics } from '@/types/admin';

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const admin = createAdminClient();

  const [
    { data: profiles, count: totalUsers },
    { data: recentUsers },
  ] = await Promise.all([
    admin.from('user_profiles').select('created_at, preferred_genres, preferred_country, onboarding_completed, plan', { count: 'exact' }),
    admin.from('user_profiles').select('id, display_name, created_at, onboarding_completed, plan').order('created_at', { ascending: false }).limit(10),
  ]);

  // Limit profiles to prevent unbounded queries
  const allProfiles = (profiles ?? []).slice(0, 1000);
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Signups this week
  const usersThisWeek = allProfiles.filter(p => new Date(p.created_at) >= weekAgo).length;

  // Onboarding rate
  const onboardedCount = allProfiles.filter(p => p.onboarding_completed).length;
  const onboardingRate = (totalUsers ?? 0) > 0 ? Math.round((onboardedCount / (totalUsers ?? 1)) * 100) : 0;

  // Signups over time
  const signupsByDay: Record<string, number> = {};
  allProfiles.forEach(p => {
    const day = p.created_at.split('T')[0];
    signupsByDay[day] = (signupsByDay[day] || 0) + 1;
  });
  const signupsOverTime = Object.entries(signupsByDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date, value }));

  // Genre distribution
  const genreCounts: Record<string, number> = {};
  allProfiles.forEach(p => {
    const genres = p.preferred_genres as string[] | null;
    if (genres) {
      genres.forEach(g => {
        genreCounts[g] = (genreCounts[g] || 0) + 1;
      });
    }
  });
  const genreDistribution = Object.entries(genreCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([label, count]) => ({ label, count }));

  // Country distribution
  const countryCounts: Record<string, number> = {};
  allProfiles.forEach(p => {
    const country = (p.preferred_country as string) || 'Not set';
    countryCounts[country] = (countryCounts[country] || 0) + 1;
  });
  const countryDistribution = Object.entries(countryCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([label, count]) => ({ label, count }));

  // Plan distribution
  const planCounts: Record<string, number> = {};
  allProfiles.forEach(p => {
    const plan = (p.plan as string) || 'free';
    planCounts[plan] = (planCounts[plan] || 0) + 1;
  });
  const planDistribution = Object.entries(planCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([label, count]) => ({ label, count }));

  const data: UserAnalytics = {
    totalUsers: totalUsers ?? 0,
    usersThisWeek,
    onboardingRate,
    signupsOverTime,
    genreDistribution,
    countryDistribution,
    planDistribution,
    recentUsers: (recentUsers ?? []).map(u => ({
      id: u.id,
      email: '',
      display_name: u.display_name,
      created_at: u.created_at,
      onboarding_completed: u.onboarding_completed ?? false,
      plan: (u.plan as string) || 'free',
    })),
  };

  return NextResponse.json(data);
}
