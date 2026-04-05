-- Fix: Phase 1's partial unique index on dedupe_key is incompatible with
-- Supabase's .upsert({ onConflict: 'dedupe_key' }) — Postgres throws 42P10
-- "there is no unique or exclusion constraint matching the ON CONFLICT
-- specification" because the index is partial (WHERE dedupe_key IS NOT NULL).
--
-- ON CONFLICT (col) requires a NON-partial unique index/constraint.
--
-- Replace with a non-partial index. This is safe because Postgres treats
-- NULL as distinct in unique indexes by default — existing rows with
-- dedupe_key=NULL can coexist freely, uniqueness is only enforced on
-- non-NULL values (which is what we want).

DROP INDEX IF EXISTS uq_notification_dedupe;

CREATE UNIQUE INDEX uq_notification_dedupe
  ON notification_requests(dedupe_key);

COMMENT ON INDEX uq_notification_dedupe IS 'Non-partial unique index on dedupe_key. Multiple NULL values allowed (Postgres default). Required for .upsert(onConflict:dedupe_key) to work.';
