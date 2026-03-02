import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-helpers';
import { fetchUserSubscriptions } from '@/lib/youtube/api';
import { createLogger } from '@/lib/logger';

const log = createLogger('youtube');

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    log.info('Fetching subscriptions', { userId: user.id.slice(0, 8) });
    const subscriptions = await fetchUserSubscriptions(user.id);
    log.success('Found subscriptions', { count: subscriptions.length });
    return NextResponse.json({ subscriptions });
  } catch (err) {
    log.error('Error fetching subscriptions', err);
    return NextResponse.json({ subscriptions: [] });
  }
}
