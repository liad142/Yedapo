# Code Review #4 — Summaries & AI

**Date:** 2026-04-03  
**Score:** 6/10  
**Scope:** `src/lib/summary-service.ts`, `src/lib/insights-service.ts`, `src/lib/gemini.ts`, `src/lib/deepgram.ts`, `src/lib/voxtral.ts`, `src/lib/json-repair.ts`, `src/lib/ask-ai-service.ts`, API routes, hooks, and all UI components for the insights page.

---

## How It Works

```
POST /api/episodes/[id]/summaries
        │
        ├── quota check (plan limits)
        ├── upsert 'queued' row → summaries + user_summaries
        └── after() → requestSummary()
                        │
                        ├── acquireLock (Redis)
                        ├── ensureTranscript()
                        │     └── try sources in order:
                        │         1. Supadata (YouTube captions)
                        │         2. Apple Podcasts transcripts
                        │         3. RSS enclosure URL
                        │         4. Voxtral (Mistral audio)
                        │         5. Deepgram (audio download)
                        ├── generateSummaryForLevel('quick') → Gemini → JSON repair → DB
                        ├── generateSummaryForLevel('deep')  → Gemini → JSON repair → DB
                        └── releaseLock

POST /api/episodes/[id]/insights  (same pattern, but via requestInsights — NO lock)

POST /api/episodes/[id]/ask       → buildEpisodeContext → Gemini stream → SSE

Frontend polling: SummarizeQueueContext (adaptive backoff 3s→30s) + SummaryPanel (fixed 5s)
```

---

## Issues Found

### 🔴 Critical

**1. `src/lib/insights-service.ts:215-273` — No distributed lock on `requestInsights`**  
`requestSummary` wraps its whole flow in `acquireLock`/`releaseLock`. `requestInsights` has no lock at all. Two simultaneous POST requests for the same episode both pass the existence check, both run Gemini generation, both write to DB — doubling cost and potentially corrupting the insights row.  
**Fix:** Add `acquireLock`/`releaseLock` wrapping the generation call, identical to the pattern in `requestSummary:1207-1361`.

---

### 🟠 Important

2. **`src/app/api/episodes/[id]/insights/route.ts:140` — Error path missing language filter**  
The `after()` catch block updates ALL insights rows for the episode without a language filter:  
```ts
.update({ status: 'failed' }).eq('episode_id', episodeId).eq('level', 'insights')
// missing: .eq('language', resolvedLanguage || 'en')
```  
The summaries route correctly adds the language filter. For multi-language episodes, this marks ALL language variants as failed on any single error.

3. **`src/app/api/episodes/[id]/insights/route.ts:78` — Cache invalidation hardcoded to `'en'`**  
```ts
await deleteCached(CacheKeys.insightsStatus(episodeId, 'en'))
```  
Non-English episodes will serve stale cached status for the entire TTL after a new generation is triggered. The summaries route invalidates both the detected language key and `'en'` (lines 114-122).

4. **`src/lib/insights-service.ts:1-3` — Module-level `createAdminClient()`**  
`const supabase = createAdminClient()` runs at module initialization, not per-request. Every other file in the codebase (`summary-service.ts`, `ask-ai-service.ts`, all route files) calls `createAdminClient()` inside the function body. If env vars aren't set at cold-start module init, all subsequent requests on that instance use a broken client silently.

5. **`src/contexts/SummarizeQueueContext.tsx:118-122` — Absent deep summary treated as `'ready'`**  
```ts
if (quickStatus === 'ready' && !deepStatus) return 'ready';
```  
The queue always requests level `'deep'`. If the deep summary failed silently (exists in DB as `failed` or was never created), polling sees no `deepStatus` → `'ready'`. Button shows "View Summary" but deep tab shows "generate". Conflicting UI state.

6. **`src/lib/summary-service.ts:130` — `identifySpeakers` bypasses fallback chain**  
Direct `getModel('gemini-3-flash-preview')` call with no fallback. All other Gemini calls go through `generateWithFallback`. If this model is rate-limited or unavailable, speaker identification silently fails (acceptable degradation), but the model name may not be a valid public Google AI model ID — if wrong, this silently never works.

7. **`src/hooks/useAskAIChat.ts:130` — `onMessageSent` fires before stream is consumed**  
```ts
if (!res.ok) throw ...
onMessageSent?.();  // ← increments usage counter here
const reader = res.body?.getReader();
```  
Usage counter (`incrementAskAi`) is incremented the moment HTTP headers arrive, before any tokens stream. If the stream errors mid-way, the displayed counter is incremented but the user received no answer.

8. **`src/components/SummaryPanel.tsx:81-91` — Parallel polling with SummarizeQueueContext**  
`SummaryPanel` polls `/api/episodes/${episodeId}/summaries` every 5s (fixed). `SummarizeQueueContext` also polls the same endpoint with adaptive backoff. Both are mounted simultaneously on the same page — effectively double the polling load on every in-progress summary.

---

### 🟡 Minor

- **`src/lib/json-repair.ts:44-56`** — Quote disambiguation heuristic can produce still-invalid JSON for multi-key objects with embedded quotes. Appears to succeed (no exception) but outputs a truncated object.
- **`src/components/insights/TranscriptTabContent.tsx:464`** — `transcript.split(...)` relies on implicit narrowing via `hasTranscript` rather than TypeScript narrowing. Safe at runtime, fragile to future refactors.

---

## What Is Done Well

- **Stale-entry recovery:** `ensureTranscript` and `requestSummary` correctly detect entries stuck in `transcribing`/`summarizing` beyond their thresholds and reset them for retry.
- **Token/cost controls exist everywhere:** `generateSummaryForLevel` caps at 150k chars, `generateInsights` at 100k, `buildEpisodeContext` at 100k, Deepgram rejects files over 200MB.
- **`SummarizeQueueContext` is well-engineered:** tab-visibility pause, jitter, adaptive backoff (3s→30s), stuck-retrigger at 3 minutes, single-processor serialization.
- **Distributed locking on summaries** via `acquireLock`/`releaseLock` prevents duplicate Gemini calls.
- **5-source transcript fallback chain** with correct status tracking at each stage.

---

## Top 3 Fixes (Priority Order)

1. **No lock on `requestInsights`** — duplicate Gemini calls, DB corruption, direct cost impact
2. **Insights error path missing language filter** — corrupts all language variants on failure
3. **Insights cache invalidation hardcoded to `'en'`** — non-English episodes appear stuck in UI
