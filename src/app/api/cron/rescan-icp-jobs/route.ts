/**
 * Rescan ICP Jobs Cron
 *
 * Runs 3x daily to re-fetch jobs matching ICP profiles.
 * Detects changes like reposts, salary increases, and referral bonuses.
 * Creates new signals when changes are detected.
 */

import { NextResponse } from 'next/server';
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
    profiles_scanned: 0,
    jobs_checked: 0,
    jobs_updated: 0,
    new_jobs: 0,
    reposts_detected: 0,
    salary_increases: 0,
    signals_created: 0,
    errors: [] as string[],
  };

  try {
    console.log('[RescanICP] Starting ICP job rescan...');

    // Check remaining API budget
    const remaining = await getRemainingCalls('reed');
    if (remaining < 10) {
      console.log('[RescanICP] Insufficient API budget, skipping');
      return NextResponse.json({
        success: true,
        message: 'Insufficient API budget',
        remaining,
      });
    }

    // Get all active ICP profiles with job_pain enabled
    const { data: profiles } = await supabase
      .from('icp_profiles')
      .select('*')
      .eq('is_active', true)
      .contains('signal_types', ['job_pain']);

    if (!profiles || profiles.length === 0) {
      console.log('[RescanICP] No active ICP profiles with job_pain');
      return NextResponse.json({ success: true, message: 'No profiles to scan', stats });
    }

    console.log(`[RescanICP] Found ${profiles.length} active profiles`);

    // Process each profile (limit API calls per profile)
    const callsPerProfile = Math.floor(remaining / profiles.length);

    for (const profile of profiles) {
      const icpProfile = profile as ICPProfile;

      try {
        // Check budget before each profile
        const { allowed } = await checkAndIncrementApiUsage('reed');
        if (!allowed) {
          console.log('[RescanICP] API budget exhausted');
          break;
        }

        console.log(`[RescanICP] Scanning profile: ${icpProfile.name}`);
        stats.profiles_scanned++;

        const roles = icpProfile.specific_roles || [];
        const locations = icpProfile.locations.length > 0
          ? icpProfile.locations
          : ['London', 'Manchester', 'Birmingham'];

        if (roles.length === 0) continue;

        // Search for top 2 roles across all locations (parallel)
        const primaryRoles = roles.slice(0, 2);

        for (const role of primaryRoles) {
          const searchTerms = getRoleSearchTerms(role);
          const primaryTerm = searchTerms[0];

          const jobs = await searchReedParallel({
            keywords: primaryTerm,
            locations: locations.slice(0, 4), // Limit locations
            postedWithin: 30,
            directEmployerOnly: true,
            limitPerLocation: 25,
          });

          stats.jobs_checked += jobs.length;

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
                    stats.salary_increases++;

                    await createSalaryChangeSignal(
                      supabase,
                      { id: existingJob.id, title: existingJob.title },
                      { id: existingJob.company_id },
                      salaryIncrease,
                      icpProfile.id
                    );
                    stats.signals_created++;

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

                  // Note: generateJobPainSignals will handle referral bonus signal
                  // We could add a specific signal here if needed
                }

                // Update last_seen_at
                await supabase
                  .from('job_postings')
                  .update({
                    last_seen_at: now,
                    is_active: true,
                  })
                  .eq('id', existingJob.id);

                stats.jobs_updated++;
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
                      stats.reposts_detected++;
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
                  stats.errors.push(`Insert: ${insertError.message}`);
                  continue;
                }

                stats.new_jobs++;

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
                    { icpProfileId: icpProfile.id }
                  );
                  stats.signals_created += signals_generated;
                }
              }
            } catch (jobError) {
              const msg = jobError instanceof Error ? jobError.message : 'Unknown error';
              stats.errors.push(`Job: ${msg}`);
            }
          }

          // Small delay between role searches
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (profileError) {
        const msg = profileError instanceof Error ? profileError.message : 'Unknown error';
        stats.errors.push(`Profile ${icpProfile.name}: ${msg}`);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[RescanICP] Complete in ${duration}ms. Profiles: ${stats.profiles_scanned}, Updated: ${stats.jobs_updated}, New: ${stats.new_jobs}, Signals: ${stats.signals_created}`);

    return NextResponse.json({
      success: true,
      stats,
      duration_ms: duration,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[RescanICP] Error:', error);
    return NextResponse.json(
      { success: false, error: message, stats },
      { status: 500 }
    );
  }
}
