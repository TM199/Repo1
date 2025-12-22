/**
 * Agency Signal Selection
 *
 * Uses the existing SIGNAL_TYPES_CONFIG from signal-mapping.ts
 * but adds hiring-intent prioritization for recruitment agencies.
 *
 * The key insight: different signals indicate DIFFERENT levels of hiring urgency.
 * - Contract awarded → Immediate hiring need (project team needed NOW)
 * - Funding announced → Hiring in 1-3 months (scaling the team)
 * - Planning approved → Hiring in 3-6 months (project mobilization)
 * - Leadership change → May or may not hire (depends on restructuring)
 */

import { SIGNAL_TYPES_CONFIG, INDUSTRIES } from './signal-mapping';
import { SignalType } from '@/types';

/**
 * Hiring urgency levels for different signal types.
 * This determines which signals are most valuable to recruiters.
 */
export const SIGNAL_HIRING_URGENCY: Record<SignalType, 'immediate' | 'short_term' | 'medium_term' | 'speculative'> = {
  contract_awarded: 'immediate',      // Need project team NOW
  company_hiring: 'immediate',        // Direct hiring intent
  cqc_rating_change: 'immediate',     // Staffing issues need fixing
  company_expansion: 'short_term',    // New facility = new team
  funding_announced: 'short_term',    // Money to hire, will post soon
  project_announced: 'short_term',    // Project team building phase
  acquisition_merger: 'short_term',   // Integration hiring
  planning_approved: 'medium_term',   // 3-6 months until construction
  planning_submitted: 'medium_term',  // Pipeline signal
  leadership_change: 'speculative',   // May restructure, uncertain
  regulatory_change: 'speculative',   // Compliance hiring possible
  layoffs_restructure: 'speculative', // Actually reduces hiring
  new_job: 'immediate',               // Direct job posting
};

/**
 * Get signal types relevant to industries, sorted by hiring urgency
 */
export function getSignalTypesForIndustries(industries: string[]): SignalType[] {
  // Use existing SIGNAL_TYPES_CONFIG to find signals relevant to these industries
  const relevantSignals = SIGNAL_TYPES_CONFIG.filter(config =>
    industries.some(industry => config.relevantIndustries.includes(industry))
  );

  // Sort by hiring urgency (immediate first, then short_term, etc.)
  const urgencyOrder = { immediate: 0, short_term: 1, medium_term: 2, speculative: 3 };

  return relevantSignals
    .sort((a, b) => {
      const urgencyA = SIGNAL_HIRING_URGENCY[a.value] || 'speculative';
      const urgencyB = SIGNAL_HIRING_URGENCY[b.value] || 'speculative';
      return urgencyOrder[urgencyA] - urgencyOrder[urgencyB];
    })
    .map(config => config.value);
}

/**
 * Get only high-urgency signals (immediate + short_term) for an industry
 */
export function getHighUrgencySignals(industries: string[]): SignalType[] {
  return getSignalTypesForIndustries(industries).filter(signal => {
    const urgency = SIGNAL_HIRING_URGENCY[signal];
    return urgency === 'immediate' || urgency === 'short_term';
  });
}

/**
 * Get signal description with hiring context (for UI display)
 */
export function getSignalHiringContext(signalType: SignalType): string {
  const contexts: Record<SignalType, string> = {
    contract_awarded: 'Companies need to staff up immediately to deliver the contract',
    company_hiring: 'Direct indication of hiring intent',
    cqc_rating_change: 'Care providers with poor ratings often need urgent staffing help',
    company_expansion: 'New locations require full teams - hiring ramp-up expected',
    funding_announced: 'Fresh capital typically funds 3-12 month hiring plans',
    project_announced: 'Major projects require project teams and contractors',
    acquisition_merger: 'Integration creates new roles and backfill opportunities',
    planning_approved: 'Construction/development will need project teams in 3-6 months',
    planning_submitted: 'Early pipeline signal - hiring 6-12 months out',
    leadership_change: 'New leaders may restructure or expand their teams',
    regulatory_change: 'Compliance requirements may create specialist roles',
    layoffs_restructure: 'Company reducing headcount - low hiring likelihood',
    new_job: 'Active job posting - immediate opportunity',
  };
  return contexts[signalType] || '';
}

/**
 * Reexport industries from signal-mapping for convenience
 */
export const AGENCY_INDUSTRIES = INDUSTRIES;
