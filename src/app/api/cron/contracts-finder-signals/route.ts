/**
 * Contracts Finder Signal Generation Cron Job
 *
 * Daily job that fetches government contract awards and generates
 * hiring pain signals for companies winning contracts.
 *
 * Schedule: 30 6 * * * (6:30am daily, after Companies House cron)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { searchAwardedContracts, ParsedContractAward } from '@/lib/contracts-finder';
import { getCPVCodesForIndustries, matchCPVToIndustry } from '@/lib/contracts-finder/cpv-mapping';
import { syncSupplierFromContract, storeContractAward, markContractSignalGenerated } from '@/lib/contracts-finder/supplier-sync';
import { detectContractAwardSignal, detectFirstContractSignal, ContractSignalCandidate, signalExists } from '@/lib/contracts-finder/signals';
import { ICPProfile } from '@/types';

export const maxDuration = 300;

// Minimum contract value to consider (skip very small contracts)
const MIN_CONTRACT_VALUE = 50000;

// How many days back to scan
const LOOKBACK_DAYS = 14;

/**
 * Verify cron secret
 */
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  return authHeader === `Bearer ${process.env.CRON_SECRET}`;
}

/**
 * Get all active ICP profiles that have 'contracts_awarded' signal type enabled
 */
async function getContractICPs(supabase: ReturnType<typeof createAdminClient>): Promise<ICPProfile[]> {
  const { data: profiles } = await supabase
    .from('icp_profiles')
    .select('*')
    .eq('is_active', true);

  if (!profiles) return [];

  return profiles.filter((p: ICPProfile) => p.signal_types.includes('contracts_awarded'));
}

/**
 * Check if a contract's CPV codes match an ICP's industries
 */
function matchesICPIndustry(cpvCodes: string[], icp: ICPProfile): boolean {
  if (!icp.industries || icp.industries.length === 0) return true;
  if (!cpvCodes || cpvCodes.length === 0) return true; // No CPV = match all

  return matchCPVToIndustry(cpvCodes, icp.industries);
}

/**
 * Check if contract value meets ICP minimum
 */
function matchesICPValue(valueGbp: number | null, icp: ICPProfile): boolean {
  if (!icp.min_contract_value) return true;
  if (!valueGbp) return false;

  return valueGbp >= icp.min_contract_value;
}

/**
 * Get ICPs that match a contract's criteria
 * Note: Location filter is NOT applied - contracts can come from suppliers anywhere
 * Only industry (via CPV codes) and value filters apply
 */
function getMatchingICPs(
  award: ParsedContractAward,
  icpProfiles: ICPProfile[]
): ICPProfile[] {
  return icpProfiles.filter(icp =>
    matchesICPIndustry(award.cpv_codes, icp) &&
    matchesICPValue(award.value_gbp, icp)
  );
}

export async function GET(request: NextRequest) {
  // Verify authorization
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const stats = {
    contracts_found: 0,
    contracts_processed: 0,
    contracts_stored: 0,
    suppliers_synced: 0,
    suppliers_new: 0,
    domains_resolved: 0,
    signals_created: 0,
    first_contract_signals: 0,
    skipped_no_icp: false,
    errors: [] as string[],
  };

  try {
    console.log('[cf-signals] Starting Contracts Finder signal generation...');

    // Get all active ICP profiles with contracts_awarded signal type
    const contractICPs = await getContractICPs(supabase);

    if (contractICPs.length === 0) {
      console.log('[cf-signals] Skipping - no ICPs with contracts_awarded signal type');
      stats.skipped_no_icp = true;
      return NextResponse.json({
        success: true,
        message: 'Skipped - no ICPs with contracts_awarded signal type',
        stats,
        timestamp: new Date().toISOString(),
      });
    }

    console.log(`[cf-signals] Processing for ${contractICPs.length} ICPs with contracts_awarded enabled`);

    // Build CPV code filter from all ICPs
    const allIndustries = contractICPs.flatMap(icp => icp.industries || []);
    const cpvFilter = getCPVCodesForIndustries([...new Set(allIndustries)]);

    console.log(`[cf-signals] Filtering by CPV prefixes: ${cpvFilter.slice(0, 5).join(', ')}${cpvFilter.length > 5 ? '...' : ''}`);

    // Calculate date range
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - LOOKBACK_DAYS);
    const fromDateStr = fromDate.toISOString().split('T')[0];

    // Fetch contract awards
    const { awards, error: fetchError } = await searchAwardedContracts({
      publishedFrom: fromDateStr,
      minValue: MIN_CONTRACT_VALUE,
      cpvCodes: cpvFilter.length > 0 ? cpvFilter : undefined,
      maxPages: 3, // Limit pages to stay within timeout
    });

    if (fetchError) {
      stats.errors.push(`Fetch error: ${fetchError}`);
      console.error('[cf-signals] Fetch error:', fetchError);
    }

    stats.contracts_found = awards.length;
    console.log(`[cf-signals] Found ${awards.length} contracts to process`);

    // Process each award
    for (const award of awards) {
      try {
        stats.contracts_processed++;

        // Sync supplier (match/create company + domain resolution)
        const syncResult = await syncSupplierFromContract(award);
        stats.suppliers_synced++;

        if (syncResult.match_type === 'new') {
          stats.suppliers_new++;
        }

        if (syncResult.domain) {
          stats.domains_resolved++;
        }

        // Store contract award
        const contractResult = await storeContractAward(award, syncResult.company_id);

        if (!contractResult) {
          continue; // Contract already exists or error
        }

        if (contractResult.isNew) {
          stats.contracts_stored++;
        }

        // Find matching ICPs for this contract (by industry/CPV codes only, not location)
        const matchingICPs = getMatchingICPs(award, contractICPs);

        if (matchingICPs.length === 0) {
          console.log(`[cf-signals] Skipping ${award.supplier.name} - no matching ICPs`);
          continue;
        }

        // Detect contract award signal
        const awardSignal = detectContractAwardSignal(award, syncResult, contractResult.id);

        // Detect first contract signal (if applicable)
        const firstContractSignal = detectFirstContractSignal(award, syncResult, contractResult.id);

        // Create signals for each matching ICP
        const signalsToCreate: ContractSignalCandidate[] = [];

        if (awardSignal) signalsToCreate.push(awardSignal);
        if (firstContractSignal) signalsToCreate.push(firstContractSignal);

        for (const signal of signalsToCreate) {
          for (const icp of matchingICPs) {
            // Check if signal already exists
            const exists = await signalExists(
              signal.companyId,
              signal.contractId,
              signal.signalType,
              icp.id
            );

            if (exists) {
              continue;
            }

            // Create signal
            const { error: insertError } = await supabase
              .from('company_pain_signals')
              .insert({
                company_id: signal.companyId,
                icp_profile_id: icp.id,
                pain_signal_type: signal.signalType,
                signal_title: signal.title,
                signal_detail: signal.detail,
                pain_score_contribution: signal.painScore,
                urgency: signal.urgency,
                confidence: signal.confidence,
                source: 'contracts_finder',
                source_contract_id: signal.contractId,
                metadata: { ...signal.metadata, source_url: signal.sourceUrl },
                is_active: true,
                detected_at: new Date().toISOString(),
              });

            if (insertError) {
              stats.errors.push(`Signal insert error: ${insertError.message}`);
              console.error('[cf-signals] Signal insert error:', insertError);
            } else {
              stats.signals_created++;
              if (signal.signalType === 'contract_awarded_first') {
                stats.first_contract_signals++;
              }
            }
          }
        }

        // Mark contract as having generated signals
        await markContractSignalGenerated(contractResult.id);

      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        stats.errors.push(`Contract ${award.ocid}: ${message}`);
        console.error(`[cf-signals] Error processing contract ${award.ocid}:`, err);
      }
    }

    // Recalculate pain scores for affected companies
    console.log('[cf-signals] Recalculating pain scores...');

    const { data: companiesWithSignals } = await supabase
      .from('company_pain_signals')
      .select('company_id')
      .eq('is_active', true)
      .eq('source', 'contracts_finder');

    if (companiesWithSignals) {
      const uniqueIds = [...new Set(companiesWithSignals.map(s => s.company_id))];

      for (const companyId of uniqueIds) {
        try {
          const { data: allSignals } = await supabase
            .from('company_pain_signals')
            .select('pain_score_contribution')
            .eq('company_id', companyId)
            .eq('is_active', true);

          const totalScore = allSignals?.reduce(
            (sum, s) => sum + (s.pain_score_contribution || 0),
            0
          ) || 0;

          await supabase
            .from('companies')
            .update({
              hiring_pain_score: Math.min(totalScore, 100),
              pain_score_updated_at: new Date().toISOString(),
              last_activity_at: new Date().toISOString(),
            })
            .eq('id', companyId);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          stats.errors.push(`Score update ${companyId}: ${message}`);
        }
      }
    }

    console.log('[cf-signals] Contracts Finder signal generation complete');
    console.log(`[cf-signals] Stats: ${JSON.stringify(stats)}`);

    return NextResponse.json({
      success: true,
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[cf-signals] Fatal error:', error);
    return NextResponse.json(
      { success: false, error: message, stats },
      { status: 500 }
    );
  }
}
