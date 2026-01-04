// src/tools/resolve-domain.ts
import { searchCompanyWebsite } from '@/lib/ai/tavily';

/**
 * Resolve a company name to its website domain using Tavily web search.
 * Use for: UK company names, Ltd companies, trading names.
 */
export async function resolveDomain(companyName: string) {
  const result = await searchCompanyWebsite(companyName);
  return {
    domain: result.domain,
    confidence: result.confidence,
    source: 'tavily' as const,
  };
}
