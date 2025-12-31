/**
 * Admin API: Fix Domain Data
 *
 * Clears invalid IP addresses from company domains and attempts to re-resolve them.
 * Run this once to clean up existing data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { resolveDomain, isIPAddress } from '@/lib/domain-resolver';

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  // Simple auth check - require admin secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const stats = {
    total_checked: 0,
    ip_addresses_found: 0,
    domains_cleared: 0,
    domains_resolved: 0,
    resolution_failures: 0,
  };

  try {
    // Get all companies with domains
    const { data: companies, error } = await supabase
      .from('companies')
      .select('id, name, domain')
      .not('domain', 'is', null);

    if (error) throw error;

    console.log(`[Fix Domains] Checking ${companies?.length || 0} companies with domains`);

    for (const company of companies || []) {
      stats.total_checked++;

      // Check if domain is actually an IP address
      if (company.domain && isIPAddress(company.domain)) {
        stats.ip_addresses_found++;
        console.log(`[Fix Domains] Found IP address for ${company.name}: ${company.domain}`);

        // Clear the invalid domain
        await supabase
          .from('companies')
          .update({ domain: null })
          .eq('id', company.id);

        stats.domains_cleared++;

        // Attempt to resolve the real domain
        console.log(`[Fix Domains] Attempting to resolve domain for: ${company.name}`);
        const result = await resolveDomain(company.name, {
          skipGoogle: !process.env.FIRECRAWL_API_KEY,
          skipCache: true, // Bypass cache to ensure fresh resolution
        });

        if (result.domain && result.confidence >= 40) {
          // Update with resolved domain
          await supabase
            .from('companies')
            .update({ domain: result.domain })
            .eq('id', company.id);

          stats.domains_resolved++;
          console.log(`[Fix Domains] Resolved ${company.name} -> ${result.domain} (${result.source}, ${result.confidence}%)`);
        } else {
          stats.resolution_failures++;
          console.log(`[Fix Domains] Could not resolve domain for ${company.name}`);
        }
      }
    }

    console.log(`[Fix Domains] Complete. Stats:`, stats);

    return NextResponse.json({
      success: true,
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Fix Domains] Error:', error);
    return NextResponse.json(
      { success: false, error: String(error), stats },
      { status: 500 }
    );
  }
}

// GET to check status
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Count companies with IP addresses as domains
  const { data: companies } = await supabase
    .from('companies')
    .select('id, name, domain')
    .not('domain', 'is', null);

  const companiesWithIPs = (companies || []).filter(
    c => c.domain && isIPAddress(c.domain)
  );

  return NextResponse.json({
    total_companies_with_domains: companies?.length || 0,
    companies_with_ip_addresses: companiesWithIPs.length,
    sample_ips: companiesWithIPs.slice(0, 10).map(c => ({
      name: c.name,
      domain: c.domain,
    })),
  });
}
