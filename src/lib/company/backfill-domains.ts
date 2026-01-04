/**
 * Domain Backfill Utility
 *
 * Resolves domains for companies that don't have one.
 * Uses the existing domain-resolver.ts strategies:
 * 1. Google search via Firecrawl (60% confidence)
 * 2. DNS validation guess (40% confidence)
 */

import { createAdminClient } from '@/lib/supabase/server';
import { resolveDomain } from '@/lib/domain-resolver';

export interface BackfillResult {
  total: number;
  resolved: number;
  still_unresolved: number;
  errors: number;
  companies_processed: Array<{
    id: string;
    name: string;
    domain: string | null;
    source: string;
    confidence: number;
  }>;
}

/**
 * Backfill domains for companies without them
 *
 * @param batchSize - Number of companies to process (default 50)
 * @param delayMs - Delay between domain resolutions (default 500ms)
 * @param skipGoogle - Skip Firecrawl/Google search to save API calls
 */
export async function backfillDomainResolution(
  batchSize: number = 50,
  delayMs: number = 500,
  skipGoogle: boolean = false
): Promise<BackfillResult> {
  const supabase = createAdminClient();

  const result: BackfillResult = {
    total: 0,
    resolved: 0,
    still_unresolved: 0,
    errors: 0,
    companies_processed: [],
  };

  // Get companies without domains
  const { data: companies, error: fetchError } = await supabase
    .from('companies')
    .select('id, name, name_normalized')
    .is('domain', null)
    .order('last_activity_at', { ascending: false, nullsFirst: false })
    .limit(batchSize);

  if (fetchError) {
    console.error('[backfill-domains] Error fetching companies:', fetchError);
    throw fetchError;
  }

  if (!companies || companies.length === 0) {
    console.log('[backfill-domains] No companies without domains found');
    return result;
  }

  result.total = companies.length;
  console.log(`[backfill-domains] Processing ${companies.length} companies...`);

  for (let i = 0; i < companies.length; i++) {
    const company = companies[i];

    try {
      console.log(`[backfill-domains] [${i + 1}/${companies.length}] Resolving: ${company.name}`);

      // Use existing domain resolver
      const domainResult = await resolveDomain(company.name, {
        skipGoogle: skipGoogle,
        skipCache: true, // Always fresh lookup for backfill
      });

      if (domainResult.domain && domainResult.confidence >= 40) {
        // Update company with resolved domain
        const { error: updateError } = await supabase
          .from('companies')
          .update({
            domain: domainResult.domain,
            domain_source: domainResult.source,
          })
          .eq('id', company.id);

        if (updateError) {
          console.error(`[backfill-domains] Error updating ${company.name}:`, updateError);
          result.errors++;
        } else {
          console.log(`[backfill-domains] Resolved: ${company.name} -> ${domainResult.domain} (${domainResult.source}, ${domainResult.confidence}%)`);
          result.resolved++;
        }

        result.companies_processed.push({
          id: company.id,
          name: company.name,
          domain: domainResult.domain,
          source: domainResult.source,
          confidence: domainResult.confidence,
        });
      } else {
        console.log(`[backfill-domains] Could not resolve: ${company.name}`);
        result.still_unresolved++;

        // Mark as attempted (update domain_source to 'unresolved')
        await supabase
          .from('companies')
          .update({ domain_source: 'unresolved' })
          .eq('id', company.id);

        result.companies_processed.push({
          id: company.id,
          name: company.name,
          domain: null,
          source: 'none',
          confidence: 0,
        });
      }
    } catch (error) {
      console.error(`[backfill-domains] Error processing ${company.name}:`, error);
      result.errors++;
      result.companies_processed.push({
        id: company.id,
        name: company.name,
        domain: null,
        source: 'error',
        confidence: 0,
      });
    }

    // Rate limiting - avoid hammering external services
    if (i < companies.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  console.log(`[backfill-domains] Complete: ${result.resolved} resolved, ${result.still_unresolved} unresolved, ${result.errors} errors`);

  return result;
}

/**
 * Get domain coverage statistics
 */
export async function getDomainCoverageStats(): Promise<{
  total: number;
  with_domain: number;
  without_domain: number;
  coverage_percent: number;
  by_source: Record<string, number>;
}> {
  const supabase = createAdminClient();

  // Get all companies
  const { data: companies } = await supabase
    .from('companies')
    .select('domain, domain_source');

  if (!companies) {
    return {
      total: 0,
      with_domain: 0,
      without_domain: 0,
      coverage_percent: 0,
      by_source: {},
    };
  }

  const total = companies.length;
  const with_domain = companies.filter(c => c.domain && c.domain.trim()).length;
  const without_domain = total - with_domain;

  // Count by source
  const by_source: Record<string, number> = {};
  for (const company of companies) {
    const source = company.domain_source || (company.domain ? 'unknown' : 'none');
    by_source[source] = (by_source[source] || 0) + 1;
  }

  return {
    total,
    with_domain,
    without_domain,
    coverage_percent: total > 0 ? Math.round((with_domain / total) * 1000) / 10 : 0,
    by_source,
  };
}
