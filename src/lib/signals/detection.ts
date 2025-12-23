/**
 * Signal Detection Configuration
 *
 * Central configuration for pain signal detection with hard_to_fill vs stale distinction.
 *
 * Key Insight: Use `last_seen_at` to distinguish between:
 * - HARD TO FILL: Jobs open 30+ days AND still being actively refreshed (high value)
 * - STALE: Jobs open 30+ days but NOT seen recently (lower value, possibly abandoned)
 */

// Threshold for considering a job as "actively recruiting"
// Jobs seen within this many days are considered actively being promoted
export const REFRESH_THRESHOLD_DAYS = 14;

// Pain score configuration for all signal types
export const PAIN_SCORES: Record<
  string,
  {
    pain_score: number;
    urgency: 'immediate' | 'short_term' | 'medium_term';
    confidence_base: number;
  }
> = {
  // HARD TO FILL - Higher scores (actively recruiting = confirmed pain)
  hard_to_fill_90: { pain_score: 35, urgency: 'immediate', confidence_base: 95 },
  hard_to_fill_60: { pain_score: 20, urgency: 'immediate', confidence_base: 85 },
  hard_to_fill_30: { pain_score: 8, urgency: 'short_term', confidence_base: 70 },

  // STALE - Lower scores (possibly abandoned)
  stale_job_90: { pain_score: 25, urgency: 'immediate', confidence_base: 70 },
  stale_job_60: { pain_score: 15, urgency: 'short_term', confidence_base: 60 },
  stale_job_30: { pain_score: 5, urgency: 'medium_term', confidence_base: 50 },

  // REPOST signals - always high value (actively trying again)
  job_reposted_once: { pain_score: 10, urgency: 'immediate', confidence_base: 85 },
  job_reposted_twice: { pain_score: 20, urgency: 'immediate', confidence_base: 90 },
  job_reposted_three_plus: { pain_score: 30, urgency: 'immediate', confidence_base: 95 },

  // SALARY signals - active changes = confirmed pain
  salary_increase_10_percent: { pain_score: 15, urgency: 'immediate', confidence_base: 80 },
  salary_increase_20_percent: { pain_score: 25, urgency: 'immediate', confidence_base: 85 },

  // REFERRAL signals
  referral_bonus: { pain_score: 8, urgency: 'short_term', confidence_base: 65 },
  high_referral_bonus: { pain_score: 15, urgency: 'short_term', confidence_base: 75 },

  // CONTRACT signals
  contract_no_hiring_30_days: { pain_score: 20, urgency: 'immediate', confidence_base: 70 },
  contract_no_hiring_60_days: { pain_score: 35, urgency: 'immediate', confidence_base: 85 },

  // Multiple roles
  multiple_open_roles: { pain_score: 10, urgency: 'short_term', confidence_base: 70 },
};

/**
 * Determine the signal type based on days open and refresh status
 */
export function determineJobSignalType(
  daysOpen: number,
  daysSinceRefresh: number
): {
  signalType: string;
  painScore: number;
  urgency: 'immediate' | 'short_term' | 'medium_term';
  confidence: number;
  isHardToFill: boolean;
} | null {
  // Must be at least 30 days old
  if (daysOpen < 30) {
    return null;
  }

  const isRecentlyRefreshed = daysSinceRefresh <= REFRESH_THRESHOLD_DAYS;

  let signalType: string;

  if (daysOpen >= 90) {
    signalType = isRecentlyRefreshed ? 'hard_to_fill_90' : 'stale_job_90';
  } else if (daysOpen >= 60) {
    signalType = isRecentlyRefreshed ? 'hard_to_fill_60' : 'stale_job_60';
  } else {
    signalType = isRecentlyRefreshed ? 'hard_to_fill_30' : 'stale_job_30';
  }

  const config = PAIN_SCORES[signalType];

  return {
    signalType,
    painScore: config.pain_score,
    urgency: config.urgency,
    confidence: config.confidence_base,
    isHardToFill: isRecentlyRefreshed,
  };
}

/**
 * Generate the signal title based on type
 */
export function generateSignalTitle(
  jobTitle: string,
  daysOpen: number,
  isHardToFill: boolean
): string {
  if (isHardToFill) {
    if (daysOpen >= 90) {
      return `${jobTitle} - Hard to fill (${daysOpen} days)`;
    } else if (daysOpen >= 60) {
      return `${jobTitle} - Hard to fill (${daysOpen} days)`;
    } else {
      return `${jobTitle} - Slow to fill (${daysOpen} days)`;
    }
  } else {
    if (daysOpen >= 90) {
      return `${jobTitle} - Possibly abandoned (${daysOpen} days)`;
    } else if (daysOpen >= 60) {
      return `${jobTitle} - Possibly stale (${daysOpen} days)`;
    } else {
      return `${jobTitle} - May be stale (${daysOpen} days)`;
    }
  }
}

/**
 * Generate the signal detail with refresh context
 */
export function generateSignalDetail(
  jobTitle: string,
  companyName: string,
  location: string,
  daysOpen: number,
  daysSinceRefresh: number,
  isHardToFill: boolean
): string {
  const baseDetail = `"${jobTitle}" at ${companyName} has been open for ${daysOpen} days.`;
  const locationPart = location ? ` Location: ${location}.` : '';

  if (isHardToFill) {
    return `${baseDetail}${locationPart} Still actively recruiting - refreshed ${daysSinceRefresh} days ago.`;
  } else {
    return `${baseDetail}${locationPart} Not refreshed in ${daysSinceRefresh} days - may be abandoned.`;
  }
}

/**
 * Get pain score for a repost signal
 */
export function getRepostSignalConfig(repostCount: number): {
  signalType: string;
  painScore: number;
  urgency: 'immediate' | 'short_term' | 'medium_term';
} {
  if (repostCount >= 3) {
    return {
      signalType: 'job_reposted_three_plus',
      painScore: PAIN_SCORES.job_reposted_three_plus.pain_score,
      urgency: PAIN_SCORES.job_reposted_three_plus.urgency,
    };
  } else if (repostCount >= 2) {
    return {
      signalType: 'job_reposted_twice',
      painScore: PAIN_SCORES.job_reposted_twice.pain_score,
      urgency: PAIN_SCORES.job_reposted_twice.urgency,
    };
  } else {
    return {
      signalType: 'job_reposted_once',
      painScore: PAIN_SCORES.job_reposted_once.pain_score,
      urgency: PAIN_SCORES.job_reposted_once.urgency,
    };
  }
}

/**
 * Get pain score for a salary increase signal
 */
export function getSalaryIncreaseSignalConfig(percentageIncrease: number): {
  signalType: string;
  painScore: number;
  urgency: 'immediate' | 'short_term' | 'medium_term';
} | null {
  if (percentageIncrease >= 20) {
    return {
      signalType: 'salary_increase_20_percent',
      painScore: PAIN_SCORES.salary_increase_20_percent.pain_score,
      urgency: PAIN_SCORES.salary_increase_20_percent.urgency,
    };
  } else if (percentageIncrease >= 10) {
    return {
      signalType: 'salary_increase_10_percent',
      painScore: PAIN_SCORES.salary_increase_10_percent.pain_score,
      urgency: PAIN_SCORES.salary_increase_10_percent.urgency,
    };
  }
  return null;
}
