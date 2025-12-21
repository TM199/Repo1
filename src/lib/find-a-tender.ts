/**
 * Find a Tender Service API Client
 *
 * Fetches high-value UK public sector contracts (usually >£118,000) from the FTS OCDS API.
 * This replaced EU's TED for UK contracts post-Brexit.
 *
 * API Documentation: https://www.find-tender.service.gov.uk/apidocumentation
 *
 * Note: Requires API key for full access (free registration).
 * Without key, some endpoints may have limits.
 */

import { createAdminClient } from './supabase/server';

const BASE_URL = 'https://www.find-tender.service.gov.uk/api/1.0';

interface FTSRelease {
  ocid: string;
  id: string;
  date: string;
  tag: string[];
  language: string;
  initiationType: string;
  parties: Array<{
    id: string;
    name: string;
    identifier?: { scheme: string; id: string };
    roles: string[];
    address?: {
      streetAddress?: string;
      locality?: string;
      region?: string;
      postalCode?: string;
      countryName?: string;
    };
  }>;
  buyer?: {
    id: string;
    name: string;
  };
  tender?: {
    id: string;
    title: string;
    description: string;
    status: string;
    value?: { amount: number; currency: string };
    procurementMethod?: string;
    mainProcurementCategory?: string;
  };
  awards?: Array<{
    id: string;
    title?: string;
    description?: string;
    status: string;
    date: string;
    value?: { amount: number; currency: string };
    suppliers?: Array<{
      id: string;
      name: string;
    }>;
  }>;
}

interface FTSResponse {
  releases: FTSRelease[];
  links?: {
    next?: string;
  };
}

interface TenderSignal {
  company_name: string;
  company_domain: string;
  signal_title: string;
  signal_detail: string;
  signal_url: string;
  location: string | null;
  value: number | null;
  buyer_name: string | null;
}

function generateFingerprint(signal: TenderSignal): string {
  const str = `${signal.company_name}|${signal.signal_title}|${signal.signal_url}`;
  return Buffer.from(str).toString('base64').slice(0, 64);
}

function extractDomainFromName(companyName: string): string {
  const cleaned = companyName
    .toLowerCase()
    .replace(/\s+(ltd|limited|plc|llp|inc|corp|co|company)\.?$/i, '')
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 30);
  return cleaned ? `${cleaned}.co.uk` : '';
}

function parseFTSRelease(release: FTSRelease): TenderSignal[] {
  const signals: TenderSignal[] = [];

  if (!release.awards || release.awards.length === 0) {
    return signals;
  }

  const buyerName = release.buyer?.name ||
    release.parties?.find(p => p.roles.includes('buyer'))?.name ||
    'Unknown Buyer';

  for (const award of release.awards) {
    if (award.status !== 'active' || !award.suppliers) continue;

    for (const supplier of award.suppliers) {
      const tenderTitle = release.tender?.title || award.title || 'High-Value Contract Award';
      const description = release.tender?.description || award.description || '';
      const value = award.value?.amount || release.tender?.value?.amount;

      const buyerParty = release.parties?.find(p => p.roles.includes('buyer'));
      const location = buyerParty?.address?.locality || buyerParty?.address?.region || null;

      signals.push({
        company_name: supplier.name,
        company_domain: extractDomainFromName(supplier.name),
        signal_title: `Won major contract: ${tenderTitle}`,
        signal_detail: description.slice(0, 500) + (description.length > 500 ? '...' : ''),
        signal_url: `https://www.find-tender.service.gov.uk/Notice/${release.ocid}`,
        location,
        value: value || null,
        buyer_name: buyerName,
      });
    }
  }

  return signals;
}

/**
 * Fetch high-value contract awards from Find a Tender
 */
export async function fetchFTSAwards(daysBack: number = 1): Promise<{
  signals: TenderSignal[];
  error?: string;
}> {
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - daysBack);
  const fromDateStr = fromDate.toISOString().split('T')[0];

  try {
    // OCDS release packages endpoint with date filter
    const url = `${BASE_URL}/ocdsReleasePackages?publishedFrom=${fromDateStr}&size=100`;

    console.log(`[Find a Tender] Fetching awards from ${fromDateStr}`);

    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };

    // Add API key if configured
    if (process.env.FIND_A_TENDER_API_KEY) {
      headers['Authorization'] = `Bearer ${process.env.FIND_A_TENDER_API_KEY}`;
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}: ${response.statusText}`);
    }

    const data: FTSResponse = await response.json();
    const allSignals: TenderSignal[] = [];

    for (const release of data.releases || []) {
      // Only process releases with award tags
      if (release.tag?.includes('award') || release.tag?.includes('contract')) {
        const signals = parseFTSRelease(release);
        allSignals.push(...signals);
      }
    }

    console.log(`[Find a Tender] Found ${allSignals.length} high-value awards`);

    return { signals: allSignals };
  } catch (error) {
    console.error('[Find a Tender] Error:', error);
    return {
      signals: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Sync Find a Tender awards to the signals database
 */
export async function syncFTSAwards(daysBack: number = 1): Promise<{
  success: boolean;
  found: number;
  new: number;
  error?: string;
}> {
  const supabase = createAdminClient();

  const { signals, error } = await fetchFTSAwards(daysBack);

  if (error) {
    return { success: false, found: 0, new: 0, error };
  }

  if (signals.length === 0) {
    return { success: true, found: 0, new: 0 };
  }

  // Get existing hashes to deduplicate
  const { data: existingSignals } = await supabase
    .from('signals')
    .select('hash');

  const existingHashes = new Set(
    existingSignals?.map(s => s.hash).filter(Boolean) || []
  );

  const newSignals = signals.filter(signal => {
    const hash = generateFingerprint(signal);
    return !existingHashes.has(hash);
  });

  if (newSignals.length === 0) {
    console.log('[Find a Tender] No new signals to insert');
    return { success: true, found: signals.length, new: 0 };
  }

  const signalsToInsert = newSignals.map(signal => ({
    source_type: 'search' as const,
    source_id: null,
    search_run_id: null,
    signal_type: 'contract_awarded' as const,
    company_name: signal.company_name,
    company_domain: signal.company_domain,
    signal_title: signal.signal_title,
    signal_detail: signal.signal_detail + (signal.buyer_name ? ` | Buyer: ${signal.buyer_name}` : '') + (signal.value ? ` | Value: £${signal.value.toLocaleString()}` : ''),
    signal_url: signal.signal_url,
    location: signal.location,
    industry: null,
    hash: generateFingerprint(signal),
    detected_at: new Date().toISOString(),
    is_new: true,
  }));

  const { error: insertError } = await supabase
    .from('signals')
    .insert(signalsToInsert);

  if (insertError) {
    console.error('[Find a Tender] Insert error:', insertError);
    return { success: false, found: signals.length, new: 0, error: insertError.message };
  }

  console.log(`[Find a Tender] Inserted ${newSignals.length} new signals`);
  return { success: true, found: signals.length, new: newSignals.length };
}
