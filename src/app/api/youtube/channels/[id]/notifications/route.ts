import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthUser } from '@/lib/auth-helpers';

// PATCH: Update notification preferences for a YouTube channel follow
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: channelDbId } = await params;

  try {
    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    if (typeof body.notifyEnabled === 'boolean') {
      updateData.notify_enabled = body.notifyEnabled;
    }
    if (Array.isArray(body.notifyChannels)) {
      const VALID_CHANNELS = ['email', 'telegram', 'in_app', 'in-app', 'whatsapp'];
      if (!body.notifyChannels.every((c: string) => VALID_CHANNELS.includes(c))) {
        return NextResponse.json({ error: 'Invalid notification channel' }, { status: 400 });
      }
      updateData.notify_channels = body.notifyChannels;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ message: 'Nothing to update' });
    }

    const { error } = await createAdminClient()
      .from('youtube_channel_follows')
      .update(updateData)
      .eq('user_id', user.id)
      .eq('channel_id', channelDbId);

    if (error) throw error;

    return NextResponse.json({ message: 'Updated successfully' });
  } catch (error) {
    console.error('Error updating YouTube notification preferences:', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}
