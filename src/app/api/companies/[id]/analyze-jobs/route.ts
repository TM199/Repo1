/**
 * Company Job URL Analysis API
 *
 * Analyzes job posting URLs for a company to extract additional information
 * like company description, benefits, salary ranges, etc.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { analyzeJobUrl } from '@/lib/job-url-analyzer';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: companyId } = await params;

  // Check for Firecrawl API key
  if (!process.env.FIRECRAWL_API_KEY) {
    return NextResponse.json(
      { error: 'Firecrawl API key not configured' },
      { status: 400 }
    );
  }

  const adminSupabase = createAdminClient();

  // Get company and its job URLs
  const { data: company, error: companyError } = await adminSupabase
    .from('companies')
    .select('id, name')
    .eq('id', companyId)
    .single();

  if (companyError || !company) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 });
  }

  // Get job URLs from pain signals
  const { data: signals } = await adminSupabase
    .from('company_pain_signals')
    .select(`
      id,
      signal_title,
      job_postings:source_job_posting_id(source_url)
    `)
    .eq('company_id', companyId)
    .eq('is_active', true)
    .limit(5);

  // Extract unique job URLs
  const jobUrls: string[] = [];
  for (const signal of (signals || [])) {
    // job_postings can be an array or object depending on Supabase response
    const jobPostingData = signal.job_postings;
    const jobPosting = Array.isArray(jobPostingData) ? jobPostingData[0] : jobPostingData;
    const sourceUrl = (jobPosting as { source_url?: string } | null)?.source_url;
    if (sourceUrl && !jobUrls.includes(sourceUrl)) {
      jobUrls.push(sourceUrl);
    }
  }

  if (jobUrls.length === 0) {
    return NextResponse.json({
      success: true,
      message: 'No job URLs found for this company',
      analyses: []
    });
  }

  // Analyze the first job URL (to save API costs)
  const jobUrl = jobUrls[0];
  const { analysis, error } = await analyzeJobUrl(jobUrl);

  if (error) {
    return NextResponse.json({
      success: false,
      error,
      jobUrl
    }, { status: 500 });
  }

  // Save analysis data to company record if we found useful info
  if (analysis && analysis.confidence > 30) {
    const updateData: Record<string, unknown> = {};

    // Only update fields we got data for
    if (analysis.companyDescription) {
      updateData.description = analysis.companyDescription;
    }
    if (analysis.companySize) {
      updateData.employee_count_range = analysis.companySize;
    }

    // Save job analysis metadata
    updateData.job_analysis = {
      lastAnalyzedAt: new Date().toISOString(),
      jobUrl,
      workMode: analysis.workMode,
      salaryRange: analysis.salaryRange,
      techStack: analysis.techStack,
      benefits: analysis.companyBenefits,
      hiringUrgency: analysis.hiringUrgency,
      confidence: analysis.confidence
    };

    if (Object.keys(updateData).length > 0) {
      await adminSupabase
        .from('companies')
        .update(updateData)
        .eq('id', companyId);
    }
  }

  return NextResponse.json({
    success: true,
    company: company.name,
    jobUrl,
    analysis
  });
}
