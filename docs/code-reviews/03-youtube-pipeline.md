# Code Review #3 — YouTube Pipeline

**Date:** 2026-04-03  
**Score:** 5/10  
**Scope:** `src/lib/youtube/*`, `src/app/api/youtube/*`, `src/app/browse/youtube/*`, YouTube UI components

---

## How It Works

```
User action (import/follow/summarize)
        │
        ▼
api/youtube/[videoId]/summary  ──► lib/youtube/summary.ts
        │                               │
        │                               ├── supadata.ts      → api.supadata.ai (transcript)
        │                               ├── metadata.ts      → YouTube watch page scrape
        │                               │    └── metadata-scraper.ts (ytInitialPlayerResponse)
        │                               └── generateSummaryForLevel → Gemini
        │
api/youtube/connect/*          ──► Google OAuth (CSRF state in httpOnly cookie)
        │
        ▼
token-manager.ts               → user_provider_tokens (Supabase)
                                  + Google token refresh (oauth2.googleapis.com)

api/youtube/channels/*         ──► api.ts (YouTube Data API v3)
                                    + Redis quota tracking
                                    + classify/route.ts (Gemini fallback)

Browse: /browse/youtube/[id]   ──► YouTubeChannelClient.tsx
Player: YouTubeEmbed.tsx       ──► YouTube IFrame API (lazy load)
        FloatingYouTubePlayer  ──► IntersectionObserver + Framer Motion drag
```

---

## Issues Found

### 🔴 Critical (4 בעיות)

**1. `Cache-Control: public` חושף `isFollowing` (per-user) ל-CDN — `src/app/api/youtube/channels/[id]/route.ts:104`**  
הresponse מכיל `isFollowing` ו-`channelDbId` של המשתמש הנוכחי עם `public, s-maxage=900`. Vercel CDN מאחסן את זה גלובלית. משתמש B מקבל את ה-follow state של משתמש A.  
**Fix:** שנה ל-`private, no-store` עבור response שמכיל data per-user.

**2. `youtube-success/page.tsx` — dead code + `postMessage` לכל origin**  
הדף שולח POST ל-`/api/youtube/connect` שאין לו POST handler (רק GET). תמיד מקבל 405, מציג שגיאה, נסגר. בנוסף: `postMessage('youtube-connected', '*')` שולח לכל origin — security issue.  
**File:** `src/app/auth/youtube-success/page.tsx:18-28`

**3. לוגיקת follow עם handle פגועה — `src/app/api/youtube/channels/follow/route.ts:95`**  
```ts
const channelId = parsed.type === 'channel' ? parsed.value : parsed.value;
```  
שני צידי הternary זהים — `@handle` נשמר כ-`channelId` במקום UC-string. `fetchChannelVideos` נכשל בשקט ונשמר row פגום עם `@handle` כ-ID.

**4. Non-atomic quota tracking ב-`lib/youtube/api.ts:33-37`**  
`trackQuota` עושה Redis `GET` → חישוב → `SET`. שני requests מקבילים קוראים `0`, שניהם כותבים `100` — במקום `200`. quota counter לא נכון תחת concurrency.  
**Fix:** השתמש ב-`INCR` atomic (כמו שעושה `checkRateLimit`).

---

### 🟠 Important (8 בעיות)

5. **`lib/youtube/summary.ts:28-91` — Race condition בbuild concurrent**  
שני requests מקבילים לאותו `episodeId+level` לא מוגנים ב-lock. שניהם יביאו transcript מ-Supadata ויריצו AI generation. `acquireLock` קיים ב-`cache.ts` אבל לא בשימוש כאן.

6. **`lib/youtube/token-manager.ts:68-76` — Supabase update לא נבדק**  
אחרי refresh מוצלח, ה-`update` לא נבדק לשגיאה. Token תקף מוחזר לcaller אבל ה-DB נשאר עם token ישן. בכל request הבא — refresh מיותר שוב.

7. **`lib/youtube/metadata.ts:44,81` — fetch ל-YouTube ללא timeout**  
`fetchPinnedComment` שולח שני POST ל-YouTube ללא `AbortSignal.timeout`. יכול לתלות את כל flow הsummarization עד שהVercel function תצא timeout.

8. **`app/api/youtube/classify/route.ts:31-56` — Prompt injection**  
`channel.title` ו-`channel.description` מהrequest body נכנסים ישירות ל-Gemini prompt ללא sanitization. אין גם cap על `channels.length`.

9. **`app/api/youtube/api.ts:101,147,196,220` — Quota נספר גם על request כושל**  
`trackQuota` נקרא לפני בדיקת `res.ok`. request שמחזיר 403/429 סופר quota units שלא נוצלו.

10. **`[videoId]/summary/route.ts` ו-`import/route.ts` — 45 שורות copy-paste**  
לוגיקת channel resolution זהה בשני routes. שינוי באחד לא יתעדכן בשני.

11. **`save/route.ts:85` — Hardcoded null UUID כ-`source_id`**  
```ts
source_id: '00000000-0000-0000-0000-000000000000'
```  
פוגע ב-FK integrity ומייצר rows שלא ניתן לקשר לchannel אמיתי.

12. **`lib/youtube/metadata.ts:6` — Module-level Supabase client**  
`createAdminClient()` נקרא ב-module scope. כל שאר הקבצים ב-`lib/youtube/` קוראים לו בתוך הפונקציה. inconsistent ועלול לגרום לבעיות בtest environments.

---

### 🟡 Minor

- `metadata-scraper.ts:30` — לולאה O(n) תו-בתו עד 2MB, חוסמת event loop
- `supadata.ts:39-46` — status 206 מטופל כ"no captions" בלי לוודא שה-body תואם
- `YouTubeEmbed.tsx:97` — `Math.random()` ב-`useRef` (בטוח עכשיו כי client-only, אבל `useId()` עדיף)
- `refresh/route.ts:75,87` — `console.error` במקום `createLogger` כמו שאר ה-routes

---

## מה טוב

- OAuth CSRF עם httpOnly state cookie — מושלם
- `videoId` validation (`/^[A-Za-z0-9_-]{11}$/`) בשני routes של import
- YouTube IFrame cleanup נכון ב-unmount
- Fallback ל-stale metadata כשfresh fetch נכשל (degradation נכון)
- pagination עם `do...while` ל-subscriptions נכון
- `acquireLock` infrastructure קיים — רק צריך להשתמש בו ב-summary.ts

---

## Top 3 Fixes (Priority Order)

1. **`Cache-Control: public` + `isFollowing`** — data privacy, ייצר באגים גלויים למשתמשים
2. **Handle → channel ID ב-follow** — שומר rows פגומים ב-DB בשקט
3. **`youtube-success` dead page + `postMessage('*')`** — dead code + security
