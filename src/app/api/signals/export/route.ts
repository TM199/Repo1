import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { signalsToCsv } from '@/lib/export';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  // Use admin client for signals since table has no user_id and RLS blocks access
  const adminSupabase = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const signalType = searchParams.get('signal_type');
  const ids = searchParams.get('ids')?.split(',');
  const searchRunId = searchParams.get('search_run_id');

  // Use admin client to bypass RLS for signals
  let query = adminSupabase
    .from('signals')
    .select('*')
    .order('detected_at', { ascending: false });

  if (signalType) {
    query = query.eq('signal_type', signalType);
  }

  if (ids && ids.length > 0) {
    query = query.in('id', ids);
  }

  if (searchRunId) {
    // Verify user owns this search run
    const { data: searchRun } = await supabase
      .from('search_runs')
      .select('id')
      .eq('id', searchRunId)
      .eq('user_id', user.id)
      .single();

    if (!searchRun) {
      return NextResponse.json({ error: 'Search run not found' }, { status: 404 });
    }

    query = query.eq('search_run_id', searchRunId);
  }

  const { data: signals, error } = await query;

  if (error) {
    console.error('[Export] Query error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.log(`[Export] Exporting ${signals?.length || 0} signals`);

  const csv = signalsToCsv(signals || []);

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename=signals-${new Date().toISOString().split('T')[0]}.csv`,
    },
  });
}
