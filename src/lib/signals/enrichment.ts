/**
 * Enrichment Priority Logic
 *
 * Prioritizes companies and jobs for Firecrawl enrichment based on
 * signal types. Hard-to-fill signals get highest priority as they
 * represent confirmed, active pain.
 *
 * Priority Order:
 * 1. hard_to_fill_90 - HIGHEST (confirmed 90+ day struggle, still active)
 * 2. hard_to_fill_60 - HIGH
 * 3. job_reposted_three_plus - HIGH (multiple failed attempts)
 * 4. salary_increase_20_percent - HIGH (desperate measure)
 * 5. hard_to_fill_30 - MEDIUM
 * 6. stale_job_* - LOW (may be abandoned, save API costs)
 */

import { SupabaseClient } from '@supabase/supabase-js';

// Priority scores for different signal types (higher = more important to enrich)
export const ENRICHMENT_PRIORITY: Record<string, number> = {
  // HARD TO FILL - Highest priority (confirmed active pain)
  hard_to_fill_90: 100,
  hard_to_fill_60: 80,
  hard_to_fill_30: 50,

  // REPOST - High priority (actively trying again)
  job_reposted_three_plus: 90,
  job_reposted_twice: 70,
  job_reposted_once: 40,

  // SALARY - High priority (active changes = confirmed pain)
  salary_increase_20_percent: 85,
  salary_increase_10_percent: 60,

  // CONTRACT - Medium priority
  contract_no_hiring_60_days: 75,
  contract_no_hiring_30_days: 55,

  // REFERRAL - Medium priority
  high_referral_bonus: 45,
  referral_bonus: 30,

  // STALE - Low priority (may be abandoned, save API costs)
  stale_job_90: 25,
  stale_job_60: 15,
  stale_job_30: 10,

  // MULTIPLE ROLES - Low priority
  multiple_open_roles: 20,
};

/**
 * Calculate the enrichment priority score for a company based on their signals
 */
export function calculateEnrichmentPriority(signals: { pain_signal_type: string; is_active: boolean }[]): number {
  let totalPriority = 0;
  let hasHardToFill = false;

  for (const signal of signals) {
    if (!signal.is_active) continue;

    const priority = ENRICHMENT_PRIORITY[signal.pain_signal_type] || 0;
    totalPriority += priority;

    if (signal.pain_signal_type.startsWith('hard_to_fill')) {
      hasHardToFill = true;
    }
  }

  // Bonus for having hard_to_fill signals (confirmed pain)
  if (hasHardToFill) {
    totalPriority *= 1.5;
  }

  return Math.min(totalPriority, 500); // Cap at 500
}

/**
 * Check if a company should be prioritized for enrichment
 */
export function shouldPrioritizeForEnrichment(signals: { pain_signal_type: string; is_active: boolean }[]): boolean {
  // Prioritize if any hard_to_fill signal exists
  return signals.some(
    (s) => s.is_active && s.pain_signal_type.startsWith('hard_to_fill')
  );
}

/**
 * Get companies sorted by enrichment priority
 */
export async function getCompaniesForEnrichment(
  supabase: SupabaseClient,
  options?: {
    limit?: number;
    minPainScore?: number;
    includeStaleOnly?: boolean;
  }
): Promise<{
  companies: Array<{
    id: string;
    name: string;
    hiring_pain_score: number;
    enrichment_priority: number;
    has_hard_to_fill: boolean;
    signals: Array<{ pain_signal_type: string; is_active: boolean }>;
  }>;
}> {
  const limit = options?.limit || 100;
  const minPainScore = options?.minPainScore || 20;

  // Fetch companies with their active signals
  const { data: companiesWithSignals, error } = await supabase
    .from('companies')
    .select(`
      id,
      name,
      hiring_pain_score,
      signals:company_pain_signals(pain_signal_type, is_active)
    `)
    .gte('hiring_pain_score', minPainScore)
    .order('hiring_pain_score', { ascending: false })
    .limit(limit * 2); // Fetch more to filter and sort

  if (error) {
    console.error('[enrichment] Error fetching companies:', error);
    return { companies: [] };
  }

  // Calculate enrichment priority for each company
  const companiesWithPriority = (companiesWithSignals || []).map((company) => {
    const signals = (company.signals || []) as Array<{ pain_signal_type: string; is_active: boolean }>;
    const enrichment_priority = calculateEnrichmentPriority(signals);
    const has_hard_to_fill = shouldPrioritizeForEnrichment(signals);

    return {
      id: company.id,
      name: company.name,
      hiring_pain_score: company.hiring_pain_score,
      enrichment_priority,
      has_hard_to_fill,
      signals,
    };
  });

  // Filter out stale-only companies if requested
  let filteredCompanies = companiesWithPriority;
  if (!options?.includeStaleOnly) {
    // Prioritize companies with hard_to_fill signals
    filteredCompanies = companiesWithPriority.filter(
      (c) => c.has_hard_to_fill || c.enrichment_priority > 30
    );
  }

  // Sort by enrichment priority (highest first)
  filteredCompanies.sort((a, b) => {
    // First sort by has_hard_to_fill (true first)
    if (a.has_hard_to_fill !== b.has_hard_to_fill) {
      return a.has_hard_to_fill ? -1 : 1;
    }
    // Then by enrichment priority
    return b.enrichment_priority - a.enrichment_priority;
  });

  return { companies: filteredCompanies.slice(0, limit) };
}

/**
 * Get jobs that should be enriched, prioritizing hard_to_fill
 */
export async function getJobsForEnrichment(
  supabase: SupabaseClient,
  companyIds: string[],
  options?: {
    limit?: number;
    skipEnrichedWithinDays?: number;
  }
): Promise<{
  jobs: Array<{
    id: string;
    source_url: string;
    company_id: string;
    priority: number;
  }>;
}> {
  const limit = options?.limit || 200;
  const skipDays = options?.skipEnrichedWithinDays || 7;

  // Calculate cutoff date for re-enrichment
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - skipDays);

  // Fetch jobs with their associated signals
  const { data: jobs, error } = await supabase
    .from('job_postings')
    .select(`
      id,
      source_url,
      company_id,
      enriched_at,
      signals:company_pain_signals(pain_signal_type, is_active)
    `)
    .in('company_id', companyIds)
    .eq('is_active', true)
    .or(`enriched_at.is.null,enriched_at.lt.${cutoffDate.toISOString()}`);

  if (error) {
    console.error('[enrichment] Error fetching jobs:', error);
    return { jobs: [] };
  }

  // Calculate priority for each job
  const jobsWithPriority = (jobs || [])
    .filter((job) => job.source_url) // Must have a URL to enrich
    .map((job) => {
      const signals = (job.signals || []) as Array<{ pain_signal_type: string; is_active: boolean }>;
      let priority = 0;

      // Get highest priority signal for this job
      for (const signal of signals) {
        if (signal.is_active) {
          const signalPriority = ENRICHMENT_PRIORITY[signal.pain_signal_type] || 0;
          priority = Math.max(priority, signalPriority);
        }
      }

      return {
        id: job.id,
        source_url: job.source_url!,
        company_id: job.company_id,
        priority,
      };
    });

  // Sort by priority (highest first)
  jobsWithPriority.sort((a, b) => b.priority - a.priority);

  return { jobs: jobsWithPriority.slice(0, limit) };
}
