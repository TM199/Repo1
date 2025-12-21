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

  // If user has no sources or search runs, return empty
  if (sourceIds.length === 0 && searchRunIds.length === 0) {
    return { data: [], error: null };
  }

  // Build query
  let query = adminSupabase
    .from('signals')
    .select('*, source:sources(name)')
    .order('detected_at', { ascending: false });

  // Filter by is_new if specified
  if (options?.isNew !== undefined) {
    query = query.eq('is_new', options.isNew);
  }

  // Filter: source_id in user's sources OR search_run_id in user's search runs
  if (sourceIds.length > 0 && searchRunIds.length > 0) {
    query = query.or(`source_id.in.(${sourceIds.join(',')}),search_run_id.in.(${searchRunIds.join(',')})`);
  } else if (sourceIds.length > 0) {
    query = query.in('source_id', sourceIds);
  } else {
    query = query.in('search_run_id', searchRunIds);
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

  if (sourceIds.length === 0 && searchRunIds.length === 0) {
    return 0;
  }

  let query = adminSupabase
    .from('signals')
    .select('*', { count: 'exact', head: true });

  if (options?.isNew !== undefined) {
    query = query.eq('is_new', options.isNew);
  }

  if (sourceIds.length > 0 && searchRunIds.length > 0) {
    query = query.or(`source_id.in.(${sourceIds.join(',')}),search_run_id.in.(${searchRunIds.join(',')})`);
  } else if (sourceIds.length > 0) {
    query = query.in('source_id', sourceIds);
  } else {
    query = query.in('search_run_id', searchRunIds);
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
