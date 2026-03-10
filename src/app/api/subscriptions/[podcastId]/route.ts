import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { getAuthUser } from '@/lib/auth-helpers';

// DELETE: Unsubscribe from a podcast
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ podcastId: string }> }
) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { podcastId } = await params;

  try {
    const { error } = await createAdminClient()
      .from('podcast_subscriptions')
      .delete()
      .eq('user_id', user.id)
      .eq('podcast_id', podcastId);

    if (error) throw error;

    return NextResponse.json({ message: 'Unsubscribed successfully' });
  } catch (error) {
    console.error('Error unsubscribing:', error);
    return NextResponse.json({ error: 'Failed to unsubscribe' }, { status: 500 });
  }
}

// PATCH: Update last_viewed_at and/or notification preferences
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ podcastId: string }> }
) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { podcastId } = await params;

  try {
    const body = await request.json().catch(() => ({}));

    const updateData: Record<string, unknown> = {};

    // Default behavior: update last_viewed_at unless explicitly skipped
    if (body.updateLastViewed !== false) {
      updateData.last_viewed_at = new Date().toISOString();
    }

    // Notification preferences
    if (typeof body.notifyEnabled === 'boolean') {
      updateData.notify_enabled = body.notifyEnabled;
    }
    if (Array.isArray(body.notifyChannels)) {
      updateData.notify_channels = body.notifyChannels;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ message: 'Nothing to update' });
    }

    const { error } = await createAdminClient()
      .from('podcast_subscriptions')
      .update(updateData)
      .eq('user_id', user.id)
      .eq('podcast_id', podcastId);

    if (error) throw error;

    return NextResponse.json({ message: 'Updated successfully' });
  } catch (error) {
    console.error('Error updating subscription:', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}
