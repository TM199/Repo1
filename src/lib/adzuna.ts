/**
 * Adzuna Job Board API Integration
 *
 * Provides access to UK job listings from Adzuna.
 * Used alongside Reed for comprehensive job market coverage.
 */

// Types
export interface AdzunaJob {
  id: string;
  title: string;
  description: string;
  created: string; // ISO format: "2026-01-01T09:06:03Z"
  company: {
    display_name: string;
  };
  location: {
    display_name: string;
    area?: string[];
  };
  latitude?: number;
  longitude?: number;
  salary_min?: number;
  salary_max?: number;
  salary_is_predicted?: string; // "0" = actual, "1" = predicted
  contract_type?: 'permanent' | 'contract';
  contract_time?: 'full_time' | 'part_time';
  category?: {
    label: string;
    tag: string;
  };
  redirect_url: string;
}

export interface AdzunaSearchResponse {
  count: number;
  mean?: number;
  results: AdzunaJob[];
}

// Constants
const ADZUNA_BASE_URL = 'https://api.adzuna.com/v1/api';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Get job count from Adzuna API (count-only, uses 1 API call)
 * Returns count without fetching job data
 */
export async function getAdzunaJobCount(what: string, where: string): Promise<number> {
  const appId = process.env.ADZUNA_APP_ID;
  const apiKey = process.env.ADZUNA_API_KEY;

  if (!appId || !apiKey) {
    console.warn('[adzuna] ADZUNA_APP_ID or ADZUNA_API_KEY not configured');
    return 0;
  }

  const params = new URLSearchParams({
    app_id: appId,
    app_key: apiKey,
    what,
    where,
    results_per_page: '1', // Minimal fetch - just need count
    max_days_old: '60',
  });

  try {
    const url = `${ADZUNA_BASE_URL}/jobs/gb/search/1?${params}`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`[adzuna] Count API error: ${response.status}`);
      return 0;
    }

    const data: AdzunaSearchResponse = await response.json();
    return data.count || 0;
  } catch (error) {
    console.error('[adzuna] getAdzunaJobCount failed:', error);
    return 0;
  }
}

/**
 * Search Adzuna for jobs
 * If where is empty/undefined, searches all UK without location filter
 */
export async function searchAdzunaJobs(options: {
  what?: string;
  where?: string; // Optional - if not provided, searches all UK
  maxDaysOld?: number;
  resultsPerPage?: number;
  page?: number;
  permanent?: boolean;
  contract?: boolean;
  sortBy?: 'date' | 'salary' | 'relevance';
}): Promise<AdzunaSearchResponse> {
  const appId = process.env.ADZUNA_APP_ID;
  const apiKey = process.env.ADZUNA_API_KEY;

  if (!appId || !apiKey) {
    console.warn('[adzuna] ADZUNA_APP_ID or ADZUNA_API_KEY not configured');
    return { count: 0, results: [] };
  }

  const page = options.page || 1;
  const resultsPerPage = options.resultsPerPage || 50;

  const params = new URLSearchParams({
    app_id: appId,
    app_key: apiKey,
    results_per_page: String(resultsPerPage),
    sort_by: options.sortBy || 'date',
  });

  // Only add where param if location is specified
  if (options.where) params.append('where', options.where);
  if (options.what) params.append('what', options.what);
  if (options.maxDaysOld) params.append('max_days_old', String(options.maxDaysOld));
  if (options.permanent) params.append('permanent', '1');
  if (options.contract) params.append('contract', '1');

  try {
    const url = `${ADZUNA_BASE_URL}/jobs/gb/search/${page}?${params}`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`[adzuna] API error: ${response.status} ${response.statusText}`);
      return { count: 0, results: [] };
    }

    const data: AdzunaSearchResponse = await response.json();
    return data;
  } catch (error) {
    console.error('[adzuna] Search failed:', error);
    return { count: 0, results: [] };
  }
}

/**
 * Fetch all Adzuna results with pagination
 */
export async function fetchAllAdzunaResults(options: {
  what?: string;
  where?: string; // Optional - if not provided, searches all UK
  maxDaysOld?: number;
  maxResults?: number;
}): Promise<AdzunaJob[]> {
  const allJobs: AdzunaJob[] = [];
  const resultsPerPage = 50;
  let page = 1;
  const maxResults = options.maxResults || 1000;
  let totalAvailable = 0;

  while (allJobs.length < maxResults) {
    const response = await searchAdzunaJobs({
      what: options.what,
      where: options.where,
      maxDaysOld: options.maxDaysOld,
      resultsPerPage,
      page,
    });

    if (page === 1) {
      totalAvailable = response.count || 0;
      console.log(`[adzuna] ${totalAvailable} total jobs available for "${options.where}"`);
    }

    if (!response.results || response.results.length === 0) {
      break;
    }

    allJobs.push(...response.results);
    page++;

    // Rate limiting - 200ms between requests
    await sleep(200);

    // Break if we got less than requested (last page)
    if (response.results.length < resultsPerPage) {
      break;
    }

    // Safety limit - Adzuna's max is around 1000 results per search
    if (page > 20) {
      console.log('[adzuna] Hit page limit (20)');
      break;
    }
  }

  const coverage = totalAvailable > 0 ? Math.round((allJobs.length / totalAvailable) * 100) : 100;
  console.log(`[adzuna] Retrieved ${allJobs.length}/${totalAvailable} jobs (${coverage}% coverage)`);

  return allJobs.slice(0, maxResults);
}

/**
 * Search Adzuna across multiple locations for a keyword
 * Sequential with rate limiting to avoid 429 errors
 * Limited to first page (50 results) per location to fit within timeout
 * If locations is empty, searches all UK without location filter
 */
export async function searchAdzunaForKeyword(options: {
  what?: string;
  locations: string[];
  maxDaysOld?: number;
}): Promise<AdzunaJob[]> {
  const allJobs: AdzunaJob[] = [];
  const seenJobIds = new Set<string>();

  // If no locations specified, do a single search without location filter
  if (options.locations.length === 0) {
    try {
      const response = await searchAdzunaJobs({
        what: options.what,
        // No where param = all UK
        maxDaysOld: options.maxDaysOld || 60,
        resultsPerPage: 50,
        page: 1,
      });

      if (response.results) {
        for (const job of response.results) {
          if (!seenJobIds.has(job.id)) {
            seenJobIds.add(job.id);
            allJobs.push(job);
          }
        }
      }

      console.log(`[adzuna] searchAdzunaForKeyword("${options.what || 'all'}"): ${allJobs.length} jobs (all UK)`);
      return allJobs;
    } catch (error) {
      console.error(`[adzuna] Search error (all UK):`, error);
      return [];
    }
  }

  // Process locations sequentially to respect rate limits
  for (const location of options.locations) {
    try {
      // Single page (50 results) per location to avoid timeout
      const response = await searchAdzunaJobs({
        what: options.what,
        where: location,
        maxDaysOld: options.maxDaysOld || 60,
        resultsPerPage: 50,
        page: 1,
      });

      if (response.results) {
        for (const job of response.results) {
          if (!seenJobIds.has(job.id)) {
            seenJobIds.add(job.id);
            allJobs.push(job);
          }
        }
      }

      // Rate limit: 400ms between requests
      await sleep(400);
    } catch (error) {
      console.error(`[adzuna] Search error for ${location}:`, error);
    }
  }

  console.log(`[adzuna] searchAdzunaForKeyword("${options.what || 'all'}"): ${allJobs.length} unique jobs`);
  return allJobs;
}

/**
 * Search Adzuna across multiple locations
 */
export async function searchAdzunaMultipleLocations(options: {
  locations: string[];
  maxDaysOld?: number;
  maxPerLocation?: number;
}): Promise<AdzunaJob[]> {
  const allJobs: AdzunaJob[] = [];
  const seenJobIds = new Set<string>();

  for (const location of options.locations) {
    try {
      const jobs = await fetchAllAdzunaResults({
        where: location,
        maxDaysOld: options.maxDaysOld || 30,
        maxResults: options.maxPerLocation || 500,
      });

      // Dedupe across locations
      for (const job of jobs) {
        if (!seenJobIds.has(job.id)) {
          seenJobIds.add(job.id);
          allJobs.push(job);
        }
      }

      // Rate limit between locations
      await sleep(200);
    } catch (error) {
      console.error(`[adzuna] Error fetching jobs for ${location}:`, error);
    }
  }

  console.log(`[adzuna] searchAdzunaMultipleLocations: ${allJobs.length} unique jobs across ${options.locations.length} locations`);
  return allJobs;
}

/**
 * Search Adzuna for multiple keywords across locations
 * Sequential processing with rate limiting to avoid 429 errors
 */
export async function searchAdzunaMultipleKeywords(options: {
  keywords: string[];
  locations: string[];
  maxDaysOld?: number;
}): Promise<AdzunaJob[]> {
  const allJobs: AdzunaJob[] = [];
  const seenJobIds = new Set<string>();

  // Process keywords sequentially to respect rate limits
  for (let i = 0; i < options.keywords.length; i++) {
    const keyword = options.keywords[i];

    const jobs = await searchAdzunaForKeyword({
      what: keyword,
      locations: options.locations,
      maxDaysOld: options.maxDaysOld || 60,
    });

    for (const job of jobs) {
      if (!seenJobIds.has(job.id)) {
        seenJobIds.add(job.id);
        allJobs.push(job);
      }
    }

    // 500ms delay between keywords
    if (i < options.keywords.length - 1) {
      await sleep(500);
    }

    console.log(`[adzuna] Processed ${i + 1}/${options.keywords.length} keywords, ${allJobs.length} unique jobs so far`);
  }

  console.log(`[adzuna] searchAdzunaMultipleKeywords: ${allJobs.length} unique jobs for ${options.keywords.length} keywords`);
  return allJobs;
}

/**
 * Map Adzuna category tag to industry
 */
export function mapAdzunaCategoryToIndustry(tag?: string): string {
  if (!tag) return 'Other';

  const mapping: Record<string, string> = {
    'it-jobs': 'Technology & Software',
    'engineering-jobs': 'Engineering & Manufacturing',
    'accounting-finance-jobs': 'Financial Services',
    'healthcare-nursing-jobs': 'Healthcare & Life Sciences',
    'legal-jobs': 'Legal & Professional Services',
    'trade-construction-jobs': 'Construction & Infrastructure',
    'energy-oil-gas-jobs': 'Energy & Utilities',
    'logistics-warehouse-jobs': 'Logistics & Supply Chain',
    'retail-jobs': 'Retail & Consumer',
    'teaching-jobs': 'Education',
    'hospitality-catering-jobs': 'Hospitality & Leisure',
    'property-jobs': 'Property & Real Estate',
    'sales-jobs': 'Other',
    'admin-jobs': 'Other',
    'hr-jobs': 'Other',
    'consultancy-jobs': 'Legal & Professional Services',
    'pr-advertising-marketing-jobs': 'Other',
    'scientific-qa-jobs': 'Healthcare & Life Sciences',
  };

  return mapping[tag] || 'Other';
}

/**
 * Parse Adzuna ISO date to YYYY-MM-DD format
 */
export function parseAdzunaDate(dateStr: string): string | null {
  if (!dateStr) return null;

  try {
    // Adzuna uses ISO format: "2026-01-01T09:06:03Z"
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
    return null;
  } catch {
    return null;
  }
}
