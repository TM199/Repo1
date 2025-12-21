import { NextRequest, NextResponse } from 'next/server';
import { processAllSources } from '@/lib/signals';
import { sendSignalNotifications } from '@/lib/email';
import { processScheduledSearches } from '@/lib/scheduled-search';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Process URL sources
  const sourceResult = await processAllSources('weekly');

  // Process scheduled AI searches
  const searchResult = await processScheduledSearches('weekly');

  // Send weekly email notifications after processing
  const emailResult = await sendSignalNotifications('weekly');

  return NextResponse.json({
    message: 'Weekly processing complete',
    sources: sourceResult,
    scheduledSearches: {
      processed: searchResult.processed,
      successful: searchResult.successful,
      newSignals: searchResult.totalNewSignals,
      errors: searchResult.errors,
    },
    emailsSent: emailResult.sent,
    emailsFailed: emailResult.failed,
  });
}
