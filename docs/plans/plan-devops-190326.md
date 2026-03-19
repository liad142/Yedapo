# DevOps & Deployment Fixes — Implementation Plan (2026-03-19)

## Overview

15 findings grouped into four phases. Estimated total effort: 2-3 developer days.

---

## Phase 1 — Critical Correctness (immediate)

### Fix 1: Health check validates wrong env var (CRITICAL)

**File:** `src/app/api/health/route.ts` line 40

**Change 1a:** `'SUPABASE_SERVICE_ROLE_KEY'` -> `'SUPABASE_SECRET_KEY'`

**Change 1b:** Return 503 for degraded (line 57):
```typescript
{ status: overallStatus === 'ok' ? 200 : 503 }
```

**Testing:** Unset `SUPABASE_SECRET_KEY` -> verify 503. All set -> verify 200.

---

### Fix 2: Hardcoded admin email in cron-test (HIGH)

**File:** `src/app/api/admin/cron-test/route.ts` line 6

**Change:** Remove `const ADMIN_EMAIL = 'liad142@gmail.com'`. Replace with `import { requireAdmin } from '@/lib/admin'` and use existing admin check pattern. Keep cron-secret header as alternative auth.

**Deployment:** Ensure `ADMIN_EMAILS` env var is set in Vercel before deploying.

---

## Phase 2 — Configuration Hardening (same sprint)

### Fix 3: Startup env var validation (HIGH)

**New file:** `src/instrumentation.ts`

```typescript
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const required = [
      'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SECRET_KEY', 'UPSTASH_REDIS_REST_URL',
      'UPSTASH_REDIS_REST_TOKEN', 'GOOGLE_GEMINI_API_KEY',
    ];
    const missing = required.filter(k => !process.env[k]);
    if (missing.length > 0) {
      console.error(JSON.stringify({
        level: 'error', message: 'STARTUP FAILED: Missing env vars', missing,
        timestamp: new Date().toISOString(),
      }));
      process.exit(1);
    }
  }
}
```

**Testing:** Remove `GOOGLE_GEMINI_API_KEY` from `.env.local`, run `next start` -> exits with clear error.

---

### Fix 4: Add missing variables to `.env.example` (HIGH)

**File:** `.env.example`

Add:
```dotenv
# Logging (optional)
LOG_LEVEL=

# Test runner (dev/test only)
TEST_BASE_URL=http://localhost:3000
```

Verify if `GROQ_API_KEY`, `ANTHROPIC_API_KEY`, `SPOTIFY_*` are actually used before adding.

---

### Fix 5: Add Sentry error monitoring (HIGH)

**New files:** `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`
**Modified:** `next.config.js` (wrap with `withSentryConfig`)

**Steps:**
1. `npm install @sentry/nextjs`
2. Create config files with DSN from env, `tracesSampleRate: 0.1` in prod
3. Wrap `next.config.js` with `withSentryConfig`
4. Add `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`, `SENTRY_AUTH_TOKEN` to `.env.example` and Vercel

**Testing:** Throw deliberate error -> verify in Sentry dashboard.

---

### Fix 6: HSTS missing preload (MEDIUM)

**File:** `next.config.js` line 58

```javascript
// Before
"max-age=31536000; includeSubDomains"
// After
"max-age=31536000; includeSubDomains; preload"
```

**Post-deploy:** Submit domain to hstspreload.org.

---

### Fix 7: Document CSP `unsafe-inline` (MEDIUM)

**File:** `next.config.js` line 64

Add comment documenting the tradeoff. No code change. Evaluate removal in hardening sprint.

---

### Fix 8: Commit and apply pending migrations (MEDIUM)

**Files:** `supabase/migrations/20260311_listening_progress.sql`, `20260312_fix_analytics_events_fk.sql`

**Steps:**
1. Verify `listening_progress` table doesn't already exist in prod
2. `git add` both files, commit
3. `supabase db push` to apply
4. Verify API routes work

---

### Fix 9: Docker RSSHub access control (LOW)

**File:** `docker-compose.yml` line 17

Add clarifying `# DEV ONLY` comment. Create `docker-compose.staging.yml` with `ACCESS_KEY: "${RSSHUB_ACCESS_KEY}"`.

---

## Phase 3 — Observability & Reliability

### Fix 10: Add request ID to logger (MEDIUM)

**File:** `src/lib/logger.ts`

Extend `createLogger` to accept optional `{ requestId }` context:
```typescript
export function createLogger(domain: string, context?: { requestId?: string }): Logger
```

In API routes, pass `request.headers.get('x-vercel-id') ?? crypto.randomUUID()`.

---

### Fix 11: Cron failure alerting (MEDIUM)

**New file:** `src/lib/notifications/send-admin-alert.ts`

Send Telegram message to `ADMIN_TELEGRAM_CHAT_ID` on cron failure. Apply to both cron routes' catch blocks.

Add `ADMIN_TELEGRAM_CHAT_ID` to `.env.example` and Vercel.

---

## Phase 4 — Code Quality Gates

### Fix 12: `rules-of-hooks` to error (MEDIUM)

**File:** `eslint.config.mjs`

```javascript
"react-hooks/rules-of-hooks": "error",  // was "warn"
"@next/next/no-img-element": "warn",    // was "off"
```

Run `npm run lint` first, fix any violations.

---

### Fix 13: Coverage thresholds (MEDIUM)

**File:** `vitest.config.ts`

```typescript
thresholds: { lines: 40, functions: 40, branches: 35 }
```

Add `"test:coverage": "vitest run --coverage"` and `"typecheck": "tsc --noEmit"` to `package.json`.

---

### Fix 14: Stricter TypeScript flags (LOW)

**File:** `tsconfig.json`

```json
"noUncheckedIndexedAccess": true,
"noUnusedLocals": true,
"noUnusedParameters": true
```

Create separate PR. Fix resulting errors in batches.

---

## Deployment Checklist

- [ ] `ADMIN_EMAILS` set in Vercel (Fix 2)
- [ ] `SUPABASE_SECRET_KEY` confirmed in Vercel (Fix 1)
- [ ] Sentry project created, DSN vars added (Fix 5)
- [ ] `ADMIN_TELEGRAM_CHAT_ID` added (Fix 11)
- [ ] Migrations applied to production (Fix 8)
- [ ] Domain submitted to hstspreload.org (Fix 6)
- [ ] `GET /api/health` returns 200 with `{"status":"ok"}` (Fix 1)

---

## Summary Table

| # | Finding | Phase | Effort |
|---|---------|-------|--------|
| 1 | Wrong env var + 200 on degraded | 1 | 5 min |
| 2 | Hardcoded admin email | 1 | 15 min |
| 3 | No startup validation | 2 | 30 min |
| 4 | Missing .env.example entries | 2 | 15 min |
| 5 | No error monitoring (Sentry) | 2 | 2 hrs |
| 6 | HSTS missing preload | 2 | 5 min |
| 7 | CSP documentation | 2 | 10 min |
| 8 | Uncommitted migrations | 2 | 30 min |
| 9 | Docker RSSHub access control | 2 | 20 min |
| 10 | Logger lacks request ID | 3 | 1 hr |
| 11 | Silent cron failures | 3 | 1 hr |
| 12 | ESLint rules-of-hooks severity | 4 | 15 min |
| 13 | No coverage thresholds | 4 | 30 min |
| 14 | TS strictness flags | 4 | 2-4 hrs |
