/**
 * POST /api/youtube/save
 * Save/unsave a YouTube video
 * Uses the feed_items table with bookmarked field
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthUser } from '@/lib/auth-helpers';

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      videoId,
      title,
      description,
      thumbnailUrl,
      publishedAt,
      channelName,
      url,
      action = 'toggle'
    } = body;

    if (!videoId) {
      return NextResponse.json(
        { error: 'Missing videoId' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Check if item already exists
    const { data: existingItem, error: fetchError } = await supabase
      .from('feed_items')
      .select('id, bookmarked')
      .eq('user_id', user.id)
      .eq('video_id', videoId)
      .eq('source_type', 'youtube')
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw new Error(`Database error: ${fetchError.message}`);
    }

    let newBookmarkedState: boolean;
    let feedItemId: string;

    if (existingItem) {
      if (action === 'toggle') {
        newBookmarkedState = !existingItem.bookmarked;
      } else if (action === 'save') {
        newBookmarkedState = true;
      } else {
        newBookmarkedState = false;
      }

      const { error: updateError } = await supabase
        .from('feed_items')
        .update({
          bookmarked: newBookmarkedState,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingItem.id);

      if (updateError) {
        throw new Error(`Failed to update bookmark: ${updateError.message}`);
      }

      feedItemId = existingItem.id;
    } else {
      newBookmarkedState = action !== 'unsave';

      const { data: newItem, error: insertError } = await supabase
        .from('feed_items')
        .insert({
          user_id: user.id,
          source_type: 'youtube',
          source_id: '00000000-0000-0000-0000-000000000000',
          video_id: videoId,
          title: title || 'YouTube Video',
          description: description || '',
          thumbnail_url: thumbnailUrl,
          published_at: publishedAt || new Date().toISOString(),
          url: url || `https://youtube.com/watch?v=${videoId}`,
          bookmarked: newBookmarkedState,
        })
        .select('id')
        .single();

      if (insertError) {
        if (insertError.code === '23505') {
          const { data: refetchedItem } = await supabase
            .from('feed_items')
            .select('id, bookmarked')
            .eq('user_id', user.id)
            .eq('video_id', videoId)
            .eq('source_type', 'youtube')
            .single();

          if (refetchedItem) {
            feedItemId = refetchedItem.id;
            newBookmarkedState = refetchedItem.bookmarked;
          } else {
            throw new Error('Failed to save video');
          }
        } else {
          throw new Error(`Failed to save video: ${insertError.message}`);
        }
      } else {
        feedItemId = newItem?.id || '';
      }
    }

    return NextResponse.json({
      success: true,
      bookmarked: newBookmarkedState,
      feedItemId,
      videoId,
    });
  } catch (error) {
    console.error('Save video error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to save video',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/youtube/save
 * Get all saved YouTube videos for a user
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const supabase = createAdminClient();

    const { data, error, count } = await supabase
      .from('feed_items')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .eq('source_type', 'youtube')
      .eq('bookmarked', true)
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to fetch saved videos: ${error.message}`);
    }

    const videos = (data || []).map(item => ({
      id: item.id,
      videoId: item.video_id,
      title: item.title,
      description: item.description,
      thumbnailUrl: item.thumbnail_url,
      publishedAt: item.published_at,
      url: item.url,
      bookmarked: item.bookmarked,
      savedAt: item.updated_at,
    }));

    return NextResponse.json({
      success: true,
      videos,
      total: count || 0,
      hasMore: (count || 0) > offset + limit,
    });
  } catch (error) {
    console.error('Get saved videos error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch saved videos',
      },
      { status: 500 }
    );
  }
}
