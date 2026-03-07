import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-helpers';
import { getFollowedChannels } from '@/lib/rsshub-db';

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const channels = await getFollowedChannels(user.id);
    return NextResponse.json({ channels });
  } catch (error) {
    console.error('Error fetching followed channels:', error);
    return NextResponse.json(
      { error: 'Failed to fetch followed channels' },
      { status: 500 }
    );
  }
}
