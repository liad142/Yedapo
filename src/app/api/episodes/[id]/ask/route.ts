import { NextRequest } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { buildEpisodeContext } from "@/lib/ask-ai-service";
import { checkRateLimit, checkPlanQuota } from "@/lib/cache";
import { isAdminEmail } from "@/lib/admin";
import { getUserPlan } from "@/lib/user-plan";
import { PLAN_LIMITS } from "@/lib/plans";
import { getAuthUser } from "@/lib/auth-helpers";
import { createLogger } from "@/lib/logger";

const log = createLogger('ask-ai');

// Separate Gemini instance for chat (plain text, not JSON)
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY!);

const ASK_MODELS = ['gemini-3-flash-preview', 'gemini-2.5-flash'] as const;

function getChatModel(modelId: string) {
  return genAI.getGenerativeModel({ model: modelId });
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // Rate limit by IP (Redis-based, works across serverless instances)
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const rlAllowed = await checkRateLimit(`askai:${ip}`, 30, 60);
    if (!rlAllowed) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again in a minute." }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Auth gate — require authenticated user
    const user = await getAuthUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Per-user daily quota for Ask AI (plan-based, skip for admins)
    if (!(user.email && isAdminEmail(user.email))) {
      const plan = await getUserPlan(user.id, user.email ?? undefined);
      const quota = await checkPlanQuota(user.id, 'askai', PLAN_LIMITS[plan].askAiPerDay);
      if (!quota.allowed) {
        return new Response(JSON.stringify({
          error: "Daily Ask AI limit reached",
          limit: quota.limit,
          used: quota.used,
          upgrade_url: "/pricing",
        }), {
          status: 429,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    const { id: episodeId } = await params;
    const body = await request.json();
    const { question, history } = body as {
      question: string;
      history?: { role: "user" | "model"; text: string }[];
    };

    // Validate
    if (!question || typeof question !== "string") {
      return new Response(JSON.stringify({ error: "question is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (question.length > 2000) {
      return new Response(JSON.stringify({ error: "Question too long (max 2000 chars)" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (history && history.length > 20) {
      return new Response(JSON.stringify({ error: "Conversation too long (max 20 messages)" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Build context
    const systemPrompt = await buildEpisodeContext(episodeId);
    if (!systemPrompt) {
      return new Response(
        JSON.stringify({ error: "No transcript available for this episode." }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Build conversation history for Gemini
    const contents = [
      ...(history || []).map((msg) => ({
        role: msg.role === "user" ? ("user" as const) : ("model" as const),
        parts: [{ text: msg.text }],
      })),
      { role: "user" as const, parts: [{ text: question }] },
    ];

    // Stream response with model fallback
    let result;
    let lastError;
    for (const modelId of ASK_MODELS) {
      try {
        const model = getChatModel(modelId);
        result = await model.generateContentStream({
          systemInstruction: systemPrompt,
          contents,
        });
        break; // success
      } catch (err) {
        lastError = err;
        log.warn('Model failed, trying fallback', { model: modelId, error: String(err) });
      }
    }
    if (!result) {
      throw lastError || new Error('All models failed');
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of result.stream) {
            const text = chunk.text();
            if (text) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err) {
          log.error('Stream error', err);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: "Stream interrupted" })}\n\n`)
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    log.error('Error', error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
