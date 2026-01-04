/**
 * Centralized color constants for Signal Mentis
 * 
 * These colors are used for signal types, email statuses, and other UI elements.
 * Both light and dark mode variants are provided where applicable.
 */

// Signal type colors - used for badges and indicators
export const SIGNAL_TYPE_COLORS = {
  new_job: { bg: '#EEF2FF', text: '#4338CA', darkBg: '#312E81', darkText: '#A5B4FC' },
  planning_submitted: { bg: '#FEF3C7', text: '#B45309', darkBg: '#78350F', darkText: '#FCD34D' },
  planning_approved: { bg: '#D1FAE5', text: '#047857', darkBg: '#064E3B', darkText: '#6EE7B7' },
  contract_awarded: { bg: '#F3E8FF', text: '#7C3AED', darkBg: '#4C1D95', darkText: '#C4B5FD' },
  funding_announced: { bg: '#FCE7F3', text: '#BE185D', darkBg: '#831843', darkText: '#F9A8D4' },
  leadership_change: { bg: '#FFEDD5', text: '#C2410C', darkBg: '#7C2D12', darkText: '#FDBA74' },
  cqc_rating_change: { bg: '#FEE2E2', text: '#B91C1C', darkBg: '#7F1D1D', darkText: '#FCA5A5' },
  company_expansion: { bg: '#CCFBF1', text: '#0F766E', darkBg: '#134E4A', darkText: '#5EEAD4' },
  // Job pain signals
  hard_to_fill_30: { bg: '#FEF3C7', text: '#B45309', darkBg: '#78350F', darkText: '#FCD34D' },
  hard_to_fill_60: { bg: '#FFEDD5', text: '#C2410C', darkBg: '#7C2D12', darkText: '#FDBA74' },
  hard_to_fill_90: { bg: '#FEE2E2', text: '#B91C1C', darkBg: '#7F1D1D', darkText: '#FCA5A5' },
  stale_job_30: { bg: '#F0F3F7', text: '#6B7C93', darkBg: '#334155', darkText: '#94A3B8' },
  stale_job_60: { bg: '#F0F3F7', text: '#6B7C93', darkBg: '#334155', darkText: '#94A3B8' },
  stale_job_90: { bg: '#F0F3F7', text: '#6B7C93', darkBg: '#334155', darkText: '#94A3B8' },
  job_reposted_once: { bg: '#FEF3C7', text: '#B45309', darkBg: '#78350F', darkText: '#FCD34D' },
  job_reposted_twice: { bg: '#FFEDD5', text: '#C2410C', darkBg: '#7C2D12', darkText: '#FDBA74' },
  job_reposted_three_plus: { bg: '#FEE2E2', text: '#B91C1C', darkBg: '#7F1D1D', darkText: '#FCA5A5' },
  salary_increase_10_percent: { bg: '#D1FAE5', text: '#047857', darkBg: '#064E3B', darkText: '#6EE7B7' },
  salary_increase_20_percent: { bg: '#CCFBF1', text: '#0F766E', darkBg: '#134E4A', darkText: '#5EEAD4' },
  high_referral_bonus: { bg: '#F3E8FF', text: '#7C3AED', darkBg: '#4C1D95', darkText: '#C4B5FD' },
  multiple_open_roles: { bg: '#EEF2FF', text: '#4338CA', darkBg: '#312E81', darkText: '#A5B4FC' },
} as const;

// Email status colors
export const EMAIL_STATUS_COLORS = {
  verified: { bg: '#D1FAE5', text: '#047857', darkBg: '#064E3B', darkText: '#6EE7B7' },
  valid: { bg: '#D1FAE5', text: '#047857', darkBg: '#064E3B', darkText: '#6EE7B7' },
  risky: { bg: '#FEE2E2', text: '#B91C1C', darkBg: '#7F1D1D', darkText: '#FCA5A5' },
  invalid: { bg: '#FEE2E2', text: '#B91C1C', darkBg: '#7F1D1D', darkText: '#FCA5A5' },
  unknown: { bg: '#F0F3F7', text: '#6B7C93', darkBg: '#334155', darkText: '#94A3B8' },
} as const;

// Urgency level colors
export const URGENCY_COLORS = {
  high: { bg: '#FEE2E2', text: '#B91C1C', darkBg: '#7F1D1D', darkText: '#FCA5A5' },
  medium: { bg: '#FEF3C7', text: '#B45309', darkBg: '#78350F', darkText: '#FCD34D' },
  low: { bg: '#F0F3F7', text: '#6B7C93', darkBg: '#334155', darkText: '#94A3B8' },
} as const;

// Default fallback color
const DEFAULT_COLOR = { bg: '#F0F3F7', text: '#6B7C93', darkBg: '#334155', darkText: '#94A3B8' };

/**
 * Get color style object for a signal type
 * @param signalType - The signal type key
 * @param isDark - Whether dark mode is active
 * @returns Object with backgroundColor and color properties for inline styles
 */
export function getSignalTypeStyle(signalType: string, isDark = false): { backgroundColor: string; color: string } {
  const colors = SIGNAL_TYPE_COLORS[signalType as keyof typeof SIGNAL_TYPE_COLORS] || DEFAULT_COLOR;
  return {
    backgroundColor: isDark ? colors.darkBg : colors.bg,
    color: isDark ? colors.darkText : colors.text,
  };
}

/**
 * Get Tailwind class names for a signal type
 * @param signalType - The signal type key
 * @returns Object with bg and text class values (hex codes for use with arbitrary values)
 */
export function getSignalTypeColors(signalType: string): { bg: string; text: string; darkBg: string; darkText: string } {
  return SIGNAL_TYPE_COLORS[signalType as keyof typeof SIGNAL_TYPE_COLORS] || DEFAULT_COLOR;
}

/**
 * Get color style object for an email status
 * @param status - The email status
 * @param isDark - Whether dark mode is active
 * @returns Object with backgroundColor and color properties for inline styles
 */
export function getEmailStatusStyle(status: string, isDark = false): { backgroundColor: string; color: string } {
  const colors = EMAIL_STATUS_COLORS[status as keyof typeof EMAIL_STATUS_COLORS] || DEFAULT_COLOR;
  return {
    backgroundColor: isDark ? colors.darkBg : colors.bg,
    color: isDark ? colors.darkText : colors.text,
  };
}

/**
 * Get color style object for an urgency level
 * @param level - The urgency level (high, medium, low)
 * @param isDark - Whether dark mode is active
 * @returns Object with backgroundColor and color properties for inline styles
 */
export function getUrgencyStyle(level: 'high' | 'medium' | 'low', isDark = false): { backgroundColor: string; color: string } {
  const colors = URGENCY_COLORS[level] || DEFAULT_COLOR;
  return {
    backgroundColor: isDark ? colors.darkBg : colors.bg,
    color: isDark ? colors.darkText : colors.text,
  };
}
