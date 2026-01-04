/**
 * Government Data Sync - Inngest Function
 *
 * Migrated from: src/app/api/cron/government/route.ts
 *
 * Daily job that syncs contract/tender data for ICP profiles that have
 * these signal types enabled:
 * - Contracts Finder (contracts_awarded)
 * - Find a Tender (tenders)
 *
 * Benefits of Inngest migration:
 * - Each step retries independently
 * - Better observability via dashboard
 * - No 300s timeout limit
 * - Step-based progress tracking
 *
 * Schedule: 5am daily (cron: 0 5 * * *)
 */

import { inngest } from '../client';
import { createAdminClient } from '@/lib/supabase/server';
import { activityLogger } from '@/lib/activity-logger';
import { fetchContractAwards } from '@/lib/contracts-finder';
import { fetchFTSAwards } from '@/lib/find-a-tender';
import { ICPProfile } from '@/types';

interface SignalResult {
  success: boolean;
  found: number;
  new: number;
  skipped_no_icp: boolean;
  error: string | null;
}

interface ICPsBySignalType {
  contracts_awarded: ICPProfile[];
  tenders: ICPProfile[];
}

/**
 * Check if a location matches any ICP profile's locations
 */
function matchesICPLocations(location: string | null, icpProfiles: ICPProfile[]): ICPProfile[] {
  if (!location) return icpProfiles;
  const locationLower = location.toLowerCase();
  return icpProfiles.filter(icp => {
    if (icp.locations.length === 0) return true;
    return icp.locations.some(l => locationLower.includes(l.toLowerCase()));
  });
}

export const syncGovernmentDataFunction = inngest.createFunction(
  {
    id: 'sync-government-data',
    retries: 3,
    throttle: {
      limit: 1,
      period: '30m',
    },
  },
  [
    { cron: '0 5 * * *' }, // 5am daily
    { event: 'government/sync' }, // Manual trigger with optional icpId param
  ],
  async ({ step, event }) => {
    const supabase = createAdminClient();

    // Optional: filter to specific ICP if provided via event
    const targetIcpId = event?.data?.icpId as string | undefined;

    const results: Record<string, SignalResult> = {
      contractsFinder: { success: false, found: 0, new: 0, skipped_no_icp: false, error: null },
      findATender: { success: false, found: 0, new: 0, skipped_no_icp: false, error: null },
    };

    // ==========================================
    // STEP 1: Get Active ICPs by Signal Type
    // ==========================================
    const icpsByType = await step.run('get-active-icps', async (): Promise<ICPsBySignalType> => {
      const { data: profiles } = await supabase
        .from('icp_profiles')
        .select('*')
        .eq('is_active', true);

      const result: ICPsBySignalType = {
        contracts_awarded: [],
        tenders: [],
      };

      if (!profiles) return result;

      for (const profile of profiles) {
        const icpProfile = profile as ICPProfile;

        // Skip if targeting specific ICP and this isn't it
        if (targetIcpId && icpProfile.id !== targetIcpId) continue;

        if (icpProfile.signal_types.includes('contracts_awarded')) {
          result.contracts_awarded.push(icpProfile);
        }
        if (icpProfile.signal_types.includes('tenders')) {
          result.tenders.push(icpProfile);
        }
      }

      return result;
    });

    // ==========================================
    // STEP 2: Sync Contracts Finder
    // ==========================================
    const contractsResult = await step.run('sync-contracts-finder', async (): Promise<SignalResult> => {
      const localResult: SignalResult = {
        success: false,
        found: 0,
        new: 0,
        skipped_no_icp: false,
        error: null,
      };

      const contractsICPs = icpsByType.contracts_awarded;

      if (contractsICPs.length === 0) {
        console.log('[Government Sync] Skipping Contracts Finder - no ICPs with contracts_awarded');
        localResult.skipped_no_icp = true;
        localResult.success = true;
        return localResult;
      }

      try {
        console.log(`[Government Sync] Syncing Contracts Finder for ${contractsICPs.length} ICPs...`);
        const { signals, error } = await fetchContractAwards(1);

        if (error) {
          localResult.error = error;
          return localResult;
        }

        localResult.found = signals.length;

        for (const signal of signals) {
          const matchingICPs = matchesICPLocations(signal.location, contractsICPs);
          if (matchingICPs.length === 0) continue;

          const fingerprint = Buffer.from(
            `${signal.company_name}|${signal.signal_title}|${signal.signal_url}`
          ).toString('base64').slice(0, 64);

          for (const icp of matchingICPs) {
            const { error: insertError } = await supabase.from('signals').upsert({
              source_type: 'search',
              signal_type: 'contract_awarded',
              company_name: signal.company_name,
              company_domain: signal.company_domain,
              signal_title: signal.signal_title,
              signal_detail: `${signal.signal_detail}${signal.buyer_name ? ` | Buyer: ${signal.buyer_name}` : ''}${signal.value ? ` | Value: £${signal.value.toLocaleString()}` : ''}`,
              signal_url: signal.signal_url,
              location: signal.location,
              hash: `${fingerprint}_${icp.id}`,
              icp_profile_id: icp.id,
              user_id: icp.user_id,
              detected_at: new Date().toISOString(),
              is_new: true,
            }, { onConflict: 'hash', ignoreDuplicates: true });

            if (!insertError) localResult.new++;
          }
        }

        localResult.success = true;
      } catch (error) {
        console.error('[Government Sync] Contracts Finder error:', error);
        localResult.error = error instanceof Error ? error.message : 'Unknown error';
      }

      return localResult;
    });

    results.contractsFinder = contractsResult;

    // ==========================================
    // STEP 3: Sync Find a Tender
    // ==========================================
    const ftsResult = await step.run('sync-find-a-tender', async (): Promise<SignalResult> => {
      const localResult: SignalResult = {
        success: false,
        found: 0,
        new: 0,
        skipped_no_icp: false,
        error: null,
      };

      const tendersICPs = icpsByType.tenders;

      if (tendersICPs.length === 0) {
        console.log('[Government Sync] Skipping Find a Tender - no ICPs with tenders');
        localResult.skipped_no_icp = true;
        localResult.success = true;
        return localResult;
      }

      try {
        console.log(`[Government Sync] Syncing Find a Tender for ${tendersICPs.length} ICPs...`);
        const { signals, error } = await fetchFTSAwards(1);

        if (error) {
          localResult.error = error;
          return localResult;
        }

        localResult.found = signals.length;

        for (const signal of signals) {
          const matchingICPs = matchesICPLocations(signal.location, tendersICPs);
          if (matchingICPs.length === 0) continue;

          const fingerprint = Buffer.from(
            `${signal.company_name}|${signal.signal_title}|${signal.signal_url}`
          ).toString('base64').slice(0, 64);

          for (const icp of matchingICPs) {
            const { error: insertError } = await supabase.from('signals').upsert({
              source_type: 'search',
              signal_type: 'contract_awarded',
              company_name: signal.company_name,
              company_domain: signal.company_domain,
              signal_title: signal.signal_title,
              signal_detail: `${signal.signal_detail}${signal.buyer_name ? ` | Buyer: ${signal.buyer_name}` : ''}${signal.value ? ` | Value: £${signal.value.toLocaleString()}` : ''}`,
              signal_url: signal.signal_url,
              location: signal.location,
              hash: `${fingerprint}_${icp.id}`,
              icp_profile_id: icp.id,
              user_id: icp.user_id,
              detected_at: new Date().toISOString(),
              is_new: true,
            }, { onConflict: 'hash', ignoreDuplicates: true });

            if (!insertError) localResult.new++;
          }
        }

        localResult.success = true;
      } catch (error) {
        console.error('[Government Sync] Find a Tender error:', error);
        localResult.error = error instanceof Error ? error.message : 'Unknown error';
      }

      return localResult;
    });

    results.findATender = ftsResult;

    // ==========================================
    // Return Stats Summary
    // ==========================================
    const totalFound = Object.values(results).reduce((sum, r) => sum + r.found, 0);
    const totalNew = Object.values(results).reduce((sum, r) => sum + r.new, 0);

    console.log(`[Government Sync] Complete. Found: ${totalFound}, New: ${totalNew}`);

    // Log activity for dashboard feed
    if (totalNew > 0) {
      await activityLogger.governmentSync(
        results.contractsFinder.new,
        results.findATender.new
      );
    }

    return {
      success: true,
      message: 'Government data sync complete',
      totalFound,
      totalNew,
      sources: results,
      timestamp: new Date().toISOString(),
    };
  }
);
