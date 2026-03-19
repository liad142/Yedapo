import { NextRequest, NextResponse } from "next/server";
import { getSummariesStatus } from "@/lib/summary-service";
import { createLogger } from "@/lib/logger";

const log = createLogger('summary');

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/episodes/:id/summaries/status - Polling endpoint for status
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const language = searchParams.get('language') || 'en';
    
    const result = await getSummariesStatus(id, language);

    // Strip content for polling — full content available via authenticated GET
    const stripped = { ...result };
    if (stripped.summaries?.quick) {
      delete stripped.summaries.quick.content;
      delete (stripped.summaries.quick as Record<string, unknown>).content_json;
    }
    if (stripped.summaries?.deep) {
      delete stripped.summaries.deep.content;
      delete (stripped.summaries.deep as Record<string, unknown>).content_json;
    }

    return NextResponse.json(stripped, {
      headers: { 'Cache-Control': 'no-cache' },
    });
  } catch (error) {
    log.error('Error fetching status', error);
    return NextResponse.json({ error: 'Failed to fetch status' }, { status: 500 });
  }
}
