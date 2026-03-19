# Performance Fix Implementation Plan (2026-03-19)

## Overview

12 performance issues, ordered by impact. Includes concrete code changes, expected improvements, and verification steps.

---

## Fix 1 — Module-Level Map Cache in /api/feed (CRITICAL)

**File:** `src/app/api/feed/route.ts` lines 16-119

**Problem:** `sourceMetadataCache` is a module-level `Map` that grows without bound in serverless. 0% cache hit rate on cold starts.

**Fix:** Delete module-level Map. Replace with Redis:
- Keys: `src:yt:{id}` / `src:pod:{id}` with 1-hour TTL
- Use `getCachedMulti` for batch lookups in a single MGET round-trip
- Fall back to existing Supabase `.in()` queries for misses
- `setCached` each new entry after DB fetch

**Expected:** Cold-start hit rate 0% -> ~80-90%. Latency: -50-150ms/request.

**Verification:** Add `x-cache-status` header. Load-test with k6.

---

## Fix 2 — Discover Page Trending Feed Waterfall (HIGH)

**New file:** `src/app/api/discover/trending-feed/route.ts`
**Modified:** `src/app/discover/page.tsx` lines 179-241

**Problem:** 2 serial browser-server round-trips (top podcasts -> batch episodes). +200-600ms.

**Fix:** Create composite `/api/discover/trending-feed` route that runs both queries server-side. Cache 1 hour in Redis. Client makes one request.

**Expected:** Eliminates one full RTT. Subsequent requests: ~5ms from Redis.

**Verification:** Network tab shows single `trending-feed` request, not two separate ones.

---

## Fix 3 — framer-motion in Initial Bundle (HIGH)

**Files:** 28 client components, `next.config.js`, `src/app/globals.css`

**Problem:** ~47KB gzipped loaded eagerly. +80-150ms TTI on mobile.

**Fix (three-pronged):**

**A. CSS animations on discover page:** Replace `<motion.div whileInView>` with CSS `@keyframes revealUp` + `IntersectionObserver` hook.

**B. `dynamic()` for animation components:** Lazy-load `StickyAudioPlayer`, `GemCompleteAnimation`, `ParticleGemAnimation`, `SoundWaveAnimation`, `QueuePositionIndicator` with `{ ssr: false }`.

**C. `optimizePackageImports` in next.config.js:**
```javascript
experimental: { optimizePackageImports: ['framer-motion', 'lucide-react'] }
```

**Order:** C first (zero risk), then A, then B.

**Expected:** Bundle from ~47KB to <15KB. TTI: -30-60ms on mobile.

**Verification:** `next build` + bundle analyzer. Lighthouse TTI comparison.

---

## Fix 4 — useUnreadCount Polls 2 Queries/30s/User (HIGH)

**File:** `src/hooks/useUnreadCount.ts`

**Problem:** 2 Supabase queries every 30s per authenticated user. Second query loads all episodes for all subscriptions and cross-joins in JS.

**Fix:**

**A. SQL function:** Create `count_new_episodes(p_user_id uuid)` that does a single `COUNT(DISTINCT) ... JOIN ... WHERE published_at > last_viewed_at`.

**B. Increase poll to 5 minutes:** `POLL_INTERVAL_MS = 5 * 60_000`. `refetchCount` already fires on explicit actions.

**C. (Follow-up):** Supabase Realtime for notifications instead of polling.

**Expected:** DB queries: 400/min (100 users) -> 20/min. Eliminates JS cross-join.

**New migration:** `supabase/migrations/20260319_count_new_episodes_fn.sql`

---

## Fix 5 — Admin 5,000-Row JS Aggregation (HIGH)

**Files:** `api/admin/content/route.ts`, `api/admin/ai/route.ts`, `api/admin/users/route.ts`

**Problem:** Fetches 5,000 rows for in-memory grouping. Silent truncation.

**Fix:** Create SQL RPCs:
- `episodes_by_week()` — `DATE_TRUNC('week') GROUP BY`
- `top_podcasts_by_episodes(limit)` — `COUNT(*) GROUP BY ORDER BY DESC`
- `summaries_by_level_status()` — `GROUP BY level, status`

Add 15-minute Redis cache to `content` and `users` routes.

**New migration:** `supabase/migrations/20260319_admin_analytics_fns.sql`

**Expected:** 5,000 rows -> ~30 aggregated rows. -200-400ms response time.

---

## Fix 6 — SafeImage Hostname Regex per Render (MEDIUM)

**File:** `src/components/SafeImage.tsx` lines 47-54

**Problem:** `isAllowedHostname` runs 30 regex tests per image per render. 50 images = 1,500 regex calls.

**Fix:** Module-level `Map<string, boolean>` cache for hostname results:
```typescript
const hostnameAllowedCache = new Map<string, boolean>();
function isAllowedHostname(src: string): boolean {
  const { hostname } = new URL(src);
  const cached = hostnameAllowedCache.get(hostname);
  if (cached !== undefined) return cached;
  const result = ALLOWED_PATTERNS.some(p => p.test(hostname));
  hostnameAllowedCache.set(hostname, result);
  return result;
}
```

Bounded naturally (~20-30 CDN domains). No eviction needed.

---

## Fix 7 — artworkCache Map Memory Leak (LOW)

**File:** `src/app/discover/page.tsx` lines 56-64

**Fix:** Remove cache entirely. `.replace('100x100', '600x600')` is negligible cost. Inline at call sites.

---

## Fix 8 — SummaryPanel 2.5s Polling (MEDIUM)

**File:** `src/components/SummaryPanel.tsx` line 86

**Fix A (immediate):** Increase to `5000ms`.

**Fix B (follow-up):** Subscribe to `SummarizeQueueContext` events instead of independent polling.

**Expected:** 24 req/min -> 6 req/min (or 0 with Fix B).

---

## Fix 9 — @react-email/components Server-Only Guard (LOW)

**File:** `src/emails/summary-ready.tsx`

**Fix:** Add `import 'server-only';` as first line. Prevents accidental client bundle inclusion (~80KB).

---

## Fix 10 — genre-episodes + todays-insights In-Memory Scoring (MEDIUM)

**Files:** `api/discover/genre-episodes/route.ts`, `api/discover/todays-insights/route.ts`

**Fix:** Add Redis caching (same pattern as daily-mix):
- `discover:genre:{genreId}:{limit}` — 1 hour TTL
- `discover:insights:{lang}` — 30 min TTL

---

## Fix 11 — Subscriptions Full Episode Table Scan (HIGH)

**File:** `src/app/api/subscriptions/route.ts` lines 51-76

Already covered in backend plan. Create `subscription_episode_counts` SQL function.

---

## Fix 12 — EpisodeList Items Not Memoized (MEDIUM)

**File:** `src/components/EpisodeList.tsx`

**Fix:**
- Wrap `EpisodeItem` with `React.memo`
- Move `useAudioPlayerSafe` into `EpisodeItem` so only the playing episode re-renders
- Ensure parent callbacks are `useCallback`-wrapped

**Expected:** 50+ re-renders per audio tick -> 1.

---

## Implementation Sequence

| Priority | Fix | Effort | Risk |
|---|---|---|---|
| 1 | Fix 3c: optimizePackageImports | 5 min | None |
| 2 | Fix 6: SafeImage cache | 15 min | None |
| 3 | Fix 7: Remove artworkCache | 10 min | None |
| 4 | Fix 9: server-only guard | 5 min | None |
| 5 | Fix 8a: Poll 5s | 5 min | None |
| 6 | Fix 4: useUnreadCount SQL + 5-min poll | 45 min | Low |
| 7 | Fix 1: Redis feed cache | 45 min | Low |
| 8 | Fix 3a: CSS animations | 30 min | Low |
| 9 | Fix 12: Memoize EpisodeItem | 30 min | Low |
| 10 | Fix 10: Redis genre/insights cache | 30 min | Low |
| 11 | Fix 2: Composite trending-feed route | 60 min | Medium |
| 12 | Fix 5: Admin SQL aggregation | 90 min | Medium |
| 13 | Fix 11: Subscriptions SQL | 60 min | Medium |
| 14 | Fix 3b: dynamic() animations | 45 min | Medium |
| 15 | Fix 8b: Queue context subscription | 60 min | Medium |

---

## New Migrations

| Fix | File |
|---|---|
| 4 | `supabase/migrations/20260319_count_new_episodes_fn.sql` |
| 5 | `supabase/migrations/20260319_admin_analytics_fns.sql` |
| 11 | `supabase/migrations/20260319_subscription_episode_counts_fn.sql` |

---

## Before/After Metrics

| Metric | Before | After |
|---|---|---|
| `/api/feed` cold-start lookups | 2 Supabase queries | 0 (Redis HIT) |
| Discover trending round-trips | 2 serial | 1 composite |
| framer-motion initial bundle | ~47 KB | <15 KB |
| useUnreadCount DB queries/min (100 users) | ~400 | ~20 |
| Admin content row transfer | 5,000 rows | ~30 rows |
| SafeImage regex calls/render (50 images) | 1,500 | 50 |
| EpisodeList re-renders per audio tick | 50+ | 1 |
| SummaryPanel polls/min | 24 | 6 |
