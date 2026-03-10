import { createAdminClient } from "@/lib/supabase/admin";
import { getCached, setCached } from "@/lib/cache";
import type { QuickSummaryContent, DeepSummaryContent, InsightsContent } from "@/types/database";

const MAX_TRANSCRIPT_CHARS = 100_000;

/**
 * Build the full context string for the Ask AI chat.
 * Assembles system instructions + summaries + transcript into a single prompt.
 * Returns null if no transcript exists for the episode.
 */
export async function buildEpisodeContext(episodeId: string): Promise<string | null> {
  // Check cache first
  const cacheKey = `askai:context:${episodeId}`;
  const cached = await getCached<string>(cacheKey);
  if (cached) return cached;

  const supabase = createAdminClient();

  // Fetch transcript and all summaries in parallel
  const [transcriptResult, summariesResult] = await Promise.all([
    supabase
      .from("transcripts")
      .select("full_text")
      .eq("episode_id", episodeId)
      .eq("status", "ready")
      .order("created_at", { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from("summaries")
      .select("level, content_json, status")
      .eq("episode_id", episodeId)
      .eq("status", "ready"),
  ]);

  const transcriptText = transcriptResult.data?.full_text;
  if (!transcriptText) return null;

  const summaries = summariesResult.data || [];
  const quick = summaries.find((s) => s.level === "quick");
  const deep = summaries.find((s) => s.level === "deep");
  const insights = summaries.find((s) => s.level === "insights");

  const parts: string[] = [];

  // 1. System instructions
  parts.push(`You are an AI assistant that answers questions about a podcast episode.
Rules:
- Answer ONLY based on the episode content provided below. If the answer isn't in the content, say so.
- Match the language of the user's question in your response.
- Use markdown formatting (bold, lists, blockquotes) for readability.
- When quoting the transcript, use blockquotes (>).
- Be concise but thorough.`);

  // 2. Quick summary
  if (quick?.content_json) {
    const qs = quick.content_json as QuickSummaryContent;
    parts.push(`\n--- EPISODE SUMMARY ---
Headline: ${qs.hook_headline}
Brief: ${qs.executive_brief}
Golden Nugget: ${qs.golden_nugget}
Tags: ${qs.tags?.join(", ") || "N/A"}`);
  }

  // 3. Deep summary
  if (deep?.content_json) {
    const ds = deep.content_json as DeepSummaryContent;
    parts.push(`\n--- DEEP ANALYSIS ---
Overview: ${ds.comprehensive_overview}
Core Concepts: ${ds.core_concepts?.map((c) => `- ${c.concept}: ${c.explanation}`).join("\n") || "N/A"}
Takeaways: ${ds.actionable_takeaways?.map((t) => `- ${typeof t === "string" ? t : t.text}`).join("\n") || "N/A"}`);
  }

  // 4. Insights highlights
  if (insights?.content_json) {
    const ic = insights.content_json as unknown as InsightsContent;
    if (ic.highlights?.length) {
      parts.push(`\n--- KEY HIGHLIGHTS ---
${ic.highlights.map((h) => `> "${h.quote}"\n  Context: ${h.context}`).join("\n\n")}`);
    }
  }

  // 5. Full transcript (capped)
  const cappedTranscript = transcriptText.slice(0, MAX_TRANSCRIPT_CHARS);
  parts.push(`\n--- FULL TRANSCRIPT ---\n${cappedTranscript}`);

  const result = parts.join("\n");

  // Cache for 30 minutes
  await setCached(cacheKey, result, 1800);

  return result;
}
