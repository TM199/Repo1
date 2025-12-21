import { NextRequest } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { enrichSignal, EnrichmentEvent } from '@/lib/enrichment';

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

  // Get user's API keys from settings
  const { data: settings } = await supabase
    .from('user_settings')
    .select('leadmagic_api_key, prospeo_api_key, enrichment_include_phone')
    .eq('user_id', user.id)
    .single();

  if (!settings?.leadmagic_api_key || !settings?.prospeo_api_key) {
    return new Response(
      JSON.stringify({ error: 'Please configure API keys in Settings' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Get signal details
  const adminSupabase = createAdminClient();
  const { data: signal } = await adminSupabase
    .from('signals')
    .select('*')
    .eq('id', signalId)
    .single();

  if (!signal) {
    return new Response(
      JSON.stringify({ error: 'Signal not found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Create SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: EnrichmentEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        const contacts = await enrichSignal(
          signal.company_domain,
          signal.company_name,
          signal.signal_type,
          signal.signal_title,
          settings.leadmagic_api_key,
          settings.prospeo_api_key,
          settings.enrichment_include_phone || false,
          3,
          sendEvent
        );

        // Save contacts to database
        if (contacts.length > 0) {
          const contactsToInsert = contacts.map((c, index) => ({
            signal_id: signalId,
            full_name: c.full_name,
            first_name: c.first_name,
            last_name: c.last_name,
            job_title: c.job_title,
            email: c.email,
            email_status: c.email_status,
            phone: c.phone,
            linkedin_url: c.linkedin_url,
            is_primary: index === 0,
            enrichment_source: 'leadmagic+prospeo',
          }));

          await adminSupabase.from('signal_contacts').insert(contactsToInsert);
        }

        controller.close();
      } catch (error) {
        sendEvent({ type: 'error', message: error instanceof Error ? error.message : 'Enrichment failed' });
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
