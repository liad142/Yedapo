import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { Redis } from '@upstash/redis';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const monitoringSecret = process.env.MONITORING_SECRET;
  const authHeader = request.headers.get('authorization');
  const isMonitor = monitoringSecret && authHeader === `Bearer ${monitoringSecret}`;

  const checks: Record<string, { status: string; latencyMs?: number }> = {};
  let overallStatus: 'ok' | 'degraded' | 'down' = 'ok';

  // Check Redis
  try {
    const start = Date.now();
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
    await redis.ping();
    checks.redis = { status: 'ok', latencyMs: Date.now() - start };
  } catch {
    checks.redis = { status: 'down' };
    overallStatus = 'degraded';
  }

  // Check Supabase
  try {
    const start = Date.now();
    const supabase = createAdminClient();
    const { error } = await supabase.from('podcasts').select('id').limit(1);
    if (error) throw error;
    checks.supabase = { status: 'ok', latencyMs: Date.now() - start };
  } catch {
    checks.supabase = { status: 'down' };
    overallStatus = 'degraded';
  }

  // Check required env vars
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'UPSTASH_REDIS_REST_URL',
    'UPSTASH_REDIS_REST_TOKEN',
    'GOOGLE_GEMINI_API_KEY',
  ];
  const missingEnvVars = requiredEnvVars.filter(v => !process.env[v]);
  checks.env = {
    status: missingEnvVars.length === 0 ? 'ok' : 'down',
  };
  if (missingEnvVars.length > 0) overallStatus = 'down';

  if (checks.redis.status === 'down' && checks.supabase.status === 'down') {
    overallStatus = 'down';
  }

  const httpStatus = overallStatus === 'ok' ? 200 : 503;

  // Non-monitor callers only get the overall status — no internal details
  if (!isMonitor) {
    return NextResponse.json({ status: overallStatus }, { status: httpStatus });
  }

  return NextResponse.json(
    { status: overallStatus, checks },
    { status: httpStatus }
  );
}
