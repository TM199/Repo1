/**
 * Backfill Domains - Inngest Function
 *
 * Resolves domains for companies that don't have one.
 * Uses Google search via Firecrawl and DNS validation.
 *
 * Trigger: domains/backfill.requested event
 */

import { inngest } from '../client';
import { backfillDomainResolution, getDomainCoverageStats } from '@/lib/company/backfill-domains';
import { activityLogger } from '@/lib/activity-logger';

export const backfillDomainsFunction = inngest.createFunction(
  {
    id: 'backfill-domains',
    throttle: { limit: 1, period: '5m' }, // Max 1 run per 5 minutes
    retries: 2,
  },
  { event: 'domains/backfill.requested' },
  async ({ event, step }) => {
    const batchSize = event.data?.batchSize || 50;

    // Step 1: Get current stats
    const beforeStats = await step.run('get-before-stats', async () => {
      return await getDomainCoverageStats();
    });

    // Step 2: Run backfill
    const result = await step.run('backfill-domains', async () => {
      return await backfillDomainResolution(batchSize, 500, false);
    });

    // Step 3: Get updated stats
    const afterStats = await step.run('get-after-stats', async () => {
      return await getDomainCoverageStats();
    });

    // Log activity for dashboard feed
    if (result.resolved > 0) {
      await activityLogger.domainsResolved(result.resolved);
    }

    return {
      success: true,
      processed: result.total,
      resolved: result.resolved,
      still_unresolved: result.still_unresolved,
      errors: result.errors,
      coverage: {
        before: beforeStats.coverage_percent,
        after: afterStats.coverage_percent,
        improvement: afterStats.coverage_percent - beforeStats.coverage_percent,
      },
    };
  }
);
