// Generate consistent fingerprints for job matching across sources

import crypto from 'crypto';
import {
  normalizeCompanyName,
  calculateSimilarity,
} from '@/lib/companies/company-matcher';

interface JobFingerprintInput {
  title: string;
  company_name: string;
  location: string;
}

/**
 * Normalize job title for matching
 * Handles common variations: Sr/Senior, Jr/Junior, etc.
 */
export function normalizeJobTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\bsr\.?\b/g, 'senior')
    .replace(/\bjr\.?\b/g, 'junior')
    .replace(/\bmgr\.?\b/g, 'manager')
    .replace(/\beng\.?\b/g, 'engineer')
    .replace(/\bdev\.?\b/g, 'developer')
    .replace(/\bqty\.?\b/g, 'quantity')
    .replace(/\bsurv\.?\b/g, 'surveyor')
    .replace(/\bproj\.?\b/g, 'project')
    .replace(/\bexec\.?\b/g, 'executive')
    .replace(/\basst\.?\b/g, 'assistant')
    .replace(/\bco\.?\b/g, 'company')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalize location for matching
 */
export function normalizeLocation(location: string): string {
  return location
    .toLowerCase()
    .replace(/\buk\b/gi, '')
    .replace(/\bunited kingdom\b/gi, '')
    .replace(/\bengland\b/gi, '')
    .replace(/\bscotland\b/gi, '')
    .replace(/\bwales\b/gi, '')
    .replace(/\bnorthern ireland\b/gi, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Generate a fingerprint hash for a job posting
 * Used to detect the same job across sources and over time
 */
export function generateJobFingerprint(input: JobFingerprintInput): string {
  const normalizedTitle = normalizeJobTitle(input.title);
  const normalizedCompany = normalizeCompanyName(input.company_name);
  const normalizedLocation = normalizeLocation(input.location);

  const fingerprintString = `${normalizedTitle}|${normalizedCompany}|${normalizedLocation}`;

  return crypto
    .createHash('sha256')
    .update(fingerprintString)
    .digest('hex')
    .substring(0, 32);
}

/**
 * Check if two jobs are likely the same (for repost detection)
 * More lenient than fingerprint - allows for title variations
 */
export function areJobsSimilar(
  job1: JobFingerprintInput,
  job2: JobFingerprintInput,
  threshold: number = 85
): boolean {
  // Same fingerprint = definitely same job
  if (generateJobFingerprint(job1) === generateJobFingerprint(job2)) {
    return true;
  }

  // Check company match (must be same company)
  const company1 = normalizeCompanyName(job1.company_name);
  const company2 = normalizeCompanyName(job2.company_name);

  if (company1 !== company2) {
    return false;
  }

  // Check location match (must be same general area)
  const location1 = normalizeLocation(job1.location);
  const location2 = normalizeLocation(job2.location);

  if (
    location1 !== location2 &&
    !location1.includes(location2) &&
    !location2.includes(location1)
  ) {
    return false;
  }

  // Check title similarity using Levenshtein
  const title1 = normalizeJobTitle(job1.title);
  const title2 = normalizeJobTitle(job2.title);

  return calculateSimilarity(title1, title2) >= threshold;
}

/**
 * Extract key terms from job title for industry detection
 */
export function extractJobTitleKeywords(title: string): string[] {
  const normalized = normalizeJobTitle(title);
  const keywords = normalized.split(' ').filter((word) => word.length > 2);
  return keywords;
}
