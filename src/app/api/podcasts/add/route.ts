import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { fetchPodcastFeed } from "@/lib/rss";
import { getPodcastById } from "@/lib/apple-podcasts";
import { getAuthUser } from "@/lib/auth-helpers";
import { createLogger } from "@/lib/logger";

const log = createLogger('add-podcast');

// Block SSRF: reject private/reserved IP ranges
const PRIVATE_IP_PATTERNS = [
  /^https?:\/\/127\./,
  /^https?:\/\/10\./,
  /^https?:\/\/172\.(1[6-9]|2\d|3[01])\./,
  /^https?:\/\/192\.168\./,
  /^https?:\/\/169\.254\./,
  /^https?:\/\/0\./,
  /^https?:\/\/localhost/i,
  /^https?:\/\/\[::1\]/,
];

function isValidPodcastUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    if (PRIVATE_IP_PATTERNS.some(p => p.test(url))) return false;
    return true;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { rss_url } = body;

    if (!rss_url || typeof rss_url !== "string") {
      return NextResponse.json(
        { error: "rss_url is required and must be a string" },
        { status: 400 }
      );
    }

    // Validate URL for non-Apple references
    if (!rss_url.startsWith("apple:") && !isValidPodcastUrl(rss_url)) {
      return NextResponse.json(
        { error: "Invalid URL. Must be a valid HTTP/HTTPS URL." },
        { status: 400 }
      );
    }

    // Check if podcast already exists
    const { data: existingPodcast } = await supabase
      .from("podcasts")
      .select("id")
      .eq("rss_feed_url", rss_url)
      .single();

    if (existingPodcast) {
      // Fetch full podcast data and episodes for the response
      const [{ data: fullPodcast }, { data: episodes }] = await Promise.all([
        supabase
          .from("podcasts")
          .select("*")
          .eq("id", existingPodcast.id)
          .single(),
        supabase
          .from("episodes")
          .select("*")
          .eq("podcast_id", existingPodcast.id)
          .order("published_at", { ascending: false }),
      ]);

      return NextResponse.json({
        id: existingPodcast.id,
        podcast: fullPodcast || existingPodcast,
        episodes: episodes || [],
        message: "Podcast already exists",
      });
    }

    // Handle Apple Podcasts (format: apple:ID)
    if (rss_url.startsWith("apple:")) {
      const appleId = rss_url.replace("apple:", "");

      // Fetch podcast details from Apple
      const applePodcast = await getPodcastById(appleId);

      if (!applePodcast) {
        return NextResponse.json(
          { error: "Apple podcast not found" },
          { status: 404 }
        );
      }

      // Insert podcast into Supabase (episodes will be fetched on-demand)
      const { data: podcast, error: podcastError } = await supabase
        .from("podcasts")
        .insert({
          title: applePodcast.name,
          author: applePodcast.artistName || null,
          description: applePodcast.description || null,
          rss_feed_url: rss_url, // Keep the apple:ID format
          image_url: applePodcast.artworkUrl || null,
          language: "en",
        })
        .select()
        .single();

      if (podcastError) {
        log.error('Error inserting Apple podcast', podcastError);
        return NextResponse.json(
          { error: "Failed to save podcast" },
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          id: podcast.id,
          podcast,
          episodes: [], // Episodes are fetched on-demand from Apple API
        },
        { status: 201 }
      );
    }

    // Fetch and parse regular RSS feed
    const { podcast: parsedPodcast, episodes: parsedEpisodes } =
      await fetchPodcastFeed(rss_url);

    // Insert podcast into Supabase
    // Use language extracted from RSS feed, fallback to 'en' if not found
    const podcastLanguage = parsedPodcast.language || "en";
    log.info('Extracted language from RSS', { language: podcastLanguage });
    
    const { data: podcast, error: podcastError } = await supabase
      .from("podcasts")
      .insert({
        title: parsedPodcast.title,
        author: parsedPodcast.author || null,
        description: parsedPodcast.description || null,
        rss_feed_url: rss_url,
        image_url: parsedPodcast.image_url || null,
        language: podcastLanguage,  // Use language from RSS feed
      })
      .select()
      .single();

    if (podcastError) {
      log.error('Error inserting podcast', podcastError);
      return NextResponse.json(
        { error: "Failed to save podcast" },
        { status: 500 }
      );
    }

    // Insert episodes into Supabase
    // Include transcript_url for FREE transcription (Priority A in the waterfall)
    const episodesToInsert = parsedEpisodes.map((episode) => ({
      podcast_id: podcast.id,
      title: episode.title,
      description: episode.description || null,
      audio_url: episode.audio_url,
      duration_seconds: episode.duration_seconds || null,
      published_at: episode.published_at || null,
      transcript_url: episode.transcript_url || null,  // RSS transcript URL for FREE transcription
      transcript_language: episode.transcript_language || null,
    }));

    const { data: episodes, error: episodesError } = await supabase
      .from("episodes")
      .insert(episodesToInsert)
      .select();

    if (episodesError) {
      log.error('Error inserting episodes', episodesError);
      // Podcast was created but episodes failed - still return podcast
      return NextResponse.json({
        id: podcast.id,
        podcast,
        episodes: [],
        warning: "Podcast saved but some episodes failed to save",
      });
    }

    return NextResponse.json(
      {
        id: podcast.id,
        podcast,
        episodes: episodes || [],
      },
      { status: 201 }
    );
  } catch (error) {
    log.error('Error adding podcast', error);

    if (error instanceof Error && error.message.includes("fetch")) {
      return NextResponse.json(
        { error: "Failed to fetch RSS feed. Please check the URL." },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
