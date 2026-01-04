/**
 * Companies House Company Sync
 *
 * Syncs company data from Companies House, resolves domains,
 * and updates company records with CH-specific fields.
 */

import { createAdminClient } from '../supabase/server';
import { findOrCreateCompany } from '../companies/company-matcher';
import { resolveDomain } from '../domain-resolver';
import { getCompanyDetails } from '../companies-house';
import { getIndustryFromSicCodes } from '../sic-codes';

interface SyncedCompany {
  id: string;
  name: string;
  domain: string | null;
  companies_house_number: string;
  sic_codes: string[] | null;
  company_status: string | null;
  incorporation_date: string | null;
  industry: string | null;
  isNew: boolean;
  domainResolved: boolean;
}

/**
 * Sync a company from Companies House data
 * 1. Fetch CH details
 * 2. Find or create company record (user-specific)
 * 3. Resolve domain if missing
 * 4. Update CH-specific fields
 */
export async function syncCompanyFromCH(
  chNumber: string,
  userId: string,
  options?: {
    skipDomainResolution?: boolean;
  }
): Promise<SyncedCompany | null> {
  const supabase = createAdminClient();

  // 1. Fetch company details from Companies House
  const { company: chCompany, error } = await getCompanyDetails(chNumber);

  if (error || !chCompany) {
    console.error(`[CH Sync] Failed to fetch company ${chNumber}:`, error);
    return null;
  }

  // 2. Derive industry from SIC codes
  const industry = chCompany.sic_codes
    ? getIndustryFromSicCodes(chCompany.sic_codes)
    : null;

  // 3. Get location from registered address
  const location = chCompany.registered_office_address?.locality ||
    chCompany.registered_office_address?.region ||
    null;

  // 4. Find or create company using the matcher (user-specific)
  const { company, match_type } = await findOrCreateCompany({
    name: chCompany.company_name,
    companies_house_number: chNumber,
    location: location || undefined,
    industry: industry || undefined,
    user_id: userId,
  });

  const isNew = match_type === 'new';

  // 5. Resolve domain if missing and not skipped
  let domainResolved = false;
  if (!company.domain && !options?.skipDomainResolution) {
    console.log(`[CH Sync] Resolving domain for: ${chCompany.company_name}`);
    const domainResult = await resolveDomain(chCompany.company_name);

    if (domainResult.domain && domainResult.confidence >= 40) {
      await supabase
        .from('companies')
        .update({ domain: domainResult.domain })
        .eq('id', company.id);

      company.domain = domainResult.domain;
      domainResolved = true;
      console.log(`[CH Sync] Domain resolved: ${domainResult.domain} (${domainResult.source}, ${domainResult.confidence}%)`);
    }
  }

  // 6. Update CH-specific fields
  const updates: Record<string, unknown> = {
    companies_house_number: chNumber,
    companies_house_last_checked: new Date().toISOString(),
  };

  if (chCompany.sic_codes) {
    updates.sic_codes = chCompany.sic_codes;
  }
  if (chCompany.company_status) {
    updates.company_status = chCompany.company_status;
  }
  if (chCompany.date_of_creation) {
    updates.incorporation_date = chCompany.date_of_creation;
  }
  if (industry && !company.industry) {
    updates.industry = industry;
  }

  await supabase
    .from('companies')
    .update(updates)
    .eq('id', company.id);

  return {
    id: company.id,
    name: company.name,
    domain: company.domain,
    companies_house_number: chNumber,
    sic_codes: chCompany.sic_codes || null,
    company_status: chCompany.company_status || null,
    incorporation_date: chCompany.date_of_creation || null,
    industry,
    isNew,
    domainResolved,
  };
}

/**
 * Batch sync multiple companies from Companies House
 * Includes rate limiting (600ms between calls)
 */
export async function batchSyncCompaniesFromCH(
  chNumbers: string[],
  userId: string,
  options?: {
    skipDomainResolution?: boolean;
    delayMs?: number;
  }
): Promise<{
  synced: SyncedCompany[];
  failed: string[];
}> {
  const synced: SyncedCompany[] = [];
  const failed: string[] = [];
  const delay = options?.delayMs ?? 600;

  for (let i = 0; i < chNumbers.length; i++) {
    const chNumber = chNumbers[i];

    try {
      const result = await syncCompanyFromCH(chNumber, userId, {
        skipDomainResolution: options?.skipDomainResolution,
      });

      if (result) {
        synced.push(result);
      } else {
        failed.push(chNumber);
      }
    } catch (err) {
      console.error(`[CH Sync] Error syncing ${chNumber}:`, err);
      failed.push(chNumber);
    }

    // Rate limit between calls (except last one)
    if (i < chNumbers.length - 1 && delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  return { synced, failed };
}
