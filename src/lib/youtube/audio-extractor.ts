/**
 * YouTube audio extraction placeholder.
 * 
 * NOTE: All Node.js ytdl libraries (distube, ybd-project, youtubei.js) are currently
 * broken due to YouTube cipher changes. URLs they extract return 403.
 * 
 * The primary fix for YouTube videos without captions is in fetchYouTubeTranscript()
 * which now tries multiple language codes (including legacy codes like 'iw' for Hebrew).
 * 
 * This function returns null until a working audio extraction method is available.
 * When/if ytdl libraries are fixed, replace this with actual extraction.
 */
export async function extractYouTubeAudioUrl(_videoId: string): Promise<string | null> {
  // All ytdl-core variants currently broken (March 2026)
  // YouTube cipher changes cause 403 on extracted URLs
  return null;
}
