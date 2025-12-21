import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { signalsToCsv } from '@/lib/export';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const adminSupabase = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const signalType = searchParams.get('signal_type');
  const ids = searchParams.get('ids')?.split(',');
  const searchRunId = searchParams.get('search_run_id');

  // Get user's source IDs and search run IDs for filtering
  const { data: sources } = await adminSupabase
    .from('sources')
    .select('id')
    .eq('user_id', user.id);

  const { data: searchRuns } = await adminSupabase
    .from('search_runs')
    .select('id')
    .eq('user_id', user.id);

  const sourceIds = sources?.map(s => s.id) || [];
  const searchRunIds = searchRuns?.map(r => r.id) || [];

  // If user has no sources or search runs, return empty
  if (sourceIds.length === 0 && searchRunIds.length === 0) {
    const csv = signalsToCsv([]);
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename=signals-${new Date().toISOString().split('T')[0]}.csv`,
      },
    });
  }

  // Build query - filter by user's signals
  let query = adminSupabase
    .from('signals')
    .select('*')
    .order('detected_at', { ascending: false });

  // Filter by user's sources or search runs
  if (sourceIds.length > 0 && searchRunIds.length > 0) {
    query = query.or(`source_id.in.(${sourceIds.join(',')}),search_run_id.in.(${searchRunIds.join(',')})`);
  } else if (sourceIds.length > 0) {
    query = query.in('source_id', sourceIds);
  } else {
    query = query.in('search_run_id', searchRunIds);
  }

  if (signalType) {
    query = query.eq('signal_type', signalType);
  }

  if (ids && ids.length > 0) {
    query = query.in('id', ids);
  }

  if (searchRunId) {
    // Verify user owns this search run (already filtered above, but double-check)
    if (!searchRunIds.includes(searchRunId)) {
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
