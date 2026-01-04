/**
 * Admin endpoint to clean up duplicate signals
 *
 * POST /api/admin/cleanup-duplicates
 * - Finds and removes duplicate signals (keeps oldest)
 * - Recalculates pain scores for affected companies
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  // Verify admin secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const stats = {
    duplicates_found: 0,
    duplicates_deleted: 0,
    companies_rescored: 0,
    errors: [] as string[],
  };

  try {
    console.log('[cleanup] Starting duplicate signal cleanup...');

    // Step 1: Find all signals grouped by unique key
    const { data: allSignals, error: fetchError } = await supabase
      .from('company_pain_signals')
      .select('id, company_id, source_contract_id, source_job_posting_id, pain_signal_type, icp_profile_id, detected_at')
      .eq('is_active', true)
      .order('detected_at', { ascending: true });

    if (fetchError) {
      throw new Error(`Failed to fetch signals: ${fetchError.message}`);
    }

    if (!allSignals || allSignals.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No signals found',
        stats,
      });
    }

    console.log(`[cleanup] Found ${allSignals.length} active signals`);

    // Group signals by unique key
    const signalGroups = new Map<string, typeof allSignals>();

    for (const signal of allSignals) {
      const key = [
        signal.company_id,
        signal.source_contract_id || '',
        signal.source_job_posting_id || '',
        signal.pain_signal_type,
        signal.icp_profile_id,
      ].join('|');

      if (!signalGroups.has(key)) {
        signalGroups.set(key, []);
      }
      signalGroups.get(key)!.push(signal);
    }

    // Find duplicates (groups with more than 1 signal)
    const duplicateIds: string[] = [];
    const affectedCompanyIds = new Set<string>();

    for (const [, signals] of signalGroups) {
      if (signals.length > 1) {
        stats.duplicates_found += signals.length - 1;

        // Keep the first (oldest) signal, mark rest for deletion
        for (let i = 1; i < signals.length; i++) {
          duplicateIds.push(signals[i].id);
          affectedCompanyIds.add(signals[i].company_id);
        }
      }
    }

    console.log(`[cleanup] Found ${stats.duplicates_found} duplicates to delete`);

    // Step 2: Delete duplicates in batches
    if (duplicateIds.length > 0) {
      const batchSize = 100;
      for (let i = 0; i < duplicateIds.length; i += batchSize) {
        const batch = duplicateIds.slice(i, i + batchSize);

        const { error: deleteError } = await supabase
          .from('company_pain_signals')
          .delete()
          .in('id', batch);

        if (deleteError) {
          stats.errors.push(`Delete batch error: ${deleteError.message}`);
          console.error('[cleanup] Delete error:', deleteError);
        } else {
          stats.duplicates_deleted += batch.length;
        }
      }
    }

    console.log(`[cleanup] Deleted ${stats.duplicates_deleted} duplicates`);

    // Step 3: Recalculate pain scores for affected companies
    for (const companyId of affectedCompanyIds) {
      try {
        const { data: signals } = await supabase
          .from('company_pain_signals')
          .select('pain_score_contribution')
          .eq('company_id', companyId)
          .eq('is_active', true);

        const totalScore = signals?.reduce(
          (sum, s) => sum + (s.pain_score_contribution || 0),
          0
        ) || 0;

        await supabase
          .from('companies')
          .update({
            hiring_pain_score: Math.min(totalScore, 100),
            pain_score_updated_at: new Date().toISOString(),
          })
          .eq('id', companyId);

        stats.companies_rescored++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        stats.errors.push(`Rescore ${companyId}: ${msg}`);
      }
    }

    console.log(`[cleanup] Rescored ${stats.companies_rescored} companies`);

    return NextResponse.json({
      success: true,
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[cleanup] Fatal error:', error);
    return NextResponse.json(
      { success: false, error: message, stats },
      { status: 500 }
    );
  }
}

// GET to preview duplicates without deleting
export async function GET(request: NextRequest) {
  // Verify admin secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  try {
    // Fetch all active signals
    const { data: allSignals, error } = await supabase
      .from('company_pain_signals')
      .select('id, company_id, source_contract_id, source_job_posting_id, pain_signal_type, icp_profile_id')
      .eq('is_active', true);

    if (error) {
      throw new Error(`Failed to fetch: ${error.message}`);
    }

    // Group and count
    const signalGroups = new Map<string, number>();

    for (const signal of allSignals || []) {
      const key = [
        signal.company_id,
        signal.source_contract_id || '',
        signal.source_job_posting_id || '',
        signal.pain_signal_type,
        signal.icp_profile_id,
      ].join('|');

      signalGroups.set(key, (signalGroups.get(key) || 0) + 1);
    }

    let duplicateCount = 0;
    let duplicateGroups = 0;

    for (const count of signalGroups.values()) {
      if (count > 1) {
        duplicateGroups++;
        duplicateCount += count - 1;
      }
    }

    return NextResponse.json({
      total_signals: allSignals?.length || 0,
      unique_signals: signalGroups.size,
      duplicate_groups: duplicateGroups,
      duplicates_to_delete: duplicateCount,
      message: `Found ${duplicateCount} duplicates that would be deleted (POST to delete)`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
