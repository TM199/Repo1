/**
 * Domain Resolution API
 *
 * Resolves website domain for a company using Tavily/Google/DNS strategies.
 * Cheaper than full classification - just finds the domain, no AI analysis.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { resolveDomain } from '@/lib/domain-resolver';

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
  const adminSupabase = createAdminClient();

  // Get company details
  const { data: company, error: fetchError } = await adminSupabase
    .from('companies')
    .select('id, name, domain, domain_source')
    .eq('id', companyId)
    .single();

  if (fetchError || !company) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 });
  }

  try {
    // Resolve domain using the waterfall strategy
    const result = await resolveDomain(company.name, {
      skipCache: true, // Always try fresh for manual requests
    });

    if (result.domain && result.confidence > 0) {
      // Save domain to company record
      const { error: updateError } = await adminSupabase
        .from('companies')
        .update({
          domain: result.domain,
          domain_source: result.source,
          domain_confidence: result.confidence,
        })
        .eq('id', companyId);

      if (updateError) {
        console.error('[resolve-domain] Update error:', updateError);
        return NextResponse.json({ error: 'Failed to save domain' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        domain: result.domain,
        source: result.source,
        confidence: result.confidence,
        companyId,
        companyName: company.name,
      });
    }

    return NextResponse.json({
      success: false,
      message: `Could not find website for ${company.name}`,
      companyId,
      companyName: company.name,
    });
  } catch (error) {
    console.error('[resolve-domain] Error:', error);
    return NextResponse.json({ error: 'Domain resolution failed' }, { status: 500 });
  }
}
