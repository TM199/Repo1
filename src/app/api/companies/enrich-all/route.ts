/**
 * Batch Company Enrichment API
 *
 * Enriches all companies in the Companies in Pain dashboard.
 * Uses SSE (Server-Sent Events) to stream progress updates.
 * Rate limited to avoid API throttling.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { enrichWithWaterfall } from '@/lib/enrichment';

const BATCH_DELAY_MS = 2000; // 2 seconds between companies to avoid rate limits

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get user's API keys
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

  const body = await request.json().catch(() => ({}));
  const { limit = 50, skipEnriched = true } = body;

  const adminSupabase = createAdminClient();

  // Get companies that need enrichment
  let query = adminSupabase
    .from('companies')
    .select(`
      id,
      name,
      domain,
      last_enriched_at,
      company_pain_signals!inner(
        pain_signal_type,
        signal_title,
        pain_score_contribution,
        is_active
      )
    `)
    .eq('company_pain_signals.is_active', true)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (skipEnriched) {
    query = query.is('last_enriched_at', null);
  }

  const { data: companies, error } = await query;

  if (error) {
    console.error('[enrich-all] Query error:', error);
    return NextResponse.json({ error: 'Failed to fetch companies' }, { status: 500 });
  }

  if (!companies || companies.length === 0) {
    return NextResponse.json({
      success: true,
      message: 'No companies need enrichment',
      total: 0,
      enriched: 0
    });
  }

  // Use SSE for streaming progress
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      sendEvent({
        type: 'start',
        total: companies.length,
        message: `Starting enrichment for ${companies.length} companies`
      });

      let enrichedCount = 0;
      let failedCount = 0;

      for (let i = 0; i < companies.length; i++) {
        const company = companies[i];
        const signals = company.company_pain_signals as {
          pain_signal_type: string;
          signal_title: string;
          pain_score_contribution: number;
        }[];

        // Get the highest pain score signal
        const topSignal = signals.sort((a, b) =>
          b.pain_score_contribution - a.pain_score_contribution
        )[0];

        sendEvent({
          type: 'progress',
          current: i + 1,
          total: companies.length,
          company: company.name,
          message: `Enriching ${company.name}...`
        });

        try {
          const result = await enrichWithWaterfall(
            company.name,
            company.domain || null,
            topSignal?.pain_signal_type || 'hard_to_fill_90',
            topSignal?.signal_title || 'Hiring Pain',
            settings.leadmagic_api_key,
            settings.prospeo_api_key,
            settings.enrichment_include_phone || false,
            3
          );

          // Save domain if found
          if (result.domain && !company.domain) {
            await adminSupabase
              .from('companies')
              .update({
                domain: result.domain,
                domain_source: result.domainSource,
              })
              .eq('id', company.id);
          }

          // Save contacts
          if (result.contacts.length > 0) {
            const contactsToInsert = result.contacts.map((c, index) => ({
              company_id: company.id,
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

            for (const contact of contactsToInsert) {
              if (contact.email) {
                await adminSupabase
                  .from('company_contacts')
                  .upsert(contact, { onConflict: 'company_id,email', ignoreDuplicates: true });
              } else {
                await adminSupabase.from('company_contacts').insert(contact);
              }
            }

            await adminSupabase
              .from('companies')
              .update({
                last_enriched_at: new Date().toISOString(),
                contacts_count: result.contacts.length
              })
              .eq('id', company.id);

            enrichedCount++;
            sendEvent({
              type: 'success',
              company: company.name,
              contacts: result.contacts.length,
              domain: result.domain
            });
          } else {
            failedCount++;
            sendEvent({
              type: 'no_contacts',
              company: company.name,
              message: 'No contacts found'
            });
          }
        } catch (error) {
          failedCount++;
          sendEvent({
            type: 'error',
            company: company.name,
            message: error instanceof Error ? error.message : 'Unknown error'
          });
        }

        // Rate limiting delay between companies
        if (i < companies.length - 1) {
          await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
        }
      }

      sendEvent({
        type: 'complete',
        total: companies.length,
        enriched: enrichedCount,
        failed: failedCount,
        message: `Enrichment complete. ${enrichedCount} companies enriched, ${failedCount} failed.`
      });

      controller.close();
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
