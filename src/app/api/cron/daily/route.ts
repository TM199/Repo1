import { NextRequest, NextResponse } from 'next/server';
import { processAllSources } from '@/lib/signals';
import { sendSignalNotifications } from '@/lib/email';
import { processScheduledSearches } from '@/lib/scheduled-search';
import { syncContractAwards } from '@/lib/contracts-finder';
import { syncFTSAwards } from '@/lib/find-a-tender';
import { syncLeadershipChanges } from '@/lib/companies-house';
import { syncPlanningApplications } from '@/lib/planning-data';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Process URL sources
  const sourceResult = await processAllSources('daily');

  // Process scheduled AI searches
  const searchResult = await processScheduledSearches('daily');

  // Sync government data sources
  const govResults = {
    contractsFinder: { new: 0 },
    findATender: { new: 0 },
    companiesHouse: { new: 0 },
    planningData: { new: 0 },
  };

  try {
    const cfResult = await syncContractAwards(1);
    govResults.contractsFinder.new = cfResult.new;
  } catch (e) {
    console.error('[Daily Cron] Contracts Finder error:', e);
  }

  try {
    const ftsResult = await syncFTSAwards(1);
    govResults.findATender.new = ftsResult.new;
  } catch (e) {
    console.error('[Daily Cron] Find a Tender error:', e);
  }

  try {
    const chResult = await syncLeadershipChanges(1);
    govResults.companiesHouse.new = chResult.new;
  } catch (e) {
    console.error('[Daily Cron] Companies House error:', e);
  }

  try {
    const pdResult = await syncPlanningApplications(7);
    govResults.planningData.new = pdResult.new;
  } catch (e) {
    console.error('[Daily Cron] Planning Data error:', e);
  }

  // Send daily email notifications after processing
  const emailResult = await sendSignalNotifications('daily');

  return NextResponse.json({
    message: 'Daily processing complete',
    sources: sourceResult,
    scheduledSearches: {
      processed: searchResult.processed,
      successful: searchResult.successful,
      newSignals: searchResult.totalNewSignals,
      errors: searchResult.errors,
    },
    governmentData: {
      contractsFinder: govResults.contractsFinder.new,
      findATender: govResults.findATender.new,
      companiesHouse: govResults.companiesHouse.new,
      planningData: govResults.planningData.new,
      total: govResults.contractsFinder.new + govResults.findATender.new + govResults.companiesHouse.new + govResults.planningData.new,
    },
    emailsSent: emailResult.sent,
    emailsFailed: emailResult.failed,
  });
}
