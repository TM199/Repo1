import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { SignalType } from '@/types';

interface AgencySignalToSave {
  company_name: string;
  company_domain: string;
  signal_title: string;
  signal_detail: string;
  signal_url: string;
  signal_type: SignalType;
  industry: string;
  hash: string;
}

/**
 * Save agency signals to database
 * POST /api/agency/save
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { signals } = body as { signals: AgencySignalToSave[] };

    if (!signals?.length) {
      return NextResponse.json({ error: 'No signals to save' }, { status: 400 });
    }

    const adminSupabase = createAdminClient();

    // Get existing hashes to skip duplicates
    const { data: existingSignals } = await adminSupabase
      .from('signals')
      .select('hash');
    const existingHashes = new Set(
      existingSignals?.map(s => s.hash).filter(Boolean) || []
    );

    // Filter out signals that already exist
    const newSignals = signals.filter(s => !existingHashes.has(s.hash));

    if (newSignals.length === 0) {
      return NextResponse.json({
        saved: 0,
        skipped: signals.length,
        message: 'All signals already exist in database',
        savedSignals: [],
      });
    }

    // Prepare signals for insert
    const signalsToInsert = newSignals.map(signal => ({
      source_type: 'agency',
      signal_type: signal.signal_type,
      company_name: signal.company_name,
      company_domain: signal.company_domain || null,
      signal_title: signal.signal_title,
      signal_detail: signal.signal_detail || null,
      signal_url: signal.signal_url || null,
      industry: signal.industry || null,
      hash: signal.hash,
      detected_at: new Date().toISOString(),
      is_new: true,
    }));

    // Insert signals
    const { data: insertedSignals, error: insertError } = await adminSupabase
      .from('signals')
      .insert(signalsToInsert)
      .select('id, hash');

    if (insertError) {
      console.error('[Agency Save] Insert error:', insertError);
      return NextResponse.json(
        { error: 'Failed to save signals' },
        { status: 500 }
      );
    }

    // Create a map of hash -> id for the response
    const hashToId = new Map(
      insertedSignals?.map(s => [s.hash, s.id]) || []
    );

    return NextResponse.json({
      saved: insertedSignals?.length || 0,
      skipped: signals.length - newSignals.length,
      savedSignals: newSignals.map(s => ({
        hash: s.hash,
        id: hashToId.get(s.hash),
      })),
    });

  } catch (error) {
    console.error('[Agency Save] Error:', error);
    return NextResponse.json(
      { error: 'Failed to save signals' },
      { status: 500 }
    );
  }
}
