import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-helpers';
import { getQuotaUsage } from '@/lib/cache';
import { getUserPlan } from '@/lib/user-plan';
import { PLAN_LIMITS } from '@/lib/plans';
import { getResetTimestamp } from '@/lib/time-utils';

export async function GET() {
  const user = await getAuthUser();

  if (!user) {
    // Guest: return free-tier limits with zero usage
    const limits = PLAN_LIMITS.free;
    return NextResponse.json({
      plan: 'free',
      summary: { used: 0, limit: limits.summariesPerDay },
      askAi: { used: 0, limit: limits.askAiPerDay },
      resetsAt: getResetTimestamp(),
    }, {
      headers: { 'Cache-Control': 'private, no-cache' },
    });
  }

  const [summaryUsed, askAiUsed, plan] = await Promise.all([
    getQuotaUsage(user.id, 'summary'),
    getQuotaUsage(user.id, 'askai'),
    getUserPlan(user.id, user.email ?? undefined),
  ]);

  const limits = PLAN_LIMITS[plan];

  return NextResponse.json({
    plan,
    summary: {
      used: summaryUsed,
      limit: limits.summariesPerDay === Infinity ? -1 : limits.summariesPerDay,
    },
    askAi: {
      used: askAiUsed,
      limit: limits.askAiPerDay === Infinity ? -1 : limits.askAiPerDay,
    },
    resetsAt: getResetTimestamp(),
  }, {
    headers: { 'Cache-Control': 'private, no-cache' },
  });
}
