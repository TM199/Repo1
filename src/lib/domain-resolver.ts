/**
 * Domain Resolver Utility
 *
 * Attempts to find real company domains using multiple strategies:
 * 1. Extract from URL (if contactUrl provided) - 100% confidence
 * 2. Google search extraction via Firecrawl - 60% confidence
 * 3. DNS validation for guesses - 40% confidence
 *
 * Note: Clearbit was removed (acquired by HubSpot, free tier unreliable)
 */

// Cache for domain lookups to avoid repeated API calls
const domainCache = new Map<string, DomainResolutionResult>();

export interface DomainResolutionResult {
  domain: string;
  source: 'url_extract' | 'google_search' | 'guessed' | 'none';
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
 * Strategy 1: Use Firecrawl to search Google for company website
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

      // Skip if it's an IP address
      if (isIPAddress(domain)) continue;

      // Skip if domain doesn't contain letters (IPs and garbage data)
      if (!/[a-z]/i.test(domain)) continue;

      // Skip excluded domains
      if (excludedDomains.some(ex => domain.includes(ex))) continue;

      // Validate it looks like a real domain
      if (isLikelyValidDomain(domain)) {
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
 * Strategy 2: Intelligent guessing with DNS validation
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
 * Check if a string is an IP address
 */
export function isIPAddress(str: string): boolean {
  // IPv4 pattern
  const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Pattern.test(str)) {
    // Validate each octet is 0-255
    const octets = str.split('.');
    return octets.every(o => {
      const num = parseInt(o, 10);
      return num >= 0 && num <= 255;
    });
  }
  return false;
}

/**
 * Validate if a domain likely exists (basic check)
 * Rejects IP addresses - we only want actual domain names
 */
function isLikelyValidDomain(domain: string): boolean {
  if (!domain || !domain.includes('.') || domain.length < 4) return false;

  // Reject IP addresses - we want actual domains, not IPs
  if (isIPAddress(domain)) return false;

  // Domain must contain at least one letter (IPs are all digits + dots)
  if (!/[a-z]/i.test(domain)) return false;

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
    skipCache?: boolean;
  }
): Promise<DomainResolutionResult> {
  const cleanedName = cleanCompanyName(companyName);
  const cacheKey = cleanedName.toLowerCase();

  // Check cache first (unless skipped)
  if (!options?.skipCache) {
    const cached = domainCache.get(cacheKey);
    if (cached) {
      // Validate cached domain isn't an IP (legacy data cleanup)
      if (!cached.domain || !isIPAddress(cached.domain)) {
        return cached;
      }
      // Clear invalid cache entry containing IP
      console.log(`[Domain Resolver] Clearing cached IP for: ${companyName}`);
      domainCache.delete(cacheKey);
    }
  }

  // Strategy 1: If contact URL provided, extract domain (100% confidence)
  if (options?.contactUrl) {
    try {
      const url = new URL(options.contactUrl);
      const domain = url.hostname.replace(/^www\./, '');
      if (isLikelyValidDomain(domain)) {
        const result: DomainResolutionResult = { domain, source: 'url_extract', confidence: 100 };
        domainCache.set(cacheKey, result);
        return result;
      }
    } catch {
      // Invalid URL, continue to other methods
    }
  }

  if (!options?.skipLookup) {
    // Strategy 2: Google Search via Firecrawl (60% confidence)
    if (!options?.skipGoogle) {
      console.log(`[Domain Resolver] Trying Google search for: ${companyName}`);
      const googleResult = await lookupViaGoogleSearch(companyName);
      if (googleResult) {
        domainCache.set(cacheKey, googleResult);
        return googleResult;
      }
    }

    // Strategy 3: Intelligent guessing with DNS validation (40% confidence)
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
