import { GoogleGenerativeAI, type GenerativeModel } from "@google/generative-ai";
import { createLogger } from "@/lib/logger";

const log = createLogger('gemini');

// Singleton Gemini client
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY!);

// Cached model instances
const modelCache = new Map<string, GenerativeModel>();

/**
 * Get a Gemini model instance (cached).
 */
export function getModel(modelId: string, jsonMode = false): GenerativeModel {
  const cacheKey = `${modelId}:${jsonMode}`;
  let model = modelCache.get(cacheKey);
  if (!model) {
    model = genAI.getGenerativeModel({
      model: modelId,
      ...(jsonMode && { generationConfig: { responseMimeType: "application/json" } }),
    });
    modelCache.set(cacheKey, model);
  }
  return model;
}

/**
 * Default model fallback chain.
 */
export const DEFAULT_MODELS = ['gemini-3-flash-preview', 'gemini-2.5-flash'] as const;

/**
 * Generate content with automatic model fallback.
 */
export async function generateWithFallback(
  prompt: string,
  models: readonly string[] = DEFAULT_MODELS,
  jsonMode = true,
  timeoutMs = 120_000
): Promise<{ text: string; modelUsed: string }> {
  let lastError: Error | null = null;

  for (const modelId of models) {
    try {
      const model = getModel(modelId, jsonMode);
      const result = await withTimeout(
        model.generateContent(prompt),
        timeoutMs,
        `${modelId} generation`
      );
      const text = result.response.text();
      return { text, modelUsed: modelId };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      log.warn('Model failed, trying fallback', { model: modelId, error: lastError.message });
    }
  }

  throw lastError || new Error('All models failed');
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout after ${ms}ms: ${label}`)), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

export { genAI };
