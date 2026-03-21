import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id: episodeId } = await params;

    if (!episodeId) {
      return NextResponse.json({ error: "Episode ID is required" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 1. Get current episode's quick summary tags
    const { data: currentSummary } = await supabase
      .from("summaries")
      .select("content_json")
      .eq("episode_id", episodeId)
      .eq("level", "quick")
      .eq("status", "ready")
      .single();

    if (!currentSummary?.content_json) {
      return NextResponse.json({ related: [] });
    }

    const content = currentSummary.content_json as Record<string, unknown>;
    const tags = content.tags as string[] | undefined;
    if (!tags || tags.length === 0) {
      return NextResponse.json({ related: [] });
    }

    // 2. Fetch recent ready quick summaries and filter by tag overlap in JS
    const { data: candidateSummaries } = await supabase
      .from("summaries")
      .select("episode_id, content_json")
      .eq("level", "quick")
      .eq("status", "ready")
      .neq("episode_id", episodeId)
      .order("updated_at", { ascending: false })
      .limit(100);

    if (!candidateSummaries || candidateSummaries.length === 0) {
      return NextResponse.json({ related: [] });
    }

    // 3. Score by tag overlap count, pick top 3
    const tagSet = new Set(tags.map(t => t.toLowerCase()));
    const scored = candidateSummaries
      .map(s => {
        const c = s.content_json as Record<string, unknown> | null;
        const sTags = (c?.tags as string[] | undefined) || [];
        const overlap = sTags.filter(t => tagSet.has(t.toLowerCase())).length;
        return { episodeId: s.episode_id, overlap };
      })
      .filter(s => s.overlap > 0)
      .sort((a, b) => b.overlap - a.overlap)
      .slice(0, 3);

    if (scored.length === 0) {
      return NextResponse.json({ related: [] });
    }

    // 4. Fetch episode + podcast data
    const episodeIds = scored.map(s => s.episodeId);
    const { data: episodes } = await supabase
      .from("episodes")
      .select("id, title, audio_url, published_at, duration_seconds, podcast_id, podcasts(id, title, image_url, author, rss_feed_url, apple_id)")
      .in("id", episodeIds);

    if (!episodes || episodes.length === 0) {
      return NextResponse.json({ related: [] });
    }

    // 5. Check which episodes have deep summaries ready
    const { data: deepSummaries } = await supabase
      .from("summaries")
      .select("episode_id, status")
      .eq("level", "deep")
      .in("episode_id", episodeIds);

    const deepStatusMap = new Map(
      (deepSummaries || []).map(s => [s.episode_id, s.status])
    );

    // 6. Build response in overlap-score order
    const episodeMap = new Map(episodes.map(e => [e.id, e]));
    const related = scored
      .map(s => {
        const ep = episodeMap.get(s.episodeId);
        if (!ep) return null;
        const podcast = (ep as Record<string, unknown>).podcasts as Record<string, unknown> | null;
        return {
          episodeId: ep.id,
          title: ep.title,
          audioUrl: ep.audio_url,
          publishedAt: ep.published_at,
          podcastName: (podcast?.title as string) || "Unknown",
          podcastArtwork: (podcast?.image_url as string) || "",
          podcastRssFeedUrl: (podcast?.rss_feed_url as string) || "",
          hasDeepSummary: deepStatusMap.get(s.episodeId) === "ready",
        };
      })
      .filter(Boolean);

    return NextResponse.json({ related }, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200" },
    });
  } catch (error) {
    console.error("Error fetching related episodes:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
