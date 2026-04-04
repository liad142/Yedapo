# Code Review #7 — Admin Panel

**Date:** 2026-04-03  
**Score:** 6.5/10  
**Scope:** `src/app/(admin)/admin/*`, `src/components/admin/*`, `src/app/api/admin/*`, `src/lib/admin.ts`

---

## How It Works

```
AdminGuard (client) → probe /api/admin/overview → redirect to /discover if 401/403

All admin API routes:
  requireAdmin() → getAuthUser() + isAdminEmail() → 403 if not admin

Pages:
  Overview    → stats: users, summaries, subscriptions, recent activity
  AI          → pipeline status: stuck summaries, YouTube pipeline, manual reset
  Analytics   → PostHog events, funnel analysis
  Content     → RSS feeds, podcast management
  Notifications → send/cancel/force-send/resend
  Providers   → health checks: Supabase, Vercel, Deepgram, Gemini, PostHog, Resend
  System      → health, cron test, env var status
  Users       → list, plan change, delete
```

---

## Issues Found

### 🔴 Critical

**1. `src/app/api/admin/ai/youtube-pipeline/route.ts:88-123` — `userEmailById` declared but never populated**  
```ts
const userEmailById = new Map<string, string>(); // ← empty, never filled
...
userEmailById.get(requestedByUserId) ?? null // ← always null
```  
The "User" column in the YouTube pipeline table always shows a truncated UUID instead of an email. Clearly intended to work (pattern from `users/route.ts:79-88`) but was never implemented. Confidence: **100**.

**2. `src/app/api/admin/cron-test/route.ts:17-27` — Weaker auth than all other admin routes**  
כל שאר ה-admin routes קוראים ל-`requireAdmin()`. `cron-test` מאפשר bypass עם `x-cron-secret` header — כלי שמריץ trigger אמיתי על summary queue (`execute=true` line 162). Response מחזיר גם `CRON_SECRET_set: !!process.env.CRON_SECRET` ו-`NEXT_PUBLIC_APP_URL`. Confidence: **95**.  
**Fix:** השתמש ב-`requireAdmin()` ומחק את ה-secret bypass, או לפחות הסר את המידע הרגיש מה-trace.

**3. `src/components/admin/AdminGuard.tsx:27` — `setIsAdmin(true)` על כל status שאינו 401/403 — כולל 500**  
```ts
if (res.status === 403 || res.status === 401) { router.replace('/discover'); return; }
setIsAdmin(true); // ← נקרא גם על 500 Server Error
```  
Supabase outage = admin access granted. Confidence: **85**.  
**Fix:** `if (res.ok) setIsAdmin(true); else router.replace('/discover');`

---

### 🟠 Important

4. **`src/app/api/admin/users/route.ts:16` — Stats מחושבים מsample של 1000, totalUsers מציג מספר אמיתי**  
`usersThisWeek`, `onboardingRate`, `genreDistribution` מחושבים מ-max 1000 users (Supabase default). `totalUsers` = מספר אמיתי. בסיס משתמשים גדול → stats מטעים ללא אזהרה. Confidence: **90**.  
**Fix:** `count: 'exact', head: true` queries נפרדים לכל stat (כמו ב-`overview/route.ts`).

5. **`src/app/api/admin/notifications/route.ts:17-42` — 5000 rows לחישוב aggregated counts**  
שולף עד 5000 rows מלאים רק כדי לספור סטטוסים. צריך `count: 'exact', head: true` per status. Confidence: **92**.

6. **`src/app/api/admin/notifications/[id]/force-send` + `cancel` + `resend` — אין audit logging**  
שלוש פעולות בלתי הפיכות (שליחת notification למשתמש אמיתי, ביטול, שליחה מחדש) ללא `createLogger`. שאר ה-routes כן מלוגים (users/[id] line 54, users/plan line 42). Confidence: **85**.

7. **`src/app/api/admin/users/[id]/route.ts:8-55` — DELETE בלי UUID validation לפני 11 sequential deletes**  
`userId` מ-URL path עובר ישירות ל-11 `.delete().eq('user_id', userId)` calls ללא format validation. UUID column מגן מ-SQL injection, אבל validation מפורש נדרש לפעולה הרסנית כזו. Confidence: **82**.

8. **`src/app/(admin)/admin/ai/page.tsx:43-68` — Double fetch על שינוי filter**  
שני `useEffect` נפרדים עוקבים אחרי `youtubeStatus`/`youtubeLevel` ושניהם קוראים ל-`fetchData`. שינוי filter = שני fetches מקבילים. Confidence: **88**.

9. **`src/app/api/admin/providers/route.ts:514-519` — `notifications` table שגויה**  
`fetchResendStats` קורא `admin.from('notifications')` אבל הטבלה האמיתית היא `notification_requests`. תמיד מחזיר -1 → מציג "N/A" בproviders dashboard. Confidence: **100**.

10. **`src/app/api/admin/todos/[id]/images/route.ts:103-108` — Storage delete ללא cross-check עם todo**  
ניתן למחוק קובץ כלשהו ב-`admin-todo-images` bucket על-ידי שליחת URL שרירותי. אין בדיקה שה-URL שייך ל-todo הספציפי.

---

### 🟡 Minor

- **`AdminGuard.tsx`** — `useEffect` deps כולל `user` → re-validates on every token refresh (מיותר)
- **`overview/route.ts:77-81`** — `recentActivity` מציג truncated UUID במקום episode title
- **`DataTable.tsx:69`** — `key={i}` (index) → React reconciliation שגוי על sort, בעיקר ב-Users table עם interactive elements

---

## מה טוב

- `requireAdmin()` כ-first call בכל route (חוץ מ-`cron-test` שיש לו סיבה מוסברת)
- Providers route: כל external API call עטוף ב-`try/catch` + `AbortSignal.timeout`
- User deletion ו-plan change — logged + UI confirm step
- `count: 'exact', head: true` לmetrics בroutesרוב (overview נכון)
- `ADMIN_EMAILS` env var עם startup warning

---

## Top 3 Fixes (Priority Order)

1. **`userEmailById` never populated** — functional bug, column תמיד מציג UUID
2. **Users stats מsample** — stats מטעים ללא indication
3. **אין audit logging לnotification actions** — פעולות בלתי הפיכות ללא trail
