/**
 * Supabase client barrel exports.
 *
 * Usage:
 *   import { createClient } from '@/lib/supabase'           -> browser singleton
 *   import { createAdminClient } from '@/lib/supabase/admin' -> admin client (service role, server-only)
 *
 * NOTE: Do NOT re-export server-only modules here.
 * - './admin' has `import 'server-only'` — importing in client components would fail at build.
 * - './server' and './middleware' use `next/headers` — same restriction.
 * Import them directly: '@/lib/supabase/admin', '@/lib/supabase/server', '@/lib/supabase/middleware'.
 */

export { createClient } from './client';
