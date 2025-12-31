/**
 * Companies House Signal Generation Cron Job
 *
 * Daily job that analyzes Companies House filing history to detect
 * leadership changes and expansion signals for relevant companies.
 *
 * Schedule: 30 5 * * * (5:30am daily, after government cron)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { detectAllCHSignals, SignalCandidate } from '@/lib/companies-house/signals';
import { ICPProfile } from '@/types';

export const maxDuration = 300;

/**
 * Verify cron secret
 */
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  return authHeader === `Bearer ${process.env.CRON_SECRET}`;
}

/**
 * Get all active ICP profiles that have 'leadership' signal type enabled
 */
async function getLeadershipICPs(supabase: ReturnType<typeof createAdminClient>): Promise<ICPProfile[]> {
  const { data: profiles } = await supabase
    .from('icp_profiles')
    .select('*')
    .eq('is_active', true);

  if (!profiles) return [];

  return profiles.filter((p: ICPProfile) => p.signal_types.includes('leadership'));
}

/**
 * Check if a company's location matches an ICP's target locations
 */
function matchesICPLocation(companyRegion: string | null, icp: ICPProfile): boolean {
  // If ICP has no location filter, match all
  if (!icp.locations || icp.locations.length === 0) return true;

  // If company has no region, don't match (unless ICP has no filter)
  if (!companyRegion) return false;

  const regionLower = companyRegion.toLowerCase();
  return icp.locations.some(loc => regionLower.includes(loc.toLowerCase()));
}

/**
 * Check if a company's industry matches an ICP's target industries
 */
function matchesICPIndustry(companyIndustry: string | null, icp: ICPProfile): boolean {
  // If ICP has no industry filter, match all
  if (!icp.industries || icp.industries.length === 0) return true;

  // If company has no industry, don't match (unless ICP has no filter)
  if (!companyIndustry) return false;

  const industryLower = companyIndustry.toLowerCase();
  return icp.industries.some(ind => industryLower.includes(ind.toLowerCase()));
}

/**
 * Get ICPs that match a company's location and industry
 */
function getMatchingICPs(
  companyRegion: string | null,
  companyIndustry: string | null,
  icpProfiles: ICPProfile[]
): ICPProfile[] {
  return icpProfiles.filter(icp =>
    matchesICPLocation(companyRegion, icp) &&
    matchesICPIndustry(companyIndustry, icp)
  );
}

export async function GET(request: NextRequest) {
  // Verify authorization
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check if API key is configured
  if (!process.env.COMPANIES_HOUSE_API_KEY) {
    return NextResponse.json({
      success: true,
      message: 'Skipped - COMPANIES_HOUSE_API_KEY not configured',
      timestamp: new Date().toISOString(),
    });
  }

  const supabase = createAdminClient();
  const stats = {
    companies_checked: 0,
    new_director_signals: 0,
    leadership_reorg_signals: 0,
    director_gap_signals: 0,
    capital_raise_signals: 0,
    filings_tracked: 0,
    companies_scored: 0,
    skipped_no_icp: false,
    errors: [] as string[],
  };

  try {
    console.log('[ch-signals] Starting Companies House signal generation...');

    // Get all active ICP profiles with leadership signal type
    const leadershipICPs = await getLeadershipICPs(supabase);

    if (leadershipICPs.length === 0) {
      console.log('[ch-signals] Skipping - no ICPs with leadership signal type');
      stats.skipped_no_icp = true;
      return NextResponse.json({
        success: true,
        message: 'Skipped - no ICPs with leadership signal type',
        stats,
        timestamp: new Date().toISOString(),
      });
    }

    console.log(`[ch-signals] Processing for ${leadershipICPs.length} ICPs with leadership enabled`);

    // ==========================================
    // STEP 1: Get companies with CH numbers (oldest checked first)
    // Include region and industry for ICP matching
    // ==========================================
    const { data: companies, error: companyError } = await supabase
      .from('companies')
      .select('id, name, companies_house_number, companies_house_last_checked, region, industry')
      .not('companies_house_number', 'is', null)
      .order('companies_house_last_checked', { ascending: true, nullsFirst: true })
      .limit(100);

    if (companyError) {
      stats.errors.push(`Company query error: ${companyError.message}`);
      throw new Error(companyError.message);
    }

    if (!companies || companies.length === 0) {
      console.log('[ch-signals] No companies with CH numbers found');
      return NextResponse.json({
        success: true,
        message: 'No companies with Companies House numbers',
        stats,
        timestamp: new Date().toISOString(),
      });
    }

    console.log(`[ch-signals] Processing ${companies.length} companies`);

    // ==========================================
    // STEP 2: Process each company for signals
    // Only create signals for ICPs that match the company's location/industry
    // ==========================================
    for (const company of companies) {
      try {
        // Find ICPs that match this company's location and industry
        const matchingICPs = getMatchingICPs(
          company.region,
          company.industry,
          leadershipICPs
        );

        // Skip companies that don't match any ICP criteria
        if (matchingICPs.length === 0) {
          console.log(`[ch-signals] Skipping ${company.name} - no matching ICPs`);
          // Still update last checked to avoid re-checking
          await supabase
            .from('companies')
            .update({ companies_house_last_checked: new Date().toISOString() })
            .eq('id', company.id);
          continue;
        }

        stats.companies_checked++;
        console.log(`[ch-signals] Processing ${company.name} for ${matchingICPs.length} matching ICP(s)`);

        // Detect all CH signals
        const signals = await detectAllCHSignals(
          company.id,
          company.companies_house_number!,
          { leadershipLookbackDays: 90, expansionLookbackDays: 180 }
        );

        // Process each signal - only for matching ICPs
        for (const signal of signals) {
          await processSignal(supabase, signal, matchingICPs, stats);
        }

        // Update last checked timestamp
        await supabase
          .from('companies')
          .update({ companies_house_last_checked: new Date().toISOString() })
          .eq('id', company.id);

        // Rate limit: 600ms between CH API calls (600 req/5min = 10/sec max)
        await new Promise(resolve => setTimeout(resolve, 600));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        stats.errors.push(`Company ${company.name}: ${message}`);
        console.error(`[ch-signals] Error processing ${company.name}:`, err);
      }
    }

    // ==========================================
    // STEP 3: Recalculate company pain scores
    // ==========================================
    console.log('[ch-signals] Recalculating pain scores...');

    const { data: companiesWithSignals } = await supabase
      .from('company_pain_signals')
      .select('company_id')
      .eq('is_active', true)
      .eq('source', 'companies_house');

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

          stats.companies_scored++;
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          stats.errors.push(`Score update ${companyId}: ${message}`);
        }
      }
    }

    console.log('[ch-signals] Companies House signal generation complete');

    return NextResponse.json({
      success: true,
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[ch-signals] Fatal error:', error);
    return NextResponse.json(
      { success: false, error: message, stats },
      { status: 500 }
    );
  }
}

/**
 * Process a single signal candidate
 */
async function processSignal(
  supabase: ReturnType<typeof createAdminClient>,
  signal: SignalCandidate,
  icpProfiles: ICPProfile[],
  stats: {
    new_director_signals: number;
    leadership_reorg_signals: number;
    director_gap_signals: number;
    capital_raise_signals: number;
    filings_tracked: number;
    errors: string[];
  }
): Promise<void> {
  // Track filing first
  const { data: existingFiling } = await supabase
    .from('companies_house_filings')
    .select('id, signal_generated')
    .eq('companies_house_number', signal.rawFiling.company_number || '')
    .eq('filing_type', signal.filingType)
    .eq('filing_date', signal.filingDate)
    .single();

  let filingId: string | null = null;

  if (!existingFiling) {
    // Insert new filing record
    const { data: newFiling, error: filingError } = await supabase
      .from('companies_house_filings')
      .insert({
        company_id: signal.companyId,
        companies_house_number: signal.rawFiling.company_number || '',
        filing_type: signal.filingType,
        filing_date: signal.filingDate,
        filing_description: signal.detail,
        officer_name: signal.officerName || null,
        raw_data: signal.rawFiling,
        signal_generated: true,
      })
      .select('id')
      .single();

    if (filingError) {
      stats.errors.push(`Filing insert: ${filingError.message}`);
    } else {
      filingId = newFiling.id;
      stats.filings_tracked++;
    }
  } else if (existingFiling.signal_generated) {
    // Already processed this filing
    return;
  } else {
    filingId = existingFiling.id;
    await supabase
      .from('companies_house_filings')
      .update({ signal_generated: true })
      .eq('id', existingFiling.id);
  }

  // Create signal for each matching ICP
  for (const icp of icpProfiles) {
    // Check for existing signal
    const { data: existingSignal } = await supabase
      .from('company_pain_signals')
      .select('id')
      .eq('company_id', signal.companyId)
      .eq('icp_profile_id', icp.id)
      .eq('pain_signal_type', signal.signalType)
      .eq('source', 'companies_house')
      .eq('is_active', true)
      .single();

    if (!existingSignal) {
      await supabase.from('company_pain_signals').insert({
        company_id: signal.companyId,
        icp_profile_id: icp.id,
        pain_signal_type: signal.signalType,
        signal_title: signal.title,
        signal_detail: signal.detail,
        pain_score_contribution: signal.painScore,
        urgency: signal.urgency,
        confidence: signal.confidence,
        source: 'companies_house',
        source_filing_id: filingId,
        metadata: {
          filing_type: signal.filingType,
          filing_date: signal.filingDate,
          officer_name: signal.officerName,
        },
      });

      // Update stats
      switch (signal.signalType) {
        case 'new_director_appointment':
          stats.new_director_signals++;
          break;
        case 'leadership_reorganisation':
          stats.leadership_reorg_signals++;
          break;
        case 'director_gap':
          stats.director_gap_signals++;
          break;
        case 'capital_raise':
          stats.capital_raise_signals++;
          break;
      }
    }
  }
}
