/**
 * Supplier Sync Utility
 *
 * Syncs suppliers from contract awards to the companies table.
 * Uses the company-matcher from Sprint 1 for matching/creation.
 * Uses the domain-resolver from Sprint 1 for domain resolution.
 *
 * CRITICAL: This module bridges Contracts Finder data with our company system.
 */

import { createAdminClient } from '@/lib/supabase/server';
import { findOrCreateCompany, normalizeCompanyName } from '@/lib/companies/company-matcher';
import { resolveDomain, DomainResolutionResult } from '@/lib/domain-resolver';
import { ParsedContractAward } from '@/lib/contracts-finder';
import { getIndustryFromCPV } from './cpv-mapping';

export interface SupplierSyncResult {
  company_id: string;
  company_name: string;
  normalised_name: string;
  match_type: 'exact_domain' | 'exact_ch_number' | 'fuzzy_name' | 'new';
  domain: string | null;
  domain_source: DomainResolutionResult['source'] | null;
  domain_confidence: number;
  is_actionable: boolean;
  is_first_contract: boolean;
}

/**
 * Sync a supplier from a contract award to the companies table.
 *
 * Flow:
 * 1. Normalise supplier name
 * 2. Try to match existing company (domain → CH number → name) for this user
 * 3. If no match, create new company for this user
 * 4. If company has no domain, attempt resolution
 * 5. Update company with government supplier flag
 * 6. Return sync result with actionability status
 */
export async function syncSupplierFromContract(
  award: ParsedContractAward,
  userId: string,
  options?: {
    skipDomainResolution?: boolean;
  }
): Promise<SupplierSyncResult> {
  const supabase = createAdminClient();
  const supplier = award.supplier;

  // Get industry from CPV codes
  const industry = award.cpv_codes.length > 0
    ? getIndustryFromCPV(award.cpv_codes[0])
    : null;

  // Step 1: Find or create company using Sprint 1 matcher (user-specific)
  const matchResult = await findOrCreateCompany({
    name: supplier.name,
    domain: supplier.domain || undefined,
    location: supplier.location || undefined,
    industry: industry || undefined,
    user_id: userId,
  });

  const { company, match_type } = matchResult;

  // Step 2: Resolve domain if missing and not skipped
  let domainResult: DomainResolutionResult | null = null;

  if (!company.domain && !options?.skipDomainResolution) {
    console.log(`[Supplier Sync] Resolving domain for: ${supplier.name}`);
    domainResult = await resolveDomain(supplier.name, {
      contactUrl: supplier.domain || undefined,
      skipGoogle: !process.env.FIRECRAWL_API_KEY, // Skip if no API key
    });

    // Update company with resolved domain
    if (domainResult.domain) {
      await supabase
        .from('companies')
        .update({ domain: domainResult.domain })
        .eq('id', company.id);

      company.domain = domainResult.domain;
    }
  }

  // Step 3: Check if this is the company's first government contract
  const { count: existingContracts } = await supabase
    .from('contract_awards')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', company.id);

  const isFirstContract = existingContracts === 0;

  // Step 4: Update company with government supplier status
  if (!isFirstContract) {
    // Already a government supplier, just increment contract count
    // (Will be done after contract is stored)
  } else {
    // Mark as government supplier
    await supabase
      .from('companies')
      .update({
        is_government_supplier: true,
        first_contract_date: award.award_date,
        last_activity_at: new Date().toISOString(),
      })
      .eq('id', company.id);
  }

  // Step 5: Build result with actionability status
  const finalDomain = company.domain || null;
  const normalisedName = normalizeCompanyName(supplier.name);

  // Company is actionable if it has a domain OR a normalised name
  // (Normalised name allows for enrichment tools to attempt lookup)
  const isActionable = !!(finalDomain || normalisedName);

  return {
    company_id: company.id,
    company_name: company.name,
    normalised_name: normalisedName,
    match_type,
    domain: finalDomain,
    domain_source: domainResult?.source || (company.domain ? 'url_extract' : null),
    domain_confidence: domainResult?.confidence || (company.domain ? 100 : 0),
    is_actionable: isActionable,
    is_first_contract: isFirstContract,
  };
}

/**
 * Store a contract award in the database
 */
export async function storeContractAward(
  award: ParsedContractAward,
  companyId: string
): Promise<{ id: string; isNew: boolean } | null> {
  const supabase = createAdminClient();

  // Check if contract already exists (by OCID + supplier party ID)
  const { data: existing } = await supabase
    .from('contract_awards')
    .select('id')
    .eq('ocid', award.ocid)
    .eq('supplier_party_id', award.supplier.party_id || award.supplier.name)
    .single();

  if (existing) {
    return { id: existing.id, isNew: false };
  }

  // Insert new contract award
  const { data: newContract, error } = await supabase
    .from('contract_awards')
    .insert({
      company_id: companyId,
      contracts_finder_id: award.ocid, // Legacy field - kept for compatibility
      ocid: award.ocid,
      title: award.title,
      description: award.description.slice(0, 2000), // Limit description length
      value_gbp: award.value_gbp,
      buyer_organisation: award.buyer_name,
      award_date: award.award_date,
      contract_start_date: award.contract_start_date,
      contract_end_date: award.contract_end_date,
      cpv_codes: award.cpv_codes,
      supplier_party_id: award.supplier.party_id || award.supplier.name,
      source: 'contracts_finder',
      source_url: award.source_url,
      signal_generated: false,
      raw_data: award.raw_data,
    })
    .select('id')
    .single();

  if (error) {
    // Handle unique constraint violation gracefully
    if (error.code === '23505') {
      console.log(`[Supplier Sync] Contract ${award.ocid} already exists (constraint)`);
      // Fetch the existing contract ID so we can still create signals for new ICPs
      const { data: existingAfterError } = await supabase
        .from('contract_awards')
        .select('id')
        .eq('ocid', award.ocid)
        .single();

      if (existingAfterError) {
        return { id: existingAfterError.id, isNew: false };
      }
      return null;
    }
    console.error('[Supplier Sync] Error storing contract:', error);
    return null;
  }

  // Update company contract stats
  await updateCompanyContractStats(supabase, companyId, award.value_gbp || 0);

  return { id: newContract.id, isNew: true };
}

/**
 * Update company's contract statistics
 */
async function updateCompanyContractStats(
  supabase: ReturnType<typeof createAdminClient>,
  companyId: string,
  contractValue: number
): Promise<void> {
  // Get current stats
  const { data: company } = await supabase
    .from('companies')
    .select('total_contracts_won, total_contract_value_gbp')
    .eq('id', companyId)
    .single();

  if (!company) return;

  const newCount = (company.total_contracts_won || 0) + 1;
  const newValue = (company.total_contract_value_gbp || 0) + contractValue;

  await supabase
    .from('companies')
    .update({
      total_contracts_won: newCount,
      total_contract_value_gbp: newValue,
      last_activity_at: new Date().toISOString(),
    })
    .eq('id', companyId);
}

/**
 * Mark a contract as having generated a signal
 */
export async function markContractSignalGenerated(
  contractId: string
): Promise<void> {
  const supabase = createAdminClient();

  await supabase
    .from('contract_awards')
    .update({ signal_generated: true })
    .eq('id', contractId);
}
