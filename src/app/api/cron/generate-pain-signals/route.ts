/**
 * Pain Signal Generation Cron Job
 *
 * Daily job that analyzes job postings and contracts to generate
 * pain signals and calculate company pain scores.
 *
 * Schedule: 0 7 * * * (7am daily, after job ingestion)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import {
  PAIN_SCORES,
  determineJobSignalType,
  generateSignalTitle,
  generateSignalDetail,
} from '@/lib/signals/detection';

/**
 * Verify cron secret
 */
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  return authHeader === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(request: NextRequest) {
  // Verify authorization
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const stats = {
    stale_signals: 0,
    hard_to_fill_signals: 0,
    repost_signals: 0,
    salary_increase_signals: 0,
    contract_signals: 0,
    referral_bonus_signals: 0,
    companies_scored: 0,
    errors: [] as string[],
  };

  try {
    console.log('[generate-pain-signals] Starting pain signal generation...');

    // ==========================================
    // STEP 1: Generate Stale Job Signals
    // ==========================================
    console.log('[generate-pain-signals] Checking for stale jobs...');

    // Query jobs posted at least 30 days ago (days_open calculated dynamically)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: staleJobs, error: staleError } = await supabase
      .from('job_postings')
      .select('*, companies!inner(id, name)')
      .eq('is_active', true)
      .lte('original_posted_date', thirtyDaysAgo.toISOString().split('T')[0]);

    if (staleError) {
      stats.errors.push(`Stale jobs query error: ${staleError.message}`);
    } else if (staleJobs) {
      for (const job of staleJobs) {
        try {
          // Calculate days_open and days_since_refresh
          const daysOpen = Math.floor(
            (Date.now() - new Date(job.original_posted_date).getTime()) / (1000 * 60 * 60 * 24)
          );
          const daysSinceRefresh = Math.floor(
            (Date.now() - new Date(job.last_seen_at).getTime()) / (1000 * 60 * 60 * 24)
          );

          // Determine signal type based on both metrics
          const signalConfig = determineJobSignalType(daysOpen, daysSinceRefresh);
          if (!signalConfig) continue;

          const { signalType, painScore, urgency, isHardToFill } = signalConfig;

          // Check if signal already exists (check for both stale and hard_to_fill variants)
          const { data: existingSignals } = await supabase
            .from('company_pain_signals')
            .select('id, pain_signal_type')
            .eq('company_id', job.company_id)
            .eq('source_job_posting_id', job.id)
            .or('pain_signal_type.like.stale_job%,pain_signal_type.like.hard_to_fill%')
            .eq('is_active', true);

          // Check if we need to create or update the signal
          let shouldCreateSignal = false;
          if (!existingSignals || existingSignals.length === 0) {
            shouldCreateSignal = true;
          } else {
            // Signal exists - check if type has changed
            const existingSignal = existingSignals[0];
            if (existingSignal.pain_signal_type !== signalType) {
              // Signal type has changed (e.g., stale -> hard_to_fill), deactivate old and create new
              await supabase
                .from('company_pain_signals')
                .update({ is_active: false, resolved_at: new Date().toISOString() })
                .eq('id', existingSignal.id);
              shouldCreateSignal = true;
            }
          }

          if (shouldCreateSignal) {
            await supabase.from('company_pain_signals').insert({
              company_id: job.company_id,
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
              pain_score_contribution: painScore,
              urgency,
            });

            // Update stats
            if (isHardToFill) {
              stats.hard_to_fill_signals++;
            } else {
              stats.stale_signals++;
            }
          }
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          stats.errors.push(`Stale job ${job.id}: ${message}`);
        }
      }
    }

    // ==========================================
    // STEP 2: Generate Repost Signals
    // ==========================================
    console.log('[generate-pain-signals] Checking for reposted jobs...');

    const { data: repostedJobs, error: repostError } = await supabase
      .from('job_postings')
      .select('*, companies!inner(id, name)')
      .eq('is_active', true)
      .gt('repost_count', 0);

    if (repostError) {
      stats.errors.push(`Repost query error: ${repostError.message}`);
    } else if (repostedJobs) {
      for (const job of repostedJobs) {
        try {
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

          // Check for existing repost signal
          const { data: existingSignal } = await supabase
            .from('company_pain_signals')
            .select('id')
            .eq('company_id', job.company_id)
            .eq('source_job_posting_id', job.id)
            .like('pain_signal_type', 'job_reposted%')
            .eq('is_active', true)
            .single();

          if (!existingSignal) {
            await supabase.from('company_pain_signals').insert({
              company_id: job.company_id,
              pain_signal_type: signalType,
              source_job_posting_id: job.id,
              signal_title: `${job.title} - Reposted ${job.repost_count}x`,
              signal_detail: `This role has been reposted ${job.repost_count} time(s), indicating failed hiring attempts.`,
              signal_value: job.repost_count,
              pain_score_contribution: painScore,
              urgency: 'immediate',
            });

            stats.repost_signals++;
          }
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          stats.errors.push(`Repost job ${job.id}: ${message}`);
        }
      }
    }

    // ==========================================
    // STEP 3: Generate Salary Increase Signals
    // ==========================================
    console.log('[generate-pain-signals] Checking for salary increases...');

    const { data: salaryIncreaseJobs, error: salaryError } = await supabase
      .from('job_postings')
      .select('*, companies!inner(id, name)')
      .eq('is_active', true)
      .gt('salary_increase_from_previous', 10);

    if (salaryError) {
      stats.errors.push(`Salary query error: ${salaryError.message}`);
    } else if (salaryIncreaseJobs) {
      for (const job of salaryIncreaseJobs) {
        try {
          const signalType =
            job.salary_increase_from_previous >= 20
              ? 'salary_increase_20_percent'
              : 'salary_increase_10_percent';

          const painScore =
            job.salary_increase_from_previous >= 20
              ? PAIN_SCORES.salary_increase_20_percent.pain_score
              : PAIN_SCORES.salary_increase_10_percent.pain_score;

          // Check for existing salary signal
          const { data: existingSignal } = await supabase
            .from('company_pain_signals')
            .select('id')
            .eq('company_id', job.company_id)
            .eq('source_job_posting_id', job.id)
            .like('pain_signal_type', 'salary_increase%')
            .eq('is_active', true)
            .single();

          if (!existingSignal) {
            await supabase.from('company_pain_signals').insert({
              company_id: job.company_id,
              pain_signal_type: signalType,
              source_job_posting_id: job.id,
              signal_title: `${job.title} - Salary increased ${job.salary_increase_from_previous}%`,
              signal_detail: `Salary for this role has increased by ${job.salary_increase_from_previous}% from previous posting, indicating market correction and hiring difficulty.`,
              signal_value: job.salary_increase_from_previous,
              pain_score_contribution: painScore,
              urgency: 'immediate',
            });

            stats.salary_increase_signals++;
          }
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          stats.errors.push(`Salary job ${job.id}: ${message}`);
        }
      }
    }

    // ==========================================
    // STEP 4: Generate Referral Bonus Signals
    // ==========================================
    console.log('[generate-pain-signals] Checking for referral bonuses...');

    const { data: referralJobs, error: referralError } = await supabase
      .from('job_postings')
      .select('*, companies!inner(id, name)')
      .eq('is_active', true)
      .eq('mentions_referral_bonus', true);

    if (referralError) {
      stats.errors.push(`Referral query error: ${referralError.message}`);
    } else if (referralJobs) {
      for (const job of referralJobs) {
        try {
          // Check for existing referral signal
          const { data: existingSignal } = await supabase
            .from('company_pain_signals')
            .select('id')
            .eq('company_id', job.company_id)
            .eq('source_job_posting_id', job.id)
            .eq('pain_signal_type', 'high_referral_bonus')
            .eq('is_active', true)
            .single();

          if (!existingSignal) {
            const bonusText = job.referral_bonus_amount
              ? `£${job.referral_bonus_amount.toLocaleString()}`
              : 'offered';

            await supabase.from('company_pain_signals').insert({
              company_id: job.company_id,
              pain_signal_type: 'high_referral_bonus',
              source_job_posting_id: job.id,
              signal_title: `${job.title} - Referral bonus ${bonusText}`,
              signal_detail: `Company is offering a referral bonus for this role, indicating difficulty finding candidates through normal channels.`,
              signal_value: job.referral_bonus_amount || 0,
              pain_score_contribution: PAIN_SCORES.high_referral_bonus.pain_score,
              urgency: 'short_term',
            });

            stats.referral_bonus_signals++;
          }
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          stats.errors.push(`Referral job ${job.id}: ${message}`);
        }
      }
    }

    // ==========================================
    // STEP 5: Generate Contract-Without-Hiring Signals
    // ==========================================
    console.log('[generate-pain-signals] Checking contracts without hiring...');

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const { data: recentContracts, error: contractError } = await supabase
      .from('contract_awards')
      .select('*, companies!inner(id, name)')
      .gte('award_date', ninetyDaysAgo.toISOString().split('T')[0])
      .gte('value_gbp', 500000);

    if (contractError) {
      stats.errors.push(`Contract query error: ${contractError.message}`);
    } else if (recentContracts) {
      for (const contract of recentContracts) {
        if (!contract.company_id) continue;

        try {
          // Count jobs posted after contract award
          const { count: jobCount } = await supabase
            .from('job_postings')
            .select('*', { count: 'exact', head: true })
            .eq('company_id', contract.company_id)
            .gte('original_posted_date', contract.award_date);

          const daysSinceAward = Math.floor(
            (Date.now() - new Date(contract.award_date).getTime()) /
              (1000 * 60 * 60 * 24)
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

            // Check for existing contract signal
            const { data: existingSignal } = await supabase
              .from('company_pain_signals')
              .select('id')
              .eq('company_id', contract.company_id)
              .eq('source_contract_id', contract.id)
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
                pain_signal_type: signalType,
                source_contract_id: contract.id,
                signal_title: `${valueText} contract - No hiring after ${daysSinceAward} days`,
                signal_detail: `${contract.companies?.name} won a ${valueText} contract "${contract.title}" ${daysSinceAward} days ago but has posted no jobs. Likely capacity constraint.`,
                signal_value: daysSinceAward,
                pain_score_contribution: painScore,
                urgency: 'immediate',
              });

              stats.contract_signals++;

              // Update contract flag
              await supabase
                .from('contract_awards')
                .update({ hiring_bottleneck_flag: true })
                .eq('id', contract.id);
            }
          }
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          stats.errors.push(`Contract ${contract.id}: ${message}`);
        }
      }
    }

    // ==========================================
    // STEP 6: Recalculate Company Pain Scores
    // ==========================================
    console.log('[generate-pain-signals] Recalculating pain scores...');

    const { data: companiesWithSignals, error: companyError } = await supabase
      .from('company_pain_signals')
      .select('company_id')
      .eq('is_active', true);

    if (companyError) {
      stats.errors.push(`Company query error: ${companyError.message}`);
    } else if (companiesWithSignals) {
      const uniqueCompanyIds = [
        ...new Set(companiesWithSignals.map((s) => s.company_id)),
      ];

      for (const companyId of uniqueCompanyIds) {
        try {
          // Sum all active pain signal scores
          const { data: signals } = await supabase
            .from('company_pain_signals')
            .select('pain_score_contribution')
            .eq('company_id', companyId)
            .eq('is_active', true);

          const totalScore =
            signals?.reduce(
              (sum, s) => sum + (s.pain_score_contribution || 0),
              0
            ) || 0;

          // Cap at 100
          const cappedScore = Math.min(totalScore, 100);

          await supabase
            .from('companies')
            .update({
              hiring_pain_score: cappedScore,
              pain_score_updated_at: new Date().toISOString(),
              last_activity_at: new Date().toISOString(),
            })
            .eq('id', companyId);

          stats.companies_scored++;
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          stats.errors.push(`Company score ${companyId}: ${message}`);
        }
      }
    }

    // ==========================================
    // STEP 7: Deactivate resolved signals
    // ==========================================
    console.log('[generate-pain-signals] Deactivating resolved signals...');

    // Get inactive job posting IDs
    const { data: inactiveJobs } = await supabase
      .from('job_postings')
      .select('id')
      .eq('is_active', false);

    if (inactiveJobs && inactiveJobs.length > 0) {
      const inactiveJobIds = inactiveJobs.map((j) => j.id);

      // Deactivate signals for jobs that are no longer active
      await supabase
        .from('company_pain_signals')
        .update({ is_active: false, resolved_at: new Date().toISOString() })
        .eq('is_active', true)
        .in('source_job_posting_id', inactiveJobIds);
    }

    console.log('[generate-pain-signals] Pain signal generation complete');

    return NextResponse.json({
      success: true,
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[generate-pain-signals] Fatal error:', error);
    return NextResponse.json(
      {
        success: false,
        error: message,
        stats,
      },
      { status: 500 }
    );
  }
}
