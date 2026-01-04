import { backfillDomainsFunction } from './backfill-domains';
import { classifyCompaniesFunction } from './classify-companies';
import { generateCHSignalsFunction } from './generate-ch-signals';
import { generateContractSignalsFunction } from './generate-contract-signals';
import { generatePainSignalsFunction } from './generate-pain-signals';
import { processJobQueueFunction } from './process-job-queue';
import { rescanIcpJobsFunction } from './rescan-icp-jobs';
import { scheduleDailyJobsFunction } from './schedule-daily-jobs';
import { syncGovernmentDataFunction } from './sync-government-data';

export const functions = [
  backfillDomainsFunction,
  classifyCompaniesFunction,
  generateCHSignalsFunction,
  generateContractSignalsFunction,
  generatePainSignalsFunction,
  processJobQueueFunction,
  rescanIcpJobsFunction,
  scheduleDailyJobsFunction,
  syncGovernmentDataFunction,
];
