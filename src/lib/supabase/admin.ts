import 'server-only';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let adminClientInstance: SupabaseClient | null = null;

/**
 * Admin client that uses the service role key to bypass RLS.
 * Used for server-side operations like summary creation, podcast management, etc.
 */
export function createAdminClient(): SupabaseClient {
  if (adminClientInstance) {
    return adminClientInstance;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is required for admin operations');
  }
  if (!secretKey) {
    throw new Error('SUPABASE_SECRET_KEY is required for admin operations');
  }

  adminClientInstance = createClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return adminClientInstance;
}
