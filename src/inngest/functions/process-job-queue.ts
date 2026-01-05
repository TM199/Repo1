/**
 * Job Queue Processor - Inngest Function
 *
 * Processes pending job fetch tasks from scan_queue.
 * Runs every 20 minutes, picks ONE task that's due, fetches jobs,
 * and triggers signal generation.
 *
 * Schedule: Every 20 minutes
 */

import { inngest } from '../client';
import { createAdminClient } from '@/lib/supabase/server';
import { logActivity } from '@/lib/activity-logger';
import {
  searchReedMultipleKeywords,
  isRecruitmentAgency,
} from '@/lib/job-boards';
import {
  searchAdzunaMultipleKeywords,
  mapAdzunaCategoryToIndustry,
  parseAdzunaDate,
} from '@/lib/adzuna';
// Note: Company creation removed - now handled in generate-pain-signals per user
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

// Industry detection patterns
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

export const processJobQueueFunction = inngest.createFunction(
  {
    id: 'process-job-queue',
    throttle: { limit: 1, period: '15m' }, // Prevent overlapping runs
    retries: 2,
  },
  [
    { cron: '*/20 * * * *' }, // Every 20 minutes
    { event: 'queue/process' }, // Manual trigger
  ],
  async ({ event, step }) => {
    const supabase = createAdminClient();
    const limit = event?.data?.limit || 1; // Process 1 task by default

    // ==========================================
    // STEP 1: Pick Next Task from Queue
    // ==========================================
    const task = await step.run('pick-next-task', async () => {
      const now = new Date();

      // Get next pending task that's due
      const { data: tasks, error } = await supabase
        .from('scan_queue')
        .select('*')
        .eq('status', 'pending')
        .lte('scheduled_for', now.toISOString())
        .order('scheduled_for', { ascending: true })
        .limit(1);

      if (error) {
        throw new Error(`Failed to fetch queue: ${error.message}`);
      }

      if (!tasks || tasks.length === 0) {
        return null; // No tasks due
      }

      const task = tasks[0];

      // Mark as processing
      await supabase
        .from('scan_queue')
        .update({
          status: 'processing',
          started_at: new Date().toISOString(),
          attempts: task.attempts + 1,
        })
        .eq('id', task.id);

      return task;
    });

    if (!task) {
      return {
        success: true,
        message: 'No tasks due for processing',
        timestamp: new Date().toISOString(),
      };
    }

    // ==========================================
    // STEP 2: Fetch Jobs for This Task
    // ==========================================
    const jobsResult = await step.run('fetch-jobs', async () => {
      const isReed = task.task_type === 'job_fetch_reed';
      const isAdzuna = task.task_type === 'job_fetch_adzuna';

      if (isReed) {
        const jobs = await searchReedMultipleKeywords({
          keywords: [task.keywords],
          locations: task.location ? [task.location] : [], // Empty = all UK
          postedWithin: 60, // Fetch last 60 days (minimum requirement)
          directEmployerOnly: true,
          limitPerSearch: 200,
        });
        return { source: 'reed', jobs };
      } else if (isAdzuna) {
        const jobs = await searchAdzunaMultipleKeywords({
          keywords: [task.keywords],
          locations: task.location ? [task.location] : [], // Empty = all UK
          maxDaysOld: 60, // Fetch last 60 days (minimum requirement)
        });
        return { source: 'adzuna', jobs };
      }

      return { source: 'unknown', jobs: [] };
    });

    // ==========================================
    // STEP 3: Process Jobs (Create Companies & Job Postings)
    // ==========================================
    const processingStats = await step.run('process-jobs', async () => {
      const stats = {
        new_jobs: 0,
        updated_jobs: 0,
        new_companies: 0,
        reposts: 0,
        errors: [] as string[],
      };

      const { source, jobs } = jobsResult as any;

      for (const job of jobs) {
        try {
          // Extract job details based on source
          let jobData: any;

          if (source === 'reed') {
            const isLikelyAgency = isRecruitmentAgency(job.employerName, job.jobDescription);
            const detectedIndustry = detectIndustryFromTitle(job.jobTitle);
            const salary = parseReedSalary(job);

            jobData = {
              source: 'reed',
              sourceId: String(job.jobId),
              title: job.jobTitle,
              companyName: job.employerName,
              location: job.locationName,
              postedDate: job.date,
              sourceUrl: job.jobUrl,
              description: job.jobDescription,
              salary,
              detectedIndustry,
              isLikelyAgency,
            };
          } else if (source === 'adzuna') {
            if (!job.company?.display_name || !job.location?.display_name) {
              continue;
            }

            const isLikelyAgency = isRecruitmentAgency(job.company.display_name, job.description);
            const detectedIndustry = job.category?.tag
              ? mapAdzunaCategoryToIndustry(job.category.tag)
              : detectIndustryFromTitle(job.title);

            jobData = {
              source: 'adzuna',
              sourceId: job.id,
              title: job.title,
              companyName: job.company.display_name,
              location: job.location.display_name,
              postedDate: parseAdzunaDate(job.created) || job.created,
              sourceUrl: job.redirect_url,
              description: job.description,
              salary: {
                annual_min: job.salary_min ? Math.round(job.salary_min) : null,
                annual_max: job.salary_max ? Math.round(job.salary_max) : null,
                salary_type: 'annual',
                confidence: job.salary_is_predicted === '0' ? 'high' : 'low',
              },
              detectedIndustry,
              contractType: job.contract_type,
              isLikelyAgency,
            };
          } else {
            continue;
          }

          // Note: Companies now created in signal generation (per user)
          // Job postings are shared across all users (public API data)

          // Generate fingerprint
          const fingerprint = generateJobFingerprint({
            title: jobData.title,
            company_name: jobData.companyName,
            location: jobData.location,
          });

          // Check for existing job
          const { data: existingJob } = await supabase
            .from('job_postings')
            .select('*')
            .eq('fingerprint', fingerprint)
            .single();

          if (existingJob) {
            // Update existing job
            await supabase
              .from('job_postings')
              .update({
                last_seen_at: new Date().toISOString(),
                is_active: true,
              })
              .eq('id', existingJob.id);
            stats.updated_jobs++;
            continue;
          }

          // Check for reposts (using employer name instead of company_id)
          let previousPostingId: string | null = null;
          let salaryIncrease: number | null = null;
          let repostCount = 0;

          const { data: similarJobs } = await supabase
            .from('job_postings')
            .select('*')
            .eq('employer_name_from_source', jobData.companyName)
            .eq('is_active', false)
            .order('last_seen_at', { ascending: false})
            .limit(10);

          if (similarJobs) {
            for (const oldJob of similarJobs) {
              if (
                areJobsSimilar(
                  { title: jobData.title, company_name: jobData.companyName, location: jobData.location },
                  { title: oldJob.title, company_name: jobData.companyName, location: oldJob.location || '' }
                )
              ) {
                previousPostingId = oldJob.id;
                repostCount = (oldJob.repost_count || 0) + 1;
                salaryIncrease = calculateSalaryIncrease(
                  oldJob.salary_min,
                  oldJob.salary_max,
                  jobData.salary.annual_min,
                  jobData.salary.annual_max
                );
                if (repostCount > 0) stats.reposts++;
                break;
              }
            }
          }

          // Detect features
          const referralBonus = jobData.description
            ? detectReferralBonus(jobData.description)
            : { hasBonus: false, amount: null };
          const department = classifyJobByDepartment(jobData.title);
          const urgencyLevel = jobData.description ? detectUrgencyLevel(jobData.description) : null;
          const hasUrgency = jobData.description ? hasUrgencyKeywords(jobData.description) : false;

          // Insert new job
          await supabase.from('job_postings').insert({
            company_id: null, // Companies created per-user in signal generation
            reed_job_id: source === 'reed' ? jobData.sourceId : null,
            adzuna_job_id: source === 'adzuna' ? jobData.sourceId : null,
            fingerprint,
            title: jobData.title,
            title_normalized: normalizeJobTitle(jobData.title),
            location: jobData.location,
            location_normalized: normalizeLocation(jobData.location),
            salary_min: jobData.salary.annual_min,
            salary_max: jobData.salary.annual_max,
            salary_type: jobData.salary.salary_type,
            salary_normalized_annual: jobData.salary.annual_min,
            contract_type: jobData.contractType,
            industry: jobData.detectedIndustry,
            source: jobData.source,
            source_url: jobData.sourceUrl,
            original_posted_date: parseReedDate(jobData.postedDate),
            repost_count: repostCount,
            previous_posting_id: previousPostingId,
            salary_increase_from_previous: salaryIncrease,
            mentions_referral_bonus: referralBonus.hasBonus,
            referral_bonus_amount: referralBonus.amount,
            raw_description: jobData.description?.substring(0, 5000),
            employer_name_from_source: jobData.companyName,
            department,
            urgency_level: urgencyLevel,
            has_urgency_keywords: hasUrgency,
          });

          stats.new_jobs++;
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          stats.errors.push(message);
        }
      }

      return stats;
    });

    // ==========================================
    // STEP 4: Mark Task as Complete
    // ==========================================
    await step.run('complete-task', async () => {
      await supabase
        .from('scan_queue')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          jobs_found: processingStats.new_jobs + processingStats.updated_jobs,
          error_message: processingStats.errors.length > 0 ? processingStats.errors[0] : null,
        })
        .eq('id', task.id);

      await logActivity({
        type: 'jobs_synced',
        title: 'Job queue processed',
        detail: `${task.keywords} × ${task.location || 'All UK'} (${processingStats.new_jobs} new, ${processingStats.updated_jobs} updated)`,
        metadata: {
          taskType: task.task_type,
          keywords: task.keywords,
          location: task.location || 'All UK',
          newJobs: processingStats.new_jobs,
          updatedJobs: processingStats.updated_jobs,
        },
      });
    });

    // ==========================================
    // STEP 5: Trigger Signal Generation
    // ==========================================
    if (processingStats.new_jobs > 0) {
      await step.sendEvent('trigger-signal-generation', {
        name: 'pain-signals/generate',
        data: {},
      });
    }

    return {
      success: true,
      task: {
        id: task.id,
        type: task.task_type,
        keywords: task.keywords,
        location: task.location,
      },
      stats: processingStats,
      timestamp: new Date().toISOString(),
    };
  }
);
