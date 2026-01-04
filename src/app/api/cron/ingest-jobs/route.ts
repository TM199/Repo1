/**
 * Job Ingestion Cron Job
 *
 * Fetches jobs from Reed, creates companies, and tracks job
 * fingerprints for staleness and repost detection.
 *
 * Schedule: every 4 hours
 */

export const maxDuration = 300; // 5 minutes (Vercel Pro)

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import {
  searchReedMultipleKeywords,
  isRecruitmentAgency,
} from '@/lib/job-boards';
import {
  searchAdzunaMultipleKeywords,
  mapAdzunaCategoryToIndustry,
  parseAdzunaDate,
  type AdzunaJob,
} from '@/lib/adzuna';
import { findOrCreateCompany, updateCompanyAgencyPattern } from '@/lib/companies/company-matcher';
import {
  generateJobFingerprint,
  areJobsSimilar,
  normalizeJobTitle,
  normalizeLocation,
} from '@/lib/jobs/job-fingerprint';
import {
  parseReedSalary,
  calculateSalaryIncrease,
  detectReferralBonus,
} from '@/lib/jobs/salary-normalizer';
import { classifyJobByDepartment } from '@/lib/jobs/department-classifier';
import { detectUrgencyLevel, hasUrgencyKeywords } from '@/lib/jobs/urgency-detector';
// Domain resolution removed from bulk ingestion - done on-demand via enrichment endpoints

// Default UK regions (used if no ICP profiles exist)
const DEFAULT_UK_REGIONS = [
  'London',
  'Manchester',
  'Birmingham',
  'Leeds',
  'Bristol',
];

// Location groups for distributed cron scheduling (prevents timeout)
const LOCATION_GROUPS: Record<string, string[]> = {
  london: ['London'],
  major: ['Manchester', 'Birmingham', 'Leeds', 'Bristol'],
  regional: ['Newcastle', 'Nottingham', 'Cardiff', 'Glasgow', 'Edinburgh', 'Liverpool', 'Sheffield'],
};

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

/**
 * Get unique roles/keywords from all active ICP profiles
 */
async function getICPRoles(supabase: ReturnType<typeof createAdminClient>): Promise<string[]> {
  const { data: profiles } = await supabase
    .from('icp_profiles')
    .select('specific_roles, signal_types')
    .eq('is_active', true);

  if (!profiles || profiles.length === 0) {
    console.log('[ingest-jobs] No active ICP profiles, no roles to search');
    return [];
  }

  // Collect unique roles from profiles that have 'job_pain' enabled
  const allRoles = new Set<string>();
  for (const profile of profiles) {
    const signalTypes = profile.signal_types || [];
    if (signalTypes.includes('job_pain')) {
      for (const role of profile.specific_roles || []) {
        allRoles.add(role);
      }
    }
  }

  const roles = Array.from(allRoles);
  console.log(`[ingest-jobs] Found ${roles.length} unique roles from ${profiles.length} ICP profiles`);
  return roles;
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

  // Get location group from query parameter (for distributed cron scheduling)
  const group = request.nextUrl.searchParams.get('group');
  // Get source filter (reed, adzuna, or both if not specified)
  const sourceParam = request.nextUrl.searchParams.get('source') as 'reed' | 'adzuna' | null;
  const runReed = !sourceParam || sourceParam === 'reed';
  const runAdzuna = !sourceParam || sourceParam === 'adzuna';

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
    console.log(`[ingest-jobs] Starting job ingestion${group ? ` (group: ${group})` : ''}...`);

    // ==========================================
    // STEP 0: Get ICP-driven configuration
    // ==========================================
    let icpLocations = await getICPLocations(supabase);
    const icpIndustries = await getICPIndustries(supabase);

    // Filter by location group if specified (for distributed cron scheduling)
    if (group && LOCATION_GROUPS[group]) {
      const groupLocations = LOCATION_GROUPS[group];
      icpLocations = icpLocations.filter(loc =>
        groupLocations.some(g => loc.toLowerCase().includes(g.toLowerCase()))
      );
      console.log(`[ingest-jobs] Group "${group}" - filtered to: ${icpLocations.join(', ') || 'none'}`);

      // Use group defaults if no ICP locations match this group
      if (icpLocations.length === 0) {
        icpLocations = groupLocations;
        console.log(`[ingest-jobs] Group "${group}" - using defaults: ${icpLocations.join(', ')}`);
      }
    }

    // Get ICP-specific roles/keywords to search for
    const icpRoles = await getICPRoles(supabase);

    console.log(`[ingest-jobs] ICP Config - Locations: ${icpLocations.join(', ')}`);
    console.log(`[ingest-jobs] ICP Config - Industries: ${icpIndustries.size > 0 ? Array.from(icpIndustries).join(', ') : 'All'}`);
    console.log(`[ingest-jobs] ICP Config - Roles: ${icpRoles.length > 0 ? icpRoles.join(', ') : 'None'}`);

    // Skip if no roles configured
    if (icpRoles.length === 0) {
      console.log('[ingest-jobs] No ICP roles configured, skipping job ingestion');
      return NextResponse.json({
        success: true,
        message: 'No ICP roles configured',
        stats,
        timestamp: new Date().toISOString(),
      });
    }

    // ==========================================
    // STEP 1: Fetch and process Reed jobs
    // ==========================================
    let processed = 0;
    let flaggedAgency = 0;
    let skippedIndustry = 0;

    if (runReed) {
      console.log(`[ingest-jobs] Fetching Reed jobs for ${icpRoles.length} roles...`);

      const reedJobs = await searchReedMultipleKeywords({
        keywords: icpRoles,
        locations: icpLocations,
        postedWithin: 365,
        directEmployerOnly: true,
        limitPerSearch: 500, // Get more results per search
      });

      stats.reed_jobs_fetched = reedJobs.length;
      console.log(`[ingest-jobs] Fetched ${reedJobs.length} Reed jobs`);
      console.log('[ingest-jobs] Processing Reed jobs...');

      for (const reedJob of reedJobs) {
        try {
          // Flag agency pattern but still ingest (no skip)
          const isLikelyAgency = isRecruitmentAgency(reedJob.employerName, reedJob.jobDescription);
          if (isLikelyAgency) {
            flaggedAgency++;
          }

          const detectedIndustry = detectIndustryFromTitle(reedJob.jobTitle);

          if (icpIndustries.size > 0 && !icpIndustries.has(detectedIndustry) && detectedIndustry !== 'Other') {
            skippedIndustry++;
            continue;
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
            detectedIndustry,
            isLikelyAgency,
          }, stats);

          processed++;

          if (processed % 200 === 0) {
            console.log(`[ingest-jobs] Reed progress: ${processed}/${reedJobs.length} processed`);
          }
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          stats.errors.push(`Reed job ${reedJob.jobId}: ${message}`);
        }
      }

      console.log(`[ingest-jobs] Reed complete: ${processed} processed, ${flaggedAgency} agencies flagged, ${skippedIndustry} industry mismatch`);
    } else {
      console.log('[ingest-jobs] Skipping Reed (source filter)');
    }

    // ==========================================
    // STEP 2: Fetch and process Adzuna jobs
    // ==========================================
    let adzunaProcessed = 0;
    let adzunaFlaggedAgency = 0;
    let adzunaSkippedIndustry = 0;

    if (runAdzuna) {
      console.log(`[ingest-jobs] Fetching Adzuna jobs for ${icpRoles.length} roles across ${icpLocations.length} locations...`);

      const adzunaJobs = await searchAdzunaMultipleKeywords({
        keywords: icpRoles,
        locations: icpLocations,
        maxDaysOld: 60,
      });

      stats.adzuna_jobs_fetched = adzunaJobs.length;
      console.log(`[ingest-jobs] Fetched ${adzunaJobs.length} Adzuna jobs`);

      for (const adzunaJob of adzunaJobs) {
        try {
          // Skip jobs with missing required fields
          if (!adzunaJob.company?.display_name || !adzunaJob.location?.display_name) {
            continue;
          }

          // Flag agency pattern but still ingest (no skip)
          const isLikelyAgency = isRecruitmentAgency(adzunaJob.company.display_name, adzunaJob.description);
          if (isLikelyAgency) {
            adzunaFlaggedAgency++;
          }

          const detectedIndustry = adzunaJob.category?.tag
            ? mapAdzunaCategoryToIndustry(adzunaJob.category.tag)
            : detectIndustryFromTitle(adzunaJob.title);

          if (icpIndustries.size > 0 && !icpIndustries.has(detectedIndustry) && detectedIndustry !== 'Other') {
            adzunaSkippedIndustry++;
            continue;
          }

          await processJob(supabase, {
            source: 'adzuna',
            sourceId: adzunaJob.id,
            title: adzunaJob.title,
            companyName: adzunaJob.company.display_name,
            location: adzunaJob.location.display_name,
            postedDate: parseAdzunaDate(adzunaJob.created) || adzunaJob.created,
            sourceUrl: adzunaJob.redirect_url,
            description: adzunaJob.description,
            salary: {
              annual_min: adzunaJob.salary_min ? Math.round(adzunaJob.salary_min) : null,
              annual_max: adzunaJob.salary_max ? Math.round(adzunaJob.salary_max) : null,
              salary_type: 'annual',
              confidence: adzunaJob.salary_is_predicted === '0' ? 'high' : 'low',
            },
            detectedIndustry,
            contractType: adzunaJob.contract_type,
            isLikelyAgency,
          }, stats);

          adzunaProcessed++;

          if (adzunaProcessed % 200 === 0) {
            console.log(`[ingest-jobs] Adzuna progress: ${adzunaProcessed}/${adzunaJobs.length} processed`);
          }
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          stats.errors.push(`Adzuna job ${adzunaJob.id}: ${message}`);
        }
      }

      console.log(`[ingest-jobs] Adzuna complete: ${adzunaProcessed} processed, ${adzunaFlaggedAgency} agencies flagged, ${adzunaSkippedIndustry} industry mismatch`);
    } else {
      console.log('[ingest-jobs] Skipping Adzuna (source filter)');
    }

    // ==========================================
    // STEP 3: Mark stale jobs as inactive
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
    isLikelyAgency?: boolean;
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
  // NOTE: Companies now created in signal generation (per user)
  // This route is deprecated - use Inngest ingest-jobs function instead

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
    // Update last_seen_at - single DB call for existing jobs
    await supabase
      .from('job_postings')
      .update({
        last_seen_at: new Date().toISOString(),
        is_active: true,
      })
      .eq('id', existingJob.id);

    // Skip job_observations for bulk ingestion (reduces DB calls by 50%)
    // Observations can be reconstructed from last_seen_at timestamps if needed

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
    .eq('employer_name_from_source', job.companyName)
    .eq('is_active', false)
    .order('last_seen_at', { ascending: false })
    .limit(10);

  if (similarJobs) {
    for (const oldJob of similarJobs) {
      if (
        areJobsSimilar(
          { title: job.title, company_name: job.companyName, location: job.location },
          { title: oldJob.title, company_name: job.companyName, location: oldJob.location || '' }
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

  // Sprint 3: Classify department and detect urgency
  const department = classifyJobByDepartment(job.title);
  const urgencyLevel = job.description ? detectUrgencyLevel(job.description) : null;
  const hasUrgency = job.description ? hasUrgencyKeywords(job.description) : false;

  // Insert new job posting
  const { error: insertError } = await supabase.from('job_postings').insert({
    company_id: null, // Companies created per-user in signal generation
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
    // Sprint 3: Department and urgency fields
    department,
    urgency_level: urgencyLevel,
    has_urgency_keywords: hasUrgency,
  });

  if (insertError) {
    throw new Error(`Insert failed: ${insertError.message}`);
  }

  stats.new_jobs_created++;
}
