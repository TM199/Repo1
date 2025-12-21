import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const adminSupabase = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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

  // If user has no sources or search runs, return 0
  if (sourceIds.length === 0 && searchRunIds.length === 0) {
    return NextResponse.json({ count: 0 });
  }

  // Count only this user's new signals
  let query = adminSupabase
    .from('signals')
    .select('*', { count: 'exact', head: true })
    .eq('is_new', true);

  if (sourceIds.length > 0 && searchRunIds.length > 0) {
    query = query.or(`source_id.in.(${sourceIds.join(',')}),search_run_id.in.(${searchRunIds.join(',')})`);
  } else if (sourceIds.length > 0) {
    query = query.in('source_id', sourceIds);
  } else {
    query = query.in('search_run_id', searchRunIds);
  }

  const { count, error } = await query;

  if (error) {
    console.error('[SignalsCount] Error:', error);
    return NextResponse.json({ count: 0 });
  }

  return NextResponse.json({ count: count || 0 });
}
