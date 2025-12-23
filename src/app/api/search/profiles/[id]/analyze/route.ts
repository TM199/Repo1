/**
 * Analyze Search Profile - Connect to Pain Detection
 *
 * Takes a search profile, extracts keywords/locations, fetches jobs from Reed,
 * and triggers pain signal generation.
 *
 * POST /api/search/profiles/[id]/analyze
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import {
  fetchAllReedResults,
  isRecruitmentAgency,
  type ReedJob,
} from '@/lib/job-boards';
import { findOrCreateCompany } from '@/lib/companies/company-matcher';
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

function parseReedDate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    return dateStr.split('T')[0];
  }
  const ukMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (ukMatch) {
    const [, day, month, year] = ukMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  try {
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
  } catch {
    // Ignore parsing errors
  }
  return new Date().toISOString().split('T')[0];
}

function roundSalary(value: number | null): number | null {
  if (value === null) return null;
  return Math.round(value);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const adminSupabase = createAdminClient();

  // Get authenticated user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch the search profile
  const { data: profile, error: profileError } = await supabase
    .from('search_profiles')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json(
      { error: 'Profile not found' },
      { status: 404 }
    );
  }

  // Extract keywords from specific_roles
  const keywords: string[] = profile.specific_roles || [];
  const locations: string[] = profile.locations || ['London'];
  const industry = profile.industry;

  if (keywords.length === 0) {
    return NextResponse.json(
      { error: 'Profile has no specific roles to search' },
      { status: 400 }
    );
  }

  const stats = {
    profile_id: id,
    profile_name: profile.name,
    industry,
    keywords_searched: keywords.slice(0, 5),
    locations_searched: locations.slice(0, 3),
    jobs_fetched: 0,
    jobs_created: 0,
    jobs_updated: 0,
    companies_created: 0,
    agencies_skipped: 0,
    errors: [] as string[],
  };

  try {
    console.log(`[analyze] Starting analysis for profile ${id}: ${profile.name}`);
    console.log(`[analyze] Keywords: ${keywords.join(', ')} | Locations: ${locations.join(', ')}`);

    const allJobs: ReedJob[] = [];
    const seenJobIds = new Set<number>();

    // Fetch jobs for each keyword/location combo (limit to 5 keywords x 3 locations)
    for (const keyword of keywords.slice(0, 5)) {
      for (const location of locations.slice(0, 3)) {
        try {
          console.log(`[analyze] Fetching: "${keyword}" in ${location}`);

          const jobs = await fetchAllReedResults({
            keywords: keyword,
            locationName: location,
            postedWithin: 90,
            postedByDirectEmployer: true,
            maxResults: 100,
          });

          for (const job of jobs) {
            if (!seenJobIds.has(job.jobId)) {
              seenJobIds.add(job.jobId);
              allJobs.push(job);
            }
          }

          console.log(`[analyze] Found ${jobs.length} jobs for "${keyword}" in ${location}`);

          // Rate limiting
          await new Promise((r) => setTimeout(r, 200));
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          stats.errors.push(`${keyword} in ${location}: ${message}`);
        }
      }
    }

    stats.jobs_fetched = allJobs.length;
    console.log(`[analyze] Total unique jobs fetched: ${allJobs.length}`);

    // Process each job
    for (const reedJob of allJobs) {
      try {
        // Skip recruitment agencies
        if (isRecruitmentAgency(reedJob.employerName, reedJob.jobDescription)) {
          stats.agencies_skipped++;
          continue;
        }

        // Detect industry from title (or use profile industry as fallback)
        const detectedIndustry = detectIndustryFromTitle(reedJob.jobTitle);
        const jobIndustry = detectedIndustry !== 'Other' ? detectedIndustry : industry;

        // Find or create company
        const { company, match_type } = await findOrCreateCompany({
          name: reedJob.employerName,
          location: reedJob.locationName,
          industry: jobIndustry,
        });

        if (match_type === 'new') stats.companies_created++;

        // Generate fingerprint
        const fingerprint = generateJobFingerprint({
          title: reedJob.jobTitle,
          company_name: reedJob.employerName,
          location: reedJob.locationName,
        });

        // Check for existing job
        const { data: existingJob } = await adminSupabase
          .from('job_postings')
          .select('id')
          .eq('fingerprint', fingerprint)
          .single();

        if (existingJob) {
          // Update last_seen_at
          await adminSupabase
            .from('job_postings')
            .update({
              last_seen_at: new Date().toISOString(),
              is_active: true,
            })
            .eq('id', existingJob.id);
          stats.jobs_updated++;
          continue;
        }

        // Check for repost (similar job that was inactive)
        let previousPostingId: string | null = null;
        let salaryIncrease: number | null = null;
        let repostCount = 0;

        const { data: similarJobs } = await adminSupabase
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
                {
                  title: reedJob.jobTitle,
                  company_name: reedJob.employerName,
                  location: reedJob.locationName,
                },
                {
                  title: oldJob.title,
                  company_name: company.name,
                  location: oldJob.location || '',
                }
              )
            ) {
              previousPostingId = oldJob.id;
              repostCount = (oldJob.repost_count || 0) + 1;

              const salary = parseReedSalary(reedJob);
              salaryIncrease = calculateSalaryIncrease(
                oldJob.salary_min,
                oldJob.salary_max,
                salary.annual_min,
                salary.annual_max
              );
              break;
            }
          }
        }

        // Parse salary and referral bonus
        const salary = parseReedSalary(reedJob);
        const referralBonus = reedJob.jobDescription
          ? detectReferralBonus(reedJob.jobDescription)
          : { hasBonus: false, amount: null };

        // Insert job posting
        const { error: insertError } = await adminSupabase.from('job_postings').insert({
          company_id: company.id,
          reed_job_id: String(reedJob.jobId),
          fingerprint,
          title: reedJob.jobTitle,
          title_normalized: normalizeJobTitle(reedJob.jobTitle),
          location: reedJob.locationName,
          location_normalized: normalizeLocation(reedJob.locationName),
          salary_min: roundSalary(salary.annual_min),
          salary_max: roundSalary(salary.annual_max),
          salary_type: salary.salary_type,
          salary_normalized_annual: roundSalary(salary.annual_min),
          industry: jobIndustry,
          source: 'reed',
          source_url: reedJob.jobUrl,
          original_posted_date: parseReedDate(reedJob.date),
          repost_count: repostCount,
          previous_posting_id: previousPostingId,
          salary_increase_from_previous: roundSalary(salaryIncrease),
          mentions_referral_bonus: referralBonus.hasBonus,
          referral_bonus_amount: referralBonus.amount,
          raw_description: reedJob.jobDescription?.substring(0, 5000),
          employer_name_from_source: reedJob.employerName,
        });

        if (insertError) {
          throw new Error(`Insert failed: ${insertError.message}`);
        }

        stats.jobs_created++;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        stats.errors.push(`Job ${reedJob.jobId}: ${message}`);
      }
    }

    console.log('[analyze] Analysis complete:', stats);

    // Return success with redirect URL
    return NextResponse.json({
      success: true,
      stats,
      redirect_url: `/pain?industry=${encodeURIComponent(industry)}`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[analyze] Fatal error:', error);
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
