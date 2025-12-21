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
  officer_name: string;
  officer_role: string;
  appointed_on: string;
}

function generateFingerprint(signal: LeadershipSignal): string {
  const str = `${signal.company_name}|${signal.signal_title}|${signal.signal_url}`;
  return Buffer.from(str).toString('base64').slice(0, 64);
}

function extractDomainFromName(companyName: string): string {
  const cleaned = companyName
    .toLowerCase()
    .replace(/\s+(ltd|limited|plc|llp|inc|corp|co|company)\.?$/i, '')
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 30);
  return cleaned ? `${cleaned}.co.uk` : '';
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
 * Fetch recent officer appointments across all companies
 * Note: Companies House doesn't have a direct "recent appointments" endpoint,
 * so we search for recently incorporated companies and check their officers.
 */
export async function fetchRecentAppointments(daysBack: number = 1): Promise<{
  signals: LeadershipSignal[];
  error?: string;
}> {
  // Since Companies House doesn't provide a direct endpoint for recent appointments,
  // we'll use the advanced search for recently incorporated companies
  // and look at their officers

  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - daysBack);
  const fromDateStr = fromDate.toISOString().split('T')[0];

  try {
    // Search for recently incorporated companies (a proxy for new appointments)
    const url = `${BASE_URL}/advanced-search/companies?incorporated_from=${fromDateStr}&size=50`;

    console.log(`[Companies House] Fetching new companies from ${fromDateStr}`);

    const response = await fetch(url, {
      headers: getAuthHeader(),
    });

    if (!response.ok) {
      // Advanced search might not be available without higher tier access
      console.log('[Companies House] Advanced search not available, skipping');
      return { signals: [] };
    }

    const data = await response.json();
    const allSignals: LeadershipSignal[] = [];

    // For each new company, get their officers
    for (const company of (data.items || []).slice(0, 20)) { // Limit to avoid rate limits
      const { officers } = await getCompanyOfficers(company.company_number);

      for (const officer of officers) {
        // Only include executive roles and recent appointments
        if (!isExecutiveRole(officer.officer_role)) continue;
        if (officer.resigned_on) continue; // Skip resigned officers

        const location = company.registered_office_address?.locality ||
          company.registered_office_address?.region ||
          null;

        allSignals.push({
          company_name: company.company_name,
          company_domain: extractDomainFromName(company.company_name),
          company_number: company.company_number,
          signal_title: `${officer.name} appointed as ${formatOfficerRole(officer.officer_role)}`,
          signal_detail: `New ${formatOfficerRole(officer.officer_role)} at ${company.company_name}`,
          signal_url: `https://find-and-update.company-information.service.gov.uk/company/${company.company_number}/officers`,
          location,
          officer_name: officer.name,
          officer_role: officer.officer_role,
          appointed_on: officer.appointed_on,
        });
      }

      // Rate limiting - wait between requests
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log(`[Companies House] Found ${allSignals.length} officer appointments`);
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
    industry: null,
    hash: generateFingerprint(signal),
    detected_at: new Date().toISOString(),
    is_new: true,
  }));

  const { error: insertError } = await supabase
    .from('signals')
    .insert(signalsToInsert);

  if (insertError) {
    console.error('[Companies House] Insert error:', insertError);
    return { success: false, found: signals.length, new: 0, error: insertError.message };
  }

  console.log(`[Companies House] Inserted ${newSignals.length} new signals`);
  return { success: true, found: signals.length, new: newSignals.length };
}
