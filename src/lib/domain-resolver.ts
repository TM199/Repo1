/**
 * Domain Resolver Utility
 *
 * Attempts to find real company domains using multiple strategies:
 * 1. Clearbit Autocomplete API (free, high accuracy)
 * 2. Companies House lookup
 * 3. Google search extraction via Firecrawl
 * 4. DNS validation for guesses
 */

const COMPANIES_HOUSE_BASE = 'https://api.company-information.service.gov.uk';
const CLEARBIT_AUTOCOMPLETE = 'https://autocomplete.clearbit.com/v1/companies/suggest';

// Cache for domain lookups to avoid repeated API calls
const domainCache = new Map<string, DomainResolutionResult>();

export interface DomainResolutionResult {
  domain: string;
  source: 'clearbit' | 'companies_house' | 'google_search' | 'guessed' | 'none';
  confidence: number; // 0-100
}

/**
 * Clean company name for lookup
 */
function cleanCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+(ltd|limited|plc|llp|inc|corp|co|company|uk|group|holdings)\.?$/gi, '')
    .replace(/\s+(ltd|limited|plc|llp|inc|corp|co|company|uk|group|holdings)\.?\s+/gi, ' ')
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
 * Strategy 1: Use Clearbit's free autocomplete API
 * This is the most reliable method - high accuracy, free, no API key needed
 */
async function lookupViaClearbit(companyName: string): Promise<DomainResolutionResult | null> {
  try {
    const cleanedName = cleanCompanyName(companyName);
    const url = `${CLEARBIT_AUTOCOMPLETE}?query=${encodeURIComponent(cleanedName)}`;

    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) return null;

    const suggestions = await response.json();

    if (!suggestions || suggestions.length === 0) return null;

    // Find best match by comparing names
    const exactMatch = suggestions.find((s: { name: string; domain: string }) =>
      cleanCompanyName(s.name) === cleanedName
    );

    const bestMatch = exactMatch || suggestions[0];

    if (bestMatch?.domain) {
      return {
        domain: bestMatch.domain,
        source: 'clearbit',
        confidence: exactMatch ? 95 : 75
      };
    }

    return null;
  } catch (error) {
    console.error('[Domain Resolver] Clearbit lookup error:', error);
    return null;
  }
}

/**
 * Strategy 2: Search Companies House for website in filing data
 */
async function lookupViaCompaniesHouse(companyName: string): Promise<DomainResolutionResult | null> {
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

    // Find best match
    const cleanedInput = cleanCompanyName(companyName);
    const bestMatch = companies.find((c: { company_name: string }) =>
      cleanCompanyName(c.company_name) === cleanedInput
    ) || companies[0];

    // Get company details
    const companyNumber = bestMatch.company_number;
    const detailsUrl = `${COMPANIES_HOUSE_BASE}/company/${companyNumber}`;
    const detailsResponse = await fetch(detailsUrl, { headers });

    if (!detailsResponse.ok) return null;

    // Companies House doesn't return website directly
    // But we got the company number which confirms the company exists
    // Use this for Google search fallback
    return null;
  } catch (error) {
    console.error('[Domain Resolver] Companies House lookup error:', error);
    return null;
  }
}

/**
 * Strategy 3: Use Firecrawl to search Google for company website
 */
async function lookupViaGoogleSearch(companyName: string): Promise<DomainResolutionResult | null> {
  const firecrawlKey = process.env.FIRECRAWL_API_KEY;
  if (!firecrawlKey) return null;

  try {
    // Search Google for "[company name] official website"
    const searchQuery = `${companyName} official website UK`;
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;

    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: searchUrl,
        formats: ['markdown'],
        onlyMainContent: true,
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const content = data.data?.markdown || '';

    // Extract domains from search results
    // Look for patterns like "www.company.com" or "company.com"
    const domainPattern = /(?:https?:\/\/)?(?:www\.)?([a-z0-9][-a-z0-9]*(?:\.[a-z0-9][-a-z0-9]*)+)/gi;
    const matches = content.match(domainPattern) || [];

    // Filter out common non-company domains
    const excludedDomains = [
      'google.com', 'linkedin.com', 'facebook.com', 'twitter.com',
      'youtube.com', 'indeed.com', 'glassdoor.com', 'reed.co.uk',
      'gov.uk', 'wikipedia.org', 'companies-house.gov.uk'
    ];

    for (const match of matches) {
      const domain = match.replace(/^(?:https?:\/\/)?(?:www\.)?/i, '').toLowerCase();
      if (!excludedDomains.some(ex => domain.includes(ex))) {
        return {
          domain,
          source: 'google_search',
          confidence: 60
        };
      }
    }

    return null;
  } catch (error) {
    console.error('[Domain Resolver] Google search error:', error);
    return null;
  }
}

/**
 * Strategy 4: Intelligent guessing with DNS validation
 */
async function guessAndValidate(companyName: string): Promise<DomainResolutionResult | null> {
  const cleanedName = cleanCompanyName(companyName);

  // Generate potential domain guesses
  const guesses: string[] = [];

  // Try first word only (e.g., "MBDA UK Ltd" -> "mbda")
  const firstWord = cleanedName.split(/\s+/)[0];
  if (firstWord && firstWord.length > 2) {
    guesses.push(`${firstWord}.com`);
    guesses.push(`${firstWord}.co.uk`);
  }

  // Try full name without spaces
  const noSpaces = cleanedName.replace(/\s+/g, '');
  if (noSpaces.length <= 20) {
    guesses.push(`${noSpaces}.com`);
    guesses.push(`${noSpaces}.co.uk`);
  }

  // Try with hyphens
  const hyphenated = cleanedName.replace(/\s+/g, '-');
  if (hyphenated.length <= 25) {
    guesses.push(`${hyphenated}.com`);
  }

  // Validate each guess with DNS lookup
  for (const guess of guesses) {
    try {
      // Use a simple HEAD request to check if domain exists
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(`https://${guess}`, {
        method: 'HEAD',
        signal: controller.signal,
        redirect: 'manual'
      });

      clearTimeout(timeoutId);

      // If we get any response (including redirects), the domain exists
      if (response.status < 500) {
        return {
          domain: guess,
          source: 'guessed',
          confidence: 40
        };
      }
    } catch {
      // Domain doesn't exist or timed out, try next guess
      continue;
    }
  }

  return null;
}

/**
 * Validate if a domain likely exists (basic check)
 */
function isLikelyValidDomain(domain: string): boolean {
  if (!domain || !domain.includes('.') || domain.length < 4) return false;
  const domainPattern = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;
  return domainPattern.test(domain);
}

/**
 * Main domain resolution function - tries multiple strategies
 */
export async function resolveDomain(
  companyName: string,
  options?: {
    contactUrl?: string;
    skipLookup?: boolean;
    skipGoogle?: boolean;
  }
): Promise<DomainResolutionResult> {
  const cleanedName = cleanCompanyName(companyName);
  const cacheKey = cleanedName.toLowerCase();

  // Check cache first
  const cached = domainCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // If contact URL provided, extract domain
  if (options?.contactUrl) {
    try {
      const url = new URL(options.contactUrl);
      const domain = url.hostname.replace(/^www\./, '');
      if (isLikelyValidDomain(domain)) {
        const result: DomainResolutionResult = { domain, source: 'clearbit', confidence: 100 };
        domainCache.set(cacheKey, result);
        return result;
      }
    } catch {
      // Invalid URL, continue to other methods
    }
  }

  if (!options?.skipLookup) {
    // Strategy 1: Clearbit (free, most reliable)
    console.log(`[Domain Resolver] Trying Clearbit for: ${companyName}`);
    const clearbitResult = await lookupViaClearbit(companyName);
    if (clearbitResult) {
      domainCache.set(cacheKey, clearbitResult);
      return clearbitResult;
    }

    // Strategy 2: Companies House (UK companies)
    console.log(`[Domain Resolver] Trying Companies House for: ${companyName}`);
    const chResult = await lookupViaCompaniesHouse(companyName);
    if (chResult) {
      domainCache.set(cacheKey, chResult);
      return chResult;
    }

    // Strategy 3: Google Search via Firecrawl (if not skipped)
    if (!options?.skipGoogle) {
      console.log(`[Domain Resolver] Trying Google search for: ${companyName}`);
      const googleResult = await lookupViaGoogleSearch(companyName);
      if (googleResult) {
        domainCache.set(cacheKey, googleResult);
        return googleResult;
      }
    }

    // Strategy 4: Intelligent guessing with validation
    console.log(`[Domain Resolver] Trying DNS validation for: ${companyName}`);
    const guessResult = await guessAndValidate(companyName);
    if (guessResult) {
      domainCache.set(cacheKey, guessResult);
      return guessResult;
    }
  }

  // No domain found
  const noResult: DomainResolutionResult = { domain: '', source: 'none', confidence: 0 };
  domainCache.set(cacheKey, noResult);
  return noResult;
}

/**
 * Synchronous domain extraction - only use when API lookup not needed
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
  if (party.contactPoint?.url) {
    const domain = extractDomainFromUrl(party.contactPoint.url);
    if (domain) return domain;
  }

  if (party.identifier?.uri) {
    const domain = extractDomainFromUrl(party.identifier.uri);
    if (domain) return domain;
  }

  return '';
}
