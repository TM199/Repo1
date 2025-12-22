/**
 * Companies House API Client
 *
 * Fetches UK company data including officer appointments (leadership changes).
 * API Documentation: https://developer.company-information.service.gov.uk/
 *
 * FREE API - requires registration for API key.
 * Rate limit: 600 requests per 5 minutes.
 */

import { createAdminClient } from './supabase/server';
import { getIndustryFromSicCodes } from './sic-codes';

const BASE_URL = 'https://api.company-information.service.gov.uk';

interface CompanyProfile {
  company_name: string;
  company_number: string;
  company_status: string;
  type: string;
  date_of_creation: string;
  jurisdiction: string;
  registered_office_address?: {
    address_line_1?: string;
    address_line_2?: string;
    locality?: string;
    region?: string;
    postal_code?: string;
    country?: string;
  };
  sic_codes?: string[];
  accounts?: {
    next_made_up_to?: string;
  };
  links?: {
    self?: string;
    filing_history?: string;
    officers?: string;
  };
}

interface Officer {
  name: string;
  officer_role: string;
  appointed_on: string;
  resigned_on?: string;
  nationality?: string;
  occupation?: string;
  date_of_birth?: {
    month: number;
    year: number;
  };
  address?: {
    premises?: string;
    address_line_1?: string;
    locality?: string;
    region?: string;
    postal_code?: string;
    country?: string;
  };
  links?: {
    self?: string;
    officer?: {
      appointments?: string;
    };
  };
}

interface OfficerListResponse {
  items: Officer[];
  items_per_page: number;
  kind: string;
  start_index: number;
  total_results: number;
  links?: {
    self?: string;
  };
}

interface CompanySearchResult {
  company_name: string;
  company_number: string;
  company_status: string;
  company_type: string;
  date_of_creation?: string;
  address?: {
    address_line_1?: string;
    locality?: string;
    postal_code?: string;
    country?: string;
  };
  links?: {
    self?: string;
  };
}

interface SearchResponse {
  items: CompanySearchResult[];
  items_per_page: number;
  kind: string;
  start_index: number;
  total_results: number;
}

interface LeadershipSignal {
  company_name: string;
  company_domain: string;
  company_number: string;
  signal_title: string;
  signal_detail: string;
  signal_url: string;
  location: string | null;
  industry: string | null;
  officer_name: string;
  officer_role: string;
  appointed_on: string;
}

function generateFingerprint(signal: LeadershipSignal): string {
  const str = `${signal.company_name}|${signal.signal_title}|${signal.signal_url}`;
  return Buffer.from(str).toString('base64').slice(0, 64);
}

// Don't guess domains - return empty string
// Domain can be looked up via enrichment or Companies House website link
function extractDomainFromName(): string {
  return '';
}

function formatOfficerRole(role: string): string {
  const roleMap: Record<string, string> = {
    'director': 'Director',
    'secretary': 'Company Secretary',
    'llp-member': 'LLP Member',
    'llp-designated-member': 'Designated LLP Member',
    'corporate-director': 'Corporate Director',
    'corporate-secretary': 'Corporate Secretary',
    'corporate-llp-member': 'Corporate LLP Member',
    'corporate-llp-designated-member': 'Corporate Designated LLP Member',
    'judicial-factor': 'Judicial Factor',
    'receiver-and-manager': 'Receiver and Manager',
    'cic-manager': 'CIC Manager',
    'member-of-supervisory-organ': 'Member of Supervisory Organ',
    'member-of-administrative-organ': 'Member of Administrative Organ',
    'member-of-management-organ': 'Member of Management Organ',
  };
  return roleMap[role] || role.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function isExecutiveRole(role: string): boolean {
  const executiveRoles = [
    'director',
    'llp-designated-member',
    'cic-manager',
    'member-of-management-organ',
  ];
  return executiveRoles.includes(role);
}

function getAuthHeader(): Record<string, string> {
  const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
  if (!apiKey) {
    throw new Error('COMPANIES_HOUSE_API_KEY environment variable not set');
  }
  // Companies House uses Basic Auth with API key as username, no password
  const credentials = Buffer.from(`${apiKey}:`).toString('base64');
  return {
    'Authorization': `Basic ${credentials}`,
    'Accept': 'application/json',
  };
}

/**
 * Search for companies by name
 */
export async function searchCompanies(query: string, limit: number = 10): Promise<{
  companies: CompanySearchResult[];
  error?: string;
}> {
  try {
    const url = `${BASE_URL}/search/companies?q=${encodeURIComponent(query)}&items_per_page=${limit}`;

    const response = await fetch(url, {
      headers: getAuthHeader(),
    });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}: ${response.statusText}`);
    }

    const data: SearchResponse = await response.json();
    return { companies: data.items || [] };
  } catch (error) {
    console.error('[Companies House] Search error:', error);
    return {
      companies: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get company details by company number
 */
export async function getCompanyDetails(companyNumber: string): Promise<{
  company: CompanyProfile | null;
  error?: string;
}> {
  try {
    const url = `${BASE_URL}/company/${companyNumber}`;

    const response = await fetch(url, {
      headers: getAuthHeader(),
    });

    if (!response.ok) {
      if (response.status === 404) {
        return { company: null };
      }
      throw new Error(`API returned ${response.status}: ${response.statusText}`);
    }

    const company: CompanyProfile = await response.json();
    return { company };
  } catch (error) {
    console.error('[Companies House] Get company error:', error);
    return {
      company: null,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get officers (directors) for a company
 */
export async function getCompanyOfficers(companyNumber: string): Promise<{
  officers: Officer[];
  error?: string;
}> {
  try {
    const url = `${BASE_URL}/company/${companyNumber}/officers`;

    const response = await fetch(url, {
      headers: getAuthHeader(),
    });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}: ${response.statusText}`);
    }

    const data: OfficerListResponse = await response.json();
    return { officers: data.items || [] };
  } catch (error) {
    console.error('[Companies House] Get officers error:', error);
    return {
      officers: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get filing history for a company to detect recent officer changes
 */
async function getFilingHistory(companyNumber: string, category?: string): Promise<{
  filings: Array<{
    category: string;
    type: string;
    date: string;
    description: string;
    description_values?: Record<string, string>;
    links?: { self?: string; document_metadata?: string };
  }>;
  error?: string;
}> {
  try {
    let url = `${BASE_URL}/company/${companyNumber}/filing-history?items_per_page=50`;
    if (category) {
      url += `&category=${category}`;
    }

    const response = await fetch(url, { headers: getAuthHeader() });

    if (!response.ok) {
      return { filings: [] };
    }

    const data = await response.json();
    return { filings: data.items || [] };
  } catch (error) {
    return {
      filings: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Fetch recent officer appointments by checking filing history
 * Searches active UK companies and filters for recent officer appointment filings
 */
export async function fetchRecentAppointments(daysBack: number = 7): Promise<{
  signals: LeadershipSignal[];
  error?: string;
}> {
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - daysBack);
  const fromDateStr = fromDate.toISOString().split('T')[0];

  try {
    // Strategy: Search for active companies with recent activity
    // The advanced-search endpoint with filed_from parameter returns companies with recent filings
    const url = `${BASE_URL}/advanced-search/companies?company_status=active&size=100`;

    console.log(`[Companies House] Fetching active companies to check for recent appointments`);

    const response = await fetch(url, { headers: getAuthHeader() });

    if (!response.ok) {
      // Advanced search might not be available - fall back to alternative approach
      console.log('[Companies House] Advanced search not available, trying alternative approach');
      return await fetchRecentAppointmentsAlternative(daysBack);
    }

    const data = await response.json();
    const allSignals: LeadershipSignal[] = [];
    const processedCompanies = new Set<string>();

    // Process companies and look for recent officer appointments
    for (const company of (data.items || []).slice(0, 30)) {
      if (processedCompanies.has(company.company_number)) continue;
      processedCompanies.add(company.company_number);

      // Get officers for this company
      const { officers } = await getCompanyOfficers(company.company_number);

      // Get company details for SIC codes (only if we have appointments to add)
      let industry: string | null = null;
      let companyDetailsChecked = false;

      for (const officer of officers) {
        // Only include executive roles
        if (!isExecutiveRole(officer.officer_role)) continue;
        if (officer.resigned_on) continue;

        // Check if appointment is recent
        if (!officer.appointed_on) continue;
        const appointedDate = new Date(officer.appointed_on);
        if (appointedDate < fromDate) continue;

        // Fetch company details once to get SIC codes
        if (!companyDetailsChecked) {
          companyDetailsChecked = true;
          const { company: companyDetails } = await getCompanyDetails(company.company_number);
          if (companyDetails?.sic_codes) {
            industry = getIndustryFromSicCodes(companyDetails.sic_codes);
          }
        }

        const location = company.registered_office_address?.locality ||
          company.registered_office_address?.region ||
          null;

        allSignals.push({
          company_name: company.company_name,
          company_domain: extractDomainFromName(),
          company_number: company.company_number,
          signal_title: `${officer.name} appointed as ${formatOfficerRole(officer.officer_role)}`,
          signal_detail: `New ${formatOfficerRole(officer.officer_role)} at ${company.company_name}. Appointed ${officer.appointed_on}.`,
          signal_url: `https://find-and-update.company-information.service.gov.uk/company/${company.company_number}/officers`,
          location,
          industry,
          officer_name: officer.name,
          officer_role: officer.officer_role,
          appointed_on: officer.appointed_on,
        });
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log(`[Companies House] Found ${allSignals.length} recent officer appointments`);
    return { signals: allSignals };
  } catch (error) {
    console.error('[Companies House] Error:', error);
    return {
      signals: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Alternative approach: Use filing history category filter
 * Less efficient but works without advanced search access
 */
async function fetchRecentAppointmentsAlternative(daysBack: number): Promise<{
  signals: LeadershipSignal[];
  error?: string;
}> {
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - daysBack);

  try {
    // Search for some well-known active companies to get a sample
    // In production, you'd want to maintain a list of companies to monitor
    const sampleQueries = ['technology', 'construction', 'healthcare', 'finance'];
    const allSignals: LeadershipSignal[] = [];
    const processedCompanies = new Set<string>();

    for (const query of sampleQueries) {
      const { companies } = await searchCompanies(query, 10);

      for (const company of companies) {
        if (processedCompanies.has(company.company_number)) continue;
        if (company.company_status !== 'active') continue;
        processedCompanies.add(company.company_number);

        const { officers } = await getCompanyOfficers(company.company_number);

        // Get company details for SIC codes (only if we have appointments to add)
        let industry: string | null = null;
        let companyDetailsChecked = false;

        for (const officer of officers) {
          if (!isExecutiveRole(officer.officer_role)) continue;
          if (officer.resigned_on) continue;
          if (!officer.appointed_on) continue;

          const appointedDate = new Date(officer.appointed_on);
          if (appointedDate < fromDate) continue;

          // Fetch company details once to get SIC codes
          if (!companyDetailsChecked) {
            companyDetailsChecked = true;
            const { company: companyDetails } = await getCompanyDetails(company.company_number);
            if (companyDetails?.sic_codes) {
              industry = getIndustryFromSicCodes(companyDetails.sic_codes);
            }
          }

          allSignals.push({
            company_name: company.company_name,
            company_domain: extractDomainFromName(),
            company_number: company.company_number,
            signal_title: `${officer.name} appointed as ${formatOfficerRole(officer.officer_role)}`,
            signal_detail: `New ${formatOfficerRole(officer.officer_role)} at ${company.company_name}. Appointed ${officer.appointed_on}.`,
            signal_url: `https://find-and-update.company-information.service.gov.uk/company/${company.company_number}/officers`,
            location: company.address?.locality || null,
            industry,
            officer_name: officer.name,
            officer_role: officer.officer_role,
            appointed_on: officer.appointed_on,
          });
        }

        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    console.log(`[Companies House] (Alt) Found ${allSignals.length} recent appointments`);
    return { signals: allSignals };
  } catch (error) {
    console.error('[Companies House] Alternative approach error:', error);
    return { signals: [], error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Sync leadership changes to the signals database
 */
export async function syncLeadershipChanges(daysBack: number = 1): Promise<{
  success: boolean;
  found: number;
  new: number;
  error?: string;
}> {
  // Check if API key is configured
  if (!process.env.COMPANIES_HOUSE_API_KEY) {
    console.log('[Companies House] API key not configured, skipping');
    return { success: true, found: 0, new: 0 };
  }

  const supabase = createAdminClient();

  const { signals, error } = await fetchRecentAppointments(daysBack);

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

  const newSignals = signals.filter(signal => {
    const hash = generateFingerprint(signal);
    return !existingHashes.has(hash);
  });

  if (newSignals.length === 0) {
    console.log('[Companies House] No new signals to insert');
    return { success: true, found: signals.length, new: 0 };
  }

  const signalsToInsert = newSignals.map(signal => ({
    source_type: 'search' as const,
    source_id: null,
    search_run_id: null,
    signal_type: 'leadership_change' as const,
    company_name: signal.company_name,
    company_domain: signal.company_domain,
    signal_title: signal.signal_title,
    signal_detail: signal.signal_detail,
    signal_url: signal.signal_url,
    location: signal.location,
    industry: signal.industry,
    hash: generateFingerprint(signal),
    detected_at: new Date().toISOString(),
    is_new: true,
  }));

  const { error: insertError } = await supabase
    .from('signals')
    .upsert(signalsToInsert, { onConflict: 'hash', ignoreDuplicates: true });

  if (insertError) {
    console.error('[Companies House] Insert error:', insertError);
    return { success: false, found: signals.length, new: 0, error: insertError.message };
  }

  console.log(`[Companies House] Inserted ${newSignals.length} new signals`);
  return { success: true, found: signals.length, new: newSignals.length };
}
