import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  try {
    const supabase = createAdminClient();

    const { count, error } = await supabase
      .from('summaries')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'ready');

    if (error) {
      console.error('[summary-count] Error querying summaries:', error);
      return NextResponse.json({ count: 0 }, { status: 500 });
    }

    return NextResponse.json(
      { count: count ?? 0 },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
        },
      }
    );
  } catch (error) {
    console.error('[summary-count] Unexpected error:', error);
    return NextResponse.json({ count: 0 }, { status: 500 });
  }
}
