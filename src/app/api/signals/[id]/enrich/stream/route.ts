import { NextRequest } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { enrichSignalWithRoles, EnrichmentEvent } from '@/lib/enrichment';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { id: signalId } = await params;
  const { searchParams } = new URL(request.url);
  const rolesParam = searchParams.get('roles');

  // Get user's API keys and default roles from settings
  const { data: settings } = await supabase
    .from('user_settings')
    .select('leadmagic_api_key, prospeo_api_key, enrichment_include_phone, default_enrichment_roles')
    .eq('user_id', user.id)
    .single();

  if (!settings?.leadmagic_api_key || !settings?.prospeo_api_key) {
    return new Response(
      JSON.stringify({ error: 'Please configure API keys in Settings' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Get signal with company details from company_pain_signals
  const adminSupabase = createAdminClient();
  const { data: signal } = await adminSupabase
    .from('company_pain_signals')
    .select(`
      *,
      companies:company_id(id, name, domain)
    `)
    .eq('id', signalId)
    .single();

  if (!signal || !signal.companies) {
    return new Response(
      JSON.stringify({ error: 'Signal not found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const company = signal.companies;
  if (!company.domain) {
    return new Response(
      JSON.stringify({ error: 'Company has no domain. Please add a domain first.', needs_domain: true }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Create SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: EnrichmentEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      let contactsSaved = 0;
      let contactsFailed = 0;

      try {
        // Determine which roles to use: query param > user default > fallback
        const defaultRoles = ['CEO', 'Founder', 'Head of Talent', 'Hiring Manager'];
        const roles = rolesParam
          ? rolesParam.split(',')
          : (settings.default_enrichment_roles?.length > 0
              ? settings.default_enrichment_roles
              : defaultRoles);

        const contacts = await enrichSignalWithRoles(
          company.domain,
          company.name,
          roles,
          settings.leadmagic_api_key,
          settings.prospeo_api_key,
          settings.enrichment_include_phone || false,
          sendEvent
        );

        // Save contacts incrementally to company_contacts (upsert by email)
        for (let i = 0; i < contacts.length; i++) {
          const c = contacts[i];
          try {
            const { error: upsertError } = await adminSupabase
              .from('company_contacts')
              .upsert({
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
                enrichment_source: 'leadmagic+prospeo',
              }, {
                onConflict: 'company_id,email',
              });

            if (upsertError) {
              contactsFailed++;
              console.error('Failed to save contact:', upsertError);
            } else {
              contactsSaved++;
            }
          } catch (saveError) {
            contactsFailed++;
            console.error('Failed to save contact:', saveError);
          }
        }

        // Send completion event
        sendEvent({
          type: 'complete',
          message: `Enrichment complete. Found ${contacts.length} contacts, saved ${contactsSaved}.`,
          summary: {
            total_found: contacts.length,
            total_saved: contactsSaved,
            failed: contactsFailed,
          }
        });

        controller.close();
      } catch (error) {
        // Even on error, report how many contacts were saved
        sendEvent({
          type: 'error',
          message: error instanceof Error ? error.message : 'Enrichment failed',
          contacts_saved: contactsSaved,
        });
        controller.close();
      }
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
