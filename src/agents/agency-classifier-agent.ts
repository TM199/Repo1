// src/agents/agency-classifier-agent.ts
import { searchCompanyWebsite, analyzeCompanyWebsite } from '@/lib/ai/tavily';
import { z } from 'zod';

// Output schema for structured results
export const ClassificationResultSchema = z.object({
  isRecruitmentAgency: z.boolean(),
  confidence: z.number().min(0).max(100),
  needsReview: z.boolean(),
  reasoning: z.string(),
  domain: z.string().nullable(),
  sicCodes: z.array(z.string()),
});

export type ClassificationResult = z.infer<typeof ClassificationResultSchema>;

/**
 * Classify a company as a recruitment agency or not
 *
 * WORKFLOW:
 * 1. Check SIC codes for 78100 (definitive match)
 * 2. Find domain via Tavily if not provided
 * 3. Analyze website content with Claude
 * 4. Fall back to name pattern matching
 */
export async function classifyCompany(
  companyName: string,
  options?: {
    domain?: string;
    sicCodes?: string[];
    useTools?: boolean;
  }
): Promise<ClassificationResult> {
  const { domain, sicCodes, useTools = true } = options || {};

  // Fast path: If we have SIC codes, check for 78100 first
  const recruitmentSicCodes = ['78100', '78200', '78300'];
  if (sicCodes?.some(code => recruitmentSicCodes.includes(code))) {
    return {
      isRecruitmentAgency: true,
      confidence: 95,
      needsReview: false,
      reasoning: 'SIC code 78100/78200/78300 = Employment placement agencies (definitive match)',
      domain: domain || null,
      sicCodes: sicCodes || [],
    };
  }

  // If not using tools, do a simple pattern match
  if (!useTools) {
    const patterns = [/recruit/i, /staffing/i, /personnel/i, /agency/i, /headhunt/i];
    const matches = patterns.filter(p => p.test(companyName));
    const isAgency = matches.length >= 2;

    return {
      isRecruitmentAgency: isAgency,
      confidence: isAgency ? 70 : 30,
      needsReview: matches.length === 1,
      reasoning: isAgency
        ? `Company name matches ${matches.length} recruitment patterns`
        : 'No strong recruitment indicators in company name',
      domain: domain || null,
      sicCodes: sicCodes || [],
    };
  }

  // Step 1: Find domain if not provided
  let resolvedDomain = domain;
  if (!resolvedDomain) {
    const domainResult = await searchCompanyWebsite(companyName);
    resolvedDomain = domainResult.domain || undefined;
  }

  // Step 2: Analyze website content with Claude
  if (resolvedDomain) {
    const websiteAnalysis = await analyzeCompanyWebsite(resolvedDomain, companyName);

    return {
      isRecruitmentAgency: websiteAnalysis.isRecruitmentAgency,
      confidence: websiteAnalysis.confidence,
      needsReview: websiteAnalysis.confidence >= 40 && websiteAnalysis.confidence < 70,
      reasoning: websiteAnalysis.reasoning,
      domain: resolvedDomain,
      sicCodes: sicCodes || [],
    };
  }

  // Step 3: Fallback to name pattern matching (lowest confidence)
  const namePatterns = [
    /recruit/i, /staffing/i, /talent\s*(acquisition|partner)/i,
    /personnel/i, /resourcing/i, /headhunt/i, /placement/i,
  ];
  const matchCount = namePatterns.filter(p => p.test(companyName)).length;
  const isLikelyAgency = matchCount >= 2;

  return {
    isRecruitmentAgency: isLikelyAgency,
    confidence: isLikelyAgency ? 60 : 30,
    needsReview: true, // Always review when no website analysis
    reasoning: isLikelyAgency
      ? `Company name matches ${matchCount} recruitment patterns (no website to analyze)`
      : 'No strong recruitment indicators found (could not analyze website)',
    domain: null,
    sicCodes: sicCodes || [],
  };
}
