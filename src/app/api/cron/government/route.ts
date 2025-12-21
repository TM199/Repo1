import { NextRequest, NextResponse } from 'next/server';
import { syncContractAwards } from '@/lib/contracts-finder';
import { syncFTSAwards } from '@/lib/find-a-tender';
import { syncLeadershipChanges } from '@/lib/companies-house';
import { syncPlanningApplications } from '@/lib/planning-data';

/**
 * Government Data Sync Cron Job
 *
 * Syncs data from UK Government APIs:
 * - Contracts Finder (public sector contracts)
 * - Find a Tender (high-value contracts)
 * - Companies House (leadership changes)
 * - Planning Data (planning applications)
 *
 * Run daily via Vercel Cron or external scheduler.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[Government Sync] Starting daily sync...');

  const results = {
    contractsFinder: { success: false, found: 0, new: 0, error: null as string | null },
    findATender: { success: false, found: 0, new: 0, error: null as string | null },
    companiesHouse: { success: false, found: 0, new: 0, error: null as string | null },
    planningData: { success: false, found: 0, new: 0, error: null as string | null },
  };

  // Sync Contracts Finder (1 day back)
  try {
    console.log('[Government Sync] Syncing Contracts Finder...');
    const cfResult = await syncContractAwards(1);
    results.contractsFinder = {
      success: cfResult.success,
      found: cfResult.found,
      new: cfResult.new,
      error: cfResult.error || null,
    };
  } catch (error) {
    console.error('[Government Sync] Contracts Finder error:', error);
    results.contractsFinder.error = error instanceof Error ? error.message : 'Unknown error';
  }

  // Sync Find a Tender (1 day back)
  try {
    console.log('[Government Sync] Syncing Find a Tender...');
    const ftsResult = await syncFTSAwards(1);
    results.findATender = {
      success: ftsResult.success,
      found: ftsResult.found,
      new: ftsResult.new,
      error: ftsResult.error || null,
    };
  } catch (error) {
    console.error('[Government Sync] Find a Tender error:', error);
    results.findATender.error = error instanceof Error ? error.message : 'Unknown error';
  }

  // Sync Companies House (1 day back) - requires API key
  try {
    console.log('[Government Sync] Syncing Companies House...');
    const chResult = await syncLeadershipChanges(1);
    results.companiesHouse = {
      success: chResult.success,
      found: chResult.found,
      new: chResult.new,
      error: chResult.error || null,
    };
  } catch (error) {
    console.error('[Government Sync] Companies House error:', error);
    results.companiesHouse.error = error instanceof Error ? error.message : 'Unknown error';
  }

  // Sync Planning Data (7 days back - less frequent updates)
  try {
    console.log('[Government Sync] Syncing Planning Data...');
    const pdResult = await syncPlanningApplications(7);
    results.planningData = {
      success: pdResult.success,
      found: pdResult.found,
      new: pdResult.new,
      error: pdResult.error || null,
    };
  } catch (error) {
    console.error('[Government Sync] Planning Data error:', error);
    results.planningData.error = error instanceof Error ? error.message : 'Unknown error';
  }

  // Calculate totals
  const totalFound =
    results.contractsFinder.found +
    results.findATender.found +
    results.companiesHouse.found +
    results.planningData.found;

  const totalNew =
    results.contractsFinder.new +
    results.findATender.new +
    results.companiesHouse.new +
    results.planningData.new;

  console.log(`[Government Sync] Complete. Found: ${totalFound}, New: ${totalNew}`);

  return NextResponse.json({
    message: 'Government data sync complete',
    totalFound,
    totalNew,
    sources: results,
    timestamp: new Date().toISOString(),
  });
}
