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

  return NextResponse.json({ videoId, results });
}
