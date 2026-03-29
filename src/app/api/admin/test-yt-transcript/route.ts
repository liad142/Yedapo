import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const videoId = request.nextUrl.searchParams.get('v') || 'epZy_NajGnA';
  const results: string[] = [];

  // Test 1: Direct youtube-transcript-plus
  try {
    const { YoutubeTranscript } = await import('youtube-transcript-plus');
    const start = Date.now();
    const segments = await YoutubeTranscript.fetchTranscript(videoId);
    results.push(`youtube-transcript-plus (default): ${segments.length} segments in ${Date.now() - start}ms`);
  } catch (e: any) {
    results.push(`youtube-transcript-plus (default): FAILED - ${e.message}`);
  }

  // Test 2: With lang=en
  try {
    const { YoutubeTranscript } = await import('youtube-transcript-plus');
    const start = Date.now();
    const segments = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'en' });
    results.push(`youtube-transcript-plus (en): ${segments.length} segments in ${Date.now() - start}ms`);
  } catch (e: any) {
    results.push(`youtube-transcript-plus (en): FAILED - ${e.message}`);
  }

  // Test 3: Our fetchYouTubeTranscript wrapper
  try {
    const { fetchYouTubeTranscript } = await import('@/lib/youtube/transcripts');
    const start = Date.now();
    const result = await fetchYouTubeTranscript(videoId, 'en');
    if (result) {
      results.push(`fetchYouTubeTranscript: ${result.text.length} chars in ${Date.now() - start}ms`);
    } else {
      results.push(`fetchYouTubeTranscript: returned null in ${Date.now() - start}ms`);
    }
  } catch (e: any) {
    results.push(`fetchYouTubeTranscript: FAILED - ${e.message}`);
  }

  // Test 4: Raw fetch to YouTube watch page
  try {
    const start = Date.now();
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(15000),
    });
    const html = await res.text();
    const hasCaptions = html.includes('captionTracks');
    const hasPlayerResponse = html.includes('ytInitialPlayerResponse');
    results.push(`Raw fetch: ${res.status}, ${html.length} bytes, captions=${hasCaptions}, playerResp=${hasPlayerResponse} in ${Date.now() - start}ms`);
  } catch (e: any) {
    results.push(`Raw fetch: FAILED - ${e.message}`);
  }

  // Test 5: YouTube timedtext API directly
  try {
    const start = Date.now();
    const res = await fetch(`https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&fmt=json3`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(10000),
    });
    const text = await res.text();
    results.push(`Timedtext API (en): ${res.status}, ${text.length} bytes in ${Date.now() - start}ms`);
  } catch (e: any) {
    results.push(`Timedtext API (en): FAILED - ${e.message}`);
  }

  // Test 6: InnerTube API directly (what youtube-transcript-plus does internally)
  try {
    const start = Date.now();
    const innertubeRes = await fetch('https://www.youtube.com/youtubei/v1/player?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'com.google.android.youtube/17.36.4 (Linux; U; Android 12)' },
      body: JSON.stringify({
        videoId,
        context: { client: { clientName: 'ANDROID', clientVersion: '17.36.4', hl: 'en' } },
      }),
      signal: AbortSignal.timeout(10000),
    });
    const data = await innertubeRes.json();
    const captionTracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    results.push(`InnerTube ANDROID: ${innertubeRes.status}, captionTracks=${captionTracks?.length ?? 0} in ${Date.now() - start}ms`);
    if (captionTracks?.length > 0) {
      results.push(`  First track: lang=${captionTracks[0].languageCode} baseUrl=${captionTracks[0].baseUrl?.substring(0, 80)}...`);
    }
  } catch (e: any) {
    results.push(`InnerTube ANDROID: FAILED - ${e.message}`);
  }

  // Test 7: InnerTube with WEB client
  try {
    const start = Date.now();
    const innertubeRes = await fetch('https://www.youtube.com/youtubei/v1/player?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      body: JSON.stringify({
        videoId,
        context: { client: { clientName: 'WEB', clientVersion: '2.20240101.00.00', hl: 'en' } },
      }),
      signal: AbortSignal.timeout(10000),
    });
    const data = await innertubeRes.json();
    const captionTracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    results.push(`InnerTube WEB: ${innertubeRes.status}, captionTracks=${captionTracks?.length ?? 0} in ${Date.now() - start}ms`);
    if (captionTracks?.length > 0) {
      results.push(`  First track: lang=${captionTracks[0].languageCode} baseUrl=${captionTracks[0].baseUrl?.substring(0, 80)}...`);
    }
  } catch (e: any) {
    results.push(`InnerTube WEB: FAILED - ${e.message}`);
  }

  // Test 8: YouTube Data API v3 (using their API key)
  const ytApiKey = process.env.YOUTUBE_API_KEY;
  if (ytApiKey) {
    try {
      const start = Date.now();
      const res = await fetch(`https://www.googleapis.com/youtube/v3/captions?videoId=${videoId}&part=snippet&key=${ytApiKey}`, {
        signal: AbortSignal.timeout(10000),
      });
      const data = await res.json();
      results.push(`YouTube Data API captions: ${res.status}, items=${data.items?.length ?? 0} in ${Date.now() - start}ms`);
      if (data.items?.length > 0) {
        data.items.forEach((item: any) => {
          results.push(`  caption: lang=${item.snippet?.language} name=${item.snippet?.name} trackKind=${item.snippet?.trackKind}`);
        });
      }
      if (data.error) {
        results.push(`  error: ${JSON.stringify(data.error.message)}`);
      }
    } catch (e: any) {
      results.push(`YouTube Data API: FAILED - ${e.message}`);
    }
  }

  // Test 9: Timedtext with kind=asr
  try {
    const start = Date.now();
    const res = await fetch(`https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&kind=asr&fmt=json3`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(10000),
    });
    const text = await res.text();
    results.push(`Timedtext (asr, json3): ${res.status}, ${text.length} bytes in ${Date.now() - start}ms`);
  } catch (e: any) {
    results.push(`Timedtext (asr): FAILED - ${e.message}`);
  }

  // Test 10: Timedtext with srv3 format
  try {
    const start = Date.now();
    const res = await fetch(`https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&fmt=srv3`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(10000),
    });
    const text = await res.text();
    results.push(`Timedtext (srv3): ${res.status}, ${text.length} bytes in ${Date.now() - start}ms`);
  } catch (e: any) {
    results.push(`Timedtext (srv3): FAILED - ${e.message}`);
  }

  // Test 11: video.google.com timedtext
  try {
    const start = Date.now();
    const res = await fetch(`https://video.google.com/timedtext?lang=en&v=${videoId}`, {
      signal: AbortSignal.timeout(10000),
    });
    const text = await res.text();
    results.push(`video.google.com timedtext: ${res.status}, ${text.length} bytes in ${Date.now() - start}ms`);
    if (text.length > 0) results.push(`  preview: ${text.substring(0, 200)}`);
  } catch (e: any) {
    results.push(`video.google.com: FAILED - ${e.message}`);
  }

  // Test 12: InnerTube with IOS client (different from ANDROID)
  try {
    const start = Date.now();
    const innertubeRes = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'com.google.ios.youtube/19.29.1 (iPhone16,2; U; CPU iOS 17_5_1 like Mac OS X;)' },
      body: JSON.stringify({
        videoId,
        context: { client: { clientName: 'IOS', clientVersion: '19.29.1', hl: 'en', deviceModel: 'iPhone16,2' } },
      }),
      signal: AbortSignal.timeout(10000),
    });
    const data = await innertubeRes.json();
    const captionTracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    results.push(`InnerTube IOS: ${innertubeRes.status}, captionTracks=${captionTracks?.length ?? 0} in ${Date.now() - start}ms`);
    if (captionTracks?.length > 0) {
      const baseUrl = captionTracks[0].baseUrl;
      results.push(`  baseUrl: ${baseUrl?.substring(0, 120)}...`);
      // Try fetching the actual caption content
      const captionRes = await fetch(baseUrl, { signal: AbortSignal.timeout(10000) });
      const captionText = await captionRes.text();
      results.push(`  Caption content: ${captionRes.status}, ${captionText.length} bytes`);
    }
  } catch (e: any) {
    results.push(`InnerTube IOS: FAILED - ${e.message}`);
  }

  // Test 13: InnerTube TVHTML5_EMBEDDED
  try {
    const start = Date.now();
    const innertubeRes = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoId,
        context: { client: { clientName: 'TVHTML5_SIMPLY_EMBEDDED_PLAYER', clientVersion: '2.0' }, thirdParty: { embedUrl: 'https://www.google.com' } },
      }),
      signal: AbortSignal.timeout(10000),
    });
    const data = await innertubeRes.json();
    const captionTracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    results.push(`InnerTube TVHTML5: ${innertubeRes.status}, captionTracks=${captionTracks?.length ?? 0} in ${Date.now() - start}ms`);
    if (captionTracks?.length > 0) {
      const baseUrl = captionTracks[0].baseUrl;
      results.push(`  baseUrl: ${baseUrl?.substring(0, 120)}...`);
      const captionRes = await fetch(baseUrl, { signal: AbortSignal.timeout(10000) });
      const captionText = await captionRes.text();
      results.push(`  Caption content: ${captionRes.status}, ${captionText.length} bytes`);
    }
  } catch (e: any) {
    results.push(`InnerTube TVHTML5: FAILED - ${e.message}`);
  }

  return NextResponse.json({ videoId, results });
}
