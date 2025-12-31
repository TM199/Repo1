/**
 * Contracts Finder API Client
 *
 * Fetches UK public sector contract awards from the Contracts Finder OCDS API.
 * API Documentation: https://www.contractsfinder.service.gov.uk/apidocumentation
 *
 * This is a FREE government API - no API key required.
 *
 * Updated for Sprint 2: Added enhanced search, CPV extraction, and pagination.
 */

import { createAdminClient } from './supabase/server';
import { extractDomainFromOCDSParty } from './domain-resolver';

const BASE_URL = 'https://www.contractsfinder.service.gov.uk/Published';

// Rate limiting
const RATE_LIMIT_MS = 500;
let lastRequestTime = 0;

async function rateLimitedFetch(url: string, options?: RequestInit): Promise<Response> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < RATE_LIMIT_MS) {
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS - timeSinceLastRequest));
  }
  lastRequestTime = Date.now();
  return fetch(url, options);
}

export interface OCDSRelease {
  ocid: string;
  id: string;
  date: string;
  tag: string[];
  initiationType: string;
  parties: Array<{
    id: string;
    name: string;
    identifier?: { scheme: string; id: string };
    roles: string[];
    address?: {
      streetAddress?: string;
      locality?: string;
      region?: string;
      postalCode?: string;
      countryName?: string;
    };
    contactPoint?: {
      name?: string;
      email?: string;
      telephone?: string;
      url?: string;
    };
  }>;
  buyer?: {
    id: string;
    name: string;
  };
  tender?: {
    id: string;
    title: string;
    description: string;
    status: string;
    value?: { amount: number; currency: string };
    procurementMethod?: string;
    mainProcurementCategory?: string;
    classification?: { scheme: string; id: string; description: string };
    additionalClassifications?: Array<{ scheme: string; id: string; description: string }>;
    items?: Array<{
      id: string;
      description: string;
      classification?: { scheme: string; id: string; description: string };
    }>;
  };
  awards?: Array<{
    id: string;
    title?: string;
    description?: string;
    status: string;
    date: string;
    value?: { amount: number; currency: string };
    suppliers?: Array<{
      id: string;
      name: string;
    }>;
    contractPeriod?: {
      startDate?: string;
      endDate?: string;
    };
  }>;
  contracts?: Array<{
    id: string;
    awardID: string;
    title?: string;
    description?: string;
    status: string;
    value?: { amount: number; currency: string };
    period?: {
      startDate?: string;
      endDate?: string;
    };
  }>;
}

interface OCDSSearchResponse {
  releases: OCDSRelease[];
  links?: {
    next?: string;
  };
}

interface ContractSignal {
  company_name: string;
  company_domain: string;
  signal_title: string;
  signal_detail: string;
  signal_url: string;
  location: string | null;
  value: number | null;
  buyer_name: string | null;
}

function generateFingerprint(signal: ContractSignal): string {
  const str = `${signal.company_name}|${signal.signal_title}|${signal.signal_url}`;
  return Buffer.from(str).toString('base64').slice(0, 64);
}

function extractDomainFromSupplier(release: OCDSRelease, supplierName: string): string {
  // Try to find the supplier party and extract domain from contact info
  const supplierParty = release.parties?.find(
    p => p.roles.includes('supplier') && p.name === supplierName
  );

  if (supplierParty) {
    return extractDomainFromOCDSParty(supplierParty);
  }

  // Return empty - don't guess
  return '';
}

function parseOCDSRelease(release: OCDSRelease): ContractSignal[] {
  const signals: ContractSignal[] = [];

  if (!release.awards || release.awards.length === 0) {
    return signals;
  }

  const buyerName = release.buyer?.name ||
    release.parties?.find(p => p.roles.includes('buyer'))?.name ||
    'Unknown Buyer';

  for (const award of release.awards) {
    if (award.status !== 'active' || !award.suppliers) continue;

    for (const supplier of award.suppliers) {
      const tenderTitle = release.tender?.title || award.title || 'Contract Award';
      const description = release.tender?.description || award.description || '';
      const value = award.value?.amount || release.tender?.value?.amount;

      // Get location from buyer address
      const buyerParty = release.parties?.find(p => p.roles.includes('buyer'));
      const location = buyerParty?.address?.locality || buyerParty?.address?.region || null;

      signals.push({
        company_name: supplier.name,
        company_domain: extractDomainFromSupplier(release, supplier.name),
        signal_title: `Won contract: ${tenderTitle}`,
        signal_detail: description.slice(0, 500) + (description.length > 500 ? '...' : ''),
        signal_url: `https://www.contractsfinder.service.gov.uk/Notice/${release.ocid}`,
        location,
        value: value || null,
        buyer_name: buyerName,
      });
    }
  }

  return signals;
}

/**
 * Fetch contract awards from the last N days
 */
export async function fetchContractAwards(daysBack: number = 1): Promise<{
  signals: ContractSignal[];
  error?: string;
}> {
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - daysBack);
  const fromDateStr = fromDate.toISOString().split('T')[0];

  try {
    // Search for award stage notices - use Notices (plural) endpoint
    const url = `${BASE_URL}/Notices/OCDS/Search?publishedFrom=${fromDateStr}&stages=award&size=100`;

    console.log(`[Contracts Finder] Fetching awards from ${fromDateStr}`);

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}: ${response.statusText}`);
    }

    const data: OCDSSearchResponse = await response.json();
    const allSignals: ContractSignal[] = [];

    for (const release of data.releases || []) {
      const signals = parseOCDSRelease(release);
      allSignals.push(...signals);
    }

    console.log(`[Contracts Finder] Found ${allSignals.length} contract awards`);

    return { signals: allSignals };
  } catch (error) {
    console.error('[Contracts Finder] Error:', error);
    return {
      signals: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Sync contract awards to the signals database
 * Called by the cron job
 */
export async function syncContractAwards(daysBack: number = 1): Promise<{
  success: boolean;
  found: number;
  new: number;
  error?: string;
}> {
  const supabase = createAdminClient();

  const { signals, error } = await fetchContractAwards(daysBack);

  if (error) {
    return { success: false, found: 0, new: 0, error };
  }

  if (signals.length === 0) {
    return { success: true, found: 0, new: 0 };
  }

  // Get existing hashes to deduplicate
  const { data: existingSignals } = await supabase
    .from('signals')
    .select('hash');

  const existingHashes = new Set(
    existingSignals?.map(s => s.hash).filter(Boolean) || []
  );

  // Filter out duplicates
  const newSignals = signals.filter(signal => {
    const hash = generateFingerprint(signal);
    return !existingHashes.has(hash);
  });

  if (newSignals.length === 0) {
    console.log('[Contracts Finder] No new signals to insert');
    return { success: true, found: signals.length, new: 0 };
  }

  // Insert new signals
  const signalsToInsert = newSignals.map(signal => ({
    source_type: 'search' as const,  // Using 'search' type for API-sourced signals
    source_id: null,
    search_run_id: null,
    signal_type: 'contract_awarded' as const,
    company_name: signal.company_name,
    company_domain: signal.company_domain,
    signal_title: signal.signal_title,
    signal_detail: signal.signal_detail + (signal.buyer_name ? ` | Buyer: ${signal.buyer_name}` : '') + (signal.value ? ` | Value: £${signal.value.toLocaleString()}` : ''),
    signal_url: signal.signal_url,
    location: signal.location,
    industry: null,
    hash: generateFingerprint(signal),
    detected_at: new Date().toISOString(),
    is_new: true,
  }));

  const { error: insertError } = await supabase
    .from('signals')
    .upsert(signalsToInsert, { onConflict: 'hash', ignoreDuplicates: true });

  if (insertError) {
    console.error('[Contracts Finder] Insert error:', insertError);
    return { success: false, found: signals.length, new: 0, error: insertError.message };
  }

  console.log(`[Contracts Finder] Inserted ${newSignals.length} new signals`);
  return { success: true, found: signals.length, new: newSignals.length };
}

// ============================================
// ENHANCED API (Sprint 2)
// ============================================

export interface SearchParams {
  publishedFrom?: string;  // YYYY-MM-DD
  publishedTo?: string;    // YYYY-MM-DD
  minValue?: number;
  maxValue?: number;
  cpvCodes?: string[];     // Filter by CPV code prefixes
  size?: number;           // Page size (default 100)
  maxPages?: number;       // Max pages to fetch (default 5)
}

export interface ParsedContractAward {
  ocid: string;
  title: string;
  description: string;
  value_gbp: number | null;
  award_date: string;
  contract_start_date: string | null;
  contract_end_date: string | null;
  buyer_name: string;
  buyer_id: string | null;
  cpv_codes: string[];
  supplier: {
    name: string;
    party_id: string | null;
    location: string | null;
    domain: string | null;
  };
  source_url: string;
  raw_data: OCDSRelease;
}

/**
 * Extract CPV codes from an OCDS release
 * CPV codes can be in tender.classification, tender.additionalClassifications, or tender.items
 */
export function extractCPVCodes(release: OCDSRelease): string[] {
  const cpvCodes: string[] = [];

  // Extract from tender main classification
  if (release.tender?.classification?.scheme === 'CPV' && release.tender.classification.id) {
    cpvCodes.push(release.tender.classification.id);
  }

  // Extract from tender additional classifications
  if (release.tender?.additionalClassifications) {
    for (const classification of release.tender.additionalClassifications) {
      if (classification.scheme === 'CPV' && classification.id) {
        cpvCodes.push(classification.id);
      }
    }
  }

  // Extract from tender items (fallback)
  if (release.tender?.items) {
    for (const item of release.tender.items) {
      if (item.classification?.scheme === 'CPV' && item.classification.id) {
        cpvCodes.push(item.classification.id);
      }
    }
  }

  return [...new Set(cpvCodes)];
}

/**
 * Get supplier party details from an OCDS release
 */
function getSupplierParty(release: OCDSRelease, supplierName: string) {
  return release.parties?.find(
    p => p.roles.includes('supplier') && p.name === supplierName
  );
}

/**
 * Parse an OCDS release into structured contract award data
 */
export function parseContractAward(release: OCDSRelease): ParsedContractAward[] {
  const awards: ParsedContractAward[] = [];

  if (!release.awards || release.awards.length === 0) {
    return awards;
  }

  const buyerParty = release.parties?.find(p => p.roles.includes('buyer'));
  const buyerName = release.buyer?.name || buyerParty?.name || 'Unknown Buyer';
  const buyerId = release.buyer?.id || buyerParty?.id || null;
  const cpvCodes = extractCPVCodes(release);

  for (const award of release.awards) {
    if (award.status !== 'active' || !award.suppliers) continue;

    for (const supplier of award.suppliers) {
      const supplierParty = getSupplierParty(release, supplier.name);
      const supplierLocation = supplierParty?.address?.locality ||
        supplierParty?.address?.region || null;
      const supplierDomain = supplierParty ?
        extractDomainFromOCDSParty(supplierParty) || null : null;

      awards.push({
        ocid: release.ocid,
        title: release.tender?.title || award.title || 'Contract Award',
        description: release.tender?.description || award.description || '',
        value_gbp: award.value?.amount || release.tender?.value?.amount || null,
        award_date: award.date,
        contract_start_date: award.contractPeriod?.startDate || null,
        contract_end_date: award.contractPeriod?.endDate || null,
        buyer_name: buyerName,
        buyer_id: buyerId,
        cpv_codes: cpvCodes,
        supplier: {
          name: supplier.name,
          party_id: supplier.id || null,
          location: supplierLocation,
          domain: supplierDomain,
        },
        source_url: `https://www.contractsfinder.service.gov.uk/Notice/${release.ocid}`,
        raw_data: release,
      });
    }
  }

  return awards;
}

/**
 * Search for awarded contracts with filtering and pagination
 *
 * @param params - Search parameters
 * @returns Array of parsed contract awards
 */
export async function searchAwardedContracts(params: SearchParams = {}): Promise<{
  awards: ParsedContractAward[];
  totalFound: number;
  pagesProcessed: number;
  error?: string;
}> {
  const {
    publishedFrom,
    publishedTo,
    minValue,
    cpvCodes,
    size = 100,
    maxPages = 5,
  } = params;

  const allAwards: ParsedContractAward[] = [];
  let pagesProcessed = 0;
  let nextUrl: string | null = null;

  try {
    // Build initial URL
    const queryParams = new URLSearchParams();
    queryParams.set('stages', 'award');
    queryParams.set('size', size.toString());

    if (publishedFrom) queryParams.set('publishedFrom', publishedFrom);
    if (publishedTo) queryParams.set('publishedTo', publishedTo);

    let url = `${BASE_URL}/Notices/OCDS/Search?${queryParams.toString()}`;

    while (url && pagesProcessed < maxPages) {
      console.log(`[Contracts Finder] Fetching page ${pagesProcessed + 1}...`);

      const response = await rateLimitedFetch(url, {
        headers: { 'Accept': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }

      const data: OCDSSearchResponse = await response.json();
      pagesProcessed++;

      for (const release of data.releases || []) {
        const awards = parseContractAward(release);

        for (const award of awards) {
          // Filter by minimum value
          if (minValue && (!award.value_gbp || award.value_gbp < minValue)) {
            continue;
          }

          // Filter by CPV codes (if specified)
          if (cpvCodes && cpvCodes.length > 0) {
            const hasMatchingCPV = award.cpv_codes.some(code =>
              cpvCodes.some(prefix => code.startsWith(prefix))
            );
            if (!hasMatchingCPV && award.cpv_codes.length > 0) {
              continue;
            }
          }

          allAwards.push(award);
        }
      }

      // Get next page URL
      nextUrl = data.links?.next || null;
      url = nextUrl || '';
    }

    console.log(`[Contracts Finder] Found ${allAwards.length} matching awards across ${pagesProcessed} pages`);

    return {
      awards: allAwards,
      totalFound: allAwards.length,
      pagesProcessed,
    };
  } catch (error) {
    console.error('[Contracts Finder] Error:', error);
    return {
      awards: allAwards,
      totalFound: allAwards.length,
      pagesProcessed,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get a single contract notice by OCID
 */
export async function getContractNotice(ocid: string): Promise<{
  release: OCDSRelease | null;
  error?: string;
}> {
  try {
    const url = `${BASE_URL}/Notices/OCDS/${ocid}`;

    const response = await rateLimitedFetch(url, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return { release: null };
      }
      throw new Error(`API returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return { release: data };
  } catch (error) {
    console.error('[Contracts Finder] Error fetching notice:', error);
    return {
      release: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
