import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { createLogger } from '@/lib/logger';

const log = createLogger('admin');

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const admin = createAdminClient();
  const { data, error: dbError } = await admin
    .from('admin_todos')
    .select('*')
    .order('created_at', { ascending: false });

  if (dbError) {
    log.error('Failed to fetch todos', { error: dbError.message });
    return NextResponse.json({ error: 'Operation failed' }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json();
  const { title, description, priority } = body;

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error: dbError } = await admin
    .from('admin_todos')
    .insert({
      title: title.trim(),
      description: description?.trim() ?? '',
      priority: priority ?? 'medium',
    })
    .select()
    .single();

  if (dbError) {
    log.error('Failed to create todo', { error: dbError.message });
    return NextResponse.json({ error: 'Operation failed' }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
