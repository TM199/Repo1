/**
 * Contracts Finder Signal Detection
 *
 * Detects hiring pain signals from government contract awards.
 * Companies winning contracts often need to scale up to deliver.
 */

import { createAdminClient } from '@/lib/supabase/server';
import { PAIN_SCORES } from '@/lib/signals/detection';
import { ParsedContractAward } from '@/lib/contracts-finder';
import { SupplierSyncResult } from './supplier-sync';

export interface ContractSignalCandidate {
  companyId: string;
  contractId: string;
  signalType: string;
  painScore: number;
  urgency: 'immediate' | 'short_term' | 'medium_term';
  confidence: number;
  title: string;
  detail: string;
  sourceUrl: string;
  metadata: {
    contract_value: number | null;
    contract_title: string;
    buyer_name: string;
    award_date: string;
    cpv_codes: string[];
    domain_resolved: boolean;
    is_actionable: boolean;
    enrichment_ready: boolean;
  };
}

// Contract value thresholds in GBP
const CONTRACT_TIERS = {
  small: { min: 50000, max: 500000, signalType: 'contract_awarded_small' },
  medium: { min: 500000, max: 2000000, signalType: 'contract_awarded_medium' },
  large: { min: 2000000, max: Infinity, signalType: 'contract_awarded_large' },
} as const;

/**
 * Determine the contract tier based on value
 */
export function getContractTier(valueGbp: number | null): {
  tier: 'small' | 'medium' | 'large' | null;
  signalType: string | null;
  painScore: number;
  urgency: 'immediate' | 'short_term' | 'medium_term';
  confidence: number;
} {
  if (!valueGbp || valueGbp < CONTRACT_TIERS.small.min) {
    return { tier: null, signalType: null, painScore: 0, urgency: 'medium_term', confidence: 0 };
  }

  let tier: 'small' | 'medium' | 'large';

  if (valueGbp >= CONTRACT_TIERS.large.min) {
    tier = 'large';
  } else if (valueGbp >= CONTRACT_TIERS.medium.min) {
    tier = 'medium';
  } else {
    tier = 'small';
  }

  const signalType = CONTRACT_TIERS[tier].signalType;
  const config = PAIN_SCORES[signalType];

  return {
    tier,
    signalType,
    painScore: config.pain_score,
    urgency: config.urgency,
    confidence: config.confidence_base,
  };
}

/**
 * Format currency for display
 */
function formatValue(value: number): string {
  if (value >= 1000000) {
    return `£${(value / 1000000).toFixed(1)}M`;
  } else if (value >= 1000) {
    return `£${(value / 1000).toFixed(0)}k`;
  }
  return `£${value.toLocaleString()}`;
}

/**
 * Detect contract award signal for a single contract
 */
export function detectContractAwardSignal(
  award: ParsedContractAward,
  syncResult: SupplierSyncResult,
  contractId: string
): ContractSignalCandidate | null {
  const tierInfo = getContractTier(award.value_gbp);

  // Skip contracts below minimum threshold
  if (!tierInfo.signalType) {
    return null;
  }

  const valueStr = award.value_gbp ? formatValue(award.value_gbp) : 'undisclosed value';
  const domainResolved = !!syncResult.domain;

  // Format the award date
  const awardDateStr = award.award_date
    ? new Date(award.award_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';

  return {
    companyId: syncResult.company_id,
    contractId,
    signalType: tierInfo.signalType,
    painScore: tierInfo.painScore,
    urgency: tierInfo.urgency,
    confidence: tierInfo.confidence,
    title: `Won ${valueStr} government contract`,
    detail: `${syncResult.company_name} awarded "${award.title}" (${valueStr}) by ${award.buyer_name}${awardDateStr ? ` on ${awardDateStr}` : ''}. Companies winning government contracts typically need to scale up to deliver.`,
    sourceUrl: award.source_url,
    metadata: {
      contract_value: award.value_gbp,
      contract_title: award.title,
      buyer_name: award.buyer_name,
      award_date: award.award_date,
      cpv_codes: award.cpv_codes,
      domain_resolved: domainResolved,
      is_actionable: syncResult.is_actionable,
      enrichment_ready: domainResolved,
    },
  };
}

/**
 * Detect first government contract signal
 * This is a special signal for companies winning their first government contract
 */
export function detectFirstContractSignal(
  award: ParsedContractAward,
  syncResult: SupplierSyncResult,
  contractId: string
): ContractSignalCandidate | null {
  if (!syncResult.is_first_contract) {
    return null;
  }

  const config = PAIN_SCORES.contract_awarded_first;
  const valueStr = award.value_gbp ? formatValue(award.value_gbp) : 'undisclosed value';
  const domainResolved = !!syncResult.domain;

  // Format the award date
  const awardDateStr = award.award_date
    ? new Date(award.award_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';

  return {
    companyId: syncResult.company_id,
    contractId,
    signalType: 'contract_awarded_first',
    painScore: config.pain_score,
    urgency: config.urgency,
    confidence: config.confidence_base,
    title: `First government contract win (${valueStr})`,
    detail: `${syncResult.company_name} won their first government contract: "${award.title}" from ${award.buyer_name}${awardDateStr ? ` on ${awardDateStr}` : ''}. First-time contractors often need significant hiring to build delivery capability.`,
    sourceUrl: award.source_url,
    metadata: {
      contract_value: award.value_gbp,
      contract_title: award.title,
      buyer_name: award.buyer_name,
      award_date: award.award_date,
      cpv_codes: award.cpv_codes,
      domain_resolved: domainResolved,
      is_actionable: syncResult.is_actionable,
      enrichment_ready: domainResolved,
    },
  };
}

/**
 * Detect multiple contract wins signal
 * Companies winning multiple contracts in a short period have increased hiring needs
 */
export async function detectMultipleContractWins(
  companyId: string,
  periodDays: number = 30
): Promise<ContractSignalCandidate | null> {
  const supabase = createAdminClient();

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - periodDays);

  // Count contracts won in period
  const { data: recentContracts, count } = await supabase
    .from('contract_awards')
    .select('id, title, value_gbp, buyer_organisation, award_date, source_url', { count: 'exact' })
    .eq('company_id', companyId)
    .gte('award_date', cutoffDate.toISOString().split('T')[0])
    .order('award_date', { ascending: false });

  if (!count || count < 2) {
    return null;
  }

  // Get company details
  const { data: company } = await supabase
    .from('companies')
    .select('name, domain')
    .eq('id', companyId)
    .single();

  if (!company) {
    return null;
  }

  const config = PAIN_SCORES.contract_awarded_multiple;
  const totalValue = recentContracts?.reduce((sum, c) => sum + (c.value_gbp || 0), 0) || 0;
  const valueStr = totalValue > 0 ? formatValue(totalValue) : 'undisclosed total value';
  const domainResolved = !!company.domain;

  // Use the most recent contract for linking
  const latestContract = recentContracts?.[0];

  return {
    companyId,
    contractId: latestContract?.id || '',
    signalType: 'contract_awarded_multiple',
    painScore: config.pain_score + Math.min((count - 2) * 5, 15), // Bonus for more contracts
    urgency: config.urgency,
    confidence: config.confidence_base,
    title: `${count} government contracts won in ${periodDays} days (${valueStr})`,
    detail: `${company.name} has won ${count} government contracts worth ${valueStr} in the last ${periodDays} days. Multiple contract wins indicate significant growth and likely hiring needs.`,
    sourceUrl: latestContract?.source_url || '',
    metadata: {
      contract_value: totalValue,
      contract_title: `${count} contracts`,
      buyer_name: 'Multiple buyers',
      award_date: latestContract?.award_date || new Date().toISOString().split('T')[0],
      cpv_codes: [],
      domain_resolved: domainResolved,
      is_actionable: !!(domainResolved || company.name),
      enrichment_ready: domainResolved,
    },
  };
}

