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
  const limit = parseInt(searchParams.get('limit') || '100');

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
    return NextResponse.json([]);
  }

  // Build query - use admin client since signals table has no user_id column
  let query = adminSupabase
    .from('signals')
    .select('*, source:sources(name)')
    .order('detected_at', { ascending: false })
    .limit(limit);

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

  if (sourceType) {
    query = query.eq('source_type', sourceType);
  }

  if (isNew === 'true') {
    query = query.eq('is_new', true);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
