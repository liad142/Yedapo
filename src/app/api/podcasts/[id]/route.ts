import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { user, error: authError } = await requireAdmin();
    if (authError) return authError;

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "Podcast ID is required" },
        { status: 400 }
      );
    }

    // Use admin client with secret key for delete operations
    const supabase = createAdminClient();

    // First delete all episodes for this podcast
    const { error: episodesError } = await supabase
      .from("episodes")
      .delete()
      .eq("podcast_id", id);

    if (episodesError) {
      console.error("Error deleting episodes:", episodesError);
      return NextResponse.json(
        { error: "Failed to delete episodes", details: episodesError.message },
        { status: 500 }
      );
    }

    // Then delete the podcast
    const { error: podcastError } = await supabase
      .from("podcasts")
      .delete()
      .eq("id", id);

    if (podcastError) {
      console.error("Error deleting podcast:", podcastError);
      return NextResponse.json(
        { error: "Failed to delete podcast", details: podcastError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in podcast DELETE:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "Podcast ID is required" },
        { status: 400 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '100', 10) || 100, 1), 100);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10) || 0, 0);

    // Use admin client for GET as well to ensure consistent permissions
    const supabase = createAdminClient();

    // Fetch podcast details
    const { data: podcast, error: podcastError } = await supabase
      .from("podcasts")
      .select("id, title, author, description, rss_feed_url, image_url, language, created_at")
      .eq("id", id)
      .single();

    if (podcastError) {
      if (podcastError.code === "PGRST116") {
        return NextResponse.json(
          { error: "Podcast not found" },
          { status: 404 }
        );
      }
      console.error("Error fetching podcast:", podcastError);
      return NextResponse.json(
        { error: "Failed to fetch podcast" },
        { status: 500 }
      );
    }

    // Fetch episodes for this podcast, ordered by published_at DESC (paginated)
    const { data: episodes, error: episodesError, count } = await supabase
      .from("episodes")
      .select("id, podcast_id, title, description, audio_url, transcript_url, duration_seconds, published_at, created_at", { count: 'exact' })
      .eq("podcast_id", id)
      .order("published_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (episodesError) {
      console.error("Error fetching episodes:", episodesError);
      return NextResponse.json(
        { error: "Failed to fetch episodes" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      podcast,
      episodes: episodes || [],
      total: count ?? 0,
      limit,
      offset,
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' },
    });
  } catch (error) {
    console.error("Error in podcast GET:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
