import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-helpers';
import { createLogger } from '@/lib/logger';

const log = createLogger('admin');

/**
 * Check if an email is in the admin allow-list.
 */
const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim().toLowerCase()) ?? [];
if (adminEmails.length === 0) {
  log.warn('ADMIN_EMAILS env var is empty or missing. No users will have admin access.');
}

export function isAdminEmail(email: string): boolean {
  return adminEmails.includes(email.toLowerCase());
}

/**
 * Require admin access for an API route.
 * Returns the authenticated user or an error NextResponse.
 */
export async function requireAdmin(): Promise<
  { user: NonNullable<Awaited<ReturnType<typeof getAuthUser>>>; error?: never } |
  { user?: never; error: NextResponse }
> {
  const user = await getAuthUser();

  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  if (!user.email || !isAdminEmail(user.email)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { user };
}
