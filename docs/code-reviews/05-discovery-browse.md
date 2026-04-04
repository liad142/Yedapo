# Code Review #5 — Discovery & Browse

**Date:** 2026-04-03  
**Score:** 6.5/10  
**Scope:** `src/app/discover/`, `src/app/browse/`, `src/components/discovery/*` (17 files), `src/app/api/discover/*`, `src/lib/podcast-search.ts`, `src/lib/apple-podcasts.ts`, `src/lib/rss.ts`, `src/lib/rsshub-db.ts`

---

## How It Works

```
DiscoverPage (client component)
  ├── /api/discover/daily-mix     → last 100 ready summaries → score by genre → diversify → cursor paginate
  │     └── Redis cache: daily-mix:{country}:{limit}  (10 min)
  ├── /api/apple/top              → iTunes top charts → batch-episodes (parallel)
  │     └── Cache-Control: s-maxage=900
  ├── /api/discover/personalized  → user genre prefs → iTunes RSS per genre → dedupe
  │     └── Redis cache: personalized:{userId}:{country} (1h)
  └── /api/discover/todays-insights → recent deep summaries → extract actionable items
        └── Redis cache: 30 min

Browse:
  /browse/genre/[id]  → RSC: getPodcastsByGenre (up to 200) → GenrePageClient (in-memory slice)
  /browse/podcast/[id] → RSC: parallel metadata+episodes → BrowsePodcastClient

Search: /api/search → searchPodcasts() → Apple + PodcastIndex + YouTube (parallel) → IP rate limit
```

---

## Issues Found

### 🔴 Critical

**1. `src/lib/rss.ts:172` + `src/lib/apple-podcasts.ts:337` — SSRF in RSS feed fetcher**  
RSS feed URLs from iTunes/Podcast Index APIs are fetched without scheme or hostname validation. A compromised upstream response (or malicious Podcast Index entry) could return `file://`, `http://localhost`, or `http://169.254.169.254`.  
```ts
// rss.ts line 172
const feed = await parser.parseURL(rssUrl); // no validation
// apple-podcasts.ts line 337  
const response = await fetch(resolvedFeedUrl, { ... }); // no validation
```  
**Fix:** Validate scheme is `https:` and block private IP ranges before any fetch — mirror the SSRF protection in `/api/podcasts/add`.

**2. `src/app/api/discover/daily-mix/route.ts:109-117` — Personalised response cached under public key**  
Redis key: `daily-mix:${country}:${limit}` — no user ID. The route applies the authenticated user's genre preferences to scoring and serves the result from this shared key. First user to warm the cache sets everyone's feed for 10 minutes.  
**Fix:** Use `daily-mix:${userId || 'guest'}:${country}:${limit}` as cache key when genre filtering is applied, or cache only the unfiltered episode list and apply scoring per-request.

---

### 🟠 Important

3. **`src/app/discover/page.tsx:238,288` — `subscribedAppleIds` missing from `useEffect` deps**  
The initial feed fetch effect lists `[country, user?.id]` as deps but uses `subscribedAppleIds` inside `mapEpisodes`. If subscriptions load after the initial fetch (common async pattern), all feed episodes will have `isSubscribed: false` permanently until country changes or page reload.

4. **`src/lib/rsshub-db.ts:421-443` — N+1 queries in `populatePodcastFeedItems`**  
One `SELECT` per episode inside a `for` loop (up to 10 per podcast). Triggered by `HighSignalFeed` on every session start via `/api/podcasts/refresh`.  
**Fix:** Single `SELECT ... WHERE audio_url = ANY($1)` + Set lookup.

5. **`src/app/api/discover/genre-episodes/route.ts:46` — Cache key is country-agnostic**  
`discover:genre:${genreId}` has no country. Language filtering is skipped entirely — Hebrew/Spanish episodes appear in English genre shelves.

6. **`src/components/discovery/TrendingFeed.tsx:102-107` + `CuriosityFeed.tsx:38-43` — Fixed 1500ms timeout decoupled from data arrival**  
```ts
onLoadMore();
setTimeout(() => setIsLoadingMore(false), 1500); // resets regardless of fetch completion
```  
User can trigger duplicate loads if fetch takes >1.5s. Spinner persists 1.2s after cache hit.

7. **`src/app/api/discover/daily-mix/route.ts:321-328` — Cursor pagination fragile under shared timestamps**  
Cursor is an ISO date string. Multiple episodes with identical `publishedAt` (batch imports) cause cursor to land at the wrong index → duplicates or skipped items across pages.

8. **`src/components/discovery/SemanticSearchBar.tsx:263` — `incrementSummary()` called on import, not on summary completion**  
Client-side quota counter decrements when import succeeds, even if summarization later fails. User can exhaust quota without getting summaries.

9. **`src/app/browse/podcast/[id]/BrowsePodcastClient.tsx:194-199` — `eslint-disable` masks missing deps**  
```ts
useEffect(() => { if (!initialPodcast) { fetchPodcast(); fetchEpisodes(); } }, []);
// eslint-disable-line react-hooks/exhaustive-deps
```  
Suppresses legitimate warning. Should use a `useRef` mount guard instead.

---

### 🟡 Minor

- **`SummaryModal.tsx:106-109`** — Body scroll lock with `document.body.style.overflow = 'hidden'` doesn't handle multiple concurrent modals. Second modal's cleanup resets scroll lock for the first.
- **`UnifiedFeed`** — `HighSignalFeed` always sends `sourceType: 'all'`, then filters client-side. Redundant server-side merge query runs on every request.
- **`KnowledgeCard` key** — `key={${type}-${id}-${index}}` — `index` suffix signals unreliable `id`. Root cause: `id: videoId || item.id` fallback should never collide but the index masks this assumption.
- **`rsshub-db.ts:276-283`** — "all" mode offset calculation is correct only for a 50/50 YouTube/podcast split. Skewed libraries may exhaust one type while the other still has items, making "Load More" appear empty prematurely.

---

## What Is Done Well

- **Parallel data fetching:** Three independent sections fire concurrently at mount with independent cancellation tokens, error states, and retry handlers — exemplary pattern.
- **Daily Mix quality:** Language filtering + genre scoring + source diversification (max 2 per podcast) + cursor pagination layered cleanly.
- **`DiscoverySummarizeButton` state machine:** Full lifecycle `checking → idle → importing → queued → transcribing → summarizing → ready / failed` with `EpisodeLookupContext` batch-lookup for instant state on known episodes.
- **`SemanticSearchBar` UX:** AbortController on debounced search, keyboard navigation across flattened result index, YouTube URL direct-paste detection.

---

## Top 3 Fixes (Priority Order)

1. **Daily-mix personalised cache under public key** — one user's preferences corrupt the feed for all users in that country
2. **SSRF in RSS fetcher** — no validation on externally-supplied feed URLs
3. **`subscribedAppleIds` missing from useEffect deps** — all feed episodes permanently show wrong subscribe state on first load
