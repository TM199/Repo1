import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const adminSupabase = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const signalType = searchParams.get('signal_type');
  const sourceType = searchParams.get('source_type');
  const isNew = searchParams.get('is_new');
  const search = searchParams.get('search'); // Company name search
  const industry = searchParams.get('industry'); // Industry filter
  const hasContacts = searchParams.get('has_contacts'); // Filter by contacts
  const dateFrom = searchParams.get('date_from'); // Date range start
  const dateTo = searchParams.get('date_to'); // Date range end
  const limit = parseInt(searchParams.get('limit') || '100');
  const offset = parseInt(searchParams.get('offset') || '0');

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

  // Include global signals (government data) where source_id and search_run_id are both null
  const globalSignalsFilter = 'and(source_id.is.null,search_run_id.is.null)';

  // Build query - include contacts for persistence after page reload
  let query = adminSupabase
    .from('signals')
    .select('*, source:sources(name), contacts:signal_contacts(*)', { count: 'exact' })
    .order('detected_at', { ascending: false })
    .range(offset, offset + limit - 1);

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

  // Apply filters
  if (signalType) {
    query = query.eq('signal_type', signalType);
  }

  if (sourceType) {
    query = query.eq('source_type', sourceType);
  }

  if (isNew === 'true') {
    query = query.eq('is_new', true);
  }

  if (search) {
    query = query.ilike('company_name', `%${search}%`);
  }

  if (industry) {
    query = query.ilike('industry', `%${industry}%`);
  }

  if (dateFrom) {
    query = query.gte('detected_at', dateFrom);
  }

  if (dateTo) {
    query = query.lte('detected_at', dateTo);
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Filter by has_contacts client-side (Supabase can't filter by related count easily)
  let filteredData = data || [];
  if (hasContacts === 'true') {
    filteredData = filteredData.filter(s => s.contacts && s.contacts.length > 0);
  } else if (hasContacts === 'false') {
    filteredData = filteredData.filter(s => !s.contacts || s.contacts.length === 0);
  }

  return NextResponse.json({
    data: filteredData,
    total: count || 0,
    hasMore: (offset + limit) < (count || 0)
  });
}
