import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthUser } from '@/lib/auth-helpers';
import { checkRateLimit } from '@/lib/cache';
import { createLogger } from '@/lib/logger';

const log = createLogger('comments');

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id: episodeId } = await params;
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10) || 50, 1), 200);
  const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10) || 0, 0);

  try {
    const admin = createAdminClient();

    // Fetch top-level comments with author profiles
    const { data: comments, error, count } = await admin
      .from('episode_comments')
      .select(`
        id, episode_id, user_id, parent_id, body, edited_at, created_at, updated_at,
        user_profiles (id, display_name, avatar_url)
      `, { count: 'exact' })
      .eq('episode_id', episodeId)
      .is('parent_id', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    // Fetch replies for returned top-level comments
    const commentIds = (comments || []).map((c: any) => c.id);
    const repliesMap: Record<string, any[]> = {};

    if (commentIds.length > 0) {
      const { data: replies } = await admin
        .from('episode_comments')
        .select(`
          id, episode_id, user_id, parent_id, body, edited_at, created_at, updated_at,
          user_profiles (id, display_name, avatar_url)
        `)
        .in('parent_id', commentIds)
        .order('created_at', { ascending: true })
        .limit(500);

      for (const reply of (replies || [])) {
        const pid = reply.parent_id as string;
        if (!repliesMap[pid]) repliesMap[pid] = [];
        repliesMap[pid].push({
          ...reply,
          author: (reply as any).user_profiles || { id: reply.user_id, display_name: null, avatar_url: null },
          replies: [],
        });
      }
    }

    // Assemble response with nested replies
    const result = (comments || []).map((c: any) => ({
      ...c,
      author: c.user_profiles || { id: c.user_id, display_name: null, avatar_url: null },
      replies: repliesMap[c.id] || [],
    }));

    // Remove the raw user_profiles join field from response
    for (const comment of result) {
      delete comment.user_profiles;
      for (const reply of comment.replies) {
        delete reply.user_profiles;
      }
    }

    return NextResponse.json({
      comments: result,
      total: count ?? 0,
      limit,
      offset,
    });
  } catch (error) {
    log.error('GET comments error', error);
    return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rlAllowed = await checkRateLimit(`comment:${user.id}`, 10, 60);
  if (!rlAllowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const { id: episodeId } = await params;

  try {
    const { body, parentId } = await request.json();

    const trimmed = (body || '').trim();
    if (!trimmed || trimmed.length > 2000) {
      return NextResponse.json({ error: 'Comment must be 1-2000 characters' }, { status: 400 });
    }

    // Strip HTML tags to prevent stored XSS
    const sanitized = trimmed.replace(/<[^>]*>/g, '');
    if (!sanitized) {
      return NextResponse.json({ error: 'Comment must be 1-2000 characters' }, { status: 400 });
    }

    const admin = createAdminClient();

    // If replying, validate parent exists and is top-level
    if (parentId) {
      const { data: parent, error: parentErr } = await admin
        .from('episode_comments')
        .select('id, episode_id, parent_id')
        .eq('id', parentId)
        .single();

      if (parentErr || !parent) {
        return NextResponse.json({ error: 'Parent comment not found' }, { status: 404 });
      }
      if (parent.episode_id !== episodeId) {
        return NextResponse.json({ error: 'Parent comment belongs to different episode' }, { status: 400 });
      }
      if (parent.parent_id !== null) {
        return NextResponse.json({ error: 'Cannot reply to a reply' }, { status: 400 });
      }
    }

    const { data: comment, error } = await admin
      .from('episode_comments')
      .insert({
        episode_id: episodeId,
        user_id: user.id,
        parent_id: parentId || null,
        body: sanitized,
      })
      .select(`
        id, episode_id, user_id, parent_id, body, edited_at, created_at, updated_at,
        user_profiles (id, display_name, avatar_url)
      `)
      .single();

    if (error) throw error;

    const result = {
      ...comment,
      author: (comment as any).user_profiles || { id: user.id, display_name: null, avatar_url: null },
      replies: [],
    };
    delete (result as any).user_profiles;

    log.info('Comment created', { episodeId, commentId: result.id, parentId: parentId || null });

    return NextResponse.json({ comment: result }, { status: 201 });
  } catch (error) {
    log.error('POST comment error', error);
    return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 });
  }
}
