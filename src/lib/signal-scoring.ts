/**
 * Signal Confidence Scoring
 *
 * Calculates a confidence score (0-100) for each signal based on:
 * - Source reliability
 * - Domain verification status
 * - Data completeness
 * - Company match confidence
 */

import { Signal } from '@/types';

interface ScoreBreakdown {
  sourceScore: number;
  domainScore: number;
  completenessScore: number;
  total: number;
  label: 'High' | 'Medium' | 'Low';
}

// Source reliability scores (out of 40)
const SOURCE_SCORES: Record<string, number> = {
  // Government sources - highest reliability
  'contracts-finder': 40,
  'find-a-tender': 40,
  'companies-house': 40,
  'planning-data': 35,

  // Scraped sources - medium reliability
  'source': 25,

  // AI search - lower reliability (depends on quality)
  'search': 20,
};

/**
 * Calculate confidence score for a signal
 */
export function calculateConfidenceScore(signal: Signal): ScoreBreakdown {
  let sourceScore = 0;
  let domainScore = 0;
  let completenessScore = 0;

  // 1. Source reliability (0-40 points)
  if (signal.source_type === 'search') {
    // AI-generated signals - base score 20
    sourceScore = 20;
    // Boost if from a search run (tracked)
    if (signal.search_run_id) sourceScore += 5;
  } else if (signal.source_type === 'scrape') {
    // Scraped from a configured source
    sourceScore = 25;
    // Boost for tracked sources
    if (signal.source_id) sourceScore += 5;
  } else {
    // Government sources or other
    sourceScore = 30;
  }

  // Extra boost for government data (no source/search run = global signals)
  if (!signal.source_id && !signal.search_run_id) {
    sourceScore = 40;
  }

  // 2. Domain verification (0-30 points)
  if (signal.company_domain) {
    // Has a domain - check quality
    const domain = signal.company_domain.toLowerCase();

    // Valid-looking domain
    if (domain.includes('.') && !domain.includes(' ')) {
      domainScore = 20;

      // Bonus for .gov.uk or known TLDs
      if (domain.endsWith('.gov.uk') || domain.endsWith('.nhs.uk')) {
        domainScore = 30;
      } else if (domain.endsWith('.co.uk') || domain.endsWith('.com') || domain.endsWith('.org')) {
        domainScore = 25;
      }
    } else {
      domainScore = 5;
    }
  } else {
    // No domain - 0 points
    domainScore = 0;
  }

  // 3. Data completeness (0-30 points)
  let completenessPoints = 0;

  // Company name (required, 5 points)
  if (signal.company_name && signal.company_name.length > 2) {
    completenessPoints += 5;
  }

  // Signal title (5 points)
  if (signal.signal_title && signal.signal_title.length > 5) {
    completenessPoints += 5;
  }

  // Signal detail (5 points)
  if (signal.signal_detail && signal.signal_detail.length > 20) {
    completenessPoints += 5;
  }

  // Signal URL (5 points)
  if (signal.signal_url && signal.signal_url.startsWith('http')) {
    completenessPoints += 5;
  }

  // Location (5 points)
  if (signal.location && signal.location.length > 2) {
    completenessPoints += 5;
  }

  // Industry (5 points)
  if (signal.industry && signal.industry.length > 2) {
    completenessPoints += 5;
  }

  completenessScore = completenessPoints;

  // Calculate total
  const total = sourceScore + domainScore + completenessScore;

  // Determine label
  let label: 'High' | 'Medium' | 'Low';
  if (total >= 70) {
    label = 'High';
  } else if (total >= 40) {
    label = 'Medium';
  } else {
    label = 'Low';
  }

  return {
    sourceScore,
    domainScore,
    completenessScore,
    total,
    label,
  };
}

/**
 * Get confidence label color for UI
 */
export function getConfidenceLabelColor(label: 'High' | 'Medium' | 'Low'): string {
  switch (label) {
    case 'High':
      return 'bg-green-100 text-green-700';
    case 'Medium':
      return 'bg-yellow-100 text-yellow-700';
    case 'Low':
      return 'bg-red-100 text-red-700';
  }
}

/**
 * Get confidence score tooltip text
 */
export function getConfidenceTooltip(breakdown: ScoreBreakdown): string {
  return `Source: ${breakdown.sourceScore}/40, Domain: ${breakdown.domainScore}/30, Data: ${breakdown.completenessScore}/30`;
}
