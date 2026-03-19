# AI/LLM Pipeline Production Hardening Plan (2026-03-19)

## Overview

28 findings across Gemini, Deepgram, Voxtral, and client-side AI integrations. Organized into 6 execution phases.

---

## Phase 1 — Critical Reliability (Findings 1, 2, 3, 4, 25)

### Fix 1: Lock TTL 600s -> 270s

**File:** `src/lib/summary-service.ts` line 1185

**Change:** `acquireLock(lockKey, 270)` (4.5 min, aligns with 3-min stale threshold)

### Fix 2: Insights route — add `after()` + `maxDuration`

**File:** `src/app/api/episodes/[id]/insights/route.ts`

**Change:**
1. Add `export const maxDuration = 300;`
2. Eagerly upsert as `'queued'`, return immediately
3. Push `requestInsights()` into `after()` with try-catch that writes `'failed'` to DB on error

### Fix 3: Add 30s timeout to `identifySpeakers`

**File:** `src/lib/summary-service.ts` line 162

**Change:** Export `withTimeout` from `gemini.ts`. Wrap: `await withTimeout(speakerModel.generateContent(fullPrompt), 30_000, 'identifySpeakers')`

### Fix 4: `after()` crash writes `'failed'` to DB

**File:** `src/app/api/episodes/[id]/summaries/route.ts` lines 227-229

**Change:** In catch block, add DB update to `status: 'failed'` with `error_message`.

### Fix 25: Prevent double-POST from resetting stale clock

**File:** `src/lib/summary-service.ts` ~line 1192

**Change:** Add `.eq('status', 'queued')` to the transcribing upsert so it only transitions queued->transcribing.

---

## Phase 2 — Security (Findings 9, 8)

### Fix 9: Strip content from unauthenticated status polling

**File:** `src/app/api/episodes/[id]/summaries/status/route.ts`

**Change:** Return only `{ status, updatedAt }` per summary level. No `content_json`.

### Fix 8: Validate Ask AI history items

**File:** `src/app/api/episodes/[id]/ask/route.ts`

**Change:** Runtime validate: role must be `"user"` or `"model"`, text max 10,000 chars.

---

## Phase 3 — Correctness (Findings 7, 10, 6, 11, 12, 13, 14, 15, 16)

### Fix 7: Verify/correct model names + startup validation

**Files:** `src/lib/gemini.ts`, `src/instrumentation.ts` (new)

**Change:** Verify `DEFAULT_MODELS` are valid. Create `instrumentation.ts` for startup env var checks.

### Fix 10: Remove duplicate `generateWithFallback`

**File:** `src/lib/summary-service.ts` lines 32-65

**Change:** Delete local copy. Import shared function from `gemini.ts`.

### Fix 6: Increase insights timeout 30s -> 90s

**File:** `src/lib/insights-service.ts` line 22

### Fix 11: Replace greedy JSON regex with indexOf/lastIndexOf

**File:** `src/lib/summary-service.ts` line 961

### Fix 12: Validate required keys after JSON parse

**File:** `src/lib/summary-service.ts` ~line 993

**Change:** Check `hook_headline`/`executive_brief` for quick, `comprehensive_overview`/`chronological_breakdown` for deep.

### Fix 13: Truncate transcript at utterance boundary

**File:** `src/lib/summary-service.ts` lines 904-906

**Change:** Use `lastIndexOf('\n', maxTranscriptChars)` instead of `substring`.

### Fix 14: Add `_generated_with_generic_speakers` metadata flag

**File:** `src/lib/summary-service.ts` ~line 997

### Fix 15: Invalidate both 'en' and actual language cache key

**Files:** `insights/route.ts` line 76, `insights-service.ts` line 149

### Fix 16: Include `updated_at` in Ask AI context cache key

**File:** `src/lib/ask-ai-service.ts`

**Change:** Cache key: `askai:context:${episodeId}:${latestUpdatedAt}`. Reduce TTL to 10 min.

---

## Phase 4 — Memory/Performance (Findings 5, 17)

### Fix 5: Stream `downloadAudioBuffer` with byte tracking

**File:** `src/lib/deepgram.ts` lines 191-221

**Change:** Replace `response.arrayBuffer()` with streaming reader that aborts above 200MB.

### Fix 17: Remove transcript_text from insights polling response

**File:** `src/lib/insights-service.ts` lines 296-306, 362

---

## Phase 5 — Ask AI Quality (Findings 18, 19, 20, 21, 22)

### Fix 18: Move `onMessageSent` to after stream completes

**File:** `src/hooks/useAskAIChat.ts` line 128

### Fix 19: Use `controller.error()` for stream errors

**File:** `src/app/api/episodes/[id]/ask/route.ts` lines 144-149

### Fix 20: Add `export const maxDuration = 60`

**File:** `src/app/api/episodes/[id]/ask/route.ts`

### Fix 21: Classify route — use shared `getModel`, add JSON repair

**File:** `src/app/api/youtube/classify/route.ts`

### Fix 22: Batch classify at 20 channels per prompt

**File:** `src/app/api/youtube/classify/route.ts`

---

## Phase 6 — Observability (Findings 23, 24, 26, 27, 28)

### Fix 23: Voxtral logger `'deepgram'` -> `'voxtral'`

**File:** `src/lib/voxtral.ts` line 5

### Fix 24: Apply `resolveAudioUrl` before Voxtral call

**Files:** Export from `deepgram.ts`, use in `summary-service.ts` before Voxtral call

### Fix 26: Distinguish fresh POST vs resume in grace period

**File:** `src/contexts/SummarizeQueueContext.tsx`

**Change:** Thread `isResume` flag through `pollLoop`. Skip grace period on resume.

### Fix 27: Add per-AI-call cost tracking

Emit `ai_tokens_used` analytics event with model, input/output tokens.

### Fix 28: Startup API key validation

Covered by Fix 7's `instrumentation.ts`.

---

## Dependencies

- Fix 10 (remove duplicate) BEFORE Fix 3 (timeout import)
- Fix 7 (model name) BEFORE Fix 21 (classify uses shared getModel)
- Fix 24 (export resolveAudioUrl) BEFORE using in summary-service
- Fix 1 + Fix 4 ship together (same recovery path)

---

## Summary Table

| Phase | Findings | Severity | Est. Time |
|---|---|---|---|
| 1 | 1, 2, 3, 4, 25 | CRITICAL/HIGH | 3-4h |
| 2 | 9, 8 | HIGH | 1-2h |
| 3 | 7, 10, 6, 11, 12, 13, 14, 15, 16 | MEDIUM-HIGH | 4-5h |
| 4 | 5, 17 | HIGH/MEDIUM | 2-3h |
| 5 | 18, 19, 20, 21, 22 | MEDIUM | 2-3h |
| 6 | 23, 24, 26, 27, 28 | LOW-MEDIUM | 2-3h |
| **Total** | **28 findings** | | **~14-20h** |
