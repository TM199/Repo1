/**
 * Daily Job Sync - Inngest Function
 *
 * Consolidated from: ingest-jobs, process-scan-queue, schedule-daily-jobs
 *
 * Fetches jobs from Reed and Adzuna, creates companies, and tracks job
 * fingerprints for staleness and repost detection.
 *
 * Schedule: 6 AM daily (single daily sync with circuit breaker)
 * Can also be triggered manually via 'jobs/ingest' event
 *
 * Circuit breaker: Stops when Reed API budget (100 calls/day) is exhausted.
 */

import { inngest } from '../client';
import { createAdminClient } from '@/lib/supabase/server';
import { activityLogger } from '@/lib/activity-logger';
import { getRemainingCalls, checkAndIncrementApiUsage } from '@/lib/rate-limiter';
import {
  searchReedMultipleKeywords,
} from '@/lib/job-boards';
import {
  searchAdzunaMultipleKeywords,
  mapAdzunaCategoryToIndustry,
  parseAdzunaDate,
} from '@/lib/adzuna';
import {
  generateJobFingerprint,
  areJobsSimilar,
  normalizeJobTitle,
  normalizeLocation,
} from '@/lib/jobs/job-fingerprint';
import {
  parseReedSalary,
  calculateSalaryIncrease,
  detectReferralBonus,
} from '@/lib/jobs/salary-normalizer';
import { classifyJobByDepartment } from '@/lib/jobs/department-classifier';
import { detectUrgencyLevel, hasUrgencyKeywords } from '@/lib/jobs/urgency-detector';

// Default UK regions (used if no ICP profiles exist)
const DEFAULT_UK_REGIONS = [
  'London',
  'Manchester',
  'Birmingham',
  'Leeds',
  'Bristol',
];

// Location groups for distributed scheduling
const LOCATION_GROUPS: Record<string, string[]> = {
  london: ['London'],
  major: ['Manchester', 'Birmingham', 'Leeds', 'Bristol'],
  regional: ['Newcastle', 'Nottingham', 'Cardiff', 'Glasgow', 'Edinburgh', 'Liverpool', 'Sheffield'],
};

// Industry detection from job titles
const INDUSTRY_PATTERNS: Record<string, RegExp[]> = {
  'Technology & Software': [
    /\b(developer|engineer|devops|software|frontend|backend|full.?stack|data scientist|machine learning|ai|cloud|architect|sre|platform)\b/i,
  ],
  'Construction & Infrastructure': [
    /\b(site manager|quantity surveyor|project manager|contracts manager|civil|groundworks|construction|surveyor|estimator|bim|clerk of works|site engineer)\b/i,
  ],
  'Healthcare & Life Sciences': [
    /\b(nurse|doctor|clinical|healthcare|medical|pharmacist|care manager|therapist|surgeon|consultant|gp|nhs)\b/i,
  ],
  'Financial Services': [
    /\b(accountant|auditor|financial|banker|analyst|compliance|risk|actuary|underwriter|fund manager|wealth|investment)\b/i,
  ],
  'Legal & Professional Services': [
    /\b(solicitor|lawyer|paralegal|legal|barrister|conveyancer|litigation|partner.*law)\b/i,
  ],
  'Engineering & Manufacturing': [
    /\b(mechanical engineer|electrical engineer|manufacturing|production|quality|cnc|maintenance engineer|plant manager|process engineer)\b/i,
  ],
  'Energy & Utilities': [
    /\b(renewable|solar|wind|energy|utilities|oil|gas|nuclear|grid|power|sustainability|carbon)\b/i,
  ],
  'Logistics & Supply Chain': [
    /\b(warehouse|logistics|supply chain|transport|fleet|distribution|freight|procurement|buyer)\b/i,
  ],
  'Retail & Consumer': [
    /\b(store manager|retail|merchandiser|buyer.*retail|e.?commerce|category manager)\b/i,
  ],
  Education: [
    /\b(teacher|headteacher|lecturer|professor|education|school|senco|teaching assistant)\b/i,
  ],
  'Hospitality & Leisure': [
    /\b(hotel|restaurant|chef|hospitality|events manager|general manager.*hotel|catering)\b/i,
  ],
  'Property & Real Estate': [
    /\b(estate agent|property manager|lettings|surveyor.*property|development manager|asset manager)\b/i,
  ],
};

function detectIndustryFromTitle(title: string): string {
  for (const [industry, patterns] of Object.entries(INDUSTRY_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(title)) {
        return industry;
      }
    }
  }
  return 'Other';
}

function parseReedDate(dateStr: string): string | null {
  if (!dateStr) return null;
  try {
    const ukMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (ukMatch) {
      const [, day, month, year] = ukMatch;
      const parsed = new Date(Number(year), Number(month) - 1, Number(day));
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0];
      }
    }
    const isoMatch = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      const [, year, month, day] = isoMatch;
      const parsed = new Date(Number(year), Number(month) - 1, Number(day));
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0];
      }
    }
    const nativeDate = new Date(dateStr);
    if (!isNaN(nativeDate.getTime())) {
      return nativeDate.toISOString().split('T')[0];
    }
    return null;
  } catch {
    return null;
  }
}

// Stats type for tracking progress
interface IngestStats {
  reed_jobs_fetched: number;
  adzuna_jobs_fetched: number;
  new_jobs_created: number;
  existing_jobs_updated: number;
  reposts_detected: number;
  salary_increases_detected: number;
  companies_created: number;
  errors: string[];
}

export const ingestJobsFunction = inngest.createFunction(
  {
    id: 'ingest-jobs',
    throttle: { limit: 1, period: '30m' }, // Prevent overlapping runs
    retries: 3,
  },
  [
    { cron: '0 6 * * *' }, // 6 AM daily (single daily sync)
    { event: 'jobs/ingest' }, // Manual trigger
  ],
  async ({ event, step }) => {
    const supabase = createAdminClient();

    // Get parameters from event (if triggered manually)
    const sourceFilter = event?.data?.source as 'reed' | 'adzuna' | undefined;
    const locationGroup = event?.data?.locationGroup as 'london' | 'major' | 'regional' | undefined;

    const runReed = !sourceFilter || sourceFilter === 'reed';
    const runAdzuna = !sourceFilter || sourceFilter === 'adzuna';

    const stats: IngestStats = {
      reed_jobs_fetched: 0,
      adzuna_jobs_fetched: 0,
      new_jobs_created: 0,
      existing_jobs_updated: 0,
      reposts_detected: 0,
      salary_increases_detected: 0,
      companies_created: 0,
      errors: [],
    };

    // ==========================================
    // STEP 1: Get ICP Configuration
    // ==========================================
    const icpConfig = await step.run('get-icp-config', async (): Promise<{
      locations: string[];
      industries: string[];
      roles: string[];
    }> => {
      // Get locations
      const { data: profiles } = await supabase
        .from('icp_profiles')
        .select('locations, industries, specific_roles, signal_types')
        .eq('is_active', true);

      if (!profiles || profiles.length === 0) {
        return { locations: DEFAULT_UK_REGIONS, industries: [], roles: [] };
      }

      // Collect unique locations
      const allLocations = new Set<string>();
      for (const profile of profiles) {
        for (const location of profile.locations || []) {
          allLocations.add(location);
        }
      }

      // Filter by location group if specified
      let locations = Array.from(allLocations);
      if (locationGroup && LOCATION_GROUPS[locationGroup]) {
        const groupLocations = LOCATION_GROUPS[locationGroup];
        locations = locations.filter(loc =>
          groupLocations.some(g => loc.toLowerCase().includes(g.toLowerCase()))
        );
        if (locations.length === 0) {
          locations = groupLocations;
        }
      }

      // Collect industries from profiles with job_pain enabled
      const industries = new Set<string>();
      for (const profile of profiles) {
        const signalTypes = profile.signal_types || [];
        if (signalTypes.includes('job_pain')) {
          for (const industry of profile.industries || []) {
            industries.add(industry);
          }
        }
      }

      // Collect roles from profiles with job_pain enabled
      const allRoles = new Set<string>();
      for (const profile of profiles) {
        const signalTypes = profile.signal_types || [];
        if (signalTypes.includes('job_pain')) {
          for (const role of profile.specific_roles || []) {
            allRoles.add(role);
          }
        }
      }

      return {
        locations: locations.length > 0 ? locations : DEFAULT_UK_REGIONS,
        industries: Array.from(industries),
        roles: Array.from(allRoles),
      };
    });

    // Skip if no roles configured
    if (icpConfig.roles.length === 0) {
      return {
        success: true,
        message: 'No ICP roles configured',
        stats,
      };
    }

    // ==========================================
    // STEP 2: Check API Budget (Circuit Breaker)
    // ==========================================
    const apiBudget = await step.run('check-api-budget', async () => {
      const remaining = await getRemainingCalls('reed');
      return { remaining, hasbudget: remaining > 0 };
    });

    // ==========================================
    // STEP 3: Fetch and Process Reed Jobs
    // ==========================================
    if (runReed && apiBudget.hasbudget) {
      const reedStats = await step.run('process-reed-jobs', async () => {
        const localStats = {
          fetched: 0,
          created: 0,
          updated: 0,
          reposts: 0,
          salary_increases: 0,
          companies: 0,
          errors: [] as string[],
        };

        // Record that we're making Reed API calls
        await checkAndIncrementApiUsage('reed');

        try {
          const reedJobs = await searchReedMultipleKeywords({
            keywords: icpConfig.roles,
            locations: icpConfig.locations,
            postedWithin: 365,
            directEmployerOnly: true,
            limitPerSearch: 500,
          });

          localStats.fetched = reedJobs.length;

          for (const reedJob of reedJobs) {
            try {
              const detectedIndustry = detectIndustryFromTitle(reedJob.jobTitle);

              // Skip if industry doesn't match ICP (unless "Other")
              if (icpConfig.industries.length > 0 &&
                  !icpConfig.industries.includes(detectedIndustry) &&
                  detectedIndustry !== 'Other') {
                continue;
              }

              // Note: Companies are now created in signal generation (per user)
              // Job postings are shared across all users (public API data)

              // Generate fingerprint
              const fingerprint = generateJobFingerprint({
                title: reedJob.jobTitle,
                company_name: reedJob.employerName,
                location: reedJob.locationName,
              });

              // Check for existing job
              const { data: existingJob } = await supabase
                .from('job_postings')
                .select('*')
                .eq('fingerprint', fingerprint)
                .single();

              if (existingJob) {
                await supabase
                  .from('job_postings')
                  .update({
                    last_seen_at: new Date().toISOString(),
                    is_active: true,
                  })
                  .eq('id', existingJob.id);
                localStats.updated++;
                continue;
              }

              // Check for reposts (using employer name instead of company_id)
              let previousPostingId: string | null = null;
              let salaryIncrease: number | null = null;
              let repostCount = 0;

              const { data: similarJobs } = await supabase
                .from('job_postings')
                .select('*')
                .eq('employer_name_from_source', reedJob.employerName)
                .eq('is_active', false)
                .order('last_seen_at', { ascending: false })
                .limit(10);

              if (similarJobs) {
                for (const oldJob of similarJobs) {
                  if (areJobsSimilar(
                    { title: reedJob.jobTitle, company_name: reedJob.employerName, location: reedJob.locationName },
                    { title: oldJob.title, company_name: reedJob.employerName, location: oldJob.location || '' }
                  )) {
                    previousPostingId = oldJob.id;
                    repostCount = (oldJob.repost_count || 0) + 1;
                    const salary = parseReedSalary(reedJob);
                    salaryIncrease = calculateSalaryIncrease(
                      oldJob.salary_min,
                      oldJob.salary_max,
                      salary.annual_min,
                      salary.annual_max
                    );
                    if (repostCount > 0) localStats.reposts++;
                    if (salaryIncrease && salaryIncrease > 10) localStats.salary_increases++;
                    break;
                  }
                }
              }

              // Parse salary and detect features
              const salary = parseReedSalary(reedJob);
              const referralBonus = reedJob.jobDescription
                ? detectReferralBonus(reedJob.jobDescription)
                : { hasBonus: false, amount: null };
              const department = classifyJobByDepartment(reedJob.jobTitle);
              const urgencyLevel = reedJob.jobDescription ? detectUrgencyLevel(reedJob.jobDescription) : null;
              const hasUrgency = reedJob.jobDescription ? hasUrgencyKeywords(reedJob.jobDescription) : false;

              // Insert new job
              await supabase.from('job_postings').insert({
                company_id: null, // Companies created per-user in signal generation
                reed_job_id: String(reedJob.jobId),
                fingerprint,
                title: reedJob.jobTitle,
                title_normalized: normalizeJobTitle(reedJob.jobTitle),
                location: reedJob.locationName,
                location_normalized: normalizeLocation(reedJob.locationName),
                salary_min: salary.annual_min,
                salary_max: salary.annual_max,
                salary_type: salary.salary_type,
                salary_normalized_annual: salary.annual_min,
                industry: detectedIndustry,
                source: 'reed',
                source_url: reedJob.jobUrl,
                original_posted_date: parseReedDate(reedJob.date),
                repost_count: repostCount,
                previous_posting_id: previousPostingId,
                salary_increase_from_previous: salaryIncrease,
                mentions_referral_bonus: referralBonus.hasBonus,
                referral_bonus_amount: referralBonus.amount,
                raw_description: reedJob.jobDescription?.substring(0, 5000),
                employer_name_from_source: reedJob.employerName,
                department,
                urgency_level: urgencyLevel,
                has_urgency_keywords: hasUrgency,
              });

              localStats.created++;
            } catch (error: unknown) {
              const message = error instanceof Error ? error.message : 'Unknown error';
              localStats.errors.push(`Reed job ${reedJob.jobId}: ${message}`);
            }
          }
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          localStats.errors.push(`Reed fetch error: ${message}`);
        }

        return localStats;
      });

      stats.reed_jobs_fetched = reedStats.fetched;
      stats.new_jobs_created += reedStats.created;
      stats.existing_jobs_updated += reedStats.updated;
      stats.reposts_detected += reedStats.reposts;
      stats.salary_increases_detected += reedStats.salary_increases;
      stats.companies_created += reedStats.companies;
      stats.errors.push(...reedStats.errors);
    }

    // ==========================================
    // STEP 4: Fetch and Process Adzuna Jobs
    // ==========================================
    if (runAdzuna) {
      const adzunaStats = await step.run('process-adzuna-jobs', async () => {
        const localStats = {
          fetched: 0,
          created: 0,
          updated: 0,
          companies: 0,
          errors: [] as string[],
        };

        try {
          const adzunaJobs = await searchAdzunaMultipleKeywords({
            keywords: icpConfig.roles,
            locations: icpConfig.locations,
            maxDaysOld: 60,
          });

          localStats.fetched = adzunaJobs.length;

          for (const adzunaJob of adzunaJobs) {
            try {
              if (!adzunaJob.company?.display_name || !adzunaJob.location?.display_name) {
                continue;
              }

              const detectedIndustry = adzunaJob.category?.tag
                ? mapAdzunaCategoryToIndustry(adzunaJob.category.tag)
                : detectIndustryFromTitle(adzunaJob.title);

              if (icpConfig.industries.length > 0 &&
                  !icpConfig.industries.includes(detectedIndustry) &&
                  detectedIndustry !== 'Other') {
                continue;
              }

              // Note: Companies are now created in signal generation (per user)
              // Job postings are shared across all users (public API data)

              // Generate fingerprint
              const fingerprint = generateJobFingerprint({
                title: adzunaJob.title,
                company_name: adzunaJob.company.display_name,
                location: adzunaJob.location.display_name,
              });

              // Check for existing job
              const { data: existingJob } = await supabase
                .from('job_postings')
                .select('id')
                .eq('fingerprint', fingerprint)
                .single();

              if (existingJob) {
                await supabase
                  .from('job_postings')
                  .update({
                    last_seen_at: new Date().toISOString(),
                    is_active: true,
                  })
                  .eq('id', existingJob.id);
                localStats.updated++;
                continue;
              }

              // Insert new job
              await supabase.from('job_postings').insert({
                company_id: null, // Companies created per-user in signal generation
                adzuna_job_id: adzunaJob.id,
                fingerprint,
                title: adzunaJob.title,
                title_normalized: normalizeJobTitle(adzunaJob.title),
                location: adzunaJob.location.display_name,
                location_normalized: normalizeLocation(adzunaJob.location.display_name),
                salary_min: adzunaJob.salary_min ? Math.round(adzunaJob.salary_min) : null,
                salary_max: adzunaJob.salary_max ? Math.round(adzunaJob.salary_max) : null,
                salary_type: 'annual',
                contract_type: adzunaJob.contract_type,
                industry: detectedIndustry,
                source: 'adzuna',
                source_url: adzunaJob.redirect_url,
                original_posted_date: parseAdzunaDate(adzunaJob.created) || adzunaJob.created,
                raw_description: adzunaJob.description?.substring(0, 5000),
                employer_name_from_source: adzunaJob.company.display_name,
              });

              localStats.created++;
            } catch (error: unknown) {
              const message = error instanceof Error ? error.message : 'Unknown error';
              localStats.errors.push(`Adzuna job ${adzunaJob.id}: ${message}`);
            }
          }
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          localStats.errors.push(`Adzuna fetch error: ${message}`);
        }

        return localStats;
      });

      stats.adzuna_jobs_fetched = adzunaStats.fetched;
      stats.new_jobs_created += adzunaStats.created;
      stats.existing_jobs_updated += adzunaStats.updated;
      stats.companies_created += adzunaStats.companies;
      stats.errors.push(...adzunaStats.errors);
    }

    // ==========================================
    // STEP 5: Mark Stale Jobs as Inactive
    // ==========================================
    await step.run('mark-stale-jobs', async () => {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      await supabase
        .from('job_postings')
        .update({ is_active: false })
        .lt('last_seen_at', threeDaysAgo.toISOString())
        .eq('is_active', true);
    });

    // Log activity for dashboard feed
    const totalNewJobs = stats.new_jobs_created;
    if (totalNewJobs > 0) {
      await step.run('log-activity', async () => {
        const sources = [];
        if (stats.reed_jobs_fetched > 0) sources.push('Reed');
        if (stats.adzuna_jobs_fetched > 0) sources.push('Adzuna');
        await activityLogger.jobsSynced(totalNewJobs, sources.join(' & '));
      });
    }

    return {
      success: true,
      stats,
      timestamp: new Date().toISOString(),
    };
  }
);
