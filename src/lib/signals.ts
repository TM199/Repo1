import { createAdminClient } from './supabase/server';
import { scrapeAndExtract } from './firecrawl';
import { Source, ExtractedSignal } from '@/types';

function generateFingerprint(signal: ExtractedSignal): string {
  const str = `${signal.company_name}|${signal.signal_title}|${signal.signal_url}`;
  return Buffer.from(str).toString('base64').slice(0, 64);
}

export async function processSource(source: Source): Promise<{
  success: boolean;
  itemsFound: number;
  newItems: number;
  error?: string;
}> {
  const supabase = createAdminClient();

  const { signals: extractedSignals, error } = await scrapeAndExtract(
    source.url,
    source.signal_type
  );

  if (error) {
    await supabase.from('scrapes').insert({
      source_id: source.id,
      status: 'failed',
      items_found: 0,
      new_items: 0,
      error_message: error,
    });

    return { success: false, itemsFound: 0, newItems: 0, error };
  }

  // Table uses 'hash' column, not 'fingerprint'
  const { data: existingSignals } = await supabase
    .from('signals')
    .select('hash')
    .eq('source_id', source.id);

  const existingHashes = new Set(
    existingSignals?.map(s => s.hash).filter(Boolean) || []
  );

  const newSignals = extractedSignals.filter(signal => {
    const hash = generateFingerprint(signal);
    return !existingHashes.has(hash);
  });

  const { data: scrape } = await supabase
    .from('scrapes')
    .insert({
      source_id: source.id,
      status: 'success',
      items_found: extractedSignals.length,
      new_items: newSignals.length,
    })
    .select()
    .single();

  if (newSignals.length > 0) {
    // Match actual Supabase schema - no user_id, scrape_id, raw_data, is_read, is_exported
    const signalsToInsert = newSignals.map(signal => ({
      source_id: source.id,
      source_type: 'scrape',
      signal_type: source.signal_type,
      company_name: signal.company_name,
      company_domain: signal.company_domain,
      signal_title: signal.signal_title,
      signal_detail: signal.signal_detail,
      signal_url: signal.signal_url,
      hash: generateFingerprint(signal),  // Table uses 'hash' not 'fingerprint'
      detected_at: new Date().toISOString(),
      is_new: true,
    }));

    const { error: insertError } = await supabase.from('signals').insert(signalsToInsert);
    if (insertError) {
      console.error('[Signals] Failed to insert signals:', JSON.stringify(insertError));
    } else {
      console.log(`[Signals] Successfully inserted ${signalsToInsert.length} signals`);
    }
  }

  await supabase
    .from('sources')
    .update({ last_scraped_at: new Date().toISOString() })
    .eq('id', source.id);

  return {
    success: true,
    itemsFound: extractedSignals.length,
    newItems: newSignals.length,
  };
}

export async function processAllSources(frequency: 'daily' | 'weekly' | 'monthly'): Promise<{
  processed: number;
  successful: number;
  totalNewSignals: number;
}> {
  const supabase = createAdminClient();

  const { data: sources } = await supabase
    .from('sources')
    .select('*')
    .eq('is_active', true)
    .eq('scrape_frequency', frequency);

  if (!sources || sources.length === 0) {
    return { processed: 0, successful: 0, totalNewSignals: 0 };
  }

  let successful = 0;
  let totalNewSignals = 0;

  for (const source of sources) {
    const result = await processSource(source as Source);
    if (result.success) {
      successful++;
      totalNewSignals += result.newItems;
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return {
    processed: sources.length,
    successful,
    totalNewSignals,
  };
}
