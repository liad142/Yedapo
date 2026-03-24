# Cleanup Dead Dependencies & Replace RSSHub Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove dead API keys, replace RSSHub localhost dependency with YouTube Data API, ensure dev=production parity.

**Architecture:** Replace `fetchYouTubeChannelFeed()` (RSSHub) with existing `fetchChannelVideos()` (YouTube Data API) in the 2 routes that use it. Delete `src/lib/rsshub.ts`. Keep `src/lib/rsshub-db.ts` (it's actually a DB layer, not RSSHub-specific). Remove dead env vars.

**Tech Stack:** Next.js, YouTube Data API v3, Supabase, TypeScript

---

### Task 1: Remove dead API keys from env files

**Files:**
- Modify: `.env.example`
- Modify: `.env.local`

**Step 1: Remove dead vars from .env.example**
Remove lines containing: `GROQ_API_KEY`, `ANTHROPIC_API_KEY`, `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `RSSHUB_BASE_URL`

**Step 2: Remove dead vars from .env.local**
Remove same keys from `.env.local`

**Step 3: Verify no code references these keys**
Run: `grep -r "GROQ\|ANTHROPIC_API_KEY\|SPOTIFY_CLIENT" src/`
Expected: No results

**Step 4: Commit**
```bash
git add .env.example
git commit -m "chore: remove dead API keys (Groq, Anthropic, Spotify, RSSHub)"
```
Note: Do NOT commit .env.local (it's gitignored)

---

### Task 2: Replace RSSHub in youtube/channels/follow route

**Files:**
- Modify: `src/app/api/youtube/channels/follow/route.ts`

**Step 1: Replace RSSHub imports with YouTube Data API imports**
- Remove: `import { fetchYouTubeChannelFeed, parseYouTubeInput, ... } from '@/lib/rsshub'`
- Add: `import { fetchChannelVideos } from '@/lib/youtube/api'`
- Keep utility functions (extractVideoId, extractChannelId, etc.) — move them or import from a shared place

**Step 2: Replace fetchYouTubeChannelFeed call with fetchChannelVideos**
The follow route at line ~99 calls `fetchYouTubeChannelFeed(parsed.value)`. Replace with `fetchChannelVideos(channelId)` which already exists and works in production.

**Step 3: Verify build compiles**
Run: `npx next build`
Expected: No errors

**Step 4: Commit**
```bash
git add src/app/api/youtube/channels/follow/route.ts
git commit -m "refactor: replace RSSHub with YouTube Data API in follow route"
```

---

### Task 3: Replace RSSHub in youtube/refresh route

**Files:**
- Modify: `src/app/api/youtube/refresh/route.ts`

**Step 1: Replace RSSHub imports with YouTube Data API**
- Remove: `import { fetchYouTubeChannelFeed, checkRateLimit } from '@/lib/rsshub'`
- Add: `import { fetchChannelVideos } from '@/lib/youtube/api'`
- Import `checkRateLimit` from `@/lib/cache` instead

**Step 2: Replace fetchYouTubeChannelFeed call with fetchChannelVideos**

**Step 3: Verify build compiles**
Run: `npx next build`
Expected: No errors

**Step 4: Commit**
```bash
git add src/app/api/youtube/refresh/route.ts
git commit -m "refactor: replace RSSHub with YouTube Data API in refresh route"
```

---

### Task 4: Move utility functions out of rsshub.ts

**Files:**
- Modify: `src/lib/rsshub.ts` (extract utilities before deleting)
- Check: all importers of utility functions from rsshub.ts

**Step 1: Check what utilities from rsshub.ts are used elsewhere**
Functions: `extractVideoId`, `extractChannelId`, `extractHandle`, `parseYouTubeInput`
These may be imported by other files. If so, move them to `src/lib/youtube/utils.ts` or similar.

**Step 2: Move any needed utilities**

**Step 3: Delete `src/lib/rsshub.ts`**

**Step 4: Remove rsshub service from docker-compose.yml**

**Step 5: Verify build**
Run: `npx next build`
Expected: No errors

**Step 6: Commit**
```bash
git add -A
git commit -m "chore: delete rsshub.ts and docker rsshub service"
```

---

### Task 5: Manual verification on dev server

**Step 1: Start dev server**
Run: `npm run dev`

**Step 2: Test YouTube channel follow flow**
- Navigate to a YouTube channel page
- Click follow/unfollow
- Verify videos load correctly

**Step 3: Test YouTube feed**
- Navigate to discover page
- Filter by YouTube tab
- Verify videos appear with correct data

**Step 4: Test search**
- Search for a YouTube channel
- Verify results appear

**Step 5: Build final production check**
Run: `npx next build`
Expected: Clean build, no warnings about missing imports

---

### Task 6: Browser verification on production-like build

**Step 1: Run production build locally**
```bash
npx next build && npx next start
```

**Step 2: Use agent-browser to verify key pages**
- Homepage loads
- Discover page with YouTube tab works
- Channel page loads videos
- Follow/unfollow works (if logged in)

**Step 3: Final commit if any fixes needed**
