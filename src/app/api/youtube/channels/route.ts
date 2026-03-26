/**
 * GET /api/youtube/channels
 * Get all channels followed by user
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFollowedChannels } from '@/lib/rsshub-db';
import { getAuthUser } from '@/lib/auth-helpers';

export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const channels = await getFollowedChannels(user.id);

    return NextResponse.json({
      success: true,
      channels,
      total: channels.length,
    }, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    console.error('Get channels error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to get channels',
      },
      { status: 500 }
    );
  }
}
