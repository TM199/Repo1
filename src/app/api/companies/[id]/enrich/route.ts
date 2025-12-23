/**
 * Company Enrichment API
 *
 * Enriches a company by finding contacts using LeadMagic + Prospeo.
 * Works with companies from pain signals (not just search signals).
 *
 * Uses WATERFALL enrichment:
 * 1. Try LeadMagic with company name only (no domain)
 * 2. Fall back to Clearbit domain resolution
 * 3. Fall back to Google Search via Firecrawl
 * 4. Fall back to DNS-validated guessing
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { enrichWithWaterfall } from '@/lib/enrichment';

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
  const body = await request.json().catch(() => ({}));
  const { signalType = 'hard_to_fill_90', signalTitle = 'Hiring Pain' } = body;

  // Get user's API keys from settings
  const { data: settings } = await supabase
    .from('user_settings')
    .select('leadmagic_api_key, prospeo_api_key, enrichment_include_phone')
    .eq('user_id', user.id)
    .single();

  if (!settings?.leadmagic_api_key || !settings?.prospeo_api_key) {
    return NextResponse.json(
      { error: 'Please configure LeadMagic and Prospeo API keys in Settings' },
      { status: 400 }
    );
  }

  // Get company details
  const adminSupabase = createAdminClient();
  const { data: company } = await adminSupabase
    .from('companies')
    .select('*')
    .eq('id', companyId)
    .single();

  if (!company) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 });
  }

  try {
    // Get the top pain signal to use for contact role mapping
    const { data: topSignal } = await adminSupabase
      .from('company_pain_signals')
      .select('pain_signal_type, signal_title')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('pain_score_contribution', { ascending: false })
      .limit(1)
      .single();

    const effectiveSignalType = topSignal?.pain_signal_type || signalType;
    const effectiveSignalTitle = topSignal?.signal_title || signalTitle;

    console.log(`[company-enrich] Starting waterfall enrichment for: ${company.name}`);

    // Use waterfall enrichment - tries LeadMagic first, then domain resolution
    const result = await enrichWithWaterfall(
      company.name,
      company.domain || null, // Pass existing domain if we have one
      effectiveSignalType,
      effectiveSignalTitle,
      settings.leadmagic_api_key,
      settings.prospeo_api_key,
      settings.enrichment_include_phone || false,
      3 // max contacts
    );

    console.log(`[company-enrich] Waterfall result: ${result.contacts.length} contacts, domain: ${result.domain} (source: ${result.domainSource})`);

    // Save resolved domain back to company if we found one
    if (result.domain && !company.domain) {
      await adminSupabase
        .from('companies')
        .update({
          domain: result.domain,
          domain_source: result.domainSource,
        })
        .eq('id', companyId);
    }

    // Save contacts to company_contacts table
    if (result.contacts.length > 0) {
      const contactsToInsert = result.contacts.map((c, index) => ({
        company_id: companyId,
        full_name: c.full_name,
        first_name: c.first_name,
        last_name: c.last_name,
        job_title: c.job_title,
        seniority: c.seniority,
        email: c.email,
        email_status: c.email_status,
        phone: c.phone,
        linkedin_url: c.linkedin_url,
        is_primary: index === 0,
        enrichment_source: `waterfall:${result.domainSource}`,
      }));

      // Use upsert to avoid duplicates (based on email)
      for (const contact of contactsToInsert) {
        if (contact.email) {
          await adminSupabase
            .from('company_contacts')
            .upsert(contact, { onConflict: 'company_id,email', ignoreDuplicates: true });
        } else {
          await adminSupabase.from('company_contacts').insert(contact);
        }
      }

      // Update company enrichment status
      await adminSupabase
        .from('companies')
        .update({
          last_enriched_at: new Date().toISOString(),
          contacts_count: result.contacts.length
        })
        .eq('id', companyId);
    }

    return NextResponse.json({
      success: true,
      contacts: result.contacts,
      domain_used: result.domain,
      domain_source: result.domainSource,
      domain_confidence: result.domainConfidence,
      domain_was_resolved: !company.domain && !!result.domain
    });
  } catch (error) {
    console.error('[company-enrich] Error:', error);
    return NextResponse.json(
      {
        error: 'Enrichment failed. Please try again.',
        company_name: company.name
      },
      { status: 500 }
    );
  }
}
