import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { signalsToCsv, signalsToJson } from '@/lib/export';

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
  const format = searchParams.get('format') || 'csv'; // csv or json
  const hasContacts = searchParams.get('has_contacts'); // true, false, or null for all
  const dateFrom = searchParams.get('date_from');
  const dateTo = searchParams.get('date_to');

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

  // Include global signals (government data)
  const globalSignalsFilter = 'and(source_id.is.null,search_run_id.is.null)';

  // Build query - include contacts for export
  let query = adminSupabase
    .from('signals')
    .select('*, contacts:signal_contacts(*)')
    .order('detected_at', { ascending: false });

  // Filter by user's sources or search runs, plus global signals
  if (sourceIds.length > 0 && searchRunIds.length > 0) {
    query = query.or(`source_id.in.(${sourceIds.join(',')}),search_run_id.in.(${searchRunIds.join(',')}),${globalSignalsFilter}`);
  } else if (sourceIds.length > 0) {
    query = query.or(`source_id.in.(${sourceIds.join(',')}),${globalSignalsFilter}`);
  } else if (searchRunIds.length > 0) {
    query = query.or(`search_run_id.in.(${searchRunIds.join(',')}),${globalSignalsFilter}`);
  } else {
    // User has no sources or search runs, just show global signals
    query = query.is('source_id', null).is('search_run_id', null);
  }

  if (signalType) {
    query = query.eq('signal_type', signalType);
  }

  if (ids && ids.length > 0) {
    query = query.in('id', ids);
  }

  if (searchRunId) {
    // Verify user owns this search run
    if (!searchRunIds.includes(searchRunId)) {
      return NextResponse.json({ error: 'Search run not found' }, { status: 404 });
    }
    query = query.eq('search_run_id', searchRunId);
  }

  if (dateFrom) {
    query = query.gte('detected_at', dateFrom);
  }

  if (dateTo) {
    query = query.lte('detected_at', dateTo);
  }

  const { data: signals, error } = await query;

  if (error) {
    console.error('[Export] Query error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Filter by has_contacts client-side
  let filteredSignals = signals || [];
  if (hasContacts === 'true') {
    filteredSignals = filteredSignals.filter(s => s.contacts && s.contacts.length > 0);
  } else if (hasContacts === 'false') {
    filteredSignals = filteredSignals.filter(s => !s.contacts || s.contacts.length === 0);
  }

  console.log(`[Export] Exporting ${filteredSignals.length} signals as ${format}`);

  const dateStr = new Date().toISOString().split('T')[0];

  if (format === 'json') {
    const json = signalsToJson(filteredSignals);
    return new NextResponse(json, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename=signals-${dateStr}.json`,
      },
    });
  }

  const csv = signalsToCsv(filteredSignals);
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename=signals-${dateStr}.csv`,
    },
  });
}
