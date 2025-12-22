import { createAdminClient } from './server';
import { Signal } from '@/types';

/**
 * Get signals for a specific user by filtering through sources and search_runs.
 * Since signals table has no user_id, we join through the relationships.
 */
export async function getSignalsForUser(
  userId: string,
  options?: { limit?: number; isNew?: boolean }
): Promise<{ data: Signal[] | null; error: Error | null }> {
  const adminSupabase = createAdminClient();

  // Get user's source IDs
  const { data: sources } = await adminSupabase
    .from('sources')
    .select('id')
    .eq('user_id', userId);

  // Get user's search run IDs
  const { data: searchRuns } = await adminSupabase
    .from('search_runs')
    .select('id')
    .eq('user_id', userId);

  const sourceIds = sources?.map(s => s.id) || [];
  const searchRunIds = searchRuns?.map(r => r.id) || [];

  // Build query - include contacts for persistence after page reload
  let query = adminSupabase
    .from('signals')
    .select('*, source:sources(name), contacts:signal_contacts(*)')
    .order('detected_at', { ascending: false });

  // Filter by is_new if specified
  if (options?.isNew !== undefined) {
    query = query.eq('is_new', options.isNew);
  }

  // Filter: source_id in user's sources OR search_run_id in user's search runs
  // Also include global signals (government data) where source_id and search_run_id are both null
  const globalSignalsFilter = 'and(source_id.is.null,search_run_id.is.null)';

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

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  return { data: data as Signal[] | null, error: error as Error | null };
}

/**
 * Count signals for a specific user.
 */
export async function countSignalsForUser(
  userId: string,
  options?: { isNew?: boolean }
): Promise<number> {
  const adminSupabase = createAdminClient();

  // Get user's source IDs
  const { data: sources } = await adminSupabase
    .from('sources')
    .select('id')
    .eq('user_id', userId);

  // Get user's search run IDs
  const { data: searchRuns } = await adminSupabase
    .from('search_runs')
    .select('id')
    .eq('user_id', userId);

  const sourceIds = sources?.map(s => s.id) || [];
  const searchRunIds = searchRuns?.map(r => r.id) || [];

  let query = adminSupabase
    .from('signals')
    .select('*', { count: 'exact', head: true });

  if (options?.isNew !== undefined) {
    query = query.eq('is_new', options.isNew);
  }

  // Include global signals (government data) where source_id and search_run_id are both null
  const globalSignalsFilter = 'and(source_id.is.null,search_run_id.is.null)';

  if (sourceIds.length > 0 && searchRunIds.length > 0) {
    query = query.or(`source_id.in.(${sourceIds.join(',')}),search_run_id.in.(${searchRunIds.join(',')}),${globalSignalsFilter}`);
  } else if (sourceIds.length > 0) {
    query = query.or(`source_id.in.(${sourceIds.join(',')}),${globalSignalsFilter}`);
  } else if (searchRunIds.length > 0) {
    query = query.or(`search_run_id.in.(${searchRunIds.join(',')}),${globalSignalsFilter}`);
  } else {
    // User has no sources or search runs, just count global signals
    query = query.is('source_id', null).is('search_run_id', null);
  }

  const { count } = await query;
  return count || 0;
}

/**
 * Get signal IDs for a user (used for marking signals as read).
 */
export async function getSignalIdsForUser(userId: string): Promise<string[]> {
  const adminSupabase = createAdminClient();

  const { data: sources } = await adminSupabase
    .from('sources')
    .select('id')
    .eq('user_id', userId);

  const { data: searchRuns } = await adminSupabase
    .from('search_runs')
    .select('id')
    .eq('user_id', userId);

  const sourceIds = sources?.map(s => s.id) || [];
  const searchRunIds = searchRuns?.map(r => r.id) || [];

  if (sourceIds.length === 0 && searchRunIds.length === 0) {
    return [];
  }

  let query = adminSupabase
    .from('signals')
    .select('id')
    .eq('is_new', true);

  if (sourceIds.length > 0 && searchRunIds.length > 0) {
    query = query.or(`source_id.in.(${sourceIds.join(',')}),search_run_id.in.(${searchRunIds.join(',')})`);
  } else if (sourceIds.length > 0) {
    query = query.in('source_id', sourceIds);
  } else {
    query = query.in('search_run_id', searchRunIds);
  }

  const { data } = await query;
  return data?.map(s => s.id) || [];
}
