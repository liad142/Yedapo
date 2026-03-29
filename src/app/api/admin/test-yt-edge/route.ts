import { NextRequest, NextResponse } from 'next/server';

// Force Edge Runtime — runs on Cloudflare CDN, different IPs than serverless
export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const videoId = request.nextUrl.searchParams.get('v') || 'epZy_NajGnA';
  const results: string[] = [];

  // Test 1: Raw watch page — does Edge get captionTracks?
  try {
    const start = Date.now();
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    const html = await res.text();
    const hasCaptions = html.includes('captionTracks');
    const hasPlayerResponse = html.includes('ytInitialPlayerResponse');
    results.push(`[EDGE] Raw fetch: ${res.status}, ${html.length} bytes, captions=${hasCaptions}, playerResp=${hasPlayerResponse} in ${Date.now() - start}ms`);

    // If captions found, extract baseUrl
    if (hasCaptions) {
      const match = html.match(/"captionTracks":\s*(\[.*?\])/);
      if (match) {
        try {
          const tracks = JSON.parse(match[1]);
          results.push(`[EDGE] Found ${tracks.length} caption tracks!`);
          for (const track of tracks) {
            results.push(`  lang=${track.languageCode} kind=${track.kind || 'manual'} baseUrl=${track.baseUrl?.substring(0, 100)}...`);

            // Try fetching actual caption content
            if (track.baseUrl) {
              const captionRes = await fetch(track.baseUrl);
              const captionText = await captionRes.text();
              results.push(`  Content: ${captionRes.status}, ${captionText.length} bytes`);
              if (captionText.length > 0) {
                results.push(`  Preview: ${captionText.substring(0, 200).replace(/\n/g, ' ')}`);
              }
            }
          }
        } catch (parseErr) {
          results.push(`  Parse error: ${String(parseErr)}`);
        }
      }
    }
  } catch (e: any) {
    results.push(`[EDGE] Raw fetch: FAILED - ${e.message}`);
  }

  // Test 2: InnerTube ANDROID from Edge
  try {
    const start = Date.now();
    const innertubeRes = await fetch('https://www.youtube.com/youtubei/v1/player?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'com.google.android.youtube/17.36.4 (Linux; U; Android 12)',
      },
      body: JSON.stringify({
        videoId,
        context: { client: { clientName: 'ANDROID', clientVersion: '17.36.4', hl: 'en' } },
      }),
    });
    const data = await innertubeRes.json();
    const captionTracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    results.push(`[EDGE] InnerTube ANDROID: ${innertubeRes.status}, captionTracks=${captionTracks?.length ?? 0} in ${Date.now() - start}ms`);
    if (captionTracks?.length > 0) {
      results.push(`  First: lang=${captionTracks[0].languageCode} baseUrl=${captionTracks[0].baseUrl?.substring(0, 100)}...`);
    }
  } catch (e: any) {
    results.push(`[EDGE] InnerTube ANDROID: FAILED - ${e.message}`);
  }

  return NextResponse.json({ videoId, runtime: 'edge', results });
}
