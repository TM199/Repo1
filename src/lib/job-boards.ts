/**
 * Job Board Integration Module
 *
 * Provides direct access to UK job boards for finding active job postings.
 * Uses Reed API as primary source (has recruiter filter) with Indeed fallback.
 */

import Firecrawl from '@mendable/firecrawl-js';
import { ExtractedSignal } from '@/types';

// Types
export interface JobBoardSearchParams {
  keywords: string;
  location: string;
  postedWithin?: number; // days
  directEmployerOnly?: boolean;
  limit?: number;
}

export interface JobBoardResult {
  company_name: string;
  company_domain: string;
  signal_title: string;
  signal_detail: string;
  signal_url: string;
  job_description?: string;
  salary_range?: string;
  job_type?: string;
  posted_date?: string;
  source_board: 'reed' | 'indeed';
  is_direct_employer: boolean;
}

// Reed API response types
interface ReedJob {
  jobId: number;
  employerId: number;
  employerName: string;
  employerProfileId?: number;
  employerProfileName?: string;
  jobTitle: string;
  locationName: string;
  minimumSalary?: number;
  maximumSalary?: number;
  currency?: string;
  expirationDate: string;
  date: string;
  jobDescription: string;
  applications: number;
  jobUrl: string;
}

interface ReedSearchResponse {
  results: ReedJob[];
  totalResults: number;
}

// Constants
const REED_API_URL = 'https://www.reed.co.uk/api/1.0/search';

// Recruiter detection patterns
const RECRUITMENT_PATTERNS = [
  // Generic terms
  /recruit/i,
  /staffing/i,
  /talent\s*(acquisition|partner|solution)/i,
  /personnel/i,
  /resourcing/i,
  /employment\s*(agency|service)/i,

  // Known UK recruitment agencies
  /\bhays\b/i,
  /reed\s*employment/i,
  /michael\s*page/i,
  /robert\s*half/i,
  /randstad/i,
  /adecco/i,
  /manpower/i,
  /kelly\s*services/i,
  /page\s*group/i,
  /spencer\s*ogden/i,
  /la\s*fosse/i,
  /goodman\s*masson/i,
  /harvey\s*nash/i,
  /amber\s*employment/i,
  /blue\s*arrow/i,
  /pertemps/i,
  /search\s*consultancy/i,
];

// Job description patterns that indicate recruiter posting
const RECRUITER_DESCRIPTION_PATTERNS = [
  /on\s*behalf\s*of/i,
  /our\s*client/i,
  /confidential\s*client/i,
  /client\s*of\s*ours/i,
  /we\s*are\s*recruiting/i,
  /acting\s*on\s*behalf/i,
];

/**
 * Check if a company name indicates a recruitment agency
 */
export function isRecruitmentAgency(companyName: string, jobDescription?: string): boolean {
  // Check company name
  if (RECRUITMENT_PATTERNS.some((p) => p.test(companyName))) {
    return true;
  }

  // Check job description if provided
  if (jobDescription && RECRUITER_DESCRIPTION_PATTERNS.some((p) => p.test(jobDescription))) {
    return true;
  }

  return false;
}

/**
 * Extract company domain from company name (best effort)
 */
function inferDomainFromCompanyName(companyName: string): string {
  // Clean company name and create a domain guess
  const cleaned = companyName
    .toLowerCase()
    .replace(/\s*(ltd|limited|plc|inc|llc|group|holdings|uk)\s*/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();

  return cleaned ? `${cleaned}.com` : '';
}

/**
 * Format salary range for display
 */
function formatSalaryRange(min?: number, max?: number, currency?: string): string {
  if (!min && !max) return '';
  const curr = currency === 'GBP' ? '£' : currency || '£';
  if (min && max) {
    return `${curr}${min.toLocaleString()} - ${curr}${max.toLocaleString()}`;
  }
  if (min) return `${curr}${min.toLocaleString()}+`;
  if (max) return `Up to ${curr}${max?.toLocaleString()}`;
  return '';
}

/**
 * Transform Reed API response to our JobBoardResult format
 */
function transformReedJob(job: ReedJob): JobBoardResult {
  const salaryRange = formatSalaryRange(job.minimumSalary, job.maximumSalary, job.currency);

  return {
    company_name: job.employerName,
    company_domain: inferDomainFromCompanyName(job.employerName),
    signal_title: job.jobTitle,
    signal_detail: [job.locationName, salaryRange].filter(Boolean).join(' | '),
    signal_url: job.jobUrl,
    job_description: job.jobDescription,
    salary_range: salaryRange,
    posted_date: job.date,
    source_board: 'reed',
    is_direct_employer: true, // Reed API filters this
  };
}

/**
 * Search Reed.co.uk API for job postings
 */
export async function searchReed(params: JobBoardSearchParams): Promise<JobBoardResult[]> {
  const apiKey = process.env.REED_API_KEY;

  if (!apiKey) {
    console.warn('[job-boards] REED_API_KEY not configured, skipping Reed search');
    return [];
  }

  try {
    const url = new URL(REED_API_URL);
    url.searchParams.set('keywords', params.keywords);
    url.searchParams.set('locationName', params.location);
    url.searchParams.set('postedWithin', String(params.postedWithin || 7));
    url.searchParams.set('resultsToTake', String(params.limit || 20));

    if (params.directEmployerOnly) {
      url.searchParams.set('postedByDirectEmployer', 'true');
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${apiKey}:`).toString('base64'),
      },
    });

    if (!response.ok) {
      console.error('[job-boards] Reed API error:', response.status, response.statusText);
      return [];
    }

    const data: ReedSearchResponse = await response.json();
    console.log(`[job-boards] Reed returned ${data.results?.length || 0} jobs for "${params.keywords}" in "${params.location}"`);

    return (data.results || []).map(transformReedJob);
  } catch (error) {
    console.error('[job-boards] Reed search failed:', error);
    return [];
  }
}

/**
 * Search Indeed UK via Firecrawl scraping (fallback)
 */
export async function searchIndeed(params: JobBoardSearchParams): Promise<JobBoardResult[]> {
  const apiKey = process.env.FIRECRAWL_API_KEY;

  if (!apiKey) {
    console.warn('[job-boards] FIRECRAWL_API_KEY not configured, skipping Indeed search');
    return [];
  }

  try {
    const firecrawl = new Firecrawl({ apiKey: apiKey.trim() });

    // Build Indeed search URL
    const indeedUrl = new URL('https://uk.indeed.com/jobs');
    indeedUrl.searchParams.set('q', params.keywords);
    indeedUrl.searchParams.set('l', params.location);
    indeedUrl.searchParams.set('fromage', String(params.postedWithin || 7));
    indeedUrl.searchParams.set('sort', 'date');

    console.log(`[job-boards] Scraping Indeed: ${indeedUrl.toString()}`);

    const scrapeResult = await firecrawl.scrape(indeedUrl.toString(), {
      formats: [
        {
          type: 'json',
          prompt: `Extract all job listings from this Indeed search results page. For each job:
- company_name: The company posting the job (NOT a recruitment agency name if possible)
- job_title: The job title
- location: The job location
- salary: The salary if shown
- job_url: The URL to the job posting
- job_description: Brief description or snippet if visible

Return as JSON array. Focus on actual employers, not recruitment agencies.`,
          schema: {
            type: 'object',
            properties: {
              jobs: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    company_name: { type: 'string' },
                    job_title: { type: 'string' },
                    location: { type: 'string' },
                    salary: { type: 'string' },
                    job_url: { type: 'string' },
                    job_description: { type: 'string' },
                  },
                  required: ['company_name', 'job_title'],
                },
              },
            },
            required: ['jobs'],
          },
        },
      ],
    });

    interface IndeedJob {
      company_name: string;
      job_title: string;
      location?: string;
      salary?: string;
      job_url?: string;
      job_description?: string;
    }

    const jsonResult = scrapeResult.json as { jobs?: IndeedJob[] } | undefined;
    if (!jsonResult?.jobs) {
      console.log('[job-boards] Indeed scrape returned no jobs');
      return [];
    }

    console.log(`[job-boards] Indeed returned ${jsonResult.jobs.length} jobs`);

    // Transform and filter out recruiters
    const results: JobBoardResult[] = [];

    for (const job of jsonResult.jobs) {
      if (!job.company_name || !job.job_title) continue;

      const isRecruiter = isRecruitmentAgency(job.company_name, job.job_description);

      // Skip recruiters if directEmployerOnly is set
      if (params.directEmployerOnly && isRecruiter) {
        continue;
      }

      results.push({
        company_name: job.company_name,
        company_domain: inferDomainFromCompanyName(job.company_name),
        signal_title: job.job_title,
        signal_detail: [job.location, job.salary].filter(Boolean).join(' | '),
        signal_url: job.job_url || indeedUrl.toString(),
        job_description: job.job_description,
        salary_range: job.salary,
        source_board: 'indeed',
        is_direct_employer: !isRecruiter,
      });
    }

    return results;
  } catch (error) {
    console.error('[job-boards] Indeed search failed:', error);
    return [];
  }
}

/**
 * Search all job boards with Reed as primary and Indeed as fallback
 */
export async function searchJobBoards(params: {
  keywords: string[];
  locations: string[];
  postedWithin?: number;
  excludeRecruiters?: boolean;
  maxResults?: number;
}): Promise<ExtractedSignal[]> {
  const allResults: JobBoardResult[] = [];
  const seenKeys = new Set<string>();
  const maxResults = params.maxResults || 15;

  // Try Reed first for each keyword/location combo
  for (const keyword of params.keywords.slice(0, 3)) {
    for (const location of params.locations.slice(0, 2)) {
      if (allResults.length >= maxResults) break;

      const reedResults = await searchReed({
        keywords: keyword,
        location,
        postedWithin: params.postedWithin || 7,
        directEmployerOnly: params.excludeRecruiters !== false,
        limit: 10,
      });

      for (const result of reedResults) {
        const key = `${result.company_name}|${result.signal_title}`.toLowerCase();
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          allResults.push(result);
        }
      }

      // Rate limit
      await sleep(500);
    }
  }

  // If not enough results, try Indeed
  if (allResults.length < maxResults) {
    for (const keyword of params.keywords.slice(0, 2)) {
      for (const location of params.locations.slice(0, 1)) {
        if (allResults.length >= maxResults) break;

        const indeedResults = await searchIndeed({
          keywords: keyword,
          location,
          postedWithin: params.postedWithin || 7,
          directEmployerOnly: params.excludeRecruiters !== false,
          limit: 10,
        });

        for (const result of indeedResults) {
          const key = `${result.company_name}|${result.signal_title}`.toLowerCase();
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            allResults.push(result);
          }
        }

        await sleep(500);
      }
    }
  }

  // Transform to ExtractedSignal format
  return allResults.slice(0, maxResults).map((job) => ({
    company_name: job.company_name,
    company_domain: job.company_domain,
    signal_title: job.signal_title,
    signal_detail: job.signal_detail,
    signal_url: job.signal_url,
  }));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================
// ENHANCED FUNCTIONS FOR V2.0 JOB INGESTION
// ============================================

// Export ReedJob type for use in cron jobs
export type { ReedJob };

/**
 * Get full job details from Reed (for description and additional data)
 */
export async function getReedJobDetails(jobId: number): Promise<ReedJob | null> {
  const apiKey = process.env.REED_API_KEY;

  if (!apiKey) {
    console.warn('[job-boards] REED_API_KEY not configured');
    return null;
  }

  try {
    const response = await fetch(`https://www.reed.co.uk/api/1.0/jobs/${jobId}`, {
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${apiKey}:`).toString('base64'),
      },
    });

    if (!response.ok) return null;

    return response.json();
  } catch (error) {
    console.error('[job-boards] getReedJobDetails failed:', error);
    return null;
  }
}

/**
 * Fetch all Reed results with pagination
 * Used by daily ingestion cron job
 */
export async function fetchAllReedResults(params: {
  keywords?: string;
  locationName?: string;
  postedWithin?: number;
  postedByDirectEmployer?: boolean;
  maxResults?: number;
}): Promise<ReedJob[]> {
  const apiKey = process.env.REED_API_KEY;

  if (!apiKey) {
    console.warn('[job-boards] REED_API_KEY not configured');
    return [];
  }

  const allJobs: ReedJob[] = [];
  const take = 100; // Reed max per page
  let skip = 0;
  const maxResults = params.maxResults || 1000;

  try {
    while (allJobs.length < maxResults) {
      const url = new URL(REED_API_URL);
      if (params.keywords) url.searchParams.set('keywords', params.keywords);
      if (params.locationName) url.searchParams.set('locationName', params.locationName);
      url.searchParams.set('postedWithin', String(params.postedWithin || 7));
      url.searchParams.set('resultsToTake', String(take));
      url.searchParams.set('resultsToSkip', String(skip));

      if (params.postedByDirectEmployer) {
        url.searchParams.set('postedByDirectEmployer', 'true');
      }

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: 'Basic ' + Buffer.from(`${apiKey}:`).toString('base64'),
        },
      });

      if (!response.ok) {
        console.error('[job-boards] Reed API pagination error:', response.status);
        break;
      }

      const data: ReedSearchResponse = await response.json();

      if (!data.results || data.results.length === 0) {
        break; // No more results
      }

      allJobs.push(...data.results);
      skip += take;

      // Rate limiting
      await sleep(100);

      // Break if we got less than requested (last page)
      if (data.results.length < take) {
        break;
      }
    }

    console.log(`[job-boards] fetchAllReedResults: Retrieved ${allJobs.length} jobs`);
    return allJobs.slice(0, maxResults);
  } catch (error) {
    console.error('[job-boards] fetchAllReedResults failed:', error);
    return allJobs;
  }
}

/**
 * Search Reed across multiple locations (for comprehensive ingestion)
 */
export async function searchReedMultipleLocations(params: {
  locations: string[];
  postedWithin?: number;
  postedByDirectEmployer?: boolean;
  maxPerLocation?: number;
}): Promise<ReedJob[]> {
  const allJobs: ReedJob[] = [];
  const seenJobIds = new Set<number>();

  for (const location of params.locations) {
    try {
      const jobs = await fetchAllReedResults({
        locationName: location,
        postedWithin: params.postedWithin || 7,
        postedByDirectEmployer: params.postedByDirectEmployer ?? true,
        maxResults: params.maxPerLocation || 200,
      });

      // Dedupe across locations
      for (const job of jobs) {
        if (!seenJobIds.has(job.jobId)) {
          seenJobIds.add(job.jobId);
          allJobs.push(job);
        }
      }

      // Rate limit between locations
      await sleep(200);
    } catch (error) {
      console.error(`[job-boards] Error fetching Reed jobs for ${location}:`, error);
    }
  }

  console.log(`[job-boards] searchReedMultipleLocations: ${allJobs.length} unique jobs across ${params.locations.length} locations`);
  return allJobs;
}
