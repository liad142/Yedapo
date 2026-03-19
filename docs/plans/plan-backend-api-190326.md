# Backend & API Production Hardening Plan (2026-03-19)

## Overview

31 findings from the Backend Architect review. Grouped by priority tier and file proximity.

**Conventions:**
- Rate limit: `checkRateLimit` from `@/lib/cache` (Redis fixed-window counter)
- IP extraction: `request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'`
- Error format: always `{ error: string }` (never `{ message }` or plain text)

---

## TIER 1 — CRITICAL

### Finding 1: Unbounded episode fetch in GET /api/podcasts/[id]

**File:** `src/app/api/podcasts/[id]/route.ts` lines 102-106

**Fix:** Add `.limit()` and pagination:
```typescript
const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 100);
const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0);
// Add .range(offset, offset + limit - 1) and { count: 'exact' }
```

Return `{ podcast, episodes, total: count, limit, offset }`.

### Finding 2: Full episode table scan in GET /api/subscriptions

**File:** `src/app/api/subscriptions/route.ts` lines 51-76

**Fix:** Create RPC `get_episode_counts(p_podcast_ids UUID[], p_last_viewed JSONB)` that returns `(podcast_id, total_count, new_count)` using `COUNT(*) GROUP BY`. Migration: `supabase/migrations/20260319_episode_count_rpc.sql`.

### Finding 3: YouTube import — no limit, N+1 API calls

**File:** `src/app/api/youtube/subscriptions/import/route.ts`

**Fix:** Cap at 100 channels: `const limited = channels.slice(0, 100)`. Replace `for` loop with `Promise.allSettled`. Return `{ imported, errors, truncated }`.

### Finding 4: Daily-mix loads 10MB into memory

**File:** `src/app/api/discover/daily-mix/route.ts`

**Fix:** Cache scored list in Redis (2-min TTL). On miss, fetch only scoring fields first, then targeted `content_json` fetch for final set. Apply same pattern to `genre-episodes` and `todays-insights`.

---

## TIER 2 — HIGH

### Finding 5: Rate limits on 13 endpoints

| Route | Key | Max/min |
|---|---|---|
| episodes/import | `episodes-import:${user.id}` | 30 |
| podcasts/add | `podcasts-add:${user.id}` | 10 |
| youtube/[videoId]/summary | `yt-summary:${user.id}` | 10 |
| notifications/send | `notifications-send:${user.id}` | 20 |
| listening-progress | `listening-progress:${user.id}` | 120 |
| feed | `feed:${user.id}` | 60 |
| summaries/status | `summary-status:${user.id}` | 60 |
| discover/daily-mix | `discover-daily-mix:ip:${ip}` | 30 |
| discover/genre-episodes | `discover-genre:ip:${ip}` | 30 |
| discover/todays-insights | `discover-insights:ip:${ip}` | 30 |
| podcasts/lookup | `podcasts-lookup:ip:${ip}` | 60 |
| resolve-apple-id | `resolve-apple:ip:${ip}` | 30 |
| feed/[id]/bookmark | `bookmark:${user.id}` | 30 |

### Finding 6+7: batch-lookup + summaries/check — no auth, no rate limit

Add IP-based rate limiting (30 req/min) to both.

### Finding 8: Feed limit param not capped

**Fix:** `const limit = Math.min(parseInt(...) || 20, 100);`

### Finding 9: Module-level Map cache in /api/feed

**Fix:** Replace with Redis: `getCached/setCached` with `feed:source-meta:${id}` key, 5-min TTL.

### Finding 10: Unbounded user summary fetch

**Fix:** Add `.limit(100).order('created_at', { ascending: false })`.

### Finding 11: Admin routes — 5,000-row JS aggregation

Create RPCs: `get_episodes_by_week()`, `get_top_podcasts_by_episode_count()`, `get_summary_status_counts()`. Migration: `supabase/migrations/20260319_admin_rpcs.sql`.

### Finding 12: Double DB round-trip on cached summary path

**Fix:** Extend `checkExistingSummary` to return row ID alongside status.

### Finding 13: N+1 sequential HTTP in cron

**Fix:** Replace `for` loop with `Promise.allSettled`.

### Finding 14: Stale threshold too short (10 min)

**Fix:** Increase to 25 minutes.

### Finding 15: podcasts/add — no rate limit, no RSS timeout, no episode cap

**Fix:** Rate limit (10/min), `AbortSignal.timeout(10_000)` on RSS fetch, cap episodes at 200.

---

## TIER 3 — MEDIUM

### Finding 17: Unbounded replies in comments GET
Add `.limit(500)` to replies query.

### Finding 18: Duplicate routes (youtube/channels + my-list/channels)
Delete `youtube/channels/route.ts`. Fix `Cache-Control: public` bug.

### Finding 19: Sequential podcast lookup (3 queries)
Collapse with `.or()` filter.

### Finding 20: audio_url lookup without podcast_id
Add `.eq('podcast_id', podcastId)`.

### Finding 22: Podcast refresh — no cap
Limit to 20 most recently subscribed.

### Finding 23: Rate limit key without prefix
Change `checkRateLimit(user.id, ...)` to `checkRateLimit('yt-follow:' + user.id, ...)`.

### Finding 24: Telegram webhook token mismatch
Webhook must lookup Redis instead of base64 decode. (See security plan for details.)

### Finding 25: Inconsistent error response format
Grep for `{ message:` and standardize to `{ error: string }`.

### Finding 26: Missing DB indexes
Migration `supabase/migrations/20260319_performance_indexes.sql`:
- `summaries(status, level, updated_at DESC)`
- `feed_items(user_id, source_type, bookmarked)`
- `notification_requests(status, created_at)`
- `user_summaries(user_id, episode_id)`

### Finding 27: Admin client overuse
Create `src/lib/supabase/anon-server.ts` for public reads.

### Finding 28: console.error in API routes
Replace with structured logger in all routes.

### Finding 30: videoId not validated
Add `/^[A-Za-z0-9_-]{11}$/` validation.

### Finding 31: notifyChannels not validated
Validate against `['email', 'telegram', 'in-app']` allowlist.

---

## Implementation Batching

**Batch A — Low-risk (single PR, ~2h):**
Findings 1, 8, 10, 14, 17, 23, 25, 28, 30, 31

**Batch B — Rate limiting (single PR, ~2h):**
Findings 5, 6, 7, 15 (rate limit part), 22

**Batch C — DB migrations (deploy migration first):**
Findings 2, 11, 26

**Batch D — Architecture changes (individual PRs):**
Findings 4+29 (Redis scoring), 9 (Map->Redis), 12, 13, 15 (timeout+cap), 16, 24, 27

**Batch E — Consolidation:**
Findings 3, 18, 19, 20

---

## New Files

| File | Purpose |
|---|---|
| `src/lib/supabase/anon-server.ts` | Anon client for public reads |
| `supabase/migrations/20260319_episode_count_rpc.sql` | Subscription counts |
| `supabase/migrations/20260319_admin_rpcs.sql` | Admin aggregation |
| `supabase/migrations/20260319_performance_indexes.sql` | Missing indexes |
