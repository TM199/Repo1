/**
 * Adzuna API Integration
 *
 * Free UK job board API for supplementing Reed data.
 * API docs: https://developer.adzuna.com
 */

// Environment variables
const ADZUNA_APP_ID = process.env.ADZUNA_APP_ID;
const ADZUNA_API_KEY = process.env.ADZUNA_API_KEY;
const ADZUNA_BASE_URL = 'https://api.adzuna.com/v1/api/jobs/gb';

// Types
export interface AdzunaSearchParams {
  keywords?: string;
  location?: string;
  category?: string;
  max_days_old?: number;
  results_per_page?: number;
  page?: number;
  full_time?: boolean;
  permanent?: boolean;
  contract?: boolean;
}

export interface AdzunaJob {
  id: string;
  title: string;
  description: string;
  company: {
    display_name: string;
  };
  location: {
    display_name: string;
    area: string[];
  };
  salary_min?: number;
  salary_max?: number;
  salary_is_predicted?: boolean;
  created: string; // ISO date
  redirect_url: string;
  contract_time?: string; // 'full_time' | 'part_time'
  contract_type?: string; // 'permanent' | 'contract'
  category: {
    label: string;
    tag: string;
  };
}

interface AdzunaSearchResponse {
  results: AdzunaJob[];
  count: number;
  mean: number;
  __CLASS__: string;
}

// Category mapping to Signal Mentis industries
const CATEGORY_TO_INDUSTRY: Record<string, string> = {
  'it-jobs': 'Technology & Software',
  'engineering-jobs': 'Engineering & Manufacturing',
  'accounting-finance-jobs': 'Financial Services',
  'healthcare-nursing-jobs': 'Healthcare & Life Sciences',
  'construction-jobs': 'Construction & Infrastructure',
  'legal-jobs': 'Legal & Professional Services',
  'hr-jobs': 'Legal & Professional Services',
  'logistics-warehouse-jobs': 'Logistics & Supply Chain',
  'manufacturing-jobs': 'Engineering & Manufacturing',
  'property-jobs': 'Property & Real Estate',
  'sales-jobs': 'Other',
  'marketing-jobs': 'Other',
  'admin-jobs': 'Other',
  'hospitality-catering-jobs': 'Hospitality & Leisure',
  'energy-oil-gas-jobs': 'Energy & Utilities',
  'teaching-jobs': 'Education',
  'retail-jobs': 'Retail & Consumer',
  'social-work-jobs': 'Healthcare & Life Sciences',
  'scientific-qa-jobs': 'Healthcare & Life Sciences',
  'consultancy-jobs': 'Legal & Professional Services',
};

/**
 * Check if Adzuna API is configured
 */
export function isAdzunaConfigured(): boolean {
  return Boolean(ADZUNA_APP_ID && ADZUNA_API_KEY);
}

/**
 * Map Adzuna category to Signal Mentis industry
 */
export function mapCategoryToIndustry(categoryTag: string): string {
  return CATEGORY_TO_INDUSTRY[categoryTag] || 'Other';
}

/**
 * Get all Adzuna category codes for comprehensive coverage
 */
export function getAllCategories(): string[] {
  return Object.keys(CATEGORY_TO_INDUSTRY);
}

/**
 * Search Adzuna for jobs
 */
export async function searchAdzunaJobs(
  params: AdzunaSearchParams
): Promise<AdzunaJob[]> {
  if (!ADZUNA_APP_ID || !ADZUNA_API_KEY) {
    console.warn('[adzuna] API credentials not configured, skipping');
    return [];
  }

  try {
    const queryParams = new URLSearchParams({
      app_id: ADZUNA_APP_ID,
      app_key: ADZUNA_API_KEY,
      results_per_page: String(params.results_per_page || 50),
    });

    // Add optional parameters
    if (params.keywords) queryParams.set('what', params.keywords);
    if (params.location) queryParams.set('where', params.location);
    if (params.category) queryParams.set('category', params.category);
    if (params.max_days_old) queryParams.set('max_days_old', String(params.max_days_old));
    if (params.full_time) queryParams.set('full_time', '1');
    if (params.permanent) queryParams.set('permanent', '1');
    if (params.contract) queryParams.set('contract', '1');

    const page = params.page || 1;
    const url = `${ADZUNA_BASE_URL}/search/${page}?${queryParams.toString()}`;

    const response = await fetch(url);

    if (!response.ok) {
      console.error('[adzuna] API error:', response.status, response.statusText);
      return [];
    }

    const data: AdzunaSearchResponse = await response.json();
    console.log(
      `[adzuna] Search returned ${data.results?.length || 0} jobs` +
        (params.category ? ` for category "${params.category}"` : '')
    );

    return data.results || [];
  } catch (error) {
    console.error('[adzuna] Search failed:', error);
    return [];
  }
}

/**
 * Fetch all pages of results for a search
 */
export async function fetchAllAdzunaResults(
  params: AdzunaSearchParams,
  maxPages: number = 10
): Promise<AdzunaJob[]> {
  if (!isAdzunaConfigured()) {
    return [];
  }

  const allJobs: AdzunaJob[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore && page <= maxPages) {
    const jobs = await searchAdzunaJobs({ ...params, page });

    if (jobs.length === 0) {
      hasMore = false;
    } else {
      allJobs.push(...jobs);
      page++;

      // Respect rate limits
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  console.log(`[adzuna] fetchAllAdzunaResults: Retrieved ${allJobs.length} jobs`);
  return allJobs;
}

/**
 * Search Adzuna across all categories (for comprehensive ingestion)
 */
export async function searchAdzunaAllCategories(params: {
  max_days_old?: number;
  maxPagesPerCategory?: number;
}): Promise<AdzunaJob[]> {
  if (!isAdzunaConfigured()) {
    console.warn('[adzuna] API not configured, skipping category search');
    return [];
  }

  const allJobs: AdzunaJob[] = [];
  const seenJobIds = new Set<string>();
  const categories = getAllCategories();

  for (const category of categories) {
    try {
      const jobs = await fetchAllAdzunaResults(
        {
          category,
          max_days_old: params.max_days_old || 7,
        },
        params.maxPagesPerCategory || 3
      );

      // Dedupe across categories
      for (const job of jobs) {
        if (!seenJobIds.has(job.id)) {
          seenJobIds.add(job.id);
          allJobs.push(job);
        }
      }

      // Rate limit between categories
      await new Promise((resolve) => setTimeout(resolve, 300));
    } catch (error) {
      console.error(`[adzuna] Error fetching category ${category}:`, error);
    }
  }

  console.log(
    `[adzuna] searchAdzunaAllCategories: ${allJobs.length} unique jobs across ${categories.length} categories`
  );
  return allJobs;
}
