# Code Review #6 — Episode & Player

**Date:** 2026-04-03  
**Score:** 6.5/10  
**Scope:** Episode pages, podcast pages, audio player, listening progress, insights UI, comments

---

## How It Works

```
/episode/[id]  →  RSC: fetchEpisodeWithPodcast (parallel) → EpisodePageClient
/episode/[id]/insights  →  layout.tsx (SSR: metadata + JSON-LD)
                            page.tsx (client: ⚠️ re-fetches same data)
                              └── EpisodeSmartFeed (orchestrator)
                                    ├── SummaryTabContent / HighlightsTabContent / KeywordsTabContent
                                    ├── TranscriptTabContent / ShownotesTabContent
                                    ├── CommentsSection (optimistic CRUD)
                                    └── AskAIChatPopup (SSE stream)

/podcast/[id]  →  RSC: fetchPodcastWithEpisodes (no limit ⚠️) → PodcastPageClient

AudioPlayerContext → single <audio> element (lazy init)
  ├── PlayerControlsContext (stable: play/pause/seek/setEpisode)
  └── PlayerStateContext (high-frequency: currentTime, isPlaying, isLoading)

useListeningProgress → localStorage (immediate) + /api/listening-progress (DB sync)
  └── beforeunload / visibilitychange → saveListeningProgress
```

---

## Issues Found

### 🔴 Critical

**1. `src/app/episode/[id]/EpisodePageClient.tsx:57-63` — `posthog.capture` בגוף הrender**  
```ts
if (typeof window !== 'undefined') {
  posthog.capture('episode_viewed', { ... }); // נורה על כל re-render
}
```  
ב-Strict Mode מתדלק פעמיים per mount, ועל כל re-render מ-`videoCurrentTime` וכד'. מנפח analytics.  
**Fix:** `useEffect(() => { posthog.capture('episode_viewed', ...) }, [episodeId])`

**2. `src/hooks/useListeningProgress.ts:45` — `Array.sort()` מוטייט את ה-prop**  
```ts
const key = episodeIds.sort().join(','); // sort() in-place!
```  
`episodeIds` מגיע מ-`useMemo` ב-`EpisodeList`. המיון מוטייט את המערך השמור, משנה סדר episodes ב-parent בשקט ב-render הראשון.  
**Fix:** `[...episodeIds].sort().join(',')`

---

### 🟠 Important

3. **`src/app/episode/[id]/insights/page.tsx:69-96` — Double fetch — data שכבר נשלף מה-server נשלף שוב מה-client**  
`layout.tsx` כבר מביא episode + summaries מה-admin client. ה-`page.tsx` עושה fetch נוסף לאותו data ב-mount. תוצאה: skeleton flash גלוי על כל טעינה.  
**Fix:** שתף את `fetchEpisodeWithPodcast` (כבר ב-`React.cache`) עם ה-page, או העבר data דרך RSC props.

4. **`src/contexts/AudioPlayerContext.tsx:192-215` — Event listeners לא מנוקים ב-unmount**  
`initializeAudio` מוסיף 7 event listeners על ה-`Audio` element. ה-cleanup effect (line 208) רק עושה `src = ''` ו-`pause` — לא קורא `removeEventListener` על אף אחד מהם. בתרחישי testing או refactor עתידי — כל ה-handlers ידלפו.

5. **`src/contexts/AudioPlayerContext.tsx:218-239` — `beforeunload` + `visibilitychange` שולחים `fetch` — לא אמין ב-mobile**  
iOS Safari וChrome mobile לא מבטיחים שasync `fetch` יושלם אחרי `beforeunload`. ה-localStorage נשמר (sync), אבל ה-DB sync נאבד.  
**Fix:** `navigator.sendBeacon` במקום `fetch` בשני ה-handlers.

6. **`src/components/insights/CommentsSection.tsx:191-218` — `handleDelete` revert משתמש ב-stale closure**  
```ts
const prev = comments;       // snapshot לפני delete
...
catch { setComments(prev); setTotal(prev.length); } // BUG: prev.length = top-level count
```  
`setTotal(prev.length)` מגדיר את הbadge לmסמך entries ב-array, לא לסה"כ האמיתי (כולל replies). לאחר delete כושל — badge count שגוי לצמיתות.

7. **`src/lib/server/fetch-podcast.ts:27-51` — אין `limit()` על episodes**  
Podcast יומי עם 5+ שנות תוכן = 1,800+ episodes נשלפים במלואם, מסודרים ב-RSC payload, ומ-hydrated בDOM אחד. `PodcastPageClient` מאשר: `hasMore: false`.  
**Fix:** `.limit(100)` server-side + client-side pagination.

8. **`src/components/insights/CommentThread.tsx:118` — `avatar_url` לא מסוניטז**  
```tsx
<img src={comment.author.avatar_url} ... />
```  
שדה שנשלט על-ידי המשתמש (מ-OAuth metadata). `StickyAudioPlayer` משתמש ב-`sanitizeImageUrl` — comment thread צריך אותו הדבר. גם אין `onError` fallback.

---

### 🟡 Minor

- **`ChapterScrubber.tsx:69`** — `Array.findLast()` (ES2023) בלי polyfill — ייכשל ב-Safari < 15.4
- **`listening-progress/route.ts:51`** — `completed_at: undefined` שומר על הvalue הקיים רק כי Supabase מתעלם מ-`undefined`. שביר אם behavior ישתנה.
- **`ShownotesTabContent.tsx`** — מכפיל RTL detection שכבר קיים ב-`@/lib/rtl`

---

## מה טוב

- **Dual-context split** (PlayerControls / PlayerState) — מונע cascade re-renders מ-`currentTime` בכל עץ הcomponent
- **`useRef` mirror pattern** ב-AudioPlayerContext — פותר stale closures ב-event handlers בצורה נכונה
- **Local-first listening progress** — localStorage מיידי + DB sync async, עם debounce נכון
- **`React.cache` ב-server helpers** — `fetchEpisodeWithPodcast` + `fetchPodcastWithEpisodes` cached נכון
- **Optimistic comments עם revert** — create/reply/edit/delete כולם עם snapshot + revert on failure

---

## Top 3 Fixes (Priority Order)

1. **posthog.capture בrender body** — מנפח analytics עכשיו, כל re-render = event
2. **`Array.sort()` prop mutation** — מוטייט memo array בשקט, קשה לדבג
3. **Insights page double-fetch** — skeleton flash גלוי לכל משתמש על כל טעינה
