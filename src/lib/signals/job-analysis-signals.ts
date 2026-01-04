/**
 * Job Analysis Signal Detection
 *
 * Sprint 3: Signals derived from analyzing job posting patterns
 * - Multiple open roles (company-wide hiring volume)
 * - Department hiring concentration (focused hiring in one area)
 */

import { createAdminClient } from '@/lib/supabase/server';
import { PAIN_SCORES } from './detection';

export interface SignalCandidate {
  signal_type: string;
  pain_score: number;
  urgency: 'immediate' | 'short_term' | 'medium_term';
  signal_title: string;
  signal_detail: string;
  signal_value: number;
  confidence: number;
  metadata?: Record<string, unknown>;
}

/**
 * Detect multiple open roles signal
 *
 * Thresholds:
 * - 5-9 roles = 10 points (moderate_hiring)
 * - 10-19 roles = 20 points (significant_hiring)
 * - 20+ roles = 30 points (mass_hiring)
 */
export async function detectMultipleOpenRoles(
  companyId: string
): Promise<SignalCandidate | null> {
  const supabase = createAdminClient();

  const { count } = await supabase
    .from('job_postings')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('is_active', true);

  if (!count || count < 5) return null;

  let painScore: number;
  let tier: string;
  let urgency: 'immediate' | 'short_term';

  if (count >= 20) {
    painScore = 30;
    tier = 'mass_hiring';
    urgency = 'immediate';
  } else if (count >= 10) {
    painScore = 20;
    tier = 'significant_hiring';
    urgency = 'immediate';
  } else {
    painScore = PAIN_SCORES.multiple_open_roles?.pain_score || 10;
    tier = 'moderate_hiring';
    urgency = 'short_term';
  }

  return {
    signal_type: 'multiple_open_roles',
    pain_score: painScore,
    urgency,
    signal_title: `${count} open positions - ${tier.replace('_', ' ')}`,
    signal_detail: `Company has ${count} active job postings. High volume hiring indicates significant growth or turnover requiring recruitment support.`,
    signal_value: count,
    confidence: 90,
    metadata: {
      role_count: count,
      tier,
    },
  };
}

/**
 * Detect department hiring concentration signal
 *
 * Triggers when 50%+ of open roles are in one department
 * Minimum threshold: 3 roles in the department
 * Pain score: 25 base + (percentage / 10), capped at 40
 */
export async function detectDepartmentConcentration(
  companyId: string
): Promise<SignalCandidate | null> {
  const supabase = createAdminClient();

  // Get all active jobs with department classification
  const { data: jobs } = await supabase
    .from('job_postings')
    .select('title, department')
    .eq('company_id', companyId)
    .eq('is_active', true);

  if (!jobs || jobs.length < 3) return null;

  // Count by department
  const departmentCounts: Record<string, number> = {};

  for (const job of jobs) {
    const dept = job.department || 'Other';
    departmentCounts[dept] = (departmentCounts[dept] || 0) + 1;
  }

  // Find the dominant department
  const entries = Object.entries(departmentCounts);
  if (entries.length === 0) return null;

  const [topDept, topCount] = entries.reduce((a, b) => (a[1] > b[1] ? a : b));

  // Skip if top department is 'Other' or null
  if (topDept === 'Other' || !topDept) return null;

  const percentage = (topCount / jobs.length) * 100;

  // Must be 50%+ concentration AND at least 3 roles
  if (percentage < 50 || topCount < 3) return null;

  // Calculate pain score: 25 base + percentage/10, capped at 40
  const painScore = Math.min(25 + Math.floor(percentage / 10), 40);

  return {
    signal_type: 'department_hiring_concentration',
    pain_score: painScore,
    urgency: 'immediate',
    signal_title: `${topDept} hiring concentration (${topCount}/${jobs.length} roles)`,
    signal_detail: `${Math.round(percentage)}% of open roles are in ${topDept}. Indicates specific function pain requiring targeted recruitment support.`,
    signal_value: topCount,
    confidence: 85,
    metadata: {
      department: topDept,
      concentration_percentage: Math.round(percentage),
      role_count: topCount,
      total_roles: jobs.length,
    },
  };
}

/**
 * Get all job analysis signals for a company
 */
export async function getJobAnalysisSignals(
  companyId: string
): Promise<SignalCandidate[]> {
  const signals: SignalCandidate[] = [];

  // Check multiple open roles
  const multipleRolesSignal = await detectMultipleOpenRoles(companyId);
  if (multipleRolesSignal) {
    signals.push(multipleRolesSignal);
  }

  // Check department concentration
  const deptConcentrationSignal = await detectDepartmentConcentration(companyId);
  if (deptConcentrationSignal) {
    signals.push(deptConcentrationSignal);
  }

  return signals;
}
