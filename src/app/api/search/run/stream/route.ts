import { NextRequest } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { executeSearch, generateSearchQueries } from '@/lib/search';
import { SearchProfile, ExtractedSignal } from '@/types';

function generateFingerprint(signal: ExtractedSignal): string {
  const str = `${signal.company_name}|${signal.signal_title}|${signal.signal_url}`.toLowerCase();
  return Buffer.from(str).toString('base64').slice(0, 64);
}

function detectSignalType(signal: ExtractedSignal, allowedTypes: string[]): string {
  const text = `${signal.signal_title} ${signal.signal_detail}`.toLowerCase();

  if (text.includes('engineer') || text.includes('developer') || text.includes('manager') ||
      text.includes('analyst') || text.includes('salary') || text.includes('job')) {
    if (allowedTypes.includes('new_job')) return 'new_job';
    if (allowedTypes.includes('company_hiring')) return 'company_hiring';
  }
  if (text.includes('contract') || text.includes('tender') || text.includes('awarded')) {
    return allowedTypes.includes('contract_awarded') ? 'contract_awarded' : allowedTypes[0];
  }
  if (text.includes('planning') || text.includes('permission') || text.includes('approved')) {
    return allowedTypes.includes('planning_approved') ? 'planning_approved' : allowedTypes[0];
  }
  if (text.includes('funding') || text.includes('investment') || text.includes('raised')) {
    return allowedTypes.includes('funding_announced') ? 'funding_announced' : allowedTypes[0];
  }
  return allowedTypes[0] || 'new_job';
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const body = await request.json();
  const { profileId } = body;

  if (!profileId) {
    return new Response(
      JSON.stringify({ error: 'Profile ID required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const adminSupabase = createAdminClient();

  // Get profile
  const { data: profile, error: profileError } = await adminSupabase
    .from('search_profiles')
    .select('*')
    .eq('id', profileId)
    .eq('user_id', user.id)
    .single();

  if (profileError || !profile) {
    return new Response(
      JSON.stringify({ error: 'Profile not found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Create search run record
  const { data: searchRun, error: runError } = await adminSupabase
    .from('search_runs')
    .insert({
      user_id: user.id,
      search_profile_id: profileId,
      status: 'running',
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (runError || !searchRun) {
    return new Response(
      JSON.stringify({ error: 'Failed to create search run' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Create SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        // Generate queries first to show progress
        const queries = generateSearchQueries(profile as SearchProfile);
        sendEvent({ type: 'queries', count: queries.length });

        // Execute search with progress callback
        const result = await executeSearch(profile as SearchProfile, (message: string) => {
          sendEvent({ type: 'progress', message });
        });

        // Get existing hashes for deduplication
        const { data: existingSignals } = await adminSupabase
          .from('signals')
          .select('hash');

        const existingHashes = new Set(
          existingSignals?.map(s => s.hash).filter(Boolean) || []
        );

        // Filter new signals and send them as they're processed
        const newSignals: ExtractedSignal[] = [];
        for (const signal of result.signals) {
          const hash = generateFingerprint(signal);
          if (!existingHashes.has(hash)) {
            newSignals.push(signal);
            sendEvent({
              type: 'signal',
              signal: {
                company_name: signal.company_name,
                signal_title: signal.signal_title,
                signal_type: detectSignalType(signal, profile.signal_types),
              },
            });
          }
        }

        // Insert new signals to database
        if (newSignals.length > 0) {
          const signalsToInsert = newSignals.map(signal => ({
            source_type: 'search',
            search_run_id: searchRun.id,
            signal_type: detectSignalType(signal, profile.signal_types),
            company_name: signal.company_name,
            company_domain: signal.company_domain,
            signal_title: signal.signal_title,
            signal_detail: signal.signal_detail,
            signal_url: signal.signal_url,
            location: profile.locations[0] || null,
            industry: profile.industry,
            hash: generateFingerprint(signal),
            detected_at: new Date().toISOString(),
            is_new: true,
          }));

          await adminSupabase.from('signals').insert(signalsToInsert);
        }

        // Update search run
        await adminSupabase
          .from('search_runs')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            queries_used: result.queriesUsed,
            signal_types_searched: profile.signal_types,
            locations_searched: profile.locations,
            urls_found: result.urlsFound,
            urls_scraped: result.urlsScraped,
            signals_found: result.signals.length,
            new_signals: newSignals.length,
          })
          .eq('id', searchRun.id);

        sendEvent({
          type: 'complete',
          run_id: searchRun.id,
          signals_found: newSignals.length,
          total_found: result.signals.length,
        });

        controller.close();
      } catch (error) {
        // Update search run as failed
        await adminSupabase
          .from('search_runs')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            error_message: error instanceof Error ? error.message : 'Unknown error',
          })
          .eq('id', searchRun.id);

        sendEvent({
          type: 'error',
          message: error instanceof Error ? error.message : 'Search failed',
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
