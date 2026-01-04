/**
 * ICP Bulk Enrich API
 * Enriches all signals for an ICP profile that don't have contacts yet
 * Returns a streaming response with progress updates
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { enrichWithWaterfall, EnrichedContact } from '@/lib/enrichment';
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

function decrypt(text: string): string {
  if (!ENCRYPTION_KEY || !text || !text.includes(':')) return text;
  try {
    const parts = text.split(':');
    if (parts.length !== 2) return text;
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = Buffer.from(parts[1], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch {
    return text;
  }
}

interface CompanySignal {
  company_id: string;
  company_name: string;
  company_domain: string | null;
  signal_type: string;
  signal_title: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify user owns this ICP
  const { data: profile, error: profileError } = await supabase
    .from('icp_profiles')
    .select('id, name')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: 'ICP profile not found' }, { status: 404 });
  }

  // Get user settings for API keys
  const { data: settings } = await supabase
    .from('user_settings')
    .select('leadmagic_api_key, prospeo_api_key, enrichment_include_phone, default_enrichment_roles')
    .eq('user_id', user.id)
    .single();

  if (!settings?.leadmagic_api_key || !settings?.prospeo_api_key) {
    return NextResponse.json({
      error: 'API keys not configured. Please add LeadMagic and Prospeo API keys in Settings.',
    }, { status: 400 });
  }

  const leadmagicKey = decrypt(settings.leadmagic_api_key);
  const prospeoKey = decrypt(settings.prospeo_api_key);
  const includePhone = settings.enrichment_include_phone || false;

  const adminSupabase = createAdminClient();

  // Get unique companies with signals for this ICP that haven't been enriched
  const { data: signals, error: signalsError } = await adminSupabase
    .from('company_pain_signals')
    .select(`
      company_id,
      pain_signal_type,
      signal_title,
      companies(id, name, domain, last_enriched_at)
    `)
    .eq('icp_profile_id', id)
    .eq('is_active', true);

  if (signalsError) {
    console.error('[Bulk Enrich] Error fetching signals:', signalsError);
    return NextResponse.json({ error: 'Failed to fetch signals' }, { status: 500 });
  }

  // Get unique companies that haven't been enriched
  const companiesMap = new Map<string, CompanySignal>();
  for (const signal of (signals || [])) {
    // companies is a single joined object, not an array
    const company = signal.companies as unknown as { id: string; name: string; domain: string | null; last_enriched_at: string | null } | null;
    if (!company) continue;

    // Skip if already enriched
    if (company.last_enriched_at) continue;

    // Keep one signal per company for enrichment context
    if (!companiesMap.has(company.id)) {
      companiesMap.set(company.id, {
        company_id: company.id,
        company_name: company.name,
        company_domain: company.domain,
        signal_type: signal.pain_signal_type,
        signal_title: signal.signal_title,
      });
    }
  }

  const companiesToEnrich = Array.from(companiesMap.values());

  if (companiesToEnrich.length === 0) {
    return NextResponse.json({
      message: 'All companies already enriched',
      enriched: 0,
      total: 0,
    });
  }

  // Create streaming response
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      send({
        type: 'start',
        total: companiesToEnrich.length,
        message: `Starting enrichment for ${companiesToEnrich.length} companies...`,
      });

      let enrichedCount = 0;
      let failedCount = 0;

      for (let i = 0; i < companiesToEnrich.length; i++) {
        const company = companiesToEnrich[i];

        send({
          type: 'progress',
          current: i + 1,
          total: companiesToEnrich.length,
          company: company.company_name,
        });

        try {
          const result = await enrichWithWaterfall(
            company.company_name,
            company.company_domain,
            company.signal_type,
            company.signal_title,
            leadmagicKey,
            prospeoKey,
            includePhone,
            3 // max contacts per company
          );

          if (result.contacts.length > 0) {
            // Save contacts to database
            const contactsToInsert = result.contacts.map((c: EnrichedContact) => ({
              company_id: company.company_id,
              full_name: c.full_name,
              first_name: c.first_name,
              last_name: c.last_name,
              job_title: c.job_title,
              seniority: c.seniority,
              email: c.email,
              email_status: c.email_status,
              phone: c.phone,
              linkedin_url: c.linkedin_url,
            }));

            await adminSupabase
              .from('company_contacts')
              .upsert(contactsToInsert, { onConflict: 'company_id,email' });

            // Update company domain if resolved
            if (result.domain && !company.company_domain) {
              await adminSupabase
                .from('companies')
                .update({
                  domain: result.domain,
                  domain_source: result.domainSource,
                })
                .eq('id', company.company_id);
            }

            // Mark company as enriched
            await adminSupabase
              .from('companies')
              .update({ last_enriched_at: new Date().toISOString() })
              .eq('id', company.company_id);

            enrichedCount++;

            send({
              type: 'enriched',
              company: company.company_name,
              contacts: result.contacts.length,
            });
          } else {
            failedCount++;
            send({
              type: 'no_contacts',
              company: company.company_name,
            });
          }
        } catch (err) {
          failedCount++;
          console.error(`[Bulk Enrich] Error enriching ${company.company_name}:`, err);
          send({
            type: 'error',
            company: company.company_name,
            message: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      }

      send({
        type: 'complete',
        enriched: enrichedCount,
        failed: failedCount,
        total: companiesToEnrich.length,
      });

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

// GET endpoint to check enrichment status
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify user owns this ICP
  const { data: profile, error: profileError } = await supabase
    .from('icp_profiles')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: 'ICP profile not found' }, { status: 404 });
  }

  const adminSupabase = createAdminClient();

  // Count signals and enriched companies
  const { data: signals } = await adminSupabase
    .from('company_pain_signals')
    .select('company_id, companies(last_enriched_at)')
    .eq('icp_profile_id', id)
    .eq('is_active', true);

  const companyIds = new Set<string>();
  let enrichedCount = 0;

  for (const signal of (signals || [])) {
    const company = signal.companies as unknown as { last_enriched_at: string | null } | null;
    if (!companyIds.has(signal.company_id)) {
      companyIds.add(signal.company_id);
      if (company?.last_enriched_at) {
        enrichedCount++;
      }
    }
  }

  return NextResponse.json({
    total_companies: companyIds.size,
    enriched_companies: enrichedCount,
    unenriched_companies: companyIds.size - enrichedCount,
    total_signals: signals?.length || 0,
  });
}
