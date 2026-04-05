/**
 * Delivery scheduling helpers for notification digests.
 * Reads user preferences from user_profiles and computes when the next
 * digest should be delivered (in user's timezone).
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { createLogger } from '@/lib/logger';

const log = createLogger('notify-schedule');

export type NotifyFrequency = 'immediate' | 'digest_daily' | 'digest_weekly' | 'off';

export interface UserDeliveryPrefs {
  frequency: NotifyFrequency;
  digestHour: number;
  timezone: string;
  dailyCap: number;
}

const DEFAULT_PREFS: UserDeliveryPrefs = {
  frequency: 'immediate',
  digestHour: 8,
  timezone: 'UTC',
  dailyCap: 10,
};

/**
 * Fetch user's delivery preferences from user_profiles.
 * Falls back to sensible defaults if row missing or Supabase errors.
 */
export async function getUserDeliveryPrefs(userId: string): Promise<UserDeliveryPrefs> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('user_profiles')
    .select('notify_frequency, notify_digest_hour, notify_timezone, notify_daily_cap')
    .eq('id', userId)
    .single();

  if (error || !data) {
    log.warn('Could not load user prefs, using defaults', { userId: userId.slice(0, 8) });
    return DEFAULT_PREFS;
  }

  return {
    frequency: (data.notify_frequency as NotifyFrequency) ?? DEFAULT_PREFS.frequency,
    digestHour: data.notify_digest_hour ?? DEFAULT_PREFS.digestHour,
    timezone: data.notify_timezone ?? DEFAULT_PREFS.timezone,
    dailyCap: data.notify_daily_cap ?? DEFAULT_PREFS.dailyCap,
  };
}

/**
 * Compute the next digest delivery time for a user.
 * For daily: next occurrence of digestHour:00 in user's timezone.
 * For weekly: next Monday at digestHour:00 in user's timezone.
 *
 * Returns a UTC Date object (which is what Postgres TIMESTAMPTZ expects).
 */
export function computeNextDigestTime(
  frequency: NotifyFrequency,
  digestHour: number,
  timezone: string,
  from: Date = new Date()
): Date {
  if (frequency !== 'digest_daily' && frequency !== 'digest_weekly') {
    throw new Error(`computeNextDigestTime called with non-digest frequency: ${frequency}`);
  }

  // Get current wall-clock time in user's timezone using Intl
  const userTzFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    weekday: 'short',
  });

  const parts = userTzFormatter.formatToParts(from);
  const year = parseInt(parts.find((p) => p.type === 'year')!.value, 10);
  const month = parseInt(parts.find((p) => p.type === 'month')!.value, 10);
  const day = parseInt(parts.find((p) => p.type === 'day')!.value, 10);
  const hour = parseInt(parts.find((p) => p.type === 'hour')!.value, 10);
  const weekdayStr = parts.find((p) => p.type === 'weekday')!.value;
  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  const weekday = weekdayMap[weekdayStr] ?? 0;

  // Build target day (in user's local time)
  let targetYear = year;
  let targetMonth = month;
  let targetDay = day;

  if (frequency === 'digest_daily') {
    // If current hour already passed digestHour today, schedule for tomorrow.
    if (hour >= digestHour) {
      // Advance one day
      const tomorrow = new Date(Date.UTC(year, month - 1, day) + 86400000);
      targetYear = tomorrow.getUTCFullYear();
      targetMonth = tomorrow.getUTCMonth() + 1;
      targetDay = tomorrow.getUTCDate();
    }
  } else {
    // weekly: target next Monday (weekday=1)
    const daysUntilMonday = (1 - weekday + 7) % 7 || 7; // 7 if today IS monday (skip to next)
    const sameDayButTooLate = weekday === 1 && hour >= digestHour;
    const daysToAdd = sameDayButTooLate ? 7 : daysUntilMonday === 0 ? 7 : daysUntilMonday;
    const target = new Date(Date.UTC(year, month - 1, day) + daysToAdd * 86400000);
    targetYear = target.getUTCFullYear();
    targetMonth = target.getUTCMonth() + 1;
    targetDay = target.getUTCDate();
  }

  // Now convert "targetYear-targetMonth-targetDay digestHour:00 in timezone" to UTC.
  // Strategy: iterate — guess UTC, format in user TZ, adjust offset.
  // Simpler approach: construct a string and parse via Date + offset math.

  // Build ISO string representing the LOCAL time in user's tz
  const mm = String(targetMonth).padStart(2, '0');
  const dd = String(targetDay).padStart(2, '0');
  const hh = String(digestHour).padStart(2, '0');
  const localIso = `${targetYear}-${mm}-${dd}T${hh}:00:00`;

  // Find the UTC offset for the target timezone at that moment.
  // We use a trick: format the same Date in both UTC and the target TZ,
  // then compute the difference.
  const probeDate = new Date(`${localIso}Z`); // Treat as UTC first (wrong, but close)
  const tzOffset = getTzOffsetMinutes(probeDate, timezone);

  // Correct the probe by subtracting the timezone's offset
  const correctedMs = probeDate.getTime() - tzOffset * 60_000;
  return new Date(correctedMs);
}

/**
 * Returns the offset in minutes (positive for east of UTC) of a timezone
 * at a specific moment. E.g., Asia/Jerusalem in summer = 180 (+03:00).
 */
function getTzOffsetMinutes(date: Date, timezone: string): number {
  const tzFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = tzFormatter.formatToParts(date);
  const y = parseInt(parts.find((p) => p.type === 'year')!.value, 10);
  const m = parseInt(parts.find((p) => p.type === 'month')!.value, 10);
  const d = parseInt(parts.find((p) => p.type === 'day')!.value, 10);
  const h = parseInt(parts.find((p) => p.type === 'hour')!.value, 10);
  const min = parseInt(parts.find((p) => p.type === 'minute')!.value, 10);
  const s = parseInt(parts.find((p) => p.type === 'second')!.value, 10);

  // Reconstruct as UTC to compare
  const asUtc = Date.UTC(y, m - 1, d, h, min, s);
  return (asUtc - date.getTime()) / 60_000;
}

/**
 * Should the notification be sent immediately, or deferred to digest?
 * Returns a plan: { scheduled: boolean, nextRetryAt: Date | null }
 */
export function planDelivery(
  prefs: UserDeliveryPrefs
): { send: boolean; scheduled: boolean; nextRetryAt: Date | null } {
  if (prefs.frequency === 'off') {
    return { send: false, scheduled: false, nextRetryAt: null };
  }
  if (prefs.frequency === 'immediate') {
    return { send: true, scheduled: false, nextRetryAt: null };
  }
  // digest_daily or digest_weekly
  const nextTime = computeNextDigestTime(prefs.frequency, prefs.digestHour, prefs.timezone);
  return { send: true, scheduled: true, nextRetryAt: nextTime };
}
