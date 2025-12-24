/**
 * Government Data Sync Cron Job (ICP-Aware)
 *
 * Syncs contract/tender data for ICP profiles that have these signal types enabled.
 * - Contracts Finder (contracts_awarded)
 * - Find a Tender (tenders)
 *
 * Run daily via Vercel Cron.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { fetchContractAwards } from '@/lib/contracts-finder';
import { fetchFTSAwards } from '@/lib/find-a-tender';
import { ICPProfile, ICPSignalType } from '@/types';

export const maxDuration = 300;

interface SignalResult {
  success: boolean;
  found: number;
  new: number;
  skipped_no_icp: boolean;
  error: string | null;
}

/**
 * Get active ICP profiles that have contracts or tenders enabled
 */
async function getActiveICPsBySignalType(supabase: ReturnType<typeof createAdminClient>): Promise<{
  contracts_awarded: ICPProfile[];
  tenders: ICPProfile[];
}> {
  const { data: profiles } = await supabase
    .from('icp_profiles')
    .select('*')
    .eq('is_active', true);

  const result = {
    contracts_awarded: [] as ICPProfile[],
    tenders: [] as ICPProfile[],
  };

  if (!profiles) return result;

  for (const profile of profiles) {
    const icpProfile = profile as ICPProfile;
    if (icpProfile.signal_types.includes('contracts_awarded')) {
      result.contracts_awarded.push(icpProfile);
    }
    if (icpProfile.signal_types.includes('tenders')) {
      result.tenders.push(icpProfile);
    }
  }

  return result;
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

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  console.log('[Government Sync] Starting sync...');

  const icpsByType = await getActiveICPsBySignalType(supabase);

  const results: Record<string, SignalResult> = {
    contractsFinder: { success: false, found: 0, new: 0, skipped_no_icp: false, error: null },
    findATender: { success: false, found: 0, new: 0, skipped_no_icp: false, error: null },
  };

  // ==========================================
  // Sync Contracts Finder
  // ==========================================
  const contractsICPs = icpsByType.contracts_awarded;
  if (contractsICPs.length === 0) {
    console.log('[Government Sync] Skipping Contracts Finder - no ICPs with contracts_awarded');
    results.contractsFinder.skipped_no_icp = true;
    results.contractsFinder.success = true;
  } else {
    try {
      console.log(`[Government Sync] Syncing Contracts Finder for ${contractsICPs.length} ICPs...`);
      const { signals, error } = await fetchContractAwards(1);

      if (error) {
        results.contractsFinder.error = error;
      } else {
        results.contractsFinder.found = signals.length;

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

            if (!insertError) results.contractsFinder.new++;
          }
        }
        results.contractsFinder.success = true;
      }
    } catch (error) {
      console.error('[Government Sync] Contracts Finder error:', error);
      results.contractsFinder.error = error instanceof Error ? error.message : 'Unknown error';
    }
  }

  // ==========================================
  // Sync Find a Tender
  // ==========================================
  const tendersICPs = icpsByType.tenders;
  if (tendersICPs.length === 0) {
    console.log('[Government Sync] Skipping Find a Tender - no ICPs with tenders');
    results.findATender.skipped_no_icp = true;
    results.findATender.success = true;
  } else {
    try {
      console.log(`[Government Sync] Syncing Find a Tender for ${tendersICPs.length} ICPs...`);
      const { signals, error } = await fetchFTSAwards(1);

      if (error) {
        results.findATender.error = error;
      } else {
        results.findATender.found = signals.length;

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

            if (!insertError) results.findATender.new++;
          }
        }
        results.findATender.success = true;
      }
    } catch (error) {
      console.error('[Government Sync] Find a Tender error:', error);
      results.findATender.error = error instanceof Error ? error.message : 'Unknown error';
    }
  }

  const totalFound = Object.values(results).reduce((sum, r) => sum + r.found, 0);
  const totalNew = Object.values(results).reduce((sum, r) => sum + r.new, 0);

  console.log(`[Government Sync] Complete. Found: ${totalFound}, New: ${totalNew}`);

  return NextResponse.json({
    message: 'Government data sync complete',
    totalFound,
    totalNew,
    sources: results,
    timestamp: new Date().toISOString(),
  });
}
