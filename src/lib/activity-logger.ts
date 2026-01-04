/**
 * Activity Logger - Utility for logging system activities to the activity feed
 *
 * Used by Inngest functions to log activities that appear in the dashboard.
 */

import { createAdminClient } from '@/lib/supabase/server';

export type ActivityType =
  | 'signals_detected'
  | 'jobs_synced'
  | 'classification_complete'
  | 'contracts_synced'
  | 'ch_signals'
  | 'queue_processed'
  | 'government_sync'
  | 'domains_resolved';

interface LogActivityParams {
  type: ActivityType;
  title: string;
  detail?: string;
  metadata?: Record<string, unknown>;
  icpProfileId?: string; // Optional: links activity to a specific ICP profile
}

/**
 * Log an activity to the system_activity table.
 * Activities appear in the dashboard activity feed in real-time.
 */
export async function logActivity({
  type,
  title,
  detail,
  metadata,
  icpProfileId,
}: LogActivityParams): Promise<void> {
  try {
    const supabase = createAdminClient();

    await supabase.from('system_activity').insert({
      type,
      title,
      detail: detail || null,
      metadata: metadata || {},
      icp_profile_id: icpProfileId || null,
    });
  } catch (error) {
    // Don't throw - activity logging should never break the main function
    console.error('[Activity Logger] Failed to log activity:', error);
  }
}

/**
 * Pre-built activity loggers for common events
 */
export const activityLogger = {
  jobsSynced: (count: number, source: string) =>
    logActivity({
      type: 'jobs_synced',
      title: 'Jobs synchronized',
      detail: `Fetched ${count} jobs from ${source}`,
      metadata: { source, count },
    }),

  signalsDetected: (count: number) =>
    logActivity({
      type: 'signals_detected',
      title: 'Pain signals detected',
      detail: `${count} new pain signals generated`,
      metadata: { count },
    }),

  classificationComplete: (count: number, agencies: number) =>
    logActivity({
      type: 'classification_complete',
      title: 'Companies classified',
      detail: `Classified ${count} companies (${agencies} agencies found)`,
      metadata: { total: count, agencies },
    }),

  contractsSynced: (count: number) =>
    logActivity({
      type: 'contracts_synced',
      title: 'Contracts synced',
      detail: `Synced ${count} contract awards`,
      metadata: { count },
    }),

  chSignals: (count: number) =>
    logActivity({
      type: 'ch_signals',
      title: 'Companies House signals',
      detail: `${count} leadership changes detected`,
      metadata: { count },
    }),

  queueProcessed: (processed: number, remaining: number) =>
    logActivity({
      type: 'queue_processed',
      title: 'Queue processed',
      detail: `Processed ${processed} tasks (${remaining} remaining)`,
      metadata: { processed, remaining },
    }),

  governmentSync: (contracts: number, tenders: number) =>
    logActivity({
      type: 'government_sync',
      title: 'Government data synced',
      detail: `${contracts} contracts, ${tenders} tenders`,
      metadata: { contracts, tenders },
    }),

  domainsResolved: (count: number) =>
    logActivity({
      type: 'domains_resolved',
      title: 'Domains resolved',
      detail: `Found websites for ${count} companies`,
      metadata: { count },
    }),
};
