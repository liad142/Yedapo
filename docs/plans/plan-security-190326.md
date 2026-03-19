# Security Fix Plan — Production Readiness (2026-03-19)

## Overview

15 security findings. Ordered by severity: Critical (1-6) > Medium (7-12) > Low (13-15). All changes are isolated to specific files; no database migrations required.

---

## CRITICAL FIXES (must ship before launch)

### Fix 1: Telegram account takeover via crafted token

**File:** `src/app/api/notifications/telegram/webhook/route.ts` (lines 29-45)

**Root cause:** Webhook decodes `userId` from base64 token instead of looking up Redis. Attacker can craft `base64url(victimUserId:timestamp)` to hijack any user's Telegram connection.

**Change:** Remove lines 29-45 (base64 decode block). Replace with:
```typescript
import { getCached, deleteCached } from '@/lib/cache';

const userId = await getCached<string>(`telegram:connect:${token}`);
if (!userId) return NextResponse.json({ ok: true });
await deleteCached(`telegram:connect:${token}`); // single-use
```

**Testing:**
1. Mock `getCached` returning `null` for unknown token -> no upsert
2. Mock `getCached` returning valid userId -> upsert runs, key deleted
3. Security test: crafted base64 token -> rejected (no Redis key)

---

### Fix 2: Summary cancel IDOR

**File:** `src/app/api/summaries/[id]/cancel/route.ts`

**Root cause:** No ownership check. Any authenticated user can cancel any summary.

**Change:** Add before the update:
```typescript
const { data: ownership } = await admin
  .from('user_summaries')
  .select('id')
  .eq('user_id', user.id)
  .eq('episode_id', episodeId)
  .limit(1)
  .single();

if (!ownership) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

**Testing:** User A starts summary -> can cancel. User B tries -> 403.

---

### Fix 3: Notification send to arbitrary email

**File:** `src/app/api/notifications/send/route.ts` (lines 43-48)

**Change:** Enforce recipient matches authenticated user's email:
```typescript
if (channel === 'email') {
  if (!user.email) return NextResponse.json({ error: 'No email on account' }, { status: 400 });
  if (recipient !== user.email) return NextResponse.json({ error: 'Can only send to your own email' }, { status: 403 });
}
```

**Testing:** Send to own email -> works. Send to other email -> 403.

---

### Fix 4: Telegram webhook secret in URL query parameter

**File:** `src/app/api/notifications/telegram/webhook/route.ts` (line 10-12)

**Change:** Read from header instead of query param:
```typescript
const secret = request.headers.get('x-telegram-bot-api-secret-token');
```

**Infrastructure step:** Re-register webhook with Telegram passing `secret_token` in `setWebhook` body. Remove `?secret=` from URL. Rotate `TELEGRAM_WEBHOOK_SECRET`.

**Testing:** Correct header -> accepted. No header -> 403. Old query param -> 403.

---

### Fix 5: Admin panel client-side guard only

**Files:** `src/middleware.ts`

**Change:** Add server-side admin check in middleware:
```typescript
if (request.nextUrl.pathname.startsWith('/admin')) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return request.cookies.getAll(); }, setAll() {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email || !isAdminEmail(user.email)) {
    return NextResponse.redirect(new URL('/discover', request.url));
  }
}
```

Keep `AdminGuard` as defense-in-depth UX fallback.

**Testing:** Unauthenticated `/admin/overview` -> redirect. Non-admin -> redirect. Admin -> renders.

---

### Fix 6: Hardcoded admin email

**Files:** `src/app/api/admin/cron-test/route.ts:6`, `src/app/settings/page.tsx:676`

**Change cron-test:** Replace `const ADMIN_EMAIL = 'liad142@gmail.com'` with `import { isAdminEmail } from '@/lib/admin'` and `isAdminEmail(user.email)`.

**Change settings:** Replace `user?.email === 'liad142@gmail.com'` with `useIsAdmin()` hook.

**Verification:** `grep -r "liad142" src/` -> zero matches.

---

## MEDIUM FIXES (fix within first sprint)

### Fix 7: Open redirect in OAuth callback

**File:** `src/app/auth/callback/route.ts` (line 11, 80)

**Change:** Add sanitizer:
```typescript
function sanitizeNext(next: string | null): string {
  if (!next) return '/discover';
  if (!next.startsWith('/') || next.startsWith('//')) return '/discover';
  return next;
}
const next = sanitizeNext(searchParams.get('next'));
```

### Fix 8: Rate limiting fails open for high-cost endpoints

**File:** `src/lib/cache.ts` (lines 247-250)

**Change:** Add `failOpen` parameter (default `true`). Summary/insights/ask-AI callers pass `failOpen: false`.

### Fix 9: SSRF protection bypass

**File:** `src/app/api/podcasts/add/route.ts` (lines 11-31)

**Change:** Add post-resolution IP check using `dns.lookup()`. Block IPv6 private ranges. Reject URLs with userinfo (`@`).

### Fix 10: Notification send rate limit

**File:** `src/app/api/notifications/send/route.ts`

**Change:** Add `checkRateLimit('notification-send:${user.id}', 5, 60)`.

### Fix 11: Health endpoint leaks infrastructure details

**File:** `src/app/api/health/route.ts`

**Change:** Return minimal `{ status }` for unauthenticated. Full details only with `Authorization: Bearer <MONITORING_SECRET>`.

### Fix 12: Missing security headers

**File:** `next.config.js` (lines 49-76)

**Change:** Add `X-XSS-Protection: 1; mode=block`. Add `preload` to HSTS. Submit to hstspreload.org.

---

## LOW FIXES (hardening)

### Fix 13: DB error messages leaked in admin responses
Sanitize to generic messages. Log details server-side.

### Fix 14: Username enumeration via signUpOrIn
Normalize error messages for new vs existing users.

### Fix 15: Unvalidated analytics params
Allowlist event names. Cap params key count at 20.

---

## Implementation Order

1. Fix 6 (hardcoded email) — low risk
2. Fix 1 (Telegram token) — high security value
3. Fix 2 (summary cancel IDOR)
4. Fix 3 + Fix 10 (email + rate limit) — deploy together
5. Fix 4 (Telegram header) + infrastructure re-registration
6. Fix 5 (admin middleware) — test on staging first
7. Fix 7 (open redirect)
8. Fix 8 (rate limit fail-closed)
9. Fix 11 (health endpoint)
10. Fix 9 (SSRF DNS check)
11. Fix 12 (security headers)
12. Fixes 13-15 (hardening sprint)

---

## Verification Checklist

- [ ] Crafted base64 token to webhook -> no DB row created
- [ ] User B cancels User A's summary -> 403
- [ ] Send email to `victim@example.com` -> 403
- [ ] Webhook with `?secret=` query param -> 403
- [ ] `curl /admin/overview` (no cookies) -> redirect, no admin HTML
- [ ] `grep -r "liad142" src/` -> zero matches
- [ ] `?next=//evil.com` in OAuth callback -> redirects to `/discover`
- [ ] `curl /api/health` -> only `{"status":"ok"}`
- [ ] `POST /api/podcasts/add` with `http://[::1]/evil.xml` -> 400
- [ ] 6 rapid requests to `/api/notifications/send` -> 6th returns 429
- [ ] HSTS header contains `preload`

---

## Environment Variables Required

| Variable | Purpose | Fix |
|---|---|---|
| `MONITORING_SECRET` | Health endpoint auth | Fix 11 |
| `ADMIN_EMAILS` | Must be set (verify) | Fix 5, 6 |

**Rotate:** `TELEGRAM_WEBHOOK_SECRET` (was logged in plaintext)
