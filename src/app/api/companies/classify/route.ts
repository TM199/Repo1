/**
 * Company Classification API
 *
 * POST /api/companies/classify
 * - With body { company_name: string }: Classifies a single company (legacy)
 * - With empty body or { batch: true }: Triggers Inngest batch classification
 *
 * GET /api/companies/classify?company_name=...
 * Returns existing classification status (without running AI)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { classifyCompany } from '@/agents/agency-classifier-agent';
import { inngest } from '@/inngest/client';

// GET: Fetch existing classification status for a company
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const companyName = searchParams.get('company_name');

  if (!companyName) {
    return NextResponse.json({ error: 'company_name is required' }, { status: 400 });
  }

  const adminSupabase = createAdminClient();

  // Look up company by name (case-insensitive)
  const { data: company } = await adminSupabase
    .from('companies')
    .select('id, name, domain, is_recruitment_agency, agency_confidence, agency_reasoning, agency_classified_at, domain_source, is_likely_agency_pattern')
    .ilike('name', companyName)
    .single();

  if (!company) {
    return NextResponse.json({
      found: false,
      classification: null,
    });
  }

  return NextResponse.json({
    found: true,
    company_id: company.id,
    classification: {
      isRecruitmentAgency: company.is_recruitment_agency,
      confidence: company.agency_confidence,
      reasoning: company.agency_reasoning,
      classifiedAt: company.agency_classified_at,
      isLikelyAgencyPattern: company.is_likely_agency_pattern,
      domain: company.domain,
      domainSource: company.domain_source,
    },
  });
}

// POST: Classify companies
// - With { company_name }: Single company (legacy)
// - With { batch: true } or empty body: Batch via Inngest
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { company_name, company_domain, batch } = body;

  const adminSupabase = createAdminClient();

  // Batch mode: trigger Inngest for background processing
  if (batch || !company_name) {
    // Get unclassified company IDs (limit 50 per batch)
    const { data: companies, error } = await adminSupabase
      .from('companies')
      .select('id')
      .is('agency_classified_at', null)
      .limit(50);

    if (error) {
      return NextResponse.json({ error: 'Failed to query companies' }, { status: 500 });
    }

    if (!companies || companies.length === 0) {
      return NextResponse.json({ started: false, message: 'No unclassified companies' });
    }

    const companyIds = companies.map(c => c.id);

    // Send Inngest event
    await inngest.send({
      name: 'company/classify.requested',
      data: { companyIds },
    });

    return NextResponse.json({
      started: true,
      count: companyIds.length,
      message: `Classification started for ${companyIds.length} companies`,
    });
  }

  // Legacy: single company classification

  // Find or create company
  let company = await adminSupabase
    .from('companies')
    .select('id, name, domain, is_recruitment_agency, agency_classified_at')
    .ilike('name', company_name)
    .single()
    .then(r => r.data);

  // If not found, create it
  if (!company) {
    const { data: newCompany, error: createError } = await adminSupabase
      .from('companies')
      .insert({
        name: company_name,
        domain: company_domain || null,
      })
      .select()
      .single();

    if (createError) {
      console.error('[classify] Failed to create company:', createError);
      return NextResponse.json({ error: 'Failed to create company' }, { status: 500 });
    }

    company = newCompany;
  }

  if (!company) {
    return NextResponse.json({ error: 'Failed to find or create company' }, { status: 500 });
  }

  try {
    console.log(`[classify] Starting classification for: ${company.name}`);

    // Call the AI classifier
    const result = await classifyCompany(company.name, {
      domain: company.domain || company_domain || undefined,
      useTools: true,
    });

    console.log(`[classify] Result: isAgency=${result.isRecruitmentAgency}, confidence=${result.confidence}, domain=${result.domain}`);

    // Build update object
    const updates: Record<string, unknown> = {
      is_recruitment_agency: result.isRecruitmentAgency,
      agency_confidence: result.confidence,
      agency_reasoning: result.reasoning,
      agency_classified_at: new Date().toISOString(),
      agency_classification_source: 'ai',
    };

    // Only update domain if AI found one and we don't already have one
    if (result.domain && !company.domain) {
      updates.domain = result.domain;
      updates.domain_source = 'ai_tavily';
      updates.domain_confidence = 80;
    }

    // Save to database
    const { error: updateError } = await adminSupabase
      .from('companies')
      .update(updates)
      .eq('id', company.id);

    if (updateError) {
      console.error('[classify] Update error:', updateError);
      throw new Error('Failed to save classification');
    }

    return NextResponse.json({
      success: true,
      company_id: company.id,
      result: {
        isRecruitmentAgency: result.isRecruitmentAgency,
        confidence: result.confidence,
        reasoning: result.reasoning,
        domain: result.domain || company.domain,
        domainWasResolved: !company.domain && !!result.domain,
      },
    });
  } catch (error) {
    console.error('[classify] Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Classification failed',
        company_name: company.name,
      },
      { status: 500 }
    );
  }
}
