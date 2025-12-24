/**
 * Job Signal Generator
 *
 * Shared logic for generating pain signals from job postings.
 * Used by both the ICP scan route and the queue processing cron.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  PAIN_SCORES,
  determineJobSignalType,
  generateSignalTitle,
  generateSignalDetail,
} from '@/lib/signals/detection';

interface JobData {
  id: string;
  title: string;
  location: string;
  original_posted_date: string;
  repost_count: number;
  salary_increase_from_previous: number | null;
  mentions_referral_bonus: boolean;
  referral_bonus_amount: number | null;
}

interface CompanyData {
  id: string;
  name: string;
}

interface GenerateSignalsResult {
  signals_generated: number;
  pain_score: number;
}

interface GenerateSignalsOptions {
  icpProfileId?: string; // Associate signals with specific ICP profile
}

/**
 * Generate pain signals for a newly inserted job posting.
 * This function:
 * 1. Creates stale/hard-to-fill signals based on job age
 * 2. Creates repost signals if applicable
 * 3. Creates salary increase signals if applicable
 * 4. Creates referral bonus signals if detected
 * 5. Recalculates and updates the company's pain score
 */
export async function generateJobPainSignals(
  supabase: SupabaseClient,
  job: JobData,
  company: CompanyData,
  options?: GenerateSignalsOptions
): Promise<GenerateSignalsResult> {
  const icpProfileId = options?.icpProfileId;
  let signalsGenerated = 0;

  const daysOpen = Math.floor(
    (Date.now() - new Date(job.original_posted_date).getTime()) / (1000 * 60 * 60 * 24)
  );

  // 1. Stale/Hard-to-fill signal based on job age
  const daysSinceRefresh = 0; // Just seen now
  const signalConfig = determineJobSignalType(daysOpen, daysSinceRefresh);

  if (signalConfig) {
    const { signalType, painScore, urgency, isHardToFill } = signalConfig;

    await supabase.from('company_pain_signals').insert({
      company_id: company.id,
      icp_profile_id: icpProfileId,
      pain_signal_type: signalType,
      source_job_posting_id: job.id,
      signal_title: generateSignalTitle(job.title, daysOpen, isHardToFill),
      signal_detail: generateSignalDetail(
        job.title,
        company.name,
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
    signalsGenerated++;
  }

  // 2. Repost signal
  if (job.repost_count > 0) {
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

    await supabase.from('company_pain_signals').insert({
      company_id: company.id,
      icp_profile_id: icpProfileId,
      pain_signal_type: signalType,
      source_job_posting_id: job.id,
      signal_title: `${job.title} - Reposted ${job.repost_count}x`,
      signal_detail: `This role has been reposted ${job.repost_count} time(s), indicating failed hiring attempts.`,
      signal_value: job.repost_count,
      pain_score_contribution: painScore,
      urgency: 'immediate',
    });
    signalsGenerated++;
  }

  // 3. Salary increase signal
  if (job.salary_increase_from_previous && job.salary_increase_from_previous > 10) {
    const signalType = job.salary_increase_from_previous >= 20
      ? 'salary_increase_20_percent'
      : 'salary_increase_10_percent';
    const painScore = job.salary_increase_from_previous >= 20
      ? PAIN_SCORES.salary_increase_20_percent.pain_score
      : PAIN_SCORES.salary_increase_10_percent.pain_score;

    await supabase.from('company_pain_signals').insert({
      company_id: company.id,
      icp_profile_id: icpProfileId,
      pain_signal_type: signalType,
      source_job_posting_id: job.id,
      signal_title: `${job.title} - Salary increased ${Math.round(job.salary_increase_from_previous)}%`,
      signal_detail: `Salary increased by ${Math.round(job.salary_increase_from_previous)}% from previous posting.`,
      signal_value: job.salary_increase_from_previous,
      pain_score_contribution: painScore,
      urgency: 'immediate',
    });
    signalsGenerated++;
  }

  // 4. Referral bonus signal
  if (job.mentions_referral_bonus) {
    const bonusText = job.referral_bonus_amount
      ? `£${job.referral_bonus_amount.toLocaleString()}`
      : 'offered';

    await supabase.from('company_pain_signals').insert({
      company_id: company.id,
      icp_profile_id: icpProfileId,
      pain_signal_type: 'high_referral_bonus',
      source_job_posting_id: job.id,
      signal_title: `${job.title} - Referral bonus ${bonusText}`,
      signal_detail: `Company is offering a referral bonus for this role.`,
      signal_value: job.referral_bonus_amount || 0,
      pain_score_contribution: PAIN_SCORES.high_referral_bonus.pain_score,
      urgency: 'short_term',
    });
    signalsGenerated++;
  }

  // 5. Recalculate company pain score
  const painScore = await recalculateCompanyPainScore(supabase, company.id);

  return {
    signals_generated: signalsGenerated,
    pain_score: painScore,
  };
}

/**
 * Recalculate and update a company's hiring pain score.
 * Returns the new score.
 */
export async function recalculateCompanyPainScore(
  supabase: SupabaseClient,
  companyId: string
): Promise<number> {
  const { data: signals } = await supabase
    .from('company_pain_signals')
    .select('pain_score_contribution')
    .eq('company_id', companyId)
    .eq('is_active', true);

  const totalScore = signals?.reduce((sum, s) => sum + (s.pain_score_contribution || 0), 0) || 0;
  const cappedScore = Math.min(totalScore, 100);

  await supabase
    .from('companies')
    .update({
      hiring_pain_score: cappedScore,
      pain_score_updated_at: new Date().toISOString(),
      last_activity_at: new Date().toISOString(),
    })
    .eq('id', companyId);

  return cappedScore;
}

/**
 * Create a signal for a detected salary increase on an existing job.
 * Used by the rescan cron when it detects salary changes.
 */
export async function createSalaryChangeSignal(
  supabase: SupabaseClient,
  job: { id: string; title: string },
  company: { id: string },
  salaryIncrease: number,
  icpProfileId?: string
): Promise<void> {
  const signalType = salaryIncrease >= 20
    ? 'salary_increase_20_percent'
    : 'salary_increase_10_percent';
  const painScore = salaryIncrease >= 20
    ? PAIN_SCORES.salary_increase_20_percent.pain_score
    : PAIN_SCORES.salary_increase_10_percent.pain_score;

  await supabase.from('company_pain_signals').insert({
    company_id: company.id,
    icp_profile_id: icpProfileId,
    pain_signal_type: signalType,
    source_job_posting_id: job.id,
    signal_title: `${job.title} - Salary increased ${Math.round(salaryIncrease)}%`,
    signal_detail: `Salary increased by ${Math.round(salaryIncrease)}% since last observation.`,
    signal_value: salaryIncrease,
    pain_score_contribution: painScore,
    urgency: 'immediate',
  });

  await recalculateCompanyPainScore(supabase, company.id);
}

/**
 * Create a repost signal when a job is detected as reposted.
 * Used by the rescan cron when it detects job reposts.
 */
export async function createRepostSignal(
  supabase: SupabaseClient,
  job: { id: string; title: string },
  company: { id: string },
  repostCount: number,
  icpProfileId?: string
): Promise<void> {
  let signalType: string;
  let painScore: number;

  if (repostCount >= 3) {
    signalType = 'job_reposted_three_plus';
    painScore = PAIN_SCORES.job_reposted_three_plus.pain_score;
  } else if (repostCount >= 2) {
    signalType = 'job_reposted_twice';
    painScore = PAIN_SCORES.job_reposted_twice.pain_score;
  } else {
    signalType = 'job_reposted_once';
    painScore = PAIN_SCORES.job_reposted_once.pain_score;
  }

  await supabase.from('company_pain_signals').insert({
    company_id: company.id,
    icp_profile_id: icpProfileId,
    pain_signal_type: signalType,
    source_job_posting_id: job.id,
    signal_title: `${job.title} - Reposted ${repostCount}x`,
    signal_detail: `This role has been reposted ${repostCount} time(s), indicating failed hiring attempts.`,
    signal_value: repostCount,
    pain_score_contribution: painScore,
    urgency: 'immediate',
  });

  await recalculateCompanyPainScore(supabase, company.id);
}
