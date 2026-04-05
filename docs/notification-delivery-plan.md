# Yedapo Auto-Delivery Notification System — Implementation Plan

> **Source:** Consolidated output from Backend Architect + UX Researcher agents (2026-04-05)
> **Goal:** When a summary becomes ready, automatically deliver it to users who subscribed to that podcast/channel via their chosen channels (Email, Telegram, WhatsApp).

---

## Executive Summary

You already have ~80% of the infrastructure:
- `notification_requests` + `telegram_connections` tables ✓
- `notify_enabled` + `notify_channels` on subscriptions ✓
- `triggerPendingNotifications(episodeId)` already fires on summary-ready ✓
- Email (Resend) + Telegram (Bot API) senders ✓

**Missing:**
1. Subscription-based auto-fan-out (current trigger only handles explicit share requests)
2. WhatsApp channel via Kapso.ai
3. User delivery preferences UI (frequency, daily cap, per-source overrides)
4. Digest delivery mode (batched daily)
5. Rate limiting + idempotency hardening

---

## Architecture (Backend)

### Database changes

```sql
-- Migration: 20260404_auto_delivery_pipeline.sql

-- 1. Extend channel to include whatsapp
ALTER TABLE notification_requests DROP CONSTRAINT notification_requests_channel_check;
ALTER TABLE notification_requests ADD CONSTRAINT notification_requests_channel_check
  CHECK (channel IN ('email','telegram','whatsapp','in_app'));

-- 2. Audit + idempotency columns
ALTER TABLE notification_requests
  ADD COLUMN source TEXT NOT NULL DEFAULT 'explicit'
    CHECK (source IN ('explicit','subscription','digest')),
  ADD COLUMN dedupe_key TEXT,
  ADD COLUMN retry_count INT NOT NULL DEFAULT 0,
  ADD COLUMN next_retry_at TIMESTAMPTZ,
  ADD COLUMN provider_message_id TEXT;

CREATE UNIQUE INDEX uq_notification_dedupe
  ON notification_requests(dedupe_key) WHERE dedupe_key IS NOT NULL;
CREATE INDEX idx_nr_pending_ready
  ON notification_requests(status, next_retry_at)
  WHERE status = 'pending';

-- 3. WhatsApp connections (mirrors telegram_connections)
CREATE TABLE whatsapp_connections (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_e164 TEXT NOT NULL UNIQUE,
  verification_code TEXT,
  verification_expires_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  last_inbound_at TIMESTAMPTZ,        -- tracks Meta's 24h session window
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','verified','blocked')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. User delivery preferences
ALTER TABLE user_profiles
  ADD COLUMN notify_frequency TEXT NOT NULL DEFAULT 'immediate'
    CHECK (notify_frequency IN ('immediate','digest_daily','digest_weekly')),
  ADD COLUMN notify_digest_hour SMALLINT DEFAULT 8 CHECK (notify_digest_hour BETWEEN 0 AND 23),
  ADD COLUMN timezone TEXT DEFAULT 'UTC',
  ADD COLUMN notify_daily_cap INT DEFAULT 10;
```

### Dedupe key pattern
```
dedupe_key = `${user_id}:${episode_id}:${channel}:${source}`
```
Unique index = DB-enforced idempotency. No app-layer races.

### New function: `triggerSubscriptionNotifications(episodeId)`

Single UNION query across podcast_subscriptions + youtube_channel_follows:

```sql
WITH ep AS (SELECT id, podcast_id, youtube_channel_id FROM episodes WHERE id = $1),
subs AS (
  SELECT ps.user_id, ps.notify_channels
  FROM podcast_subscriptions ps, ep
  WHERE ps.podcast_id = ep.podcast_id AND ps.notify_enabled = true
  UNION
  SELECT yc.user_id, yc.notify_channels
  FROM youtube_channel_follows yc, ep
  WHERE yc.channel_id = ep.youtube_channel_id AND yc.notify_enabled = true
)
SELECT user_id, notify_channels FROM subs;
```

Then bulk UPSERT into `notification_requests` with `ON CONFLICT (dedupe_key) DO NOTHING`.

Called right after existing `triggerPendingNotifications` in `summary-service.ts`.

### Send loop claim-update pattern
```sql
UPDATE notification_requests SET status='sending', updated_at=NOW()
WHERE id = $1 AND status='pending' RETURNING *;
```
Only the row returned is sent — if two workers race, only one wins.

### Rate limits (Upstash Redis token buckets)

1. **Per-user daily cap**: `quota:notify:{userId}:{YYYY-MM-DD}`, plan-based (10 free, 100 pro)
2. **Provider rate limits**:
   - `rl:resend` → 10 req/s
   - `rl:telegram` → 30 msg/s
   - `rl:kapso` → ~80 msg/s (verify with Kapso)
3. **Backpressure**: if >20% of batch fails with rate-limit errors, sleep 30s

### Delivery modes

- **Immediate** (default): insert with `scheduled=false`, worker picks up instantly
- **Daily digest**: insert with `scheduled=true, next_retry_at=next_digest_time(user_tz, user.digest_hour)`. One hourly cron groups pending by (user_id, channel), sends ONE message per group.
- **Anti-spam**: if user has >5 pending notifications for same channel in last 30min → auto-collapse into digest

### WhatsApp template (submit to Meta for approval)

```
Name: yedapo_summary_ready
Category: UTILITY
Language: en
Body:
  New summary ready: *{{1}}*

  {{2}}

  Listen: {{3}}
Buttons: [URL: "Open in Yedapo" → {{4}}]
```

Variables: `{{1}}=episode_title`, `{{2}}=one_liner (≤120 chars)`, `{{3}}=podcast_name`, `{{4}}=deep_link_url`

---

## UX Design

### Information architecture

```
Settings → Notifications (top-level section, not nested under "Account")
├── Channels   — connect email/Telegram/WhatsApp; verification status
├── Delivery   — frequency, quiet hours, daily cap
├── Sources    — per-source overrides; bulk actions
└── History    — last 30 delivered notifications
```

### Global vs Per-source (inheritance pattern)

| Dimension | Decision |
|---|---|
| Default | Global = baseline; per-source = *override* only |
| New subscription | Inherits global channels + frequency automatically |
| Override UI | Per-source row collapsed by default; expand to customize |
| Channel selection | Global (users rarely want different channels per podcast) |
| Frequency | Global + per-source override (some shows deserve immediate) |
| Mute | Per-source only |

### Frequency default recommendation

**Default: Daily digest at 8 AM, immediate for starred sources.**

Rationale:
- 50+ sources × immediate = notification fatigue = uninstall (YouTube's mistake)
- Digest reframes as a scheduled ritual (Substack's win)
- "Star for immediate" gives power users an escape hatch
- Free tier: digest-only, removes cap complexity + creates clean upgrade trigger

### Connection flows

**Email:** Auto-verified via auth email → green check in panel (no flow needed)

**Telegram:**
```
Click "Connect Telegram"
  → Side-sheet: QR code + deep link t.me/YedapoBot?start={userToken}
  → User scans → Telegram opens → bot receives "/start {token}"
  → Webhook verifies token → updates user.telegram_chat_id
  → Side-sheet auto-closes, card shows "Connected as @username · Send test"
```

**WhatsApp:**
```
Click "Connect WhatsApp"
  → Side-sheet: country code dropdown + phone input
  → Submit → Kapso sends approved "verification" template with 6-digit code
  → User enters code → verify → store phone + opt-in timestamp
  → Show: "Verified. We'll use approved templates only — no free-form messages."
```

### Pitfalls to avoid (based on competitor research)

1. **YouTube's all-or-nothing trap** — forces bell/bell-with-ring/off per channel → notification fatigue. **Fix:** Default digest; make immediate opt-in.
2. **Spotify's opaque controls** — buries prefs 4 levels deep, no way to see what triggered what. **Fix:** Top-level Notifications + History tab.
3. **Substack's digest-only rigidity** — no per-newsletter frequency → power users mute everything. **Fix:** Inheritance model + star-for-immediate.

---

## Phased Rollout (recommended)

### Phase 1 — Foundation + Email/Telegram Auto-Fan-Out (4-5 hours)
**Ship immediately. Zero WhatsApp dependencies.**
- Migration: dedupe_key, source column, indexes
- `triggerSubscriptionNotifications()` function
- Wire into summary-service.ts (after existing triggerPendingNotifications)
- Admin UI: show subscription-sourced notifications distinctly
- **Result:** Users who toggle notify_enabled + select channels in the existing settings immediately start receiving summaries. No UI changes needed yet.

### Phase 2 — Delivery Preferences + User Settings UI (4-5 hours)
- Migration: user_profiles notify_frequency, daily_cap, timezone
- Settings page: Notifications section with Channels + Delivery tabs
- Frequency selector (immediate / digest_daily / digest_weekly)
- Daily cap control
- Per-source overrides table (simple version)

### Phase 3 — Digest Mode + Rate Limits (3-4 hours)
- Hourly digest cron
- Redis rate limit buckets (per-user + per-provider)
- Anti-spam collapse (>5 in 30min → digest)

### Phase 4 — WhatsApp via Kapso (4-5 hours)
**Requires Meta template approval first (submit Day 1, typically 1-2 day review).**
- Migration: whatsapp_connections table
- `src/lib/notifications/send-whatsapp.ts`
- Phone verification flow (enter number → Kapso code → verify)
- Settings UI: WhatsApp channel card
- Kapso webhook: `/api/notifications/whatsapp/webhook` for delivery confirmations
- Feature flag: `WHATSAPP_ENABLED`

### Phase 5 — Polish + Observability (2-3 hours)
- History tab (last 30 deliveries)
- Retry UI for failed sends
- Admin dashboard: per-channel success rate, failed recipient top 10
- "Send test" buttons per channel

**Total: ~20 hours across 5 PRs**

---

## Key Decisions (consolidated)

1. **Reuse `triggerPendingNotifications` worker loop** — refactor to accept `{ source?, scheduled? }` filter. One code path, two callers.
2. **Idempotency via `dedupe_key` unique index** — no app-level race check.
3. **Redis token buckets** for rate limits, NOT DB row locks.
4. **Single hourly digest cron** that computes user-TZ times at insert time, NOT 24 per-timezone crons.
5. **Ship WhatsApp behind feature flag** until Meta template approval lands.
6. **`source='subscription'` vs `source='explicit'`** — audit + enables A/B analysis later.

---

## Environment Variables Needed

```bash
# Already configured
RESEND_API_KEY=...
TELEGRAM_BOT_TOKEN=...

# New
KAPSO_API_KEY=...
KAPSO_PHONE_NUMBER_ID=...
WHATSAPP_ENABLED=true  # feature flag
```

---

## Files That Will Be Touched

### New
- `supabase/migrations/20260404_auto_delivery_pipeline.sql`
- `src/lib/notifications/send-whatsapp.ts`
- `src/lib/notifications/trigger-subscriptions.ts`
- `src/lib/notifications/rate-limit.ts`
- `src/app/api/cron/notification-digest/route.ts`
- `src/app/api/notifications/whatsapp/connect/route.ts`
- `src/app/api/notifications/whatsapp/verify/route.ts`
- `src/app/api/notifications/whatsapp/webhook/route.ts`
- `src/app/settings/notifications/page.tsx` (or refactor existing)

### Modified
- `src/lib/notifications/trigger.ts` (refactor loop to accept filter)
- `src/lib/summary-service.ts` (add second trigger call)
- `src/lib/insights-service.ts` (same)
- `src/app/settings/page.tsx` (link to new Notifications section)

---

## Acceptance Criteria

- [ ] Phase 1: User sets notify_enabled=true + notify_channels=['email'] → new summary → email arrives within 60s
- [ ] Phase 1: Same episode triggering twice does NOT double-send (dedupe_key works)
- [ ] Phase 2: User picks "daily digest at 8am" → summaries batched, one email per day at 8am user time
- [ ] Phase 2: Free user hits 10 notifications → 11th is blocked, upgrade prompt shown
- [ ] Phase 3: User with 50 podcasts all publishing at once → gets ONE digest, not 50 emails
- [ ] Phase 4: User enters phone → receives Kapso verification code → can send WhatsApp notifications
- [ ] Phase 5: Admin can see failed notifications + retry them

---

## Testing Strategy

- **Phase 1**: Unit test `triggerSubscriptionNotifications` with mock subscribers, assert single dedupe_key
- **Phase 2**: E2E Playwright test — toggle prefs → trigger summary → assert email received (use Mailtrap in test env)
- **Phase 3**: Integration test — seed 10 pending rows → run digest cron → assert 1 message sent
- **Phase 4**: Kapso sandbox (they should have test mode) — verify template rendering
