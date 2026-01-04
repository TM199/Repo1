/**
 * Contracts Finder Signal Generation - Inngest Function
 *
 * Migrated from: src/app/api/cron/contracts-finder-signals/route.ts
 *
 * Daily job that fetches government contract awards and generates
 * hiring pain signals for companies winning contracts.
 *
 * Benefits of Inngest migration:
 * - Each step retries independently
 * - Better observability via dashboard
 * - No 300s timeout limit
 * - Step-based progress tracking
 *
 * Schedule: 0 6 * * * (6am daily)
 */

import { inngest } from '../client';
import { createAdminClient } from '@/lib/supabase/server';
import { searchAwardedContracts, ParsedContractAward } from '@/lib/contracts-finder';
import { getCPVCodesForIndustries, matchCPVToIndustry } from '@/lib/contracts-finder/cpv-mapping';
import {
  syncSupplierFromContract,
  storeContractAward,
  markContractSignalGenerated,
} from '@/lib/contracts-finder/supplier-sync';
import {
  detectContractAwardSignal,
  detectFirstContractSignal,
  ContractSignalCandidate,
} from '@/lib/contracts-finder/signals';
import { ICPProfile } from '@/types';

// Minimum contract value to consider (skip very small contracts)
const MIN_CONTRACT_VALUE = 50000;

// Default lookback days (daily cron only fetches contracts from TODAY)
const DEFAULT_LOOKBACK_DAYS = 1;

// Stats type
interface ContractSignalStats {
  contracts_found: number;
  contracts_processed: number;
  contracts_stored: number;
  suppliers_synced: number;
  suppliers_new: number;
  domains_resolved: number;
  signals_created: number;
  first_contract_signals: number;
  companies_scored: number;
  skipped_no_icp: boolean;
  errors: string[];
}

/**
 * Get all active ICP profiles that have 'contracts_awarded' signal type enabled
 */
async function getContractICPs(
  supabase: ReturnType<typeof createAdminClient>
): Promise<ICPProfile[]> {
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
  return icpProfiles.filter(
    (icp) => matchesICPIndustry(award.cpv_codes, icp) && matchesICPValue(award.value_gbp, icp)
  );
}

export const generateContractSignalsFunction = inngest.createFunction(
  {
    id: 'generate-contract-signals',
    retries: 3,
    throttle: {
      limit: 1,
      period: '30m',
    },
  },
  [
    { cron: '0 6 * * *' }, // 6am daily
    { event: 'signals/contracts' }, // Manual trigger with optional lookbackDays
  ],
  async ({ event, step }) => {
    const supabase = createAdminClient();
    const lookbackDays =
      (event?.data as { lookbackDays?: number } | undefined)?.lookbackDays ?? DEFAULT_LOOKBACK_DAYS;

    const stats: ContractSignalStats = {
      contracts_found: 0,
      contracts_processed: 0,
      contracts_stored: 0,
      suppliers_synced: 0,
      suppliers_new: 0,
      domains_resolved: 0,
      signals_created: 0,
      first_contract_signals: 0,
      companies_scored: 0,
      skipped_no_icp: false,
      errors: [],
    };

    // ==========================================
    // STEP 1: Get ICP Profiles with contracts_awarded
    // ==========================================
    const contractICPs = await step.run(
      'get-contract-icps',
      async (): Promise<ICPProfile[]> => {
        return await getContractICPs(supabase);
      }
    );

    if (contractICPs.length === 0) {
      return {
        success: true,
        message: 'Skipped - no ICPs with contracts_awarded signal type',
        stats: { ...stats, skipped_no_icp: true },
        timestamp: new Date().toISOString(),
      };
    }

    console.log(
      `[cf-signals] Processing for ${contractICPs.length} ICPs with contracts_awarded enabled`
    );

    // ==========================================
    // STEP 2: Fetch contract awards from Contracts Finder API
    // ==========================================
    const fetchResult = await step.run(
      'fetch-contract-awards',
      async (): Promise<{ awards: ParsedContractAward[]; fetchError: string | null }> => {
        // Build CPV code filter from all ICPs
        const allIndustries = contractICPs.flatMap((icp) => icp.industries || []);
        const cpvFilter = getCPVCodesForIndustries([...new Set(allIndustries)]);

        console.log(
          `[cf-signals] Filtering by CPV prefixes: ${cpvFilter.slice(0, 5).join(', ')}${cpvFilter.length > 5 ? '...' : ''}`
        );

        // Calculate date range
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - lookbackDays);
        const fromDateStr = fromDate.toISOString().split('T')[0];

        // Fetch contract awards
        const { awards, error: fetchError } = await searchAwardedContracts({
          publishedFrom: fromDateStr,
          minValue: MIN_CONTRACT_VALUE,
          cpvCodes: cpvFilter.length > 0 ? cpvFilter : undefined,
          maxPages: 3, // Limit pages to stay within timeout
        });

        return { awards, fetchError: fetchError ?? null };
      }
    );

    stats.contracts_found = fetchResult.awards.length;
    if (fetchResult.fetchError) {
      stats.errors.push(`Fetch error: ${fetchResult.fetchError}`);
      console.error('[cf-signals] Fetch error:', fetchResult.fetchError);
    }

    console.log(`[cf-signals] Found ${fetchResult.awards.length} contracts to process`);

    // ==========================================
    // STEP 3: Process awards (sync suppliers, store contracts, create signals)
    // ==========================================
    const processResult = await step.run(
      'process-contract-awards',
      async (): Promise<{
        contracts_processed: number;
        contracts_stored: number;
        suppliers_synced: number;
        suppliers_new: number;
        domains_resolved: number;
        signals_created: number;
        first_contract_signals: number;
        errors: string[];
      }> => {
        const localStats = {
          contracts_processed: 0,
          contracts_stored: 0,
          suppliers_synced: 0,
          suppliers_new: 0,
          domains_resolved: 0,
          signals_created: 0,
          first_contract_signals: 0,
          errors: [] as string[],
        };

        for (const award of fetchResult.awards) {
          try {
            localStats.contracts_processed++;

            // Sync supplier (match/create company + domain resolution)
            const syncResult = await syncSupplierFromContract(award);
            localStats.suppliers_synced++;

            if (syncResult.match_type === 'new') {
              localStats.suppliers_new++;
            }

            if (syncResult.domain) {
              localStats.domains_resolved++;
            }

            // Store contract award
            const contractResult = await storeContractAward(award, syncResult.company_id);

            if (!contractResult) {
              continue; // Contract already exists or error
            }

            if (contractResult.isNew) {
              localStats.contracts_stored++;
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
            const firstContractSignal = detectFirstContractSignal(
              award,
              syncResult,
              contractResult.id
            );

            // Create signals for each matching ICP
            const signalsToCreate: ContractSignalCandidate[] = [];

            if (awardSignal) signalsToCreate.push(awardSignal);
            if (firstContractSignal) signalsToCreate.push(firstContractSignal);

            for (const signal of signalsToCreate) {
              for (const icp of matchingICPs) {
                // Upsert signal (atomic - no race conditions)
                const { error: upsertError } = await supabase.from('company_pain_signals').upsert(
                  {
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
                  },
                  {
                    onConflict: 'company_id,source_contract_id,pain_signal_type,icp_profile_id',
                  }
                );

                if (upsertError) {
                  localStats.errors.push(`Signal upsert error: ${upsertError.message}`);
                  console.error('[cf-signals] Signal upsert error:', upsertError);
                } else {
                  localStats.signals_created++;
                  if (signal.signalType === 'contract_awarded_first') {
                    localStats.first_contract_signals++;
                  }
                }
              }
            }

            // Mark contract as having generated signals
            await markContractSignalGenerated(contractResult.id);
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            localStats.errors.push(`Contract ${award.ocid}: ${message}`);
            console.error(`[cf-signals] Error processing contract ${award.ocid}:`, err);
          }
        }

        return localStats;
      }
    );

    stats.contracts_processed = processResult.contracts_processed;
    stats.contracts_stored = processResult.contracts_stored;
    stats.suppliers_synced = processResult.suppliers_synced;
    stats.suppliers_new = processResult.suppliers_new;
    stats.domains_resolved = processResult.domains_resolved;
    stats.signals_created = processResult.signals_created;
    stats.first_contract_signals = processResult.first_contract_signals;
    stats.errors.push(...processResult.errors);

    // ==========================================
    // STEP 4: Recalculate pain scores for affected companies
    // ==========================================
    const scoreStats = await step.run(
      'recalculate-pain-scores',
      async (): Promise<{ count: number; errors: string[] }> => {
        const localStats = { count: 0, errors: [] as string[] };

        console.log('[cf-signals] Recalculating pain scores...');

        const { data: companiesWithSignals } = await supabase
          .from('company_pain_signals')
          .select('company_id')
          .eq('is_active', true)
          .eq('source', 'contracts_finder');

        if (!companiesWithSignals) return localStats;

        const uniqueIds = [...new Set(companiesWithSignals.map((s) => s.company_id))];

        for (const companyId of uniqueIds) {
          try {
            const { data: allSignals } = await supabase
              .from('company_pain_signals')
              .select('pain_score_contribution')
              .eq('company_id', companyId)
              .eq('is_active', true);

            const totalScore =
              allSignals?.reduce((sum, s) => sum + (s.pain_score_contribution || 0), 0) || 0;

            await supabase
              .from('companies')
              .update({
                hiring_pain_score: Math.min(totalScore, 100),
                pain_score_updated_at: new Date().toISOString(),
                last_activity_at: new Date().toISOString(),
              })
              .eq('id', companyId);

            localStats.count++;
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            localStats.errors.push(`Score update ${companyId}: ${message}`);
          }
        }

        return localStats;
      }
    );

    stats.companies_scored = scoreStats.count;
    stats.errors.push(...scoreStats.errors);

    console.log('[cf-signals] Contracts Finder signal generation complete');
    console.log(`[cf-signals] Stats: ${JSON.stringify(stats)}`);

    return {
      success: true,
      stats,
      timestamp: new Date().toISOString(),
    };
  }
);
