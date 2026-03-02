import { createAuthServerClient } from '@/lib/supabase/server';
import { createLogger } from '@/lib/logger';

const log = createLogger('auth');

/**
 * Get the authenticated user from the request cookies.
 * Returns null if not authenticated.
 */
export async function getAuthUser() {
  const supabase = await createAuthServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) {
    log.error('getAuthUser failed', { message: error.message });
  }
  return user;
}
