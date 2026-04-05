/**
 * User delivery preferences (frequency, digest time, timezone, daily cap).
 * Controls HOW notifications are batched + delivered, separate from WHICH
 * subscriptions trigger them (those are per-subscription notify_enabled toggles).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-helpers';
import { createAdminClient } from '@/lib/supabase/admin';
import { createLogger } from '@/lib/logger';

const log = createLogger('delivery-prefs');

const VALID_FREQUENCIES = ['immediate', 'digest_daily', 'digest_weekly', 'off'] as const;
type Frequency = typeof VALID_FREQUENCIES[number];

function isValidTimezone(tz: string): boolean {
  try {
    // Validate via Intl — throws if IANA tz identifier is invalid
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('user_profiles')
    .select('notify_frequency, notify_digest_hour, notify_timezone, notify_daily_cap')
    .eq('id', user.id)
    .single();

  if (error) {
    log.error('Failed to load delivery preferences', { userId: user.id, error: error.message });
    return NextResponse.json({ error: 'Failed to load preferences' }, { status: 500 });
  }

  return NextResponse.json({
    frequency: data?.notify_frequency ?? 'immediate',
    digestHour: data?.notify_digest_hour ?? 8,
    timezone: data?.notify_timezone ?? 'UTC',
    dailyCap: data?.notify_daily_cap ?? 10,
  });
}

export async function PATCH(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { frequency?: string; digestHour?: number; timezone?: string; dailyCap?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};

  if (body.frequency !== undefined) {
    if (!VALID_FREQUENCIES.includes(body.frequency as Frequency)) {
      return NextResponse.json(
        { error: `frequency must be one of: ${VALID_FREQUENCIES.join(', ')}` },
        { status: 400 }
      );
    }
    updates.notify_frequency = body.frequency;
  }

  if (body.digestHour !== undefined) {
    if (!Number.isInteger(body.digestHour) || body.digestHour < 0 || body.digestHour > 23) {
      return NextResponse.json({ error: 'digestHour must be an integer 0-23' }, { status: 400 });
    }
    updates.notify_digest_hour = body.digestHour;
  }

  if (body.timezone !== undefined) {
    if (typeof body.timezone !== 'string' || !isValidTimezone(body.timezone)) {
      return NextResponse.json({ error: 'timezone must be a valid IANA identifier' }, { status: 400 });
    }
    updates.notify_timezone = body.timezone;
  }

  if (body.dailyCap !== undefined) {
    if (!Number.isInteger(body.dailyCap) || body.dailyCap < 1 || body.dailyCap > 100) {
      return NextResponse.json({ error: 'dailyCap must be an integer 1-100' }, { status: 400 });
    }
    updates.notify_daily_cap = body.dailyCap;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('user_profiles')
    .update(updates)
    .eq('id', user.id);

  if (error) {
    log.error('Failed to update delivery preferences', { userId: user.id, error: error.message });
    return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
