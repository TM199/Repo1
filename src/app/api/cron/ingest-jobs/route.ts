/**
 * Job Ingestion Cron Job
 *
 * Daily job that fetches jobs from Reed and Adzuna, creates companies,
 * and tracks job fingerprints for staleness and repost detection.
 *
 * Schedule: 0 6 * * * (6am daily)
 */

export const maxDuration = 300; // 5 minutes (Vercel Pro)

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import {
  searchReedMultipleLocations,
  isRecruitmentAgency,
  type ReedJob,
} from '@/lib/job-boards';
import {
  searchAdzunaAllCategories,
  isAdzunaConfigured,
  mapCategoryToIndustry,
  type AdzunaJob,
} from '@/lib/adzuna';
import { findOrCreateCompany } from '@/lib/companies/company-matcher';
import {
  generateJobFingerprint,
  areJobsSimilar,
  normalizeJobTitle,
  normalizeLocation,
} from '@/lib/jobs/job-fingerprint';
import {
  parseReedSalary,
  parseAdzunaSalary,
  calculateSalaryIncrease,
  detectReferralBonus,
} from '@/lib/jobs/salary-normalizer';

// Default UK regions (used if no ICP profiles exist)
const DEFAULT_UK_REGIONS = [
  'London',
  'Manchester',
  'Birmingham',
  'Leeds',
  'Bristol',
];

/**
 * Get unique locations from all active ICP profiles
 */
async function getICPLocations(supabase: ReturnType<typeof createAdminClient>): Promise<string[]> {
  const { data: profiles } = await supabase
    .from('icp_profiles')
    .select('locations')
    .eq('is_active', true);

  if (!profiles || profiles.length === 0) {
    console.log('[ingest-jobs] No active ICP profiles, using default locations');
    return DEFAULT_UK_REGIONS;
  }

  // Collect unique locations from all profiles
  const allLocations = new Set<string>();
  for (const profile of profiles) {
    for (const location of profile.locations || []) {
      allLocations.add(location);
    }
  }

  const locations = Array.from(allLocations);
  console.log(`[ingest-jobs] Found ${locations.length} unique locations from ${profiles.length} ICP profiles`);
  return locations.length > 0 ? locations : DEFAULT_UK_REGIONS;
}

/**
 * Get industries that should be tracked based on active ICPs
 */
async function getICPIndustries(supabase: ReturnType<typeof createAdminClient>): Promise<Set<string>> {
  const { data: profiles } = await supabase
    .from('icp_profiles')
    .select('industries, signal_types')
    .eq('is_active', true);

  if (!profiles || profiles.length === 0) {
    return new Set(); // Empty = allow all industries
  }

  // Only include industries from profiles that have 'job_pain' enabled
  const industries = new Set<string>();
  for (const profile of profiles) {
    const signalTypes = profile.signal_types || [];
    if (signalTypes.includes('job_pain')) {
      for (const industry of profile.industries || []) {
        industries.add(industry);
      }
    }
  }

  return industries;
}

// Industry detection from job titles
const INDUSTRY_PATTERNS: Record<string, RegExp[]> = {
  'Technology & Software': [
    /\b(developer|engineer|devops|software|frontend|backend|full.?stack|data scientist|machine learning|ai|cloud|architect|sre|platform)\b/i,
  ],
  'Construction & Infrastructure': [
    /\b(site manager|quantity surveyor|project manager|contracts manager|civil|groundworks|construction|surveyor|estimator|bim|clerk of works|site engineer)\b/i,
  ],
  'Healthcare & Life Sciences': [
    /\b(nurse|doctor|clinical|healthcare|medical|pharmacist|care manager|therapist|surgeon|consultant|gp|nhs)\b/i,
  ],
  'Financial Services': [
    /\b(accountant|auditor|financial|banker|analyst|compliance|risk|actuary|underwriter|fund manager|wealth|investment)\b/i,
  ],
  'Legal & Professional Services': [
    /\b(solicitor|lawyer|paralegal|legal|barrister|conveyancer|litigation|partner.*law)\b/i,
  ],
  'Engineering & Manufacturing': [
    /\b(mechanical engineer|electrical engineer|manufacturing|production|quality|cnc|maintenance engineer|plant manager|process engineer)\b/i,
  ],
  'Energy & Utilities': [
    /\b(renewable|solar|wind|energy|utilities|oil|gas|nuclear|grid|power|sustainability|carbon)\b/i,
  ],
  'Logistics & Supply Chain': [
    /\b(warehouse|logistics|supply chain|transport|fleet|distribution|freight|procurement|buyer)\b/i,
  ],
  'Retail & Consumer': [
    /\b(store manager|retail|merchandiser|buyer.*retail|e.?commerce|category manager)\b/i,
  ],
  Education: [
    /\b(teacher|headteacher|lecturer|professor|education|school|senco|teaching assistant)\b/i,
  ],
  'Hospitality & Leisure': [
    /\b(hotel|restaurant|chef|hospitality|events manager|general manager.*hotel|catering)\b/i,
  ],
  'Property & Real Estate': [
    /\b(estate agent|property manager|lettings|surveyor.*property|development manager|asset manager)\b/i,
  ],
};

/**
 * Detect industry from job title
 */
function detectIndustryFromTitle(title: string): string {
  for (const [industry, patterns] of Object.entries(INDUSTRY_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(title)) {
        return industry;
      }
    }
  }
  return 'Other';
}

/**
 * Parse Reed date format (can be "dd/mm/yyyy", ISO, or other formats)
 */
function parseReedDate(dateStr: string): string | null {
  if (!dateStr) return null;

  try {
    // Try UK format first (dd/mm/yyyy with optional time)
    // Reed uses this format
    const ukMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (ukMatch) {
      const [, day, month, year] = ukMatch;
      const parsed = new Date(Number(year), Number(month) - 1, Number(day));
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0];
      }
    }

    // Try ISO format (2024-12-23 or 2024-12-23T00:00:00)
    const isoMatch = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      const [, year, month, day] = isoMatch;
      const parsed = new Date(Number(year), Number(month) - 1, Number(day));
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0];
      }
    }

    // Last resort: try native Date parsing
    const nativeDate = new Date(dateStr);
    if (!isNaN(nativeDate.getTime())) {
      return nativeDate.toISOString().split('T')[0];
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Verify cron secret
 */
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  return authHeader === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(request: NextRequest) {
  // Verify authorization
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const stats = {
    reed_jobs_fetched: 0,
    adzuna_jobs_fetched: 0,
    new_jobs_created: 0,
    existing_jobs_updated: 0,
    reposts_detected: 0,
    salary_increases_detected: 0,
    companies_created: 0,
    errors: [] as string[],
  };

  try {
    console.log('[ingest-jobs] Starting job ingestion...');

    // ==========================================
    // STEP 0: Get ICP-driven configuration
    // ==========================================
    const icpLocations = await getICPLocations(supabase);
    const icpIndustries = await getICPIndustries(supabase);

    console.log(`[ingest-jobs] ICP Config - Locations: ${icpLocations.join(', ')}`);
    console.log(`[ingest-jobs] ICP Config - Industries: ${icpIndustries.size > 0 ? Array.from(icpIndustries).join(', ') : 'All'}`);

    // ==========================================
    // STEP 1: Fetch jobs from Reed
    // ==========================================
    console.log('[ingest-jobs] Fetching Reed jobs...');

    const reedJobs = await searchReedMultipleLocations({
      locations: icpLocations, // Full locations - 800s timeout in Vercel settings
      postedWithin: 7,
      postedByDirectEmployer: true,
      maxPerLocation: 200, // Higher limit for comprehensive ingestion
    });

    stats.reed_jobs_fetched = reedJobs.length;
    console.log(`[ingest-jobs] Fetched ${reedJobs.length} Reed jobs`);

    // ==========================================
    // STEP 2: Adzuna disabled (API not working reliably)
    // ==========================================
    const adzunaJobs: AdzunaJob[] = [];
    console.log('[ingest-jobs] Adzuna disabled - using Reed only');

    // ==========================================
    // STEP 3: Process Reed jobs
    // ==========================================
    console.log('[ingest-jobs] Processing Reed jobs...');

    for (const reedJob of reedJobs) {
      try {
        // Skip recruitment agencies
        if (isRecruitmentAgency(reedJob.employerName, reedJob.jobDescription)) {
          continue;
        }

        // Detect industry from job title
        const detectedIndustry = detectIndustryFromTitle(reedJob.jobTitle);

        // Filter by ICP industries if any are configured
        if (icpIndustries.size > 0 && !icpIndustries.has(detectedIndustry) && detectedIndustry !== 'Other') {
          continue; // Skip jobs not matching ICP industries
        }

        await processJob(supabase, {
          source: 'reed',
          sourceId: String(reedJob.jobId),
          title: reedJob.jobTitle,
          companyName: reedJob.employerName,
          location: reedJob.locationName,
          postedDate: reedJob.date,
          sourceUrl: reedJob.jobUrl,
          description: reedJob.jobDescription,
          salary: parseReedSalary(reedJob),
          detectedIndustry, // Already detected above
        }, stats);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        stats.errors.push(`Reed job ${reedJob.jobId}: ${message}`);
      }
    }

    // ==========================================
    // STEP 4: Process Adzuna jobs
    // ==========================================
    console.log('[ingest-jobs] Processing Adzuna jobs...');

    for (const adzunaJob of adzunaJobs) {
      try {
        // Skip recruitment agencies
        if (
          isRecruitmentAgency(
            adzunaJob.company?.display_name || '',
            adzunaJob.description
          )
        ) {
          continue;
        }

        const industry =
          detectIndustryFromTitle(adzunaJob.title) ||
          mapCategoryToIndustry(adzunaJob.category?.tag);

        await processJob(supabase, {
          source: 'adzuna',
          sourceId: adzunaJob.id,
          title: adzunaJob.title,
          companyName: adzunaJob.company?.display_name || 'Unknown',
          location: adzunaJob.location?.display_name || '',
          postedDate: adzunaJob.created,
          sourceUrl: adzunaJob.redirect_url,
          description: adzunaJob.description,
          salary: parseAdzunaSalary(adzunaJob),
          detectedIndustry: industry,
          contractType: adzunaJob.contract_type,
        }, stats);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        stats.errors.push(`Adzuna job ${adzunaJob.id}: ${message}`);
      }
    }

    // ==========================================
    // STEP 5: Mark stale jobs as inactive
    // ==========================================
    console.log('[ingest-jobs] Marking stale jobs as inactive...');

    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const { error: staleError } = await supabase
      .from('job_postings')
      .update({ is_active: false })
      .lt('last_seen_at', threeDaysAgo.toISOString())
      .eq('is_active', true);

    if (staleError) {
      stats.errors.push(`Stale job update error: ${staleError.message}`);
    }

    console.log('[ingest-jobs] Job ingestion complete');

    return NextResponse.json({
      success: true,
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[ingest-jobs] Fatal error:', error);
    return NextResponse.json(
      {
        success: false,
        error: message,
        stats,
      },
      { status: 500 }
    );
  }
}

/**
 * Process a single job from either source
 */
async function processJob(
  supabase: ReturnType<typeof createAdminClient>,
  job: {
    source: 'reed' | 'adzuna';
    sourceId: string;
    title: string;
    companyName: string;
    location: string;
    postedDate: string;
    sourceUrl: string;
    description?: string;
    salary: {
      annual_min: number | null;
      annual_max: number | null;
      salary_type: string;
      confidence: string;
    };
    detectedIndustry: string;
    contractType?: string;
  },
  stats: {
    new_jobs_created: number;
    existing_jobs_updated: number;
    reposts_detected: number;
    salary_increases_detected: number;
    companies_created: number;
    errors: string[];
  }
) {
  // Find or create company
  const { company, match_type } = await findOrCreateCompany({
    name: job.companyName,
    location: job.location,
    industry: job.detectedIndustry,
  });

  if (match_type === 'new') {
    stats.companies_created++;
  }

  // Generate fingerprint
  const fingerprint = generateJobFingerprint({
    title: job.title,
    company_name: job.companyName,
    location: job.location,
  });

  // Check for existing job with same fingerprint
  const { data: existingJob } = await supabase
    .from('job_postings')
    .select('*')
    .eq('fingerprint', fingerprint)
    .single();

  if (existingJob) {
    // Update last_seen_at
    await supabase
      .from('job_postings')
      .update({
        last_seen_at: new Date().toISOString(),
        is_active: true,
      })
      .eq('id', existingJob.id);

    // Record observation
    await supabase.from('job_observations').insert({
      job_posting_id: existingJob.id,
      salary_min: job.salary.annual_min,
      salary_max: job.salary.annual_max,
      was_active: true,
    });

    stats.existing_jobs_updated++;
    return;
  }

  // Check for similar jobs (repost detection)
  let previousPostingId: string | null = null;
  let salaryIncrease: number | null = null;
  let repostCount = 0;

  const { data: similarJobs } = await supabase
    .from('job_postings')
    .select('*')
    .eq('company_id', company.id)
    .eq('is_active', false)
    .order('last_seen_at', { ascending: false })
    .limit(10);

  if (similarJobs) {
    for (const oldJob of similarJobs) {
      if (
        areJobsSimilar(
          { title: job.title, company_name: job.companyName, location: job.location },
          { title: oldJob.title, company_name: company.name, location: oldJob.location || '' }
        )
      ) {
        previousPostingId = oldJob.id;
        repostCount = (oldJob.repost_count || 0) + 1;
        salaryIncrease = calculateSalaryIncrease(
          oldJob.salary_min,
          oldJob.salary_max,
          job.salary.annual_min,
          job.salary.annual_max
        );

        if (repostCount > 0) stats.reposts_detected++;
        if (salaryIncrease && salaryIncrease > 10) stats.salary_increases_detected++;

        break;
      }
    }
  }

  // Check for referral bonus
  const referralBonus = job.description
    ? detectReferralBonus(job.description)
    : { hasBonus: false, amount: null };

  // Insert new job posting
  const { error: insertError } = await supabase.from('job_postings').insert({
    company_id: company.id,
    reed_job_id: job.source === 'reed' ? job.sourceId : null,
    adzuna_job_id: job.source === 'adzuna' ? job.sourceId : null,
    fingerprint,
    title: job.title,
    title_normalized: normalizeJobTitle(job.title),
    location: job.location,
    location_normalized: normalizeLocation(job.location),
    salary_min: job.salary.annual_min,
    salary_max: job.salary.annual_max,
    salary_type: job.salary.salary_type,
    salary_normalized_annual: job.salary.annual_min,
    contract_type: job.contractType,
    industry: job.detectedIndustry,
    source: job.source,
    source_url: job.sourceUrl,
    original_posted_date: parseReedDate(job.postedDate),
    repost_count: repostCount,
    previous_posting_id: previousPostingId,
    salary_increase_from_previous: salaryIncrease,
    mentions_referral_bonus: referralBonus.hasBonus,
    referral_bonus_amount: referralBonus.amount,
    raw_description: job.description?.substring(0, 5000),
    employer_name_from_source: job.companyName,
  });

  if (insertError) {
    throw new Error(`Insert failed: ${insertError.message}`);
  }

  stats.new_jobs_created++;
}
