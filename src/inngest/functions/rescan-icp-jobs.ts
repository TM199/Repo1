/**
 * Rescan ICP Jobs - Inngest Function
 *
 * Migrated from: src/app/api/cron/rescan-icp-jobs/route.ts
 *
 * Runs 3x daily to re-fetch jobs matching ICP profiles.
 * Detects changes like reposts, salary increases, and referral bonuses.
 * Creates new signals when changes are detected.
 *
 * Schedule: 6am, 12pm, 6pm daily
 * Can also be triggered manually via 'icp/rescan-jobs' event
 */

import { inngest } from '../client';
import { createAdminClient } from '@/lib/supabase/server';
import { searchReedParallel, isRecruitmentAgency } from '@/lib/job-boards';
import { getRoleSearchTerms } from '@/lib/role-variations';
import {
  generateJobFingerprint,
  areJobsSimilar,
} from '@/lib/jobs/job-fingerprint';
import {
  parseReedSalary,
  calculateSalaryIncrease,
  detectReferralBonus,
} from '@/lib/jobs/salary-normalizer';
import {
  createSalaryChangeSignal,
  createRepostSignal,
  generateJobPainSignals,
} from '@/lib/signals/job-signal-generator';
import { findOrCreateCompany } from '@/lib/companies/company-matcher';
import { checkAndIncrementApiUsage, getRemainingCalls } from '@/lib/rate-limiter';
import { ICPProfile } from '@/types';

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
  'Engineering & Manufacturing': [
    /\b(mechanical engineer|electrical engineer|manufacturing|production|quality|cnc|maintenance engineer|plant manager|process engineer)\b/i,
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

// Stats type for tracking progress
interface RescanStats {
  profiles_scanned: number;
  jobs_checked: number;
  jobs_updated: number;
  new_jobs: number;
  reposts_detected: number;
  salary_increases: number;
  signals_created: number;
  errors: string[];
}

export const rescanIcpJobsFunction = inngest.createFunction(
  {
    id: 'rescan-icp-jobs',
    throttle: { limit: 1, period: '30m' },
    retries: 3,
  },
  [
    { cron: '0 6,12,18 * * *' }, // 3x daily: 6am, 12pm, 6pm
    { event: 'icp/rescan-jobs' }, // Manual trigger with optional icpId
  ],
  async ({ event, step }) => {
    const supabase = createAdminClient();

    // Get optional icpId from event data
    const icpId = event?.data?.icpId as string | undefined;

    const stats: RescanStats = {
      profiles_scanned: 0,
      jobs_checked: 0,
      jobs_updated: 0,
      new_jobs: 0,
      reposts_detected: 0,
      salary_increases: 0,
      signals_created: 0,
      errors: [],
    };

    // ==========================================
    // STEP 1: Check API Budget
    // ==========================================
    const budgetCheck = await step.run('check-api-budget', async (): Promise<{
      allowed: boolean;
      remaining: number;
    }> => {
      const remaining = await getRemainingCalls('reed');
      return {
        allowed: remaining >= 10,
        remaining,
      };
    });

    if (!budgetCheck.allowed) {
      return {
        success: true,
        message: 'Insufficient API budget',
        remaining: budgetCheck.remaining,
        stats,
      };
    }

    // ==========================================
    // STEP 2: Get Active ICP Profiles
    // ==========================================
    const profiles = await step.run('get-icp-profiles', async (): Promise<ICPProfile[]> => {
      let query = supabase
        .from('icp_profiles')
        .select('*')
        .eq('is_active', true)
        .contains('signal_types', ['job_pain']);

      // Filter by specific ICP if provided
      if (icpId) {
        query = query.eq('id', icpId);
      }

      const { data } = await query;
      return (data || []) as ICPProfile[];
    });

    if (profiles.length === 0) {
      return {
        success: true,
        message: 'No active ICP profiles with job_pain',
        stats,
      };
    }

    // Calculate calls per profile
    const callsPerProfile = Math.floor(budgetCheck.remaining / profiles.length);

    // ==========================================
    // STEP 3: Process Each Profile
    // ==========================================
    for (const profile of profiles) {
      const profileStats = await step.run(
        `process-profile-${profile.id}`,
        async (): Promise<{
          jobs_checked: number;
          jobs_updated: number;
          new_jobs: number;
          reposts_detected: number;
          salary_increases: number;
          signals_created: number;
          errors: string[];
          budget_exhausted: boolean;
        }> => {
          const localStats = {
            jobs_checked: 0,
            jobs_updated: 0,
            new_jobs: 0,
            reposts_detected: 0,
            salary_increases: 0,
            signals_created: 0,
            errors: [] as string[],
            budget_exhausted: false,
          };

          try {
            // Check budget before processing
            const { allowed } = await checkAndIncrementApiUsage('reed');
            if (!allowed) {
              localStats.budget_exhausted = true;
              return localStats;
            }

            console.log(`[RescanICP] Scanning profile: ${profile.name}`);

            const roles = profile.specific_roles || [];
            const locations = profile.locations.length > 0
              ? profile.locations
              : ['London', 'Manchester', 'Birmingham'];

            if (roles.length === 0) {
              return localStats;
            }

            // Search for top 2 roles across all locations
            const primaryRoles = roles.slice(0, 2);

            for (const role of primaryRoles) {
              const searchTerms = getRoleSearchTerms(role);
              const primaryTerm = searchTerms[0];

              const jobs = await searchReedParallel({
                keywords: primaryTerm,
                locations: locations.slice(0, 4),
                postedWithin: 30,
                directEmployerOnly: true,
                limitPerLocation: 25,
              });

              localStats.jobs_checked += jobs.length;

              // Process each job
              for (const reedJob of jobs) {
                try {
                  // Skip recruitment agencies
                  if (isRecruitmentAgency(reedJob.employerName, reedJob.jobDescription || '')) {
                    continue;
                  }

                  // Generate fingerprint
                  const fingerprint = generateJobFingerprint({
                    title: reedJob.jobTitle,
                    company_name: reedJob.employerName,
                    location: reedJob.locationName || '',
                  });

                  // Check for existing job by fingerprint
                  const { data: existingJob } = await supabase
                    .from('job_postings')
                    .select('*, companies!inner(id, name)')
                    .eq('fingerprint', fingerprint)
                    .single();

                  if (existingJob) {
                    // UPDATE existing job - check for changes
                    const now = new Date().toISOString();

                    // Parse current salary
                    const currentSalary = parseReedSalary({
                      minimumSalary: reedJob.minimumSalary,
                      maximumSalary: reedJob.maximumSalary,
                    });

                    // Check for salary increase
                    if (currentSalary.annual_min && existingJob.salary_min) {
                      const salaryIncrease = calculateSalaryIncrease(
                        existingJob.salary_min,
                        existingJob.salary_max,
                        currentSalary.annual_min,
                        currentSalary.annual_max
                      );

                      if (salaryIncrease && salaryIncrease > 10) {
                        console.log(`[RescanICP] Salary increase detected: ${existingJob.title} (+${Math.round(salaryIncrease)}%)`);
                        localStats.salary_increases++;

                        await createSalaryChangeSignal(
                          supabase,
                          { id: existingJob.id, title: existingJob.title },
                          { id: existingJob.company_id },
                          salaryIncrease,
                          profile.id
                        );
                        localStats.signals_created++;

                        // Update job with new salary
                        await supabase
                          .from('job_postings')
                          .update({
                            salary_min: currentSalary.annual_min,
                            salary_max: currentSalary.annual_max,
                            salary_increase_from_previous: salaryIncrease,
                            last_seen_at: now,
                          })
                          .eq('id', existingJob.id);
                      }
                    }

                    // Check for referral bonus added
                    const referralBonus = detectReferralBonus(reedJob.jobDescription || '');
                    if (referralBonus.hasBonus && !existingJob.mentions_referral_bonus) {
                      console.log(`[RescanICP] Referral bonus detected: ${existingJob.title}`);

                      await supabase
                        .from('job_postings')
                        .update({
                          mentions_referral_bonus: true,
                          referral_bonus_amount: referralBonus.amount,
                          last_seen_at: now,
                        })
                        .eq('id', existingJob.id);
                    }

                    // Update last_seen_at
                    await supabase
                      .from('job_postings')
                      .update({
                        last_seen_at: now,
                        is_active: true,
                      })
                      .eq('id', existingJob.id);

                    localStats.jobs_updated++;
                  } else {
                    // NEW job - check if it's a repost
                    const detectedIndustry = detectIndustryFromTitle(reedJob.jobTitle);

                    const { company } = await findOrCreateCompany({
                      name: reedJob.employerName,
                      location: reedJob.locationName || '',
                      industry: detectedIndustry,
                    });

                    // Check for similar inactive jobs (repost detection)
                    let repostCount = 0;
                    let previousPostingId: string | null = null;

                    const { data: similarJobs } = await supabase
                      .from('job_postings')
                      .select('*')
                      .eq('company_id', company.id)
                      .eq('is_active', false)
                      .order('last_seen_at', { ascending: false })
                      .limit(10);

                    if (similarJobs) {
                      for (const oldJob of similarJobs) {
                        if (
                          areJobsSimilar(
                            { title: reedJob.jobTitle, company_name: reedJob.employerName, location: reedJob.locationName || '' },
                            { title: oldJob.title, company_name: company.name, location: oldJob.location || '' }
                          )
                        ) {
                          previousPostingId = oldJob.id;
                          repostCount = (oldJob.repost_count || 0) + 1;
                          localStats.reposts_detected++;
                          console.log(`[RescanICP] Repost detected: ${reedJob.jobTitle} (${repostCount}x)`);
                          break;
                        }
                      }
                    }

                    // Parse salary and referral bonus
                    const salary = parseReedSalary({
                      minimumSalary: reedJob.minimumSalary,
                      maximumSalary: reedJob.maximumSalary,
                    });
                    const referralBonus = detectReferralBonus(reedJob.jobDescription || '');

                    // Insert new job
                    const { data: newJob, error: insertError } = await supabase
                      .from('job_postings')
                      .insert({
                        company_id: company.id,
                        reed_job_id: reedJob.jobUrl.match(/\/job\/(\d+)/)?.[1] || String(reedJob.jobId),
                        fingerprint,
                        title: reedJob.jobTitle,
                        location: reedJob.locationName,
                        salary_min: salary.annual_min,
                        salary_max: salary.annual_max,
                        salary_type: salary.salary_type,
                        industry: detectedIndustry,
                        source: 'reed',
                        source_url: reedJob.jobUrl,
                        original_posted_date: reedJob.date
                          ? new Date(reedJob.date).toISOString().split('T')[0]
                          : new Date().toISOString().split('T')[0],
                        repost_count: repostCount,
                        previous_posting_id: previousPostingId,
                        mentions_referral_bonus: referralBonus.hasBonus,
                        referral_bonus_amount: referralBonus.amount,
                        raw_description: reedJob.jobDescription?.substring(0, 5000),
                        employer_name_from_source: reedJob.employerName,
                      })
                      .select()
                      .single();

                    if (insertError) {
                      localStats.errors.push(`Insert: ${insertError.message}`);
                      continue;
                    }

                    localStats.new_jobs++;

                    // Generate pain signals (with ICP profile ID)
                    if (newJob) {
                      const { signals_generated } = await generateJobPainSignals(
                        supabase,
                        {
                          id: newJob.id,
                          title: newJob.title,
                          location: newJob.location || '',
                          original_posted_date: newJob.original_posted_date,
                          repost_count: newJob.repost_count || 0,
                          salary_increase_from_previous: null,
                          mentions_referral_bonus: newJob.mentions_referral_bonus || false,
                          referral_bonus_amount: newJob.referral_bonus_amount,
                        },
                        company,
                        { icpProfileId: profile.id }
                      );
                      localStats.signals_created += signals_generated;
                    }
                  }
                } catch (jobError) {
                  const msg = jobError instanceof Error ? jobError.message : 'Unknown error';
                  localStats.errors.push(`Job: ${msg}`);
                }
              }

              // Small delay between role searches
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          } catch (profileError) {
            const msg = profileError instanceof Error ? profileError.message : 'Unknown error';
            localStats.errors.push(`Profile ${profile.name}: ${msg}`);
          }

          return localStats;
        }
      );

      // Aggregate stats
      stats.profiles_scanned++;
      stats.jobs_checked += profileStats.jobs_checked;
      stats.jobs_updated += profileStats.jobs_updated;
      stats.new_jobs += profileStats.new_jobs;
      stats.reposts_detected += profileStats.reposts_detected;
      stats.salary_increases += profileStats.salary_increases;
      stats.signals_created += profileStats.signals_created;
      stats.errors.push(...profileStats.errors);

      // Stop if budget exhausted
      if (profileStats.budget_exhausted) {
        console.log('[RescanICP] API budget exhausted');
        break;
      }
    }

    return {
      success: true,
      stats,
      timestamp: new Date().toISOString(),
    };
  }
);
