/**
 * Planning Data API Client (planning.data.gov.uk)
 *
 * Fetches UK planning applications from the Government's beta API.
 * API Documentation: https://www.planning.data.gov.uk/
 *
 * FREE API - no key required.
 * Note: This is a beta service covering England only.
 */

import { createAdminClient } from './supabase/server';

const BASE_URL = 'https://www.planning.data.gov.uk';

interface PlanningApplication {
  reference: string;
  name?: string;
  description?: string;
  documentation_url?: string;
  organisation_entity?: number;
  organisation?: string;
  address?: string;
  point?: {
    type: string;
    coordinates: number[];
  };
  geometry?: object;
  entry_date?: string;
  start_date?: string;
  end_date?: string;
  planning_decision?: string;
  planning_decision_date?: string;
  appeal_decision?: string;
  appeal_decision_date?: string;
}

interface PlanningResponse {
  count: number;
  entities: PlanningApplication[];
  links?: {
    next?: string;
    prev?: string;
  };
}

interface PlanningSignal {
  company_name: string;
  company_domain: string;
  signal_title: string;
  signal_detail: string;
  signal_url: string;
  location: string | null;
  reference: string;
  decision: string | null;
}

function generateFingerprint(signal: PlanningSignal): string {
  const str = `${signal.company_name}|${signal.signal_title}|${signal.reference}`;
  return Buffer.from(str).toString('base64').slice(0, 64);
}

function extractCompanyFromDescription(description: string): string {
  // Try to extract company name from application description
  // Common patterns: "Application by X Ltd", "Submitted by X", etc.
  const patterns = [
    /(?:by|for|from)\s+([A-Z][A-Za-z0-9\s&]+(?:Ltd|Limited|PLC|LLP|Inc))/i,
    /([A-Z][A-Za-z0-9\s&]+(?:Ltd|Limited|PLC|LLP))/i,
  ];

  for (const pattern of patterns) {
    const match = description.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }

  return 'Unknown Applicant';
}

// Don't guess domains - return empty string for unknown applicants
// Domain can be looked up via enrichment later
function extractDomainFromName(): string {
  return '';
}

function formatDecision(decision: string | null | undefined): string {
  if (!decision) return 'Pending';

  const decisionMap: Record<string, string> = {
    'approved': 'Approved',
    'granted': 'Approved',
    'refused': 'Refused',
    'withdrawn': 'Withdrawn',
    'pending': 'Pending',
    'decided': 'Decided',
  };

  const lower = decision.toLowerCase();
  for (const [key, value] of Object.entries(decisionMap)) {
    if (lower.includes(key)) return value;
  }

  return decision;
}

function isSignificantDevelopment(description: string): boolean {
  // Filter for significant commercial/industrial developments
  const keywords = [
    'commercial',
    'industrial',
    'office',
    'warehouse',
    'factory',
    'retail',
    'hotel',
    'residential development',
    'mixed use',
    'business park',
    'employment',
    'units',
    'sqm',
    'sq m',
    'hectare',
  ];

  const lower = description.toLowerCase();
  return keywords.some(kw => lower.includes(kw));
}

/**
 * Fetch recent planning applications
 */
export async function fetchPlanningApplications(daysBack: number = 7): Promise<{
  signals: PlanningSignal[];
  error?: string;
}> {
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - daysBack);
  const fromDateStr = fromDate.toISOString().split('T')[0];

  try {
    // The planning.data.gov.uk API uses different endpoints
    // Using the entity search for planning applications
    const url = `${BASE_URL}/entity.json?dataset=planning-application&entry_date_since=${fromDateStr}&limit=100`;

    console.log(`[Planning Data] Fetching applications from ${fromDateStr}`);

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      // Try alternative endpoint format
      console.log('[Planning Data] Primary endpoint failed, trying alternative...');

      const altUrl = `${BASE_URL}/api/v1/planning-application?start_date=${fromDateStr}`;
      const altResponse = await fetch(altUrl);

      if (!altResponse.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }
    }

    const data: PlanningResponse = await response.json();
    const allSignals: PlanningSignal[] = [];

    for (const app of data.entities || []) {
      const description = app.description || app.name || '';

      // Skip insignificant applications
      if (!isSignificantDevelopment(description)) continue;

      const companyName = extractCompanyFromDescription(description);
      const decision = app.planning_decision;
      const isApproved = decision?.toLowerCase().includes('approved') ||
        decision?.toLowerCase().includes('granted');

      allSignals.push({
        company_name: companyName,
        company_domain: extractDomainFromName(),
        signal_title: isApproved
          ? `Planning approved: ${description.slice(0, 100)}`
          : `Planning submitted: ${description.slice(0, 100)}`,
        signal_detail: description,
        signal_url: app.documentation_url || `https://www.planning.data.gov.uk/entity/${app.reference}`,
        location: app.address || null,
        reference: app.reference,
        decision: formatDecision(decision),
      });
    }

    console.log(`[Planning Data] Found ${allSignals.length} significant planning applications`);

    return { signals: allSignals };
  } catch (error) {
    console.error('[Planning Data] Error:', error);
    return {
      signals: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Sync planning applications to the signals database
 */
export async function syncPlanningApplications(daysBack: number = 7): Promise<{
  success: boolean;
  found: number;
  new: number;
  error?: string;
}> {
  const supabase = createAdminClient();

  const { signals, error } = await fetchPlanningApplications(daysBack);

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
    console.log('[Planning Data] No new signals to insert');
    return { success: true, found: signals.length, new: 0 };
  }

  const signalsToInsert = newSignals.map(signal => ({
    source_type: 'search' as const,
    source_id: null,
    search_run_id: null,
    signal_type: (signal.decision === 'Approved' ? 'planning_approved' : 'planning_submitted') as 'planning_approved' | 'planning_submitted',
    company_name: signal.company_name,
    company_domain: signal.company_domain,
    signal_title: signal.signal_title,
    signal_detail: `${signal.signal_detail} | Ref: ${signal.reference} | Status: ${signal.decision}`,
    signal_url: signal.signal_url,
    location: signal.location,
    industry: 'construction',
    hash: generateFingerprint(signal),
    detected_at: new Date().toISOString(),
    is_new: true,
  }));

  const { error: insertError } = await supabase
    .from('signals')
    .upsert(signalsToInsert, { onConflict: 'hash', ignoreDuplicates: true });

  if (insertError) {
    console.error('[Planning Data] Insert error:', insertError);
    return { success: false, found: signals.length, new: 0, error: insertError.message };
  }

  console.log(`[Planning Data] Inserted ${newSignals.length} new signals`);
  return { success: true, found: signals.length, new: newSignals.length };
}
