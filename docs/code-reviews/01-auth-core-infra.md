# Code Review #1 — Auth & Core Infrastructure

**Date:** 2026-04-03  
**Score:** 7/10  
**Files reviewed:** `src/lib/supabase/*`, `src/lib/auth-helpers.ts`, `src/middleware.ts`, `src/contexts/AuthContext.tsx`, `src/lib/user-plan.ts`, `src/lib/plans.ts`, `src/lib/elevation.ts`, `src/hooks/useUserPlan.ts`, `src/contexts/UsageContext.tsx`

---

## How It Works

```
Browser → middleware.ts (session refresh) → API routes
                                          → /admin pages (admin guard)

AuthContext → supabase/client.ts (browser singleton)
           → onAuthStateChange listener
           → exposes: user, session, signIn/Out, UI state

API Routes → auth-helpers.ts → supabase/server.ts → getUser() (validated server-side)

Privileged ops → supabase/admin.ts (service role, bypasses RLS)

Plan system: user-plan.ts (server) ←→ useUserPlan hook (client) ←→ UsageContext
```

---

## Issues Found

### 🔴 Critical

**`src/middleware.ts` — double `getUser()` on every admin request**  
Every admin page navigation makes two network round-trips to Supabase auth.  
`updateSession()` already calls `getUser()` internally, then the admin guard creates a new client and calls it again.  
**Fix:** Return the resolved user from `updateSession()` and reuse it in the admin check.

---

### 🟠 Important

1. **`src/lib/supabase/index.ts:14`** — `createAdminClient` exported from the barrel.  
   If accidentally imported in a client component, Next.js won't throw — service role key silently becomes `undefined`.  
   **Fix:** Add `import 'server-only'` to `admin.ts` and remove it from the barrel.

2. **`src/lib/auth-helpers.ts:12-16`** — No distinction between "invalid token" and "Supabase unreachable".  
   A transient Supabase outage causes all authenticated users to get 401 with no indication it's an infrastructure failure.  
   **Fix:** Return a structured result `{ user, authError }` or throw a distinct error type for infrastructure failures.

3. **`src/hooks/useUserPlan.ts:34-47`** — One HTTP fetch per hook consumer.  
   If 5 components on a page call `useUserPlan()`, 5 parallel requests go to `/api/user/profile`.  
   Plan data already exists in `UsageContext`.  
   **Fix:** Wire `useUserPlan` to consume `UsageContext` instead of making its own fetch.

4. **`src/contexts/UsageContext.tsx:106-124`** — Optimistic increments never reconciled on failure.  
   With two tabs open: tab 2 has stale count, generates a summary, server rejects it — but tab 2 still shows incremented local count.  
   **Fix:** Call `refresh()` after any quota-exceeded API response.

5. **`src/lib/user-plan.ts:30`** — `return data.plan as UserPlan` with no validation.  
   If DB contains an unexpected value, `PLAN_LIMITS[plan]` returns `undefined` → crash.  
   **Fix:** `const validPlans: UserPlan[] = ['free', 'pro']; return validPlans.includes(data.plan) ? data.plan as UserPlan : 'free';`

---

### 🟡 Minor

1. **`src/contexts/AuthContext.tsx`** — `getSession()` used for initial hydration (local decode, not server-validated) instead of `getUser()`. Low risk for a podcast app but inconsistent with server-side pattern.

2. **`src/contexts/AuthContext.tsx:148-151`** — "User already exists" detected via error message string matching. Supabase error messages are not versioned — a package update could silently break this. The `identities?.length === 0` check is the reliable signal.

3. **`src/lib/plans.ts`** — `FREE_CUTOFFS` and `FULL_ACCESS` are identical (both all-`Infinity`). When a content restriction is eventually added, a developer may update one but not the other. Remove the alias or add a clear comment.

4. **`src/contexts/UsageContext.tsx`** — `setInterval` every 60s polling for reset time. A `setTimeout` scheduled to fire at the exact `resetsAt` time would be more efficient.

---

## What Is Done Well

- `getAuthUser()` correctly uses `getUser()` (server-validated) across all API routes — consistent and secure.
- Supabase client separation (browser / server / admin / middleware) matches the `@supabase/ssr` recommended pattern exactly.
- Middleware session refresh is textbook.
- `onAuthStateChange` properly cleaned up on unmount.
- `requireAdmin()` returns a discriminated union — callers can't forget to check the result.
- Optimistic update pattern in `UsageContext` with cancellation flags in `useEffect` is well-implemented.

---

## Top 3 Fixes (Priority Order)

1. **Double `getUser()` in middleware** — latency hit on every admin navigation
2. **`server-only` on `admin.ts`** — prevent accidental client-side import of service role client
3. **`useUserPlan` → consume `UsageContext`** — eliminate N parallel profile fetches per page
