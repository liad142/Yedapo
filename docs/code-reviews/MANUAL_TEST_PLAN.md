# Manual Test Plan — Code Review Fixes

**Date:** 2026-04-03
**Branches:** `fix/code-review-01` through `fix/code-review-08`

Instructions: Merge all 8 branches into a test branch, then run through each section. Mark each item PASS/FAIL.

---

## Review #1 — Auth & Core Infrastructure

### 1.1 Double getUser in middleware (Critical)
- [ ] Navigate to `/admin` as an admin user
- [ ] Open browser DevTools → Network tab
- [ ] Verify only ONE `getUser` call appears in the middleware waterfall (previously two)
- [ ] Navigate to `/admin` as a non-admin → should redirect to `/discover`

### 1.2 server-only on admin.ts
- [ ] Run `npm run build` — confirm no client-side bundle includes `createAdminClient`
- [ ] If you add `import { createAdminClient } from '@/lib/supabase'` in any client component, build should fail with "server-only" error

### 1.3 Auth-helpers infrastructure error distinction
- [ ] Temporarily set `NEXT_PUBLIC_SUPABASE_URL` to an invalid URL
- [ ] Hit any authenticated API route → should return 500 (not 401)
- [ ] Restore the correct URL

### 1.4 useUserPlan consumes UsageContext
- [ ] Open a page that renders multiple components using `useUserPlan()` (e.g., discovery page)
- [ ] Network tab: confirm NO requests to `/api/user/profile` from useUserPlan — plan data comes from `/api/user/usage` (UsageContext)
- [ ] Verify plan limits, cutoffs, isFree/isPro/isGuest all display correctly

### 1.5 User plan validation
- [ ] (DB test) Manually set a user's `plan` column to `"invalid_plan"` in `user_profiles`
- [ ] Call `/api/user/profile` → should return `plan: "free"` (not crash)
- [ ] Restore the correct plan value

### 1.6 UsageContext setTimeout reset
- [ ] Generate a summary to use a quota slot
- [ ] Check that `resetsAt` is shown in the UI
- [ ] Wait for the reset time to pass (or set it to 1 minute in the future via DB)
- [ ] Verify usage auto-refreshes at the exact reset time (not polling every 60s)

### 1.7 Plans consolidation
- [ ] Verify free and pro users both see full content (no regression from FREE_CUTOFFS removal)
- [ ] Guest users still see gated content with blur + sign-up CTA

### 1.8 signUpOrIn identities check
- [ ] Sign up with email A, confirm account
- [ ] Try signing up again with email A → should auto-fallback to sign in (no error)

---

## Review #2 — API Routes

### 2.1 YouTube summary quota (Critical)
- [ ] As a free user with 0 summaries remaining, POST to `/api/youtube/{videoId}/summary`
- [ ] Should return 429 with "Daily summary limit reached" (not succeed)
- [ ] As a pro/admin user → should succeed normally

### 2.2 Episode detail cache private (Critical)
- [ ] Fetch `/api/episodes/{id}` — check response headers
- [ ] `Cache-Control` should start with `private` (not `public`)
- [ ] Confirm episode data still loads correctly on the episode page

### 2.3 Unbounded episode queries (Critical)
- [ ] Subscribe to a podcast with 1000+ episodes
- [ ] Load `/api/summaries`, `/api/subscriptions`, `/api/stats/new-summaries`
- [ ] All should return quickly (< 2s) — no timeout or massive payload
- [ ] Check that episodes older than 90 days from subscriptions don't appear in summaries feed

### 2.4 Daily-mix personalized cache
- [ ] Log in as User A (who prefers Technology)
- [ ] Load `/api/discover/daily-mix` → note the results
- [ ] In a different browser, log in as User B (who prefers Health)
- [ ] Load `/api/discover/daily-mix` → results should differ from User A
- [ ] Load as guest → should get unfiltered results

### 2.5 YouTube status rate limit
- [ ] Hit `/api/youtube/{videoId}/status` 31 times in 60 seconds from the same IP
- [ ] The 31st request should return 429

### 2.6 YouTube refresh rate limit key
- [ ] POST to `/api/youtube/refresh` — should succeed
- [ ] Other rate-limited actions for the same user should NOT be affected (no key collision)

### 2.7 YouTube classify rate limit + channel cap
- [ ] POST to `/api/youtube/classify` with 51 channels → should return 400 "Maximum 50"
- [ ] POST 6 times in 60 seconds → 6th should return 429

### 2.8 Comment edit XSS
- [ ] Create a comment on an episode
- [ ] Edit it to contain `<script>alert(1)</script>`
- [ ] Verify the stored comment body has HTML tags stripped
- [ ] View the comment → no script execution

### 2.9 Batch episodes rate limit
- [ ] POST to `/api/apple/podcasts/batch-episodes` 11 times from the same IP in 60s
- [ ] 11th should return 429

### 2.10 Admin users query limit
- [ ] Open admin Users page → data loads correctly
- [ ] (DB check) If you have >1000 users, verify stats are computed from the DB query (with `.limit(1000)`) not a JS slice

### 2.11 Notification resend try/catch
- [ ] In admin, try to resend a failed notification where the episode was deleted
- [ ] Should return a 500 with a descriptive error (not an unhandled crash)

### 2.12 Insights cache private
- [ ] GET `/api/episodes/{id}/insights` → check Cache-Control header is `private`

### 2.13 Related episodes reduced candidates
- [ ] Load related episodes for any episode → should still show up to 6 related items
- [ ] Response time should be slightly faster (100 candidates instead of 200)

---

## Review #3 — YouTube Pipeline

### 3.1 Channel detail cache private (Critical)
- [ ] GET `/api/youtube/channels/{id}` as User A → note `isFollowing`
- [ ] GET same endpoint as User B → `isFollowing` should reflect User B's state (not cached from A)
- [ ] Check `Cache-Control: private, no-store` in response headers

### 3.2 YouTube success page (Critical)
- [ ] Complete a YouTube OAuth flow
- [ ] The success page should show the checkmark and close automatically
- [ ] No error should appear (the dead POST code was removed)
- [ ] Open DevTools console → no `postMessage` to `*` (should use `window.location.origin`)

### 3.3 Handle follow resolution (Critical)
- [ ] Go to YouTube browse → paste a channel handle like `@lexfridman`
- [ ] Follow it → should resolve to the actual UC channel ID
- [ ] Channel should appear correctly in your followed channels list
- [ ] Videos should load for the channel

### 3.4 Quota tracking after success only
- [ ] (Redis check) Note current `yt-quota:{today}` value
- [ ] Trigger a YouTube API call that returns an error (e.g., invalid API key)
- [ ] Verify the quota counter did NOT increment
- [ ] Trigger a successful API call → quota counter should increment

### 3.5 YouTube summary distributed lock
- [ ] Open two browser tabs on the same YouTube video
- [ ] Click "Summarize" in both tabs simultaneously
- [ ] Only one Gemini call should fire (second tab should see "summarizing" status)
- [ ] Both tabs should eventually show the completed summary

### 3.6 Token manager error logging
- [ ] (Code inspection) Confirm `token-manager.ts` now logs errors from the Supabase update call

### 3.7 Metadata fetch timeout
- [ ] (Code inspection) Confirm `AbortSignal.timeout(10_000)` is present on both InnerTube fetch calls in `metadata.ts`

### 3.8 Metadata module-level client fix
- [ ] (Code inspection) Confirm `createAdminClient()` is called inside `ensureYouTubeMetadata()` not at module level

### 3.9 Refresh route logger
- [ ] POST `/api/youtube/refresh` → any errors should appear in structured logs (not `console.error`)

---

## Review #4 — Summaries & AI

### 4.1 Insights distributed lock (Critical)
- [ ] Open two tabs on the same episode insights page
- [ ] Trigger insights generation in both simultaneously
- [ ] Only one Gemini call should fire
- [ ] Both tabs should see the completed insights

### 4.2 Insights error path language filter
- [ ] Trigger insights for a Hebrew episode
- [ ] If generation fails, only the Hebrew variant should be marked failed (not English too)
- [ ] Verify by checking the `summaries` table: only one row per language should have `status=failed`

### 4.3 Insights cache invalidation multi-language
- [ ] Generate insights for a non-English episode
- [ ] Cache should be invalidated for both the detected language AND 'en'
- [ ] Subsequent GET should return fresh data (not stale "queued" status)

### 4.4 Module-level client fix
- [ ] (Code inspection) Confirm `insights-service.ts` no longer has `const supabase = createAdminClient()` at module level
- [ ] Each exported function should call `createAdminClient()` internally

### 4.5 Deep summary polling fix
- [ ] Generate a summary via the queue → monitor the polling
- [ ] When quick is ready but deep hasn't appeared yet, status should show "summarizing" (not "ready")
- [ ] Once deep is ready, status should flip to "ready" and "View Summary" button appears
- [ ] Deep tab should have content (not "generate")

### 4.6 Ask AI usage counter timing
- [ ] Ask a question in the Ask AI chat
- [ ] The usage counter should increment after the first streamed chunk arrives (not on HTTP 200 headers)
- [ ] If the stream errors mid-way, verify the counter was already incremented (acceptable — the tokens were generated)

---

## Review #5 — Discovery & Browse

### 5.1 SSRF in RSS fetcher (Critical)
- [ ] (API test) Try to add a podcast with RSS URL `http://localhost:3000/secret`
- [ ] Should be rejected with an SSRF error
- [ ] Try `http://169.254.169.254/latest/meta-data/` → also rejected
- [ ] Try `file:///etc/passwd` → also rejected
- [ ] Valid HTTPS RSS URLs should still work normally

### 5.2 subscribedAppleIds useEffect deps
- [ ] Load the discover page → subscribe to a new podcast while on the page
- [ ] The feed should update to reflect the new subscription's `isSubscribed` state
- [ ] No full page reload needed

### 5.3 N+1 queries in populatePodcastFeedItems
- [ ] Subscribe to a podcast and trigger a feed refresh
- [ ] (Performance) Page should load within 2s even for podcasts with many episodes
- [ ] New episodes should appear in the feed

### 5.4 Genre-episodes cache key with country
- [ ] Load genre episodes with country=us → note results
- [ ] Load same genre with country=il → results should differ (Hebrew content may appear)
- [ ] Second request shouldn't serve the first country's cached results

### 5.5 TrendingFeed/CuriosityFeed loading state
- [ ] Click "Load More" on trending or curiosity feed
- [ ] Spinner should appear while loading and disappear when data arrives
- [ ] If loading takes >1.5s, spinner should persist until data arrives (not reset prematurely)
- [ ] If loading is instant (cache hit), spinner should disappear immediately

### 5.6 Daily-mix cursor pagination
- [ ] Scroll through the daily mix feed, loading multiple pages
- [ ] No duplicate episodes should appear across pages
- [ ] No episodes should be skipped even if batch-imported at the same timestamp

### 5.7 SemanticSearchBar incrementSummary timing
- [ ] Search for a YouTube video and click import
- [ ] Quota counter should NOT decrement on import
- [ ] Quota counter should only decrement when the summary is actually generated

### 5.8 BrowsePodcastClient mount guard
- [ ] Navigate to `/browse/podcast/{id}` → data loads correctly
- [ ] Navigate away and back → no double fetch on re-mount
- [ ] No eslint-disable comments in the file

---

## Review #6 — Episode & Player

### 6.1 posthog.capture in useEffect (Critical)
- [ ] Open an episode page with PostHog debug mode enabled
- [ ] Verify `episode_viewed` fires exactly ONCE on mount
- [ ] Trigger a re-render (e.g., resize window, play audio) → no additional `episode_viewed` events

### 6.2 Array.sort non-mutating (Critical)
- [ ] Open a page that shows an episode list with listening progress
- [ ] Verify episodes appear in the correct order (not randomly reordered)
- [ ] Navigate away and back → order should be consistent

### 6.3 Audio event listener cleanup
- [ ] Play an episode → pause → navigate to a different page
- [ ] (Memory) No audio event listeners should leak (check DevTools Performance/Memory panel)
- [ ] Play another episode → no ghost handlers from the previous one

### 6.4 sendBeacon for mobile DB sync
- [ ] On a mobile device (or mobile emulator): play an episode for 30 seconds
- [ ] Close the tab/switch apps
- [ ] Reopen the app → listening progress should be saved from the point where you closed
- [ ] (Code inspection) Confirm `navigator.sendBeacon` is used in `beforeunload`/`visibilitychange`

### 6.5 Comment delete revert
- [ ] Add a comment, then add a reply to it
- [ ] Note the total comment count badge
- [ ] Delete the parent comment → if delete fails (simulate by going offline), badge count should restore correctly
- [ ] Badge should show the correct total (including replies), not just top-level count

### 6.6 Podcast episodes limit
- [ ] Navigate to `/podcast/{id}` for a podcast with many episodes
- [ ] Should load quickly with at most 100 episodes initially
- [ ] Page should not crash or be extremely slow

### 6.7 Avatar URL sanitization
- [ ] (DB test) Set a user's `avatar_url` to `javascript:alert(1)` in user_profiles
- [ ] View a comment from that user → avatar should not execute script
- [ ] Broken/invalid avatar URLs should show a fallback (initials)

---

## Review #7 — Admin Panel

### 7.1 YouTube pipeline user emails (Critical)
- [ ] Open admin → AI → YouTube Pipeline
- [ ] The "User" column should show email addresses (not truncated UUIDs)
- [ ] Verify for multiple rows

### 7.2 Cron test auth (Critical)
- [ ] GET `/api/admin/cron-test` without admin auth → should return 403
- [ ] GET with `x-cron-secret` header but no admin session → should return 403 (bypass removed)
- [ ] GET as admin → should return cron test results
- [ ] Response should NOT contain `CRON_SECRET_set` or `NEXT_PUBLIC_APP_URL`

### 7.3 AdminGuard on server error (Critical)
- [ ] (Simulate) Temporarily break the `/api/admin/overview` endpoint to return 500
- [ ] Navigate to `/admin` → should redirect to `/discover` (not grant admin access)
- [ ] Restore the endpoint → admin access works normally

### 7.4 User deletion UUID validation
- [ ] (API test) DELETE `/api/admin/users/not-a-uuid` → should return 400 "Invalid user ID format"
- [ ] DELETE with a valid UUID → should proceed normally

---

## Review #8 — Landing Page & Remotion

### 8.1 TRANSITION_OVERLAP (Critical)
- [ ] Export the Remotion promo video (`npx remotion render` in the video/ directory)
- [ ] Watch the end of the exported MP4 → should end cleanly (no black frames)
- [ ] Total duration should match expected (no extra 1.73s of silence)

### 8.2 Landing copy consistency (Critical)
- [ ] Visit the landing page → scroll to the pricing CTA section
- [ ] Should say "3 AI summaries per day" (not 5)
- [ ] Navigate to `/pricing` → free plan should also say 3
- [ ] Both numbers should match

### 8.3 Video preload
- [ ] (Code inspection) If HeroVideoShowcase exists, confirm `preload="metadata"` (not "auto")
- [ ] Load the landing page → Network tab → MP4 should not fully download on page load

### 8.4 StaggerItem reduced motion
- [ ] Enable "Reduce motion" in OS accessibility settings
- [ ] Load the landing page → scroll through features and how-it-works
- [ ] Elements should appear instantly without animation (no opacity:0 stuck state)
- [ ] Disable reduced motion → animations should work normally

### 8.5 Social links removed
- [ ] Scroll to the landing page footer
- [ ] There should be NO Twitter/GitHub links with `href="#"`
- [ ] Footer should have a clean 3-column layout

### 8.6 PricingCard auth state
- [ ] Visit `/pricing` while NOT logged in
- [ ] Free plan should show "Get Started Free" button (not "Current Plan")
- [ ] Clicking it should navigate to `/discover`
- [ ] Log in → free plan should show "Current Plan" (disabled)

### 8.7 FinalCTA reduced motion
- [ ] Enable "Reduce motion" in OS settings
- [ ] Scroll to the final CTA section on the landing page
- [ ] No floating particle animations should appear
- [ ] Gradient glow should not pulse
- [ ] Disable reduced motion → particles and glow should animate

---

## Cross-cutting Checks

### Build & Type Safety
- [ ] `npx tsc --noEmit` passes with no new errors
- [ ] `npm run build` completes successfully
- [ ] No new console warnings in development mode

### Regression
- [ ] Browse the discover page → episodes load, daily mix works
- [ ] Play a podcast episode → audio works, progress saves
- [ ] Generate a summary → full flow (quick → deep → insights) completes
- [ ] YouTube import → follow channel → summarize video → all work
- [ ] Admin panel → overview, users, AI pages all load correctly
- [ ] Landing page → all sections render, pricing page works
- [ ] Auth flow → sign up, sign in, Google OAuth, sign out all work
