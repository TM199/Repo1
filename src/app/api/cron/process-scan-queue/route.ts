/**
 * Process Scan Queue Cron
 *
 * Runs every 15 minutes to process queued ICP expansion tasks.
 * Respects Reed API rate limits (100 calls/day).
 */

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { searchReed, isRecruitmentAgency, filterByEmploymentType } from '@/lib/job-boards';
import { getRoleSearchTerms } from '@/lib/role-variations';
import { findOrCreateCompany } from '@/lib/companies/company-matcher';
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
import { generateJobPainSignals } from '@/lib/signals/job-signal-generator';
import {
  getNextQueueTasks,
  markTaskProcessing,
  markTaskCompleted,
  markTaskFailed,
  updateScanProgress,
  checkAndFinalizeExpansion,
} from '@/lib/scan-queue';
import { checkAndIncrementApiUsage } from '@/lib/rate-limiter';
import { ICPProfile } from '@/types';

export const maxDuration = 300;

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

export async function GET() {
  const startTime = Date.now();
  const supabase = createAdminClient();

  const stats = {
    tasks_processed: 0,
    jobs_found: 0,
    jobs_inserted: 0,
    signals_generated: 0,
    errors: [] as string[],
  };

  try {
    console.log('[ProcessQueue] Starting queue processing...');

    // Get next pending tasks (limit to 2 per run to stay within budget)
    const tasks = await getNextQueueTasks(supabase, 2);

    if (tasks.length === 0) {
      console.log('[ProcessQueue] No pending tasks');
      return NextResponse.json({ success: true, message: 'No pending tasks', stats });
    }

    console.log(`[ProcessQueue] Processing ${tasks.length} tasks`);

    for (const task of tasks) {
      try {
        // Check API budget before each task
        const { allowed, remaining } = await checkAndIncrementApiUsage('reed');
        if (!allowed) {
          console.log('[ProcessQueue] API budget exhausted, stopping');
          break;
        }

        console.log(`[ProcessQueue] Processing task ${task.id}: ${task.keywords} in ${task.location} (${remaining} calls remaining)`);

        // Mark as processing
        await markTaskProcessing(supabase, task.id);

        // Get the ICP profile for employment type filter
        const { data: profile } = await supabase
          .from('icp_profiles')
          .select('*')
          .eq('id', task.icp_profile_id)
          .single();

        if (!profile) {
          await markTaskFailed(supabase, task.id, 'ICP profile not found');
          continue;
        }

        const icpProfile = profile as ICPProfile;
        const employmentType = icpProfile.employment_type || 'both';

        // Search Reed
        const searchTerms = getRoleSearchTerms(task.keywords);
        const primaryTerm = searchTerms[0];

        const jobs = await searchReed({
          keywords: primaryTerm,
          location: task.location,
          postedWithin: 30,
          directEmployerOnly: true,
          limit: 50,
        });

        stats.jobs_found += jobs.length;

        // Apply employment type filter
        const filteredJobs = filterByEmploymentType(
          jobs.map(j => ({
            jobId: parseInt(j.signal_url.match(/\/job\/(\d+)/)?.[1] || '0'),
            employerName: j.company_name,
            jobTitle: j.signal_title,
            locationName: task.location,
            jobDescription: j.job_description || '',
            jobUrl: j.signal_url,
            date: j.posted_date || new Date().toISOString(),
          })),
          employmentType
        );

        let taskJobsInserted = 0;
        let taskSignals = 0;

        // Process each job
        for (const reedJob of filteredJobs) {
          try {
            // Skip recruitment agencies
            if (isRecruitmentAgency(reedJob.employerName, reedJob.jobDescription)) {
              continue;
            }

            // Detect industry from job title
            const detectedIndustry = detectIndustryFromTitle(reedJob.jobTitle);

            // Find or create company
            const { company } = await findOrCreateCompany({
              name: reedJob.employerName,
              location: reedJob.locationName,
              industry: detectedIndustry,
            });

            // Generate fingerprint
            const fingerprint = generateJobFingerprint({
              title: reedJob.jobTitle,
              company_name: reedJob.employerName,
              location: reedJob.locationName,
            });

            // Check for existing job
            const { data: existingJob } = await supabase
              .from('job_postings')
              .select('id')
              .eq('fingerprint', fingerprint)
              .single();

            if (existingJob) {
              // Update last_seen_at
              await supabase
                .from('job_postings')
                .update({
                  last_seen_at: new Date().toISOString(),
                  is_active: true,
                })
                .eq('id', existingJob.id);
              continue;
            }

            // Check for similar jobs (repost detection)
            let repostCount = 0;
            let previousPostingId: string | null = null;
            let salaryIncrease: number | null = null;

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
                    { title: reedJob.jobTitle, company_name: reedJob.employerName, location: reedJob.locationName },
                    { title: oldJob.title, company_name: company.name, location: oldJob.location || '' }
                  )
                ) {
                  previousPostingId = oldJob.id;
                  repostCount = (oldJob.repost_count || 0) + 1;

                  // Note: We don't have salary info in the simplified job format
                  // Salary comparison would need the full ReedJob object
                  break;
                }
              }
            }

            // Parse salary and detect referral bonus
            const referralBonus = detectReferralBonus(reedJob.jobDescription || '');

            // Insert job posting
            const { data: newJob, error: insertError } = await supabase
              .from('job_postings')
              .insert({
                company_id: company.id,
                reed_job_id: String(reedJob.jobId),
                fingerprint,
                title: reedJob.jobTitle,
                title_normalized: normalizeJobTitle(reedJob.jobTitle),
                location: reedJob.locationName,
                location_normalized: normalizeLocation(reedJob.locationName),
                industry: detectedIndustry,
                source: 'reed',
                source_url: reedJob.jobUrl,
                original_posted_date: new Date(reedJob.date).toISOString().split('T')[0],
                repost_count: repostCount,
                previous_posting_id: previousPostingId,
                salary_increase_from_previous: salaryIncrease,
                mentions_referral_bonus: referralBonus.hasBonus,
                referral_bonus_amount: referralBonus.amount,
                raw_description: reedJob.jobDescription?.substring(0, 5000),
                employer_name_from_source: reedJob.employerName,
              })
              .select()
              .single();

            if (insertError) {
              stats.errors.push(`Insert error: ${insertError.message}`);
              continue;
            }

            taskJobsInserted++;
            stats.jobs_inserted++;

            // Generate pain signals using shared function (with ICP profile ID)
            if (newJob) {
              const { signals_generated } = await generateJobPainSignals(
                supabase,
                {
                  id: newJob.id,
                  title: newJob.title,
                  location: newJob.location,
                  original_posted_date: newJob.original_posted_date,
                  repost_count: newJob.repost_count || 0,
                  salary_increase_from_previous: newJob.salary_increase_from_previous,
                  mentions_referral_bonus: newJob.mentions_referral_bonus || false,
                  referral_bonus_amount: newJob.referral_bonus_amount,
                },
                company,
                { icpProfileId: task.icp_profile_id }
              );
              taskSignals += signals_generated;
              stats.signals_generated += signals_generated;
            }
          } catch (jobError) {
            const msg = jobError instanceof Error ? jobError.message : 'Unknown error';
            stats.errors.push(`Job ${reedJob.jobId}: ${msg}`);
          }
        }

        // Mark task completed
        await markTaskCompleted(supabase, task.id, taskJobsInserted);
        stats.tasks_processed++;

        // Update ICP profile progress
        await updateScanProgress(supabase, task.icp_profile_id, {
          jobs_found: taskJobsInserted,
          signals_generated: taskSignals,
          tasks_completed: 1,
        });

        // Check if expansion is complete
        await checkAndFinalizeExpansion(supabase, task.icp_profile_id, task.batch_id);

      } catch (taskError) {
        const msg = taskError instanceof Error ? taskError.message : 'Unknown error';
        stats.errors.push(`Task ${task.id}: ${msg}`);
        await markTaskFailed(supabase, task.id, msg);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[ProcessQueue] Complete in ${duration}ms. Tasks: ${stats.tasks_processed}, Jobs: ${stats.jobs_inserted}, Signals: ${stats.signals_generated}`);

    return NextResponse.json({
      success: true,
      stats,
      duration_ms: duration,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[ProcessQueue] Error:', error);
    return NextResponse.json(
      { success: false, error: message, stats },
      { status: 500 }
    );
  }
}
