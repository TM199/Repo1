/**
 * ICP Profile Scan API
 *
 * Triggers immediate data collection for a specific ICP profile.
 * Called after profile creation to populate initial data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/server';
import {
  searchReedParallel,
  searchReedMultipleKeywords,
  UK_NATIONAL_LOCATIONS,
  isRecruitmentAgency,
  filterByEmploymentType,
} from '@/lib/job-boards';
import { getRoleSearchTerms } from '@/lib/role-variations';
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
import { fetchContractAwards } from '@/lib/contracts-finder';
import { fetchFTSAwards } from '@/lib/find-a-tender';
import { ICPProfile } from '@/types';
import {
  PAIN_SCORES,
  determineJobSignalType,
  generateSignalTitle,
  generateSignalDetail
} from '@/lib/signals/detection';
import { queueExpansionTasks } from '@/lib/scan-queue';
import { randomUUID } from 'crypto';

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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const adminClient = createAdminClient();

  // Verify user owns this profile
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from('icp_profiles')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  const icpProfile = profile as ICPProfile;

  const stats = {
    jobs_fetched: 0,
    jobs_processed: 0,
    companies_created: 0,
    signals_generated: 0,
    contracts_found: 0,
    contracts_matched: 0,
    expansion_tasks_queued: 0,
    errors: [] as string[],
  };

  try {
    console.log(`[ICP Scan] Starting scan for profile: ${icpProfile.name}`);

    // Only scan if job_pain signal type is enabled
    if (!icpProfile.signal_types.includes('job_pain')) {
      return NextResponse.json({
        success: true,
        message: 'Job pain signals not enabled for this profile',
        stats,
      });
    }

    // Get locations and roles from profile
    const locations = icpProfile.locations.length > 0
      ? icpProfile.locations
      : ['London', 'Manchester', 'Birmingham'];

    const roles = icpProfile.specific_roles || [];
    const employmentType = icpProfile.employment_type || 'both';

    if (roles.length === 0) {
      console.log(`[ICP Scan] No specific roles defined, skipping job search`);
      return NextResponse.json({
        success: true,
        message: 'No specific roles defined for this profile',
        stats,
      });
    }

    // Use parallel search across locations for better performance
    // Include UK national locations for broader coverage
    const searchLocations = locations.length > 0
      ? [...new Set([...locations, ...UK_NATIONAL_LOCATIONS.slice(0, 5)])]
      : UK_NATIONAL_LOCATIONS;

    console.log(`[ICP Scan] Searching for ${roles.length} roles across ${searchLocations.length} locations (parallel)`);

    // Set scan status to 'scanning'
    await adminClient
      .from('icp_profiles')
      .update({ scan_status: 'scanning' })
      .eq('id', id);

    const allReedJobs: Array<{
      jobId: number;
      employerName: string;
      jobTitle: string;
      locationName: string;
      jobDescription: string;
      jobUrl: string;
      date: string;
      minimumSalary?: number;
      maximumSalary?: number;
      applications: number;
      expirationDate: string;
      currency?: string;
    }> = [];
    const seenJobIds = new Set<number>();

    // Build search keywords from roles (top 2 variations per role)
    const searchKeywords: string[] = [];
    const searchedRoles: string[] = [];
    for (const role of roles.slice(0, 5)) {
      const searchTerms = getRoleSearchTerms(role);
      // Use top 2 variations
      searchKeywords.push(...searchTerms.slice(0, 2));
      searchedRoles.push(...searchTerms.slice(0, 2));
    }

    // Parallel search across all locations with multiple keywords
    try {
      const jobs = await searchReedMultipleKeywords({
        keywords: [...new Set(searchKeywords)], // Dedupe keywords
        locations: searchLocations,
        postedWithin: 365, // Full year - captures old active jobs for immediate "hard to fill" signals
        directEmployerOnly: true,
        limitPerSearch: 500, // Get more jobs per search (pagination handles this)
      });

      // Jobs are already in ReedJob format
      for (const job of jobs) {
        if (!seenJobIds.has(job.jobId)) {
          seenJobIds.add(job.jobId);
          allReedJobs.push({
            jobId: job.jobId,
            employerName: job.employerName,
            jobTitle: job.jobTitle,
            locationName: job.locationName,
            jobDescription: job.jobDescription || '',
            jobUrl: job.jobUrl,
            date: job.date,
            minimumSalary: job.minimumSalary,
            maximumSalary: job.maximumSalary,
            applications: job.applications || 0,
            expirationDate: job.expirationDate || '',
            currency: job.currency || 'GBP',
          });
        }
      }
    } catch (err) {
      console.error('[ICP Scan] Error in parallel search:', err);
      stats.errors.push(`Parallel search error: ${err instanceof Error ? err.message : 'Unknown'}`);
    }

    console.log(`[ICP Scan] Found ${allReedJobs.length} unique jobs before filtering`);

    // Apply employment type filter
    const filteredJobs = filterByEmploymentType(allReedJobs, employmentType);
    console.log(`[ICP Scan] ${filteredJobs.length} jobs after employment type filter (${employmentType})`);

    stats.jobs_fetched = filteredJobs.length;

    // Process each job
    for (const reedJob of filteredJobs) {
      try {
        // Skip recruitment agencies
        if (isRecruitmentAgency(reedJob.employerName, reedJob.jobDescription)) {
          continue;
        }

        // Detect industry from job title
        const detectedIndustry = detectIndustryFromTitle(reedJob.jobTitle);

        // Find or create company
        const { company, match_type } = await findOrCreateCompany({
          name: reedJob.employerName,
          location: reedJob.locationName,
          industry: detectedIndustry,
        });

        if (match_type === 'new') {
          stats.companies_created++;
        }

        // Generate fingerprint
        const fingerprint = generateJobFingerprint({
          title: reedJob.jobTitle,
          company_name: reedJob.employerName,
          location: reedJob.locationName,
        });

        // Check for existing job
        const { data: existingJob } = await adminClient
          .from('job_postings')
          .select('*')
          .eq('fingerprint', fingerprint)
          .single();

        if (existingJob) {
          // Update last_seen_at
          await adminClient
            .from('job_postings')
            .update({
              last_seen_at: new Date().toISOString(),
              is_active: true,
            })
            .eq('id', existingJob.id);
          continue;
        }

        // Check for similar jobs (repost detection)
        let repostCount = 0;
        let previousPostingId: string | null = null;
        let salaryIncrease: number | null = null;

        const { data: similarJobs } = await adminClient
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
                { title: reedJob.jobTitle, company_name: reedJob.employerName, location: reedJob.locationName },
                { title: oldJob.title, company_name: company.name, location: oldJob.location || '' }
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

        // Parse salary and detect referral bonus
        const salary = parseReedSalary(reedJob);
        const referralBonus = detectReferralBonus(reedJob.jobDescription || '');

        // Insert job posting
        const { data: newJob, error: insertError } = await adminClient
          .from('job_postings')
          .insert({
            company_id: company.id,
            reed_job_id: String(reedJob.jobId),
            fingerprint,
            title: reedJob.jobTitle,
            title_normalized: normalizeJobTitle(reedJob.jobTitle),
            location: reedJob.locationName,
            location_normalized: normalizeLocation(reedJob.locationName),
            salary_min: salary.annual_min,
            salary_max: salary.annual_max,
            salary_type: salary.salary_type,
            salary_normalized_annual: salary.annual_min,
            industry: detectedIndustry,
            source: 'reed',
            source_url: reedJob.jobUrl,
            original_posted_date: new Date(reedJob.date).toISOString().split('T')[0],
            repost_count: repostCount,
            previous_posting_id: previousPostingId,
            salary_increase_from_previous: salaryIncrease,
            mentions_referral_bonus: referralBonus.hasBonus,
            referral_bonus_amount: referralBonus.amount,
            raw_description: reedJob.jobDescription?.substring(0, 5000),
            employer_name_from_source: reedJob.employerName,
          })
          .select()
          .single();

        if (insertError) {
          stats.errors.push(`Insert error: ${insertError.message}`);
          continue;
        }

        stats.jobs_processed++;

        // Generate pain signals for this job
        if (newJob) {
          const daysOpen = Math.floor(
            (Date.now() - new Date(reedJob.date).getTime()) / (1000 * 60 * 60 * 24)
          );

          // Calculate signal type based on job age and refresh status
          const daysSinceRefresh = 0; // Just seen now
          const signalConfig = determineJobSignalType(daysOpen, daysSinceRefresh);

          if (signalConfig) {
            const { signalType, painScore, urgency, isHardToFill } = signalConfig;

            await adminClient.from('company_pain_signals').insert({
              company_id: company.id,
              pain_signal_type: signalType,
              source_job_posting_id: newJob.id,
              signal_title: generateSignalTitle(reedJob.jobTitle, daysOpen, isHardToFill),
              signal_detail: generateSignalDetail(
                reedJob.jobTitle,
                company.name,
                reedJob.locationName,
                daysOpen,
                daysSinceRefresh,
                isHardToFill
              ),
              signal_value: daysOpen,
              days_since_refresh: daysSinceRefresh,
              pain_score_contribution: painScore,
              urgency,
            });
            stats.signals_generated++;
          }

          // Repost signal
          if (repostCount > 0) {
            let signalType: string;
            let painScore: number;

            if (repostCount >= 3) {
              signalType = 'job_reposted_three_plus';
              painScore = PAIN_SCORES.job_reposted_three_plus.pain_score;
            } else if (repostCount >= 2) {
              signalType = 'job_reposted_twice';
              painScore = PAIN_SCORES.job_reposted_twice.pain_score;
            } else {
              signalType = 'job_reposted_once';
              painScore = PAIN_SCORES.job_reposted_once.pain_score;
            }

            await adminClient.from('company_pain_signals').insert({
              company_id: company.id,
              pain_signal_type: signalType,
              source_job_posting_id: newJob.id,
              signal_title: `${reedJob.jobTitle} - Reposted ${repostCount}x`,
              signal_detail: `This role has been reposted ${repostCount} time(s), indicating failed hiring attempts.`,
              signal_value: repostCount,
              pain_score_contribution: painScore,
              urgency: 'immediate',
            });
            stats.signals_generated++;
          }

          // Salary increase signal
          if (salaryIncrease && salaryIncrease > 10) {
            const signalType = salaryIncrease >= 20 ? 'salary_increase_20_percent' : 'salary_increase_10_percent';
            const painScore = salaryIncrease >= 20 ? PAIN_SCORES.salary_increase_20_percent.pain_score : PAIN_SCORES.salary_increase_10_percent.pain_score;

            await adminClient.from('company_pain_signals').insert({
              company_id: company.id,
              pain_signal_type: signalType,
              source_job_posting_id: newJob.id,
              signal_title: `${reedJob.jobTitle} - Salary increased ${Math.round(salaryIncrease)}%`,
              signal_detail: `Salary increased by ${Math.round(salaryIncrease)}% from previous posting.`,
              signal_value: salaryIncrease,
              pain_score_contribution: painScore,
              urgency: 'immediate',
            });
            stats.signals_generated++;
          }

          // Referral bonus signal
          if (referralBonus.hasBonus) {
            const bonusText = referralBonus.amount ? `£${referralBonus.amount.toLocaleString()}` : 'offered';

            await adminClient.from('company_pain_signals').insert({
              company_id: company.id,
              pain_signal_type: 'high_referral_bonus',
              source_job_posting_id: newJob.id,
              signal_title: `${reedJob.jobTitle} - Referral bonus ${bonusText}`,
              signal_detail: `Company is offering a referral bonus for this role.`,
              signal_value: referralBonus.amount || 0,
              pain_score_contribution: PAIN_SCORES.high_referral_bonus.pain_score,
              urgency: 'short_term',
            });
            stats.signals_generated++;
          }

          // Update company pain score
          const { data: signals } = await adminClient
            .from('company_pain_signals')
            .select('pain_score_contribution')
            .eq('company_id', company.id)
            .eq('is_active', true);

          const totalScore = signals?.reduce((sum, s) => sum + (s.pain_score_contribution || 0), 0) || 0;
          const cappedScore = Math.min(totalScore, 100);

          await adminClient
            .from('companies')
            .update({
              hiring_pain_score: cappedScore,
              pain_score_updated_at: new Date().toISOString(),
              last_activity_at: new Date().toISOString(),
            })
            .eq('id', company.id);
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        stats.errors.push(`Job ${reedJob.jobId}: ${message}`);
      }
    }

    // Scan for contract signals if enabled
    const hasContractSignals = icpProfile.signal_types.includes('contracts_awarded') ||
                               icpProfile.signal_types.includes('tenders');

    if (hasContractSignals) {
      console.log(`[ICP Scan] Scanning for contract signals...`);

      // Get filter criteria from ICP profile
      const minValue = icpProfile.min_contract_value || 0;
      const keywords = icpProfile.contract_keywords || [];
      const targetLocations = new Set(icpProfile.locations.map(l => l.toLowerCase()));

      // Fetch from Contracts Finder (7 days back for initial scan)
      if (icpProfile.signal_types.includes('contracts_awarded')) {
        try {
          const { signals: contractSignals } = await fetchContractAwards(7);
          stats.contracts_found += contractSignals.length;

          for (const signal of contractSignals) {
            // Filter by min value
            if (minValue > 0 && (signal.value || 0) < minValue) continue;

            // Filter by keywords (if any specified)
            if (keywords.length > 0) {
              const titleLower = signal.signal_title.toLowerCase();
              const detailLower = signal.signal_detail.toLowerCase();
              const hasKeyword = keywords.some(kw =>
                titleLower.includes(kw.toLowerCase()) ||
                detailLower.includes(kw.toLowerCase())
              );
              if (!hasKeyword) continue;
            }

            // Filter by location (if any specified)
            if (targetLocations.size > 0 && signal.location) {
              const locationLower = signal.location.toLowerCase();
              const matchesLocation = Array.from(targetLocations).some(loc =>
                locationLower.includes(loc)
              );
              if (!matchesLocation) continue;
            }

            stats.contracts_matched++;

            // Insert as signal
            const fingerprint = Buffer.from(
              `${signal.company_name}|${signal.signal_title}|${signal.signal_url}`
            ).toString('base64').slice(0, 64);

            await adminClient.from('signals').upsert({
              source_type: 'search',
              signal_type: 'contract_awarded',
              company_name: signal.company_name,
              company_domain: signal.company_domain,
              signal_title: signal.signal_title,
              signal_detail: `${signal.signal_detail}${signal.buyer_name ? ` | Buyer: ${signal.buyer_name}` : ''}${signal.value ? ` | Value: £${signal.value.toLocaleString()}` : ''}`,
              signal_url: signal.signal_url,
              location: signal.location,
              hash: fingerprint,
              detected_at: new Date().toISOString(),
              is_new: true,
            }, { onConflict: 'hash', ignoreDuplicates: true });

            stats.signals_generated++;
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          stats.errors.push(`Contracts Finder: ${msg}`);
        }
      }

      // Fetch from Find a Tender (7 days back)
      if (icpProfile.signal_types.includes('tenders')) {
        try {
          const { signals: tenderSignals } = await fetchFTSAwards(7);
          stats.contracts_found += tenderSignals.length;

          for (const signal of tenderSignals) {
            // Filter by min value
            if (minValue > 0 && (signal.value || 0) < minValue) continue;

            // Filter by keywords
            if (keywords.length > 0) {
              const titleLower = signal.signal_title.toLowerCase();
              const detailLower = signal.signal_detail.toLowerCase();
              const hasKeyword = keywords.some(kw =>
                titleLower.includes(kw.toLowerCase()) ||
                detailLower.includes(kw.toLowerCase())
              );
              if (!hasKeyword) continue;
            }

            // Filter by location
            if (targetLocations.size > 0 && signal.location) {
              const locationLower = signal.location.toLowerCase();
              const matchesLocation = Array.from(targetLocations).some(loc =>
                locationLower.includes(loc)
              );
              if (!matchesLocation) continue;
            }

            stats.contracts_matched++;

            const fingerprint = Buffer.from(
              `${signal.company_name}|${signal.signal_title}|${signal.signal_url}`
            ).toString('base64').slice(0, 64);

            await adminClient.from('signals').upsert({
              source_type: 'search',
              signal_type: 'contract_awarded',
              company_name: signal.company_name,
              company_domain: signal.company_domain,
              signal_title: signal.signal_title,
              signal_detail: `${signal.signal_detail}${signal.buyer_name ? ` | Buyer: ${signal.buyer_name}` : ''}${signal.value ? ` | Value: £${signal.value.toLocaleString()}` : ''}`,
              signal_url: signal.signal_url,
              location: signal.location,
              hash: fingerprint,
              detected_at: new Date().toISOString(),
              is_new: true,
            }, { onConflict: 'hash', ignoreDuplicates: true });

            stats.signals_generated++;
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          stats.errors.push(`Find a Tender: ${msg}`);
        }
      }

      console.log(`[ICP Scan] Contracts: ${stats.contracts_found} found, ${stats.contracts_matched} matched ICP criteria`);
    }

    // Queue expansion tasks for background processing
    // This will search additional role variations and expanded locations
    const batchId = randomUUID();
    const allRoleVariations = roles.flatMap(role => getRoleSearchTerms(role));
    const remainingRoles = allRoleVariations.filter(r => !searchedRoles.includes(r));

    if (remainingRoles.length > 0 || searchLocations.length < UK_NATIONAL_LOCATIONS.length) {
      try {
        const tasksQueued = await queueExpansionTasks(
          adminClient,
          id,
          batchId,
          remainingRoles,
          searchedRoles,
          locations,
          searchLocations
        );
        stats.expansion_tasks_queued = tasksQueued;
        console.log(`[ICP Scan] Queued ${tasksQueued} expansion tasks for background processing`);
      } catch (err) {
        console.error('[ICP Scan] Error queuing expansion tasks:', err);
      }
    }

    // Update profile last_synced_at and scan_status
    await supabase
      .from('icp_profiles')
      .update({
        last_synced_at: new Date().toISOString(),
        scan_status: stats.expansion_tasks_queued > 0 ? 'expanding' : 'completed',
        scan_batch_id: stats.expansion_tasks_queued > 0 ? batchId : null,
      })
      .eq('id', id);

    console.log(`[ICP Scan] Complete. Jobs: ${stats.jobs_processed}, Contracts: ${stats.contracts_matched}, Signals: ${stats.signals_generated}, Expansion: ${stats.expansion_tasks_queued} tasks`);

    return NextResponse.json({
      success: true,
      stats,
      expandingInBackground: stats.expansion_tasks_queued > 0,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[ICP Scan] Error:', error);
    return NextResponse.json(
      { success: false, error: message, stats },
      { status: 500 }
    );
  }
}
