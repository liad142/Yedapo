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

    // Strip most content for polling — keep only what the player needs (chapters)
    // Full summary content is available via the authenticated insights GET endpoint
    const stripped = { ...result };
    if (stripped.summaries?.quick) {
      delete stripped.summaries.quick.content;
      delete (stripped.summaries.quick as Record<string, unknown>).content_json;
    }
    if (stripped.summaries?.deep) {
      // Preserve chronological_breakdown for player chapters (used by usePlayerAskAI)
      const deepContent = stripped.summaries.deep.content as Record<string, unknown> | undefined;
      const chapters = deepContent?.chronological_breakdown;
      delete stripped.summaries.deep.content;
      delete (stripped.summaries.deep as Record<string, unknown>).content_json;
      if (chapters) {
        (stripped.summaries.deep as Record<string, unknown>).content = { chronological_breakdown: chapters };
      }
    }

    return NextResponse.json(stripped, {
      headers: { 'Cache-Control': 'no-cache' },
    });
  } catch (error) {
    log.error('Error fetching status', error);
    return NextResponse.json({ error: 'Failed to fetch status' }, { status: 500 });
  }
}
