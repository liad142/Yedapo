# Code Review #2 — API Routes

**Date:** 2026-04-03  
**Score:** 6/10  
**Scope:** All ~60 route handlers under `src/app/api/`

---

## How It Works

```
src/app/api/
├── summaries/          — summary lifecycle (list, check status, cancel)
├── episodes/           — episode detail, summary request, Ask AI, comments, related
├── podcasts/           — add/get/delete podcasts, RSS refresh
├── discover/           — daily-mix, genre-episodes, personalized, todays-insights
├── youtube/            — OAuth, channel follow, video import, summary, classify
├── admin/              — stats, users, AI pipeline, notifications, system
├── cron/               — check-new-episodes, process-queued-summaries
├── user/               — profile, account deletion, usage/quota
├── subscriptions/      — list/add/remove podcast subscriptions
├── notifications/      — send, inbox, cancel, Telegram webhook
├── search/             — podcast search proxy
├── stats/              — new-summaries count
├── apple/, pi/         — Apple Podcasts & Podcast Index API proxies
├── feed/               — unified feed builder
├── listening-progress/ — progress save/retrieve
└── my-list/            — YouTube channel list
```

Auth model: `getAuthUser()` from `auth-helpers.ts` — server-validated via `getUser()`. Admin routes additionally check `requireAdmin()` (email allowlist). Cron routes validate Bearer token or QStash HMAC.

---

## Issues Found

### 🔴 Critical

**1. YouTube summary path bypasses daily quota — `src/app/api/youtube/[videoId]/summary/route.ts`**  
The podcast summary route (`/api/episodes/[id]/summaries`) calls `checkPlanQuota` before generating. The YouTube route has no quota check anywhere. A free-tier user can bypass their daily summary limit entirely by using the YouTube path instead of the podcast path. Only a 10/min rate limit exists — it does not enforce the daily cap.  
**Fix:** Add `checkPlanQuota(user.id, 'summary', PLAN_LIMITS[plan].summariesPerDay)` before calling `requestYouTubeSummary`, mirroring the podcast summary pattern.

**2. Full transcript + summary content in publicly cached CDN response — `src/app/api/episodes/[id]/route.ts:26-28, 85-107`**  
Response includes `transcript.text` and `summary.content` with `Cache-Control: public, s-maxage=3600` and no auth gate. After any user accesses an episode, the full transcript is freely available from CDN cache to anyone, regardless of plan.  
**Fix:** Either remove transcript/summary from this endpoint (they're available via the authenticated insights endpoint) or change to `private, no-store` + add auth check.

**3. Unbounded episode queries — 3 files**  
Same pattern in 3 routes — fetches ALL episode IDs for all subscribed podcasts with no `limit()` or date filter:
- `src/app/api/summaries/route.ts:108-113`
- `src/app/api/subscriptions/route.ts:51-54`
- `src/app/api/stats/new-summaries/route.ts:73-80`

For a user subscribed to a podcast with 5,000+ episodes, one request fetches thousands of DB rows.  
**Fix:** Add `published_at` recency filter (e.g. last 90 days) or `.limit(500)` to these intermediate queries.

---

### 🟠 Important

4. **`src/app/api/discover/daily-mix`** — Cache key is `daily-mix:${country}:${limit}` but response is personalized by user genre preferences. CDN `public` header means one user's unfiltered response can be served to another. First request to warm cache "wins" for everyone.

5. **`src/app/api/youtube/[videoId]/status/route.ts`** — No auth guard, no rate limit. Unauthenticated DB read for any videoId.

6. **`src/app/api/youtube/refresh/route.ts:23`** — Rate limit key is bare `user.id` instead of namespaced (e.g. `yt-refresh:${user.id}`). Collides with any other code using `user.id` as a rate-limit key.

7. **`src/app/api/youtube/classify/route.ts`** — No rate limit on an endpoint that calls YouTube Data API + Gemini AI. A user can POST 100 channels repeatedly, burning quota.

8. **`src/app/api/episodes/[id]/comments/[commentId]/route.ts:52` (PATCH)** — HTML not sanitized on comment edit, only on create. XSS risk via stored HTML in edited comments.

9. **`src/app/api/apple/podcasts/batch-episodes/route.ts`** — No auth guard, no rate limit. Triggers up to 20 parallel external Apple API fetches per anonymous request.

10. **`src/app/api/admin/users/route.ts:16`** — Fetches ALL user profiles from DB without server-side limit, slices to 1,000 in JavaScript. At 10k users, 10k rows transferred over the wire.

11. **`src/app/api/admin/notifications/[id]/resend/route.ts:34`** — `buildShareContent()` not wrapped in try/catch unlike the `force-send` sibling. Race condition can cause unhandled 500.

---

### 🟡 Minor

- `src/app/api/episodes/[id]/comments/[commentId]/route.ts` (DELETE) — no rate limit (PATCH has one, DELETE doesn't)
- `src/app/api/episodes/[id]/related/route.ts:54-65` — fetches 200 summaries with full `content_json` on every request with no caching
- `src/app/api/episodes/[id]/insights/route.ts:27-29` — full AI insights publicly cached (`public, s-maxage=60`), no auth gate
- `src/app/api/podcasts/[id]/route.ts` — no auth, no rate limit, exposes `rss_feed_url` for all episodes

---

## What Is Done Well

- **Admin auth:** `requireAdmin()` used correctly in every single admin route as the first call
- **Cron auth:** Both cron routes properly validate Bearer token (Vercel) and QStash HMAC signature. Redis distributed locks prevent double-execution
- **Comment ownership:** Edit and delete both verify `user_id` and `episode_id` cross-checks — no ID-juggling attacks
- **Rate limiting:** Applied consistently on all expensive write operations (summary generation, Ask AI, imports)
- **SSRF protection:** RSS URL ingestion has both regex-based private IP check + actual DNS resolution validation
- **Telegram webhook:** Uses header-based secret (not query param) — no token leakage in logs
- **YouTube OAuth:** CSRF protection with random state in `httpOnly` cookie, validated in callback

---

## Top 3 Fixes (Priority Order)

1. **YouTube summary quota bypass** — direct billing impact, easy to fix (copy pattern from podcast summary route)
2. **Public CDN cache of transcripts/summaries** — gated content freely accessible via CDN
3. **Unbounded episode DB queries** — reliability issue at scale, appears in 3 high-traffic endpoints
