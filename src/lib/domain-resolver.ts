/**
 * Domain Resolver Utility
 *
 * Attempts to find real company domains instead of guessing.
 * Uses Companies House API to look up company websites when available.
 * Falls back to empty string instead of guessing.
 */

const COMPANIES_HOUSE_BASE = 'https://api.company-information.service.gov.uk';

// Cache for domain lookups to avoid repeated API calls
const domainCache = new Map<string, string>();

/**
 * Clean company name for lookup
 */
function cleanCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+(ltd|limited|plc|llp|inc|corp|co|company)\.?$/i, '')
    .trim();
}

/**
 * Get auth header for Companies House API
 */
function getAuthHeader(): Record<string, string> | null {
  const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
  if (!apiKey) return null;

  const credentials = Buffer.from(`${apiKey}:`).toString('base64');
  return {
    'Authorization': `Basic ${credentials}`,
    'Accept': 'application/json',
  };
}

/**
 * Search Companies House for a company and try to find its website
 */
async function lookupCompanyDomain(companyName: string): Promise<string | null> {
  const headers = getAuthHeader();
  if (!headers) return null;

  try {
    // Search for company
    const searchUrl = `${COMPANIES_HOUSE_BASE}/search/companies?q=${encodeURIComponent(companyName)}&items_per_page=5`;
    const searchResponse = await fetch(searchUrl, { headers });

    if (!searchResponse.ok) return null;

    const searchData = await searchResponse.json();
    const companies = searchData.items || [];

    if (companies.length === 0) return null;

    // Find best match (exact or close match)
    const cleanedInput = cleanCompanyName(companyName);
    const bestMatch = companies.find((c: { company_name: string }) =>
      cleanCompanyName(c.company_name) === cleanedInput
    ) || companies[0];

    // Get company details for website
    const companyNumber = bestMatch.company_number;
    const detailsUrl = `${COMPANIES_HOUSE_BASE}/company/${companyNumber}`;
    const detailsResponse = await fetch(detailsUrl, { headers });

    if (!detailsResponse.ok) return null;

    const company = await detailsResponse.json();

    // Companies House doesn't directly provide website, but we can try the registered company profile
    // The website might be in filing_history or linked data
    // For now, return null if no direct website available

    return null;
  } catch (error) {
    console.error('[Domain Resolver] Lookup error:', error);
    return null;
  }
}

/**
 * Validate if a domain likely exists (basic check)
 */
function isLikelyValidDomain(domain: string): boolean {
  // Must have at least one dot and reasonable length
  if (!domain || !domain.includes('.') || domain.length < 4) return false;

  // Basic pattern check
  const domainPattern = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;
  return domainPattern.test(domain);
}

/**
 * Try to extract domain from various sources
 * Returns empty string if domain cannot be reliably determined
 */
export async function resolveDomain(
  companyName: string,
  options?: {
    contactUrl?: string;  // URL from contact info if available
    skipLookup?: boolean; // Skip Companies House lookup
  }
): Promise<string> {
  const cleanedName = cleanCompanyName(companyName);

  // Check cache first
  if (domainCache.has(cleanedName)) {
    return domainCache.get(cleanedName) || '';
  }

  // If contact URL provided, try to extract domain
  if (options?.contactUrl) {
    try {
      const url = new URL(options.contactUrl);
      const domain = url.hostname.replace(/^www\./, '');
      if (isLikelyValidDomain(domain)) {
        domainCache.set(cleanedName, domain);
        return domain;
      }
    } catch {
      // Invalid URL, continue to other methods
    }
  }

  // Try Companies House lookup if not skipped
  if (!options?.skipLookup && process.env.COMPANIES_HOUSE_API_KEY) {
    const lookedUpDomain = await lookupCompanyDomain(companyName);
    if (lookedUpDomain && isLikelyValidDomain(lookedUpDomain)) {
      domainCache.set(cleanedName, lookedUpDomain);
      return lookedUpDomain;
    }
  }

  // Don't guess - return empty string
  // This is better than a wrong domain because:
  // 1. Enrichment will fail gracefully with empty domain
  // 2. UI can show "domain unknown" status
  // 3. User can manually add correct domain later
  domainCache.set(cleanedName, '');
  return '';
}

/**
 * Synchronous domain extraction - only use when API lookup not needed
 * Returns empty string instead of guessing
 */
export function extractDomainFromUrl(url: string): string {
  if (!url) return '';

  try {
    const parsed = new URL(url);
    const domain = parsed.hostname.replace(/^www\./, '');
    return isLikelyValidDomain(domain) ? domain : '';
  } catch {
    return '';
  }
}

/**
 * Extract domain if contact info URL is available in OCDS parties
 */
export function extractDomainFromOCDSParty(party: {
  contactPoint?: { url?: string };
  identifier?: { uri?: string; scheme?: string; id?: string };
}): string {
  // Try contact URL first
  if (party.contactPoint?.url) {
    const domain = extractDomainFromUrl(party.contactPoint.url);
    if (domain) return domain;
  }

  // Try identifier URI
  if (party.identifier?.uri) {
    const domain = extractDomainFromUrl(party.identifier.uri);
    if (domain) return domain;
  }

  return '';
}
