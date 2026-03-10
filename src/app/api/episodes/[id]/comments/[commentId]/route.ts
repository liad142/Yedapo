import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthUser } from '@/lib/auth-helpers';
import { checkRateLimit } from '@/lib/cache';
import { createLogger } from '@/lib/logger';

const log = createLogger('comments');

interface RouteParams {
  params: Promise<{ id: string; commentId: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rlAllowed = await checkRateLimit(`comment-edit:${user.id}`, 20, 60);
  if (!rlAllowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const { id: episodeId, commentId } = await params;

  try {
    const { body } = await request.json();
    const trimmed = (body || '').trim();
    if (!trimmed || trimmed.length > 2000) {
      return NextResponse.json({ error: 'Comment must be 1-2000 characters' }, { status: 400 });
    }

    const admin = createAdminClient();

    // Verify ownership
    const { data: existing } = await admin
      .from('episode_comments')
      .select('id, user_id, episode_id')
      .eq('id', commentId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }
    if (existing.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (existing.episode_id !== episodeId) {
      return NextResponse.json({ error: 'Comment does not belong to this episode' }, { status: 400 });
    }

    const { data: updated, error } = await admin
      .from('episode_comments')
      .update({ body: trimmed, edited_at: new Date().toISOString() })
      .eq('id', commentId)
      .select(`
        id, episode_id, user_id, parent_id, body, edited_at, created_at, updated_at,
        user_profiles (id, display_name, avatar_url)
      `)
      .single();

    if (error) throw error;

    const result = {
      ...updated,
      author: (updated as any).user_profiles || { id: user.id, display_name: null, avatar_url: null },
    };
    delete (result as any).user_profiles;

    log.info('Comment edited', { commentId });

    return NextResponse.json({ comment: result });
  } catch (error) {
    log.error('PATCH comment error', error);
    return NextResponse.json({ error: 'Failed to update comment' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: episodeId, commentId } = await params;

  try {
    const admin = createAdminClient();

    const { data: existing } = await admin
      .from('episode_comments')
      .select('id, user_id, episode_id')
      .eq('id', commentId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }
    if (existing.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (existing.episode_id !== episodeId) {
      return NextResponse.json({ error: 'Comment does not belong to this episode' }, { status: 400 });
    }

    const { error } = await admin
      .from('episode_comments')
      .delete()
      .eq('id', commentId);

    if (error) throw error;

    log.info('Comment deleted', { commentId });

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error('DELETE comment error', error);
    return NextResponse.json({ error: 'Failed to delete comment' }, { status: 500 });
  }
}
