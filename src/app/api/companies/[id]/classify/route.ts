/**
 * Company Classification API
 *
 * Classifies a company as a recruitment agency or not using AI.
 * Uses Tavily for domain resolution and Claude for website analysis.
 *
 * POST /api/companies/[id]/classify
 * Returns: { success, result } with classification details
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { classifyCompany } from '@/agents/agency-classifier-agent';

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

  // Get company details
  const adminSupabase = createAdminClient();
  const { data: company, error: companyError } = await adminSupabase
    .from('companies')
    .select('id, name, domain, is_recruitment_agency, agency_classified_at')
    .eq('id', companyId)
    .single();

  if (companyError || !company) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 });
  }

  try {
    console.log(`[classify] Starting classification for: ${company.name}`);

    // Call the AI classifier
    const result = await classifyCompany(company.name, {
      domain: company.domain || undefined,
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
      updates.domain_confidence = 80; // Tavily default confidence
    }

    // Save to database
    const { error: updateError } = await adminSupabase
      .from('companies')
      .update(updates)
      .eq('id', companyId);

    if (updateError) {
      console.error('[classify] Update error:', updateError);
      throw new Error('Failed to save classification');
    }

    return NextResponse.json({
      success: true,
      result: {
        isRecruitmentAgency: result.isRecruitmentAgency,
        confidence: result.confidence,
        reasoning: result.reasoning,
        domain: result.domain,
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
