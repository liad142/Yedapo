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

    // 1. Get current episode's tags from quick summary or deep summary core_concepts
    const { data: currentSummaries } = await supabase
      .from("summaries")
      .select("level, content_json")
      .eq("episode_id", episodeId)
      .eq("status", "ready")
      .in("level", ["quick", "deep"]);

    if (!currentSummaries || currentSummaries.length === 0) {
      return NextResponse.json({ related: [] });
    }

    let tags: string[] = [];
    const quickSummary = currentSummaries.find(s => s.level === "quick");
    const deepSummary = currentSummaries.find(s => s.level === "deep");

    // Priority: deep topic_tags (fixed taxonomy) > quick tags > deep core_concepts
    if (deepSummary?.content_json) {
      const content = deepSummary.content_json as Record<string, unknown>;
      const topicTags = content.topic_tags as string[] | undefined;
      if (topicTags && topicTags.length > 0) tags = topicTags;
      if (tags.length === 0) {
        const coreConcepts = content.core_concepts as Array<{ concept: string }> | undefined;
        if (coreConcepts) tags = coreConcepts.map(c => c.concept);
      }
    }
    if (tags.length === 0 && quickSummary?.content_json) {
      const content = quickSummary.content_json as Record<string, unknown>;
      tags = (content.tags as string[]) || [];
    }

    if (tags.length === 0) {
      return NextResponse.json({ related: [] });
    }

    // 2. Fetch recent ready summaries (quick + deep) and filter by tag overlap
    const { data: candidateSummaries } = await supabase
      .from("summaries")
      .select("episode_id, level, content_json")
      .eq("status", "ready")
      .in("level", ["quick", "deep"])
      .neq("episode_id", episodeId)
      .order("updated_at", { ascending: false })
      .limit(100);

    if (!candidateSummaries || candidateSummaries.length === 0) {
      return NextResponse.json({ related: [] });
    }

    // Build per-episode tag list: prefer deep topic_tags > quick tags > deep core_concepts
    const episodeTagMap = new Map<string, string[]>();
    for (const s of candidateSummaries) {
      const c = s.content_json as Record<string, unknown> | null;
      if (!c) continue;
      const existing = episodeTagMap.get(s.episode_id);
      if (s.level === "deep") {
        const topicTags = c.topic_tags as string[] | undefined;
        if (topicTags && topicTags.length > 0) {
          episodeTagMap.set(s.episode_id, topicTags); // Best: fixed taxonomy tags
        } else if (!existing) {
          const coreConcepts = c.core_concepts as Array<{ concept: string }> | undefined;
          if (coreConcepts) episodeTagMap.set(s.episode_id, coreConcepts.map(cc => cc.concept));
        }
      } else if (s.level === "quick" && !existing) {
        const qTags = (c.tags as string[]) || [];
        if (qTags.length > 0) episodeTagMap.set(s.episode_id, qTags);
      }
    }

    // 3. Score by tag overlap — match exact tags AND individual words within multi-word concepts
    const tagSet = new Set(tags.map(t => t.toLowerCase()));
    // Also extract individual significant words (3+ chars) for fuzzy matching
    const wordSet = new Set<string>();
    for (const tag of tags) {
      for (const word of tag.toLowerCase().split(/[\s\-\/,]+/)) {
        if (word.length >= 3) wordSet.add(word);
      }
    }

    const scored = Array.from(episodeTagMap.entries())
      .map(([epId, sTags]) => {
        let score = 0;
        const matchedTags: string[] = [];

        for (const sTag of sTags) {
          const sLower = sTag.toLowerCase();
          // Exact match = 3 points
          if (tagSet.has(sLower)) {
            score += 3;
            matchedTags.push(sTag);
          } else {
            // Word-level match = 1 point per shared word
            const sWords = sLower.split(/[\s\-\/,]+/).filter(w => w.length >= 3);
            const wordMatches = sWords.filter(w => wordSet.has(w));
            if (wordMatches.length > 0) {
              score += wordMatches.length;
              if (matchedTags.length < 2) matchedTags.push(sTag);
            }
          }
        }

        return { episodeId: epId, overlap: score, sharedTags: matchedTags.slice(0, 2) };
      })
      .filter(s => s.overlap > 0)
      .sort((a, b) => b.overlap - a.overlap);

    if (scored.length === 0) {
      return NextResponse.json({ related: [] });
    }

    // 4. Fetch episode + podcast data (fetch extra to allow dedup filtering)
    const candidateIds = scored.map(s => s.episodeId);
    const { data: episodes } = await supabase
      .from("episodes")
      .select("id, title, audio_url, published_at, duration_seconds, description, podcast_id, podcasts(id, title, image_url, author, rss_feed_url, apple_id)")
      .in("id", candidateIds);

    if (!episodes || episodes.length === 0) {
      return NextResponse.json({ related: [] });
    }

    // 5. Check which episodes have deep summaries ready
    const { data: deepSummaries } = await supabase
      .from("summaries")
      .select("episode_id, status")
      .eq("level", "deep")
      .in("episode_id", candidateIds);

    const deepStatusMap = new Map(
      (deepSummaries || []).map(s => [s.episode_id, s.status])
    );

    // 6. Build response in overlap-score order, max 2 episodes per podcast, skip duplicate titles
    const episodeMap = new Map(episodes.map(e => [e.id, e]));
    const podcastCount = new Map<string, number>();
    const seenTitles = new Set<string>();
    const related: Record<string, unknown>[] = [];

    for (const s of scored) {
      if (related.length >= 6) break;
      const ep = episodeMap.get(s.episodeId);
      if (!ep) continue;
      const podcast = (ep as Record<string, unknown>).podcasts as Record<string, unknown> | null;
      const podcastId = ep.podcast_id as string;

      // Max 2 episodes from the same podcast
      const count = podcastCount.get(podcastId) || 0;
      if (count >= 2) continue;

      // Skip duplicate titles (case-insensitive)
      const titleKey = (ep.title as string || "").toLowerCase().trim();
      if (seenTitles.has(titleKey)) continue;
      seenTitles.add(titleKey);

      podcastCount.set(podcastId, count + 1);

      related.push({
        episodeId: ep.id,
        title: ep.title,
        audioUrl: ep.audio_url,
        publishedAt: ep.published_at,
        description: ep.description || null,
        podcastName: (podcast?.title as string) || "Unknown",
        podcastArtwork: (podcast?.image_url as string) || "",
        podcastRssFeedUrl: (podcast?.rss_feed_url as string) || "",
        hasDeepSummary: deepStatusMap.get(s.episodeId) === "ready",
        sharedTags: s.sharedTags,
      });
    }

    return NextResponse.json({ related }, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200" },
    });
  } catch (error) {
    console.error("Error fetching related episodes:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
