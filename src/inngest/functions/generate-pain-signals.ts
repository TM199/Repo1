/**
 * Pain Signal Generation - Inngest Function
 *
 * Migrated from: src/app/api/cron/generate-pain-signals/route.ts
 *
 * Daily job that analyzes job postings and contracts to generate
 * pain signals and calculate company pain scores.
 *
 * Benefits of Inngest migration:
 * - Each step retries independently
 * - Better observability via dashboard
 * - No 300s timeout limit
 * - Step-based progress tracking
 *
 * Schedule: Every 2 hours at minute 45 (cron: 45 *\/2 * * *)
 */

import { inngest } from '../client';
import { createAdminClient } from '@/lib/supabase/server';
import { activityLogger } from '@/lib/activity-logger';
import {
  PAIN_SCORES,
  determineJobSignalType,
  generateSignalTitle,
  generateSignalDetail,
} from '@/lib/signals/detection';
import {
  detectMultipleOpenRoles,
  detectDepartmentConcentration,
} from '@/lib/signals/job-analysis-signals';
import { getUrgencyBoost } from '@/lib/jobs/urgency-detector';
import { ICPProfile } from '@/types';
import { notifyICPOwner } from '@/lib/email';

// Stats type
interface PainSignalStats {
  stale_signals: number;
  hard_to_fill_signals: number;
  repost_signals: number;
  salary_increase_signals: number;
  contract_signals: number;
  referral_bonus_signals: number;
  multiple_open_roles_signals: number;
  department_concentration_signals: number;
  urgency_boosts_applied: number;
  companies_scored: number;
  skipped_no_icp: boolean;
  errors: string[];
}

/**
 * Check if a job location matches any ICP profile's locations
 */
function matchesICPLocations(location: string | null, icpProfiles: ICPProfile[]): ICPProfile[] {
  if (!location) return icpProfiles;
  const locationLower = location.toLowerCase();
  return icpProfiles.filter(icp => {
    if (icp.locations.length === 0) return true;
    return icp.locations.some(l => locationLower.includes(l.toLowerCase()));
  });
}

export const generatePainSignalsFunction = inngest.createFunction(
  {
    id: 'generate-pain-signals',
    retries: 3,
    // Can be triggered by cron or event
  },
  [
    { cron: '45 */2 * * *' }, // Every 2 hours at minute 45 (matching Vercel schedule)
    { event: 'pain-signals/generate' }, // Manual trigger
  ],
  async ({ step }) => {
    const supabase = createAdminClient();
    const stats: PainSignalStats = {
      stale_signals: 0,
      hard_to_fill_signals: 0,
      repost_signals: 0,
      salary_increase_signals: 0,
      contract_signals: 0,
      referral_bonus_signals: 0,
      multiple_open_roles_signals: 0,
      department_concentration_signals: 0,
      urgency_boosts_applied: 0,
      companies_scored: 0,
      skipped_no_icp: false,
      errors: [],
    };

    // ==========================================
    // STEP 1: Get ICP Profiles with job_pain
    // ==========================================
    const jobPainICPs = await step.run('get-job-pain-icps', async () => {
      const { data: profiles } = await supabase
        .from('icp_profiles')
        .select('*')
        .eq('is_active', true);

      if (!profiles) return [];
      return profiles.filter((p: ICPProfile) => p.signal_types.includes('job_pain'));
    });

    if (jobPainICPs.length === 0) {
      return {
        success: true,
        message: 'Skipped - no ICPs with job_pain signal type',
        stats: { ...stats, skipped_no_icp: true },
      };
    }

    // ==========================================
    // STEP 2: Generate Stale Job Signals
    // ==========================================
    const staleStats = await step.run('generate-stale-signals', async () => {
      const localStats = { stale: 0, hard_to_fill: 0, urgency_boosts: 0, errors: [] as string[] };

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: staleJobs, error } = await supabase
        .from('job_postings')
        .select('*, companies!inner(id, name), urgency_level')
        .eq('is_active', true)
        .lte('original_posted_date', thirtyDaysAgo.toISOString().split('T')[0]);

      if (error) {
        localStats.errors.push(`Stale jobs query error: ${error.message}`);
        return localStats;
      }

      if (!staleJobs) return localStats;

      for (const job of staleJobs) {
        try {
          const matchingICPs = matchesICPLocations(job.location, jobPainICPs);
          if (matchingICPs.length === 0) continue;

          const daysOpen = Math.floor(
            (Date.now() - new Date(job.original_posted_date).getTime()) / (1000 * 60 * 60 * 24)
          );
          const daysSinceRefresh = Math.floor(
            (Date.now() - new Date(job.last_seen_at).getTime()) / (1000 * 60 * 60 * 24)
          );

          const signalConfig = determineJobSignalType(daysOpen, daysSinceRefresh);
          if (!signalConfig) continue;

          const { signalType, painScore, urgency, isHardToFill } = signalConfig;

          for (const icp of matchingICPs) {
            const urgencyBoost = getUrgencyBoost(job.urgency_level as 'high' | 'medium' | null);
            const finalPainScore = painScore + urgencyBoost;

            // Use UPSERT to handle duplicates atomically
            const { error: upsertError } = await supabase.from('company_pain_signals').upsert({
              company_id: job.company_id,
              icp_profile_id: icp.id,
              pain_signal_type: signalType,
              source_job_posting_id: job.id,
              signal_title: generateSignalTitle(job.title, daysOpen, isHardToFill),
              signal_detail: generateSignalDetail(
                job.title,
                job.companies?.name || '',
                job.location,
                daysOpen,
                daysSinceRefresh,
                isHardToFill
              ),
              signal_value: daysOpen,
              days_since_refresh: daysSinceRefresh,
              pain_score_contribution: finalPainScore,
              urgency,
              metadata: urgencyBoost > 0 ? { urgency_boost: urgencyBoost, urgency_level: job.urgency_level } : null,
              detected_at: new Date().toISOString(),
            }, {
              onConflict: 'company_id,source_job_posting_id,pain_signal_type,icp_profile_id',
            });

            if (!upsertError) {
              if (isHardToFill) {
                localStats.hard_to_fill++;
              } else {
                localStats.stale++;
              }
              if (urgencyBoost > 0) {
                localStats.urgency_boosts++;
              }
            }
          }
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          localStats.errors.push(`Stale job ${job.id}: ${message}`);
        }
      }

      return localStats;
    });

    stats.stale_signals = staleStats.stale;
    stats.hard_to_fill_signals = staleStats.hard_to_fill;
    stats.urgency_boosts_applied += staleStats.urgency_boosts;
    stats.errors.push(...staleStats.errors);

    // ==========================================
    // STEP 3: Generate Repost Signals
    // ==========================================
    const repostStats = await step.run('generate-repost-signals', async () => {
      const localStats = { count: 0, errors: [] as string[] };

      const { data: repostedJobs, error } = await supabase
        .from('job_postings')
        .select('*, companies!inner(id, name)')
        .eq('is_active', true)
        .gt('repost_count', 0);

      if (error) {
        localStats.errors.push(`Repost query error: ${error.message}`);
        return localStats;
      }

      if (!repostedJobs) return localStats;

      for (const job of repostedJobs) {
        try {
          const matchingICPs = matchesICPLocations(job.location, jobPainICPs);
          if (matchingICPs.length === 0) continue;

          let signalType: string;
          let painScore: number;

          if (job.repost_count >= 3) {
            signalType = 'job_reposted_three_plus';
            painScore = PAIN_SCORES.job_reposted_three_plus.pain_score;
          } else if (job.repost_count >= 2) {
            signalType = 'job_reposted_twice';
            painScore = PAIN_SCORES.job_reposted_twice.pain_score;
          } else {
            signalType = 'job_reposted_once';
            painScore = PAIN_SCORES.job_reposted_once.pain_score;
          }

          for (const icp of matchingICPs) {
            // Use UPSERT to handle duplicates atomically
            const { error: upsertError } = await supabase.from('company_pain_signals').upsert({
              company_id: job.company_id,
              icp_profile_id: icp.id,
              pain_signal_type: signalType,
              source_job_posting_id: job.id,
              signal_title: `${job.title} - Reposted ${job.repost_count}x`,
              signal_detail: `This role has been reposted ${job.repost_count} time(s), indicating failed hiring attempts.`,
              signal_value: job.repost_count,
              pain_score_contribution: painScore,
              urgency: 'immediate',
              detected_at: new Date().toISOString(),
            }, {
              onConflict: 'company_id,source_job_posting_id,pain_signal_type,icp_profile_id',
            });

            if (!upsertError) {
              localStats.count++;
            }
          }
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          localStats.errors.push(`Repost job ${job.id}: ${message}`);
        }
      }

      return localStats;
    });

    stats.repost_signals = repostStats.count;
    stats.errors.push(...repostStats.errors);

    // ==========================================
    // STEP 4: Generate Salary Increase Signals
    // ==========================================
    const salaryStats = await step.run('generate-salary-signals', async () => {
      const localStats = { count: 0, errors: [] as string[] };

      const { data: salaryIncreaseJobs, error } = await supabase
        .from('job_postings')
        .select('*, companies!inner(id, name)')
        .eq('is_active', true)
        .gt('salary_increase_from_previous', 10);

      if (error) {
        localStats.errors.push(`Salary query error: ${error.message}`);
        return localStats;
      }

      if (!salaryIncreaseJobs) return localStats;

      for (const job of salaryIncreaseJobs) {
        try {
          const matchingICPs = matchesICPLocations(job.location, jobPainICPs);
          if (matchingICPs.length === 0) continue;

          const signalType =
            job.salary_increase_from_previous >= 20
              ? 'salary_increase_20_percent'
              : 'salary_increase_10_percent';

          const painScore =
            job.salary_increase_from_previous >= 20
              ? PAIN_SCORES.salary_increase_20_percent.pain_score
              : PAIN_SCORES.salary_increase_10_percent.pain_score;

          for (const icp of matchingICPs) {
            // Use UPSERT to handle duplicates atomically
            const { error: upsertError } = await supabase.from('company_pain_signals').upsert({
              company_id: job.company_id,
              icp_profile_id: icp.id,
              pain_signal_type: signalType,
              source_job_posting_id: job.id,
              signal_title: `${job.title} - Salary increased ${job.salary_increase_from_previous}%`,
              signal_detail: `Salary for this role has increased by ${job.salary_increase_from_previous}% from previous posting, indicating market correction and hiring difficulty.`,
              signal_value: job.salary_increase_from_previous,
              pain_score_contribution: painScore,
              urgency: 'immediate',
              detected_at: new Date().toISOString(),
            }, {
              onConflict: 'company_id,source_job_posting_id,pain_signal_type,icp_profile_id',
            });

            if (!upsertError) {
              localStats.count++;
            }
          }
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          localStats.errors.push(`Salary job ${job.id}: ${message}`);
        }
      }

      return localStats;
    });

    stats.salary_increase_signals = salaryStats.count;
    stats.errors.push(...salaryStats.errors);

    // ==========================================
    // STEP 5: Generate Referral Bonus Signals
    // ==========================================
    const referralStats = await step.run('generate-referral-signals', async () => {
      const localStats = { count: 0, errors: [] as string[] };

      const { data: referralJobs, error } = await supabase
        .from('job_postings')
        .select('*, companies!inner(id, name)')
        .eq('is_active', true)
        .eq('mentions_referral_bonus', true);

      if (error) {
        localStats.errors.push(`Referral query error: ${error.message}`);
        return localStats;
      }

      if (!referralJobs) return localStats;

      for (const job of referralJobs) {
        try {
          const matchingICPs = matchesICPLocations(job.location, jobPainICPs);
          if (matchingICPs.length === 0) continue;

          for (const icp of matchingICPs) {
            const bonusText = job.referral_bonus_amount
              ? `£${job.referral_bonus_amount.toLocaleString()}`
              : 'offered';

            // Use UPSERT to handle duplicates atomically
            const { error: upsertError } = await supabase.from('company_pain_signals').upsert({
              company_id: job.company_id,
              icp_profile_id: icp.id,
              pain_signal_type: 'high_referral_bonus',
              source_job_posting_id: job.id,
              signal_title: `${job.title} - Referral bonus ${bonusText}`,
              signal_detail: `Company is offering a referral bonus for this role, indicating difficulty finding candidates through normal channels.`,
              signal_value: job.referral_bonus_amount || 0,
              pain_score_contribution: PAIN_SCORES.high_referral_bonus.pain_score,
              urgency: 'short_term',
              detected_at: new Date().toISOString(),
            }, {
              onConflict: 'company_id,source_job_posting_id,pain_signal_type,icp_profile_id',
            });

            if (!upsertError) {
              localStats.count++;
            }
          }
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          localStats.errors.push(`Referral job ${job.id}: ${message}`);
        }
      }

      return localStats;
    });

    stats.referral_bonus_signals = referralStats.count;
    stats.errors.push(...referralStats.errors);

    // ==========================================
    // STEP 6: Generate Contract-Without-Hiring Signals
    // ==========================================
    const contractStats = await step.run('generate-contract-signals', async () => {
      const localStats = { count: 0, errors: [] as string[] };

      // Get ICPs with contracts_awarded signal type
      const { data: allProfiles } = await supabase
        .from('icp_profiles')
        .select('*')
        .eq('is_active', true);

      const contractICPs = allProfiles?.filter((p: ICPProfile) =>
        p.signal_types.includes('contracts_awarded')
      ) || [];

      if (contractICPs.length === 0) return localStats;

      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const { data: recentContracts, error } = await supabase
        .from('contract_awards')
        .select('*, companies!inner(id, name)')
        .gte('award_date', ninetyDaysAgo.toISOString().split('T')[0])
        .gte('value_gbp', 500000);

      if (error) {
        localStats.errors.push(`Contract query error: ${error.message}`);
        return localStats;
      }

      if (!recentContracts) return localStats;

      for (const contract of recentContracts) {
        if (!contract.company_id) continue;

        try {
          const { data: company } = await supabase
            .from('companies')
            .select('location')
            .eq('id', contract.company_id)
            .single();

          const matchingICPs = matchesICPLocations(company?.location || null, contractICPs);
          if (matchingICPs.length === 0) continue;

          const { count: jobCount } = await supabase
            .from('job_postings')
            .select('*', { count: 'exact', head: true })
            .eq('company_id', contract.company_id)
            .gte('original_posted_date', contract.award_date);

          const daysSinceAward = Math.floor(
            (Date.now() - new Date(contract.award_date).getTime()) / (1000 * 60 * 60 * 24)
          );

          // Update contract record
          if (daysSinceAward >= 30) {
            await supabase
              .from('contract_awards')
              .update({ jobs_posted_within_30_days: jobCount || 0 })
              .eq('id', contract.id);
          }
          if (daysSinceAward >= 60) {
            await supabase
              .from('contract_awards')
              .update({ jobs_posted_within_60_days: jobCount || 0 })
              .eq('id', contract.id);
          }

          // Generate signal if no hiring
          if ((jobCount || 0) === 0 && daysSinceAward >= 30) {
            const signalType =
              daysSinceAward >= 60
                ? 'contract_no_hiring_60_days'
                : 'contract_no_hiring_30_days';

            const painScore =
              daysSinceAward >= 60
                ? PAIN_SCORES.contract_no_hiring_60_days.pain_score
                : PAIN_SCORES.contract_no_hiring_30_days.pain_score;

            for (const icp of matchingICPs) {
              const { data: existingSignal } = await supabase
                .from('company_pain_signals')
                .select('id')
                .eq('company_id', contract.company_id)
                .eq('source_contract_id', contract.id)
                .eq('icp_profile_id', icp.id)
                .like('pain_signal_type', 'contract_no_hiring%')
                .eq('is_active', true)
                .single();

              if (!existingSignal) {
                const valueText =
                  contract.value_gbp >= 1000000
                    ? `£${(Number(contract.value_gbp) / 1000000).toFixed(1)}M`
                    : `£${(Number(contract.value_gbp) / 1000).toFixed(0)}k`;

                await supabase.from('company_pain_signals').insert({
                  company_id: contract.company_id,
                  icp_profile_id: icp.id,
                  pain_signal_type: signalType,
                  source_contract_id: contract.id,
                  signal_title: `${valueText} contract - No hiring after ${daysSinceAward} days`,
                  signal_detail: `${contract.companies?.name} won a ${valueText} contract "${contract.title}" ${daysSinceAward} days ago but has posted no jobs. Likely capacity constraint.`,
                  signal_value: daysSinceAward,
                  pain_score_contribution: painScore,
                  urgency: 'immediate',
                });

                localStats.count++;

                await supabase
                  .from('contract_awards')
                  .update({ hiring_bottleneck_flag: true })
                  .eq('id', contract.id);
              }
            }
          }
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          localStats.errors.push(`Contract ${contract.id}: ${message}`);
        }
      }

      return localStats;
    });

    stats.contract_signals = contractStats.count;
    stats.errors.push(...contractStats.errors);

    // ==========================================
    // STEP 7: Generate Multiple Open Roles & Dept Signals
    // ==========================================
    const analysisStats = await step.run('generate-analysis-signals', async () => {
      const localStats = { multiple_roles: 0, dept_concentration: 0, errors: [] as string[] };

      const { data: companiesWithJobs } = await supabase
        .from('job_postings')
        .select('company_id')
        .eq('is_active', true);

      if (!companiesWithJobs) return localStats;

      const uniqueCompanyIds = [...new Set(companiesWithJobs.map(j => j.company_id))];

      for (const companyId of uniqueCompanyIds) {
        try {
          // Check multiple open roles
          const multipleRolesSignal = await detectMultipleOpenRoles(companyId);
          if (multipleRolesSignal) {
            const { data: company } = await supabase
              .from('companies')
              .select('region')
              .eq('id', companyId)
              .single();

            const matchingICPs = matchesICPLocations(company?.region || null, jobPainICPs);

            for (const icp of matchingICPs) {
              // Use UPSERT to handle duplicates atomically
              const { error: upsertError } = await supabase.from('company_pain_signals').upsert({
                company_id: companyId,
                icp_profile_id: icp.id,
                source_job_posting_id: null,
                pain_signal_type: multipleRolesSignal.signal_type,
                signal_title: multipleRolesSignal.signal_title,
                signal_detail: multipleRolesSignal.signal_detail,
                signal_value: multipleRolesSignal.signal_value,
                pain_score_contribution: multipleRolesSignal.pain_score,
                urgency: multipleRolesSignal.urgency,
                confidence: multipleRolesSignal.confidence,
                metadata: multipleRolesSignal.metadata,
                detected_at: new Date().toISOString(),
              }, {
                onConflict: 'company_id,source_job_posting_id,pain_signal_type,icp_profile_id',
                ignoreDuplicates: true,
              });

              if (!upsertError) {
                localStats.multiple_roles++;
              }
            }
          }

          // Check department concentration
          const deptSignal = await detectDepartmentConcentration(companyId);
          if (deptSignal) {
            const { data: company } = await supabase
              .from('companies')
              .select('region')
              .eq('id', companyId)
              .single();

            const matchingICPs = matchesICPLocations(company?.region || null, jobPainICPs);

            for (const icp of matchingICPs) {
              // Use UPSERT to handle duplicates atomically
              const { error: upsertError } = await supabase.from('company_pain_signals').upsert({
                company_id: companyId,
                icp_profile_id: icp.id,
                source_job_posting_id: null,
                pain_signal_type: deptSignal.signal_type,
                signal_title: deptSignal.signal_title,
                signal_detail: deptSignal.signal_detail,
                signal_value: deptSignal.signal_value,
                pain_score_contribution: deptSignal.pain_score,
                urgency: deptSignal.urgency,
                confidence: deptSignal.confidence,
                metadata: deptSignal.metadata,
                detected_at: new Date().toISOString(),
              }, {
                onConflict: 'company_id,source_job_posting_id,pain_signal_type,icp_profile_id',
                ignoreDuplicates: true,
              });

              if (!upsertError) {
                localStats.dept_concentration++;
              }
            }
          }
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          localStats.errors.push(`Company analysis ${companyId}: ${message}`);
        }
      }

      return localStats;
    });

    stats.multiple_open_roles_signals = analysisStats.multiple_roles;
    stats.department_concentration_signals = analysisStats.dept_concentration;
    stats.errors.push(...analysisStats.errors);

    // ==========================================
    // STEP 8: Recalculate Company Pain Scores
    // ==========================================
    const scoreStats = await step.run('recalculate-pain-scores', async () => {
      const localStats = { count: 0, errors: [] as string[] };

      const { data: companiesWithSignals, error } = await supabase
        .from('company_pain_signals')
        .select('company_id')
        .eq('is_active', true);

      if (error) {
        localStats.errors.push(`Company query error: ${error.message}`);
        return localStats;
      }

      if (!companiesWithSignals) return localStats;

      const uniqueCompanyIds = [...new Set(companiesWithSignals.map(s => s.company_id))];

      for (const companyId of uniqueCompanyIds) {
        try {
          const { data: signals } = await supabase
            .from('company_pain_signals')
            .select('pain_score_contribution')
            .eq('company_id', companyId)
            .eq('is_active', true);

          const totalScore = signals?.reduce(
            (sum, s) => sum + (s.pain_score_contribution || 0),
            0
          ) || 0;

          const cappedScore = Math.min(totalScore, 100);

          await supabase
            .from('companies')
            .update({
              hiring_pain_score: cappedScore,
              pain_score_updated_at: new Date().toISOString(),
              last_activity_at: new Date().toISOString(),
            })
            .eq('id', companyId);

          localStats.count++;
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          localStats.errors.push(`Company score ${companyId}: ${message}`);
        }
      }

      return localStats;
    });

    stats.companies_scored = scoreStats.count;
    stats.errors.push(...scoreStats.errors);

    // ==========================================
    // STEP 9: Deactivate Resolved Signals
    // ==========================================
    await step.run('deactivate-resolved-signals', async () => {
      const { data: inactiveJobs } = await supabase
        .from('job_postings')
        .select('id')
        .eq('is_active', false);

      if (inactiveJobs && inactiveJobs.length > 0) {
        const inactiveJobIds = inactiveJobs.map(j => j.id);

        await supabase
          .from('company_pain_signals')
          .update({ is_active: false, resolved_at: new Date().toISOString() })
          .eq('is_active', true)
          .in('source_job_posting_id', inactiveJobIds);
      }
    });

    // ==========================================
    // STEP 10: Send Email Notifications
    // ==========================================
    const totalNewSignals =
      stats.hard_to_fill_signals +
      stats.stale_signals +
      stats.repost_signals +
      stats.salary_increase_signals +
      stats.referral_bonus_signals +
      stats.contract_signals +
      stats.multiple_open_roles_signals +
      stats.department_concentration_signals;

    if (totalNewSignals > 0) {
      await step.run('send-email-notifications', async () => {
        for (const icp of jobPainICPs) {
          try {
            await notifyICPOwner(icp.id, totalNewSignals);
          } catch (emailErr) {
            console.error(`Email failed for ICP ${icp.id}:`, emailErr);
          }
        }
      });

      // Log activity for dashboard feed
      await activityLogger.signalsDetected(totalNewSignals);
    }

    return {
      success: true,
      stats,
      timestamp: new Date().toISOString(),
    };
  }
);
