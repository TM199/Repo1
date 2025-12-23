/**
 * Signal Explanations
 *
 * Human-readable explanations for why each pain signal type
 * indicates a company is struggling to hire.
 */

export interface SignalExplanation {
  title: string;
  whyItMatters: string;
  actionAdvice: string;
  urgencyLevel: 'high' | 'medium' | 'low';
}

export const SIGNAL_EXPLANATIONS: Record<string, SignalExplanation> = {
  // Stale job signals - potentially abandoned listings
  stale_job_30: {
    title: 'Possibly Stale - 30+ Days',
    whyItMatters:
      'This role has been open for over a month but hasn\'t been refreshed recently. The company may have paused hiring or forgotten to remove the listing.',
    actionAdvice:
      'Approach with caution - verify the role is still open before investing too much time.',
    urgencyLevel: 'low',
  },
  stale_job_60: {
    title: 'Possibly Stale - 60+ Days',
    whyItMatters:
      'Two months open without recent activity. This listing may be abandoned, or the company has deprioritized this hire.',
    actionAdvice:
      'Lower priority - the company may not be actively hiring. Consider reaching out to verify status first.',
    urgencyLevel: 'medium',
  },
  stale_job_90: {
    title: 'Possibly Abandoned - 90+ Days',
    whyItMatters:
      'Three months without refresh activity. This listing is likely abandoned or the company has given up on this role.',
    actionAdvice:
      'Low priority - focus on hard_to_fill signals first. This company may have stopped actively recruiting.',
    urgencyLevel: 'medium',
  },

  // Hard to fill signals - HIGH VALUE (actively recruiting)
  hard_to_fill_30: {
    title: 'Hard to Fill - 30+ Days',
    whyItMatters:
      'This role has been open for over a month AND the company is still actively promoting it. They\'re confirmed to be struggling - this is a hot lead.',
    actionAdvice:
      'Reach out now - they\'re actively trying to fill this role. Mention you noticed they\'re still recruiting.',
    urgencyLevel: 'medium',
  },
  hard_to_fill_60: {
    title: 'Hard to Fill - 60+ Days',
    whyItMatters:
      'Two months of active recruiting with no hire. This company is confirmed to be struggling - they\'re still paying to promote this role. High-value pain signal.',
    actionAdvice:
      'High priority - they\'re desperate and still trying. Position yourself as the solution to their 2-month struggle.',
    urgencyLevel: 'high',
  },
  hard_to_fill_90: {
    title: 'Hard to Fill - 90+ Days',
    whyItMatters:
      'Three months of active, ongoing recruitment. This is your BEST signal - confirmed, acute pain. The company is still spending money to fill this role after 90+ days.',
    actionAdvice:
      'Call immediately - this is a confirmed emergency. They\'ve been trying for 3+ months and are still actively recruiting.',
    urgencyLevel: 'high',
  },

  // Repost signals
  job_reposted_once: {
    title: 'Job Reposted',
    whyItMatters:
      'The job was taken down and reposted. This usually means their first hiring attempt failed - candidates dropped out, didn\'t pass interviews, or the hire didn\'t work out.',
    actionAdvice:
      'Mention you noticed they\'re still looking - offer to help them find the right fit this time.',
    urgencyLevel: 'medium',
  },
  job_reposted_twice: {
    title: 'Job Reposted Twice',
    whyItMatters:
      'Two failed attempts to fill this role. The company is frustrated and likely questioning their approach. They may have made a bad hire that didn\'t work out.',
    actionAdvice:
      'Position yourself as an expert in this role type. They need someone who can find candidates that stick.',
    urgencyLevel: 'high',
  },
  job_reposted_three_plus: {
    title: 'Job Reposted 3+ Times',
    whyItMatters:
      'Multiple failed attempts signal a serious problem. Either they can\'t attract talent, their process is broken, or the role itself has issues. They\'re desperate.',
    actionAdvice:
      'Offer consultative help. They may need advice on salary, job description, or interview process - not just candidates.',
    urgencyLevel: 'high',
  },

  // Salary increase signals
  salary_increase_10_percent: {
    title: 'Salary Increased 10%+',
    whyItMatters:
      'They\'ve raised the salary to attract candidates. This means their original offer wasn\'t competitive and they\'re now paying a premium to fill the role.',
    actionAdvice:
      'Use this as leverage - they\'ve acknowledged the market rate is higher. Good candidates have options.',
    urgencyLevel: 'medium',
  },
  salary_increase_20_percent: {
    title: 'Salary Increased 20%+',
    whyItMatters:
      'A 20%+ salary increase is significant desperation. They\'ve been outbid by competitors and are now paying well above their original budget to attract talent.',
    actionAdvice:
      'This is a hot role. They\'re willing to pay premium - perfect for your best candidates.',
    urgencyLevel: 'high',
  },

  // Contract signals
  contract_no_hiring_30_days: {
    title: 'Contract Win, No Hiring (30 Days)',
    whyItMatters:
      'They won a significant contract but haven\'t posted any jobs. Either they\'re scaling internally (unlikely to meet demand) or they haven\'t started hiring yet.',
    actionAdvice:
      'Proactive outreach - ask if they need help scaling up for the new contract.',
    urgencyLevel: 'medium',
  },
  contract_no_hiring_60_days: {
    title: 'Contract Win, No Hiring (60 Days)',
    whyItMatters:
      'Two months after a major contract win with no visible hiring. They\'re likely struggling to resource the project, which risks delivery and client relationships.',
    actionAdvice:
      'Urgent outreach - they may be in crisis mode. Offer immediate support.',
    urgencyLevel: 'high',
  },

  // Referral bonus
  high_referral_bonus: {
    title: 'Referral Bonus Offered',
    whyItMatters:
      'Offering a referral bonus means normal channels aren\'t working. They\'re incentivizing employees to tap their networks - a sign of recruitment difficulty.',
    actionAdvice:
      'They\'re spending money on referrals - they might spend it on a recruiter instead.',
    urgencyLevel: 'medium',
  },

  // Multiple roles
  multiple_open_roles: {
    title: 'Multiple Open Roles',
    whyItMatters:
      'Having many open positions suggests either rapid growth (good) or high turnover (concerning). Either way, their internal team is stretched thin.',
    actionAdvice:
      'Offer bulk hiring solutions. They may appreciate a single partner for multiple roles.',
    urgencyLevel: 'medium',
  },
};

/**
 * Get explanation for a signal type
 */
export function getSignalExplanation(signalType: string): SignalExplanation | null {
  return SIGNAL_EXPLANATIONS[signalType] || null;
}

/**
 * Get a short "why it matters" snippet for display
 */
export function getQuickExplanation(signalType: string): string {
  const explanation = SIGNAL_EXPLANATIONS[signalType];
  if (!explanation) return '';

  // Return first sentence of whyItMatters
  const firstSentence = explanation.whyItMatters.split('.')[0];
  return firstSentence + '.';
}

/**
 * Map signal type to friendly display name
 */
export function getSignalDisplayName(signalType: string): string {
  const explanation = SIGNAL_EXPLANATIONS[signalType];
  if (explanation) return explanation.title;

  // Fallback: convert snake_case to Title Case
  return signalType
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
