/**
 * Inngest Event Types
 *
 * Defines all events that can trigger Inngest functions.
 */

export type InngestEvents = {
  // Job ingestion - fetches jobs from Reed/Adzuna
  'jobs/ingest': {
    data: {
      source?: 'reed' | 'adzuna'; // If not specified, fetches from both
      locationGroup?: 'london' | 'major' | 'regional'; // If not specified, fetches all
    };
  };

  // Queue processing - processes pending scan_queue tasks
  'queue/process': {
    data: {
      limit?: number; // Max tasks to process (default: 10)
    };
  };

  // Pain signal generation (already migrated)
  'pain-signals/generate': {
    data: Record<string, never>; // No data required
  };

  // Company classification (already migrated)
  'company/classify.requested': {
    data: {
      companyIds: string[];
    };
  };

  // Government data sync (Contracts Finder + Find a Tender)
  'government/sync': {
    data: {
      icpId?: string; // Optional: sync for specific ICP only
    };
  };

  // Companies House signals generation
  'signals/companies-house': {
    data: {
      icpId?: string; // Optional: generate for specific ICP only
    };
  };

  // Contracts Finder signals generation
  'signals/contracts': {
    data: {
      lookbackDays?: number; // Default: 1 day for cron, 30 days for manual
    };
  };

  // Rescan ICP jobs for changes (reposts, salary increases)
  'icp/rescan-jobs': {
    data: {
      icpId?: string; // Optional: rescan specific ICP only
    };
  };

  // Schedule daily job fetch tasks
  'jobs/schedule-daily': {
    data: Record<string, never>; // No data required
  };
};
