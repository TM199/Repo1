/**
 * Scan Queue Helper
 *
 * Manages the background queue for ICP profile expansion.
 * Queues additional role variations and location searches
 * to spread API calls over time.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { ScanQueueTask, ScanQueueTaskType, ScanProgress } from '@/types';
import { getRemainingCalls } from '@/lib/rate-limiter';

// UK cities for expanded location searches (beyond user's ICP locations)
const UK_EXPANSION_LOCATIONS = [
  'Edinburgh',
  'Glasgow',
  'Bristol',
  'Newcastle',
  'Sheffield',
  'Nottingham',
  'Southampton',
  'Liverpool',
  'Cambridge',
  'Oxford',
  'Brighton',
  'Cardiff',
  'Belfast',
  'Coventry',
  'Derby',
];

/**
 * Queue expansion tasks after initial ICP scan.
 * Queues remaining role variations and expanded locations.
 */
export async function queueExpansionTasks(
  supabase: SupabaseClient,
  icpProfileId: string,
  batchId: string,
  roles: string[],
  searchedRoles: string[], // Roles already searched in sync phase
  userLocations: string[],
  searchedLocations: string[] // Locations already searched
): Promise<number> {
  const tasks: Partial<ScanQueueTask>[] = [];
  const userLocationSet = new Set(userLocations.map(l => l.toLowerCase()));
  const searchedLocationSet = new Set(searchedLocations.map(l => l.toLowerCase()));

  // 1. Queue remaining role variations (skip already searched)
  for (const role of roles) {
    if (!searchedRoles.includes(role)) {
      // Queue for each user location
      for (const location of userLocations) {
        tasks.push({
          icp_profile_id: icpProfileId,
          batch_id: batchId,
          task_type: 'role_variation',
          keywords: role,
          location,
          priority: 1, // Higher priority for user's specified roles
        });
      }
    }
  }

  // 2. Queue expanded location searches
  // Use the primary roles (first 2) for each expansion location
  const primaryRoles = roles.slice(0, 2);
  for (const location of UK_EXPANSION_LOCATIONS) {
    // Skip if it's already in user's locations or was searched
    if (userLocationSet.has(location.toLowerCase()) || searchedLocationSet.has(location.toLowerCase())) {
      continue;
    }

    for (const role of primaryRoles) {
      tasks.push({
        icp_profile_id: icpProfileId,
        batch_id: batchId,
        task_type: 'expanded_location',
        keywords: role,
        location,
        priority: 0, // Lower priority for expansion
      });
    }
  }

  // Insert all tasks
  if (tasks.length > 0) {
    await supabase.from('scan_queue').insert(tasks);
  }

  // Update ICP profile status
  await supabase
    .from('icp_profiles')
    .update({
      scan_status: 'expanding',
      scan_batch_id: batchId,
      scan_progress: {
        jobs_found: 0,
        companies_found: 0,
        signals_generated: 0,
        tasks_pending: tasks.length,
        tasks_completed: 0,
        last_updated: new Date().toISOString(),
      } as ScanProgress,
    })
    .eq('id', icpProfileId);

  return tasks.length;
}

/**
 * Get next pending tasks from the queue.
 * Respects rate limits and priorities.
 */
export async function getNextQueueTasks(
  supabase: SupabaseClient,
  limit: number = 1
): Promise<ScanQueueTask[]> {
  // Check remaining API budget
  const remaining = await getRemainingCalls('reed');
  if (remaining <= 0) {
    console.log('[ScanQueue] No API budget remaining for today');
    return [];
  }

  // Get pending tasks, ordered by priority (higher first) and creation time
  const { data: tasks, error } = await supabase
    .from('scan_queue')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_for', new Date().toISOString())
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(Math.min(limit, remaining));

  if (error) {
    console.error('[ScanQueue] Error fetching tasks:', error);
    return [];
  }

  return tasks || [];
}

/**
 * Mark a queue task as processing.
 */
export async function markTaskProcessing(
  supabase: SupabaseClient,
  taskId: string
): Promise<void> {
  await supabase
    .from('scan_queue')
    .update({
      status: 'processing',
      started_at: new Date().toISOString(),
      attempts: supabase.rpc('increment_attempts', { task_id: taskId }),
    })
    .eq('id', taskId);

  // Fallback if RPC doesn't exist - just increment manually
  const { data: task } = await supabase
    .from('scan_queue')
    .select('attempts')
    .eq('id', taskId)
    .single();

  if (task) {
    await supabase
      .from('scan_queue')
      .update({
        status: 'processing',
        started_at: new Date().toISOString(),
        attempts: (task.attempts || 0) + 1,
      })
      .eq('id', taskId);
  }
}

/**
 * Mark a queue task as completed.
 */
export async function markTaskCompleted(
  supabase: SupabaseClient,
  taskId: string,
  jobsFound: number
): Promise<void> {
  await supabase
    .from('scan_queue')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      jobs_found: jobsFound,
    })
    .eq('id', taskId);
}

/**
 * Mark a queue task as failed.
 */
export async function markTaskFailed(
  supabase: SupabaseClient,
  taskId: string,
  errorMessage: string
): Promise<void> {
  const { data: task } = await supabase
    .from('scan_queue')
    .select('attempts')
    .eq('id', taskId)
    .single();

  const attempts = task?.attempts || 0;
  const maxAttempts = 3;

  if (attempts >= maxAttempts) {
    // Permanent failure
    await supabase
      .from('scan_queue')
      .update({
        status: 'failed',
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
      })
      .eq('id', taskId);
  } else {
    // Retry later (schedule for 15 minutes from now)
    await supabase
      .from('scan_queue')
      .update({
        status: 'pending',
        error_message: errorMessage,
        scheduled_for: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      })
      .eq('id', taskId);
  }
}

/**
 * Update ICP profile scan progress.
 */
export async function updateScanProgress(
  supabase: SupabaseClient,
  icpProfileId: string,
  updates: Partial<ScanProgress>
): Promise<void> {
  // Get current progress
  const { data: profile } = await supabase
    .from('icp_profiles')
    .select('scan_progress')
    .eq('id', icpProfileId)
    .single();

  const currentProgress = (profile?.scan_progress as ScanProgress) || {
    jobs_found: 0,
    companies_found: 0,
    signals_generated: 0,
    tasks_pending: 0,
    tasks_completed: 0,
    last_updated: new Date().toISOString(),
  };

  const newProgress: ScanProgress = {
    ...currentProgress,
    ...updates,
    last_updated: new Date().toISOString(),
  };

  await supabase
    .from('icp_profiles')
    .update({ scan_progress: newProgress })
    .eq('id', icpProfileId);
}

/**
 * Check if all tasks for an ICP profile are complete.
 * If so, update status to 'completed'.
 */
export async function checkAndFinalizeExpansion(
  supabase: SupabaseClient,
  icpProfileId: string,
  batchId: string
): Promise<boolean> {
  // Count pending/processing tasks
  const { count: pendingCount } = await supabase
    .from('scan_queue')
    .select('*', { count: 'exact', head: true })
    .eq('icp_profile_id', icpProfileId)
    .eq('batch_id', batchId)
    .in('status', ['pending', 'processing']);

  if ((pendingCount || 0) === 0) {
    // All done - update status
    await supabase
      .from('icp_profiles')
      .update({
        scan_status: 'completed',
        last_synced_at: new Date().toISOString(),
      })
      .eq('id', icpProfileId);

    return true;
  }

  return false;
}

/**
 * Get summary stats for an ICP profile's expansion.
 */
export async function getExpansionStats(
  supabase: SupabaseClient,
  icpProfileId: string,
  batchId: string
): Promise<{
  total: number;
  pending: number;
  completed: number;
  failed: number;
  jobs_found: number;
}> {
  const { data: tasks } = await supabase
    .from('scan_queue')
    .select('status, jobs_found')
    .eq('icp_profile_id', icpProfileId)
    .eq('batch_id', batchId);

  if (!tasks) {
    return { total: 0, pending: 0, completed: 0, failed: 0, jobs_found: 0 };
  }

  return {
    total: tasks.length,
    pending: tasks.filter(t => t.status === 'pending' || t.status === 'processing').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    failed: tasks.filter(t => t.status === 'failed').length,
    jobs_found: tasks.reduce((sum, t) => sum + (t.jobs_found || 0), 0),
  };
}
