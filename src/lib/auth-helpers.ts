import { createAuthServerClient } from '@/lib/supabase/server';
import { createLogger } from '@/lib/logger';

const log = createLogger('auth');

/**
 * Get the authenticated user from the request cookies.
 * Returns null if not authenticated (invalid/expired token).
 * Throws on infrastructure failures (Supabase unreachable) so callers
 * return 500 instead of a misleading 401.
 *
 * @param options.silent - When true, suppresses the error log for missing/invalid
 *   auth sessions. Use this on routes where unauthenticated access is expected
 *   (e.g. guest-accessible discovery endpoints) to avoid log noise.
 */
export async function getAuthUser(options?: { silent?: boolean }) {
  const supabase = await createAuthServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) {
    const status = error.status;
    // Auth errors (invalid/expired token) → return null (not authenticated).
    // Infrastructure errors (network failure, Supabase down) → throw so the
    // caller surfaces a 500 instead of a misleading 401.
    if (status === undefined || status === 0 || status >= 500) {
      log.error('Auth service unavailable', { message: error.message, status });
      throw new Error(`Auth service unavailable: ${error.message}`);
    }
    if (!options?.silent) {
      log.error('getAuthUser failed', { message: error.message });
    }
  }
  return user;
}
