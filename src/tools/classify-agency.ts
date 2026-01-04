// src/tools/classify-agency.ts
import { analyzeCompanyWebsite, searchCompanyWebsite } from '@/lib/ai/tavily';

/**
 * Agency Classification Tool
 *
 * WORKFLOW:
 * 1. If no domain provided, find it via Tavily search
 * 2. Fetch website content via Tavily
 * 3. Send content to Claude for analysis
 * 4. Combine with SIC codes for final classification
 *
 * The key innovation: Claude reads the actual website content
 * and understands the business model, not just pattern matching.
 */
export async function classifyAgency(
  companyName: string,
  domain?: string,
  sicCodes?: string[]
) {
  // Step 1: Find domain if not provided
  let resolvedDomain = domain;
  if (!resolvedDomain) {
    const domainResult = await searchCompanyWebsite(companyName);
    resolvedDomain = domainResult.domain || undefined;
  }

  // Step 2: Quick check - SIC code 78100 is definitive
  const recruitmentSicCodes = ['78100', '78200', '78300'];
  const hasSicMatch = sicCodes?.some(code => recruitmentSicCodes.includes(code));
  if (hasSicMatch) {
    return {
      isRecruitmentAgency: true,
      confidence: 95,
      needsReview: false,
      reasoning: 'SIC code 78100 = Employment placement agencies (definitive match)',
      domain: resolvedDomain || null,
      evidence: [`SIC codes: ${sicCodes?.join(', ')}`],
    };
  }

  // Step 3: Analyze website content with Claude
  if (resolvedDomain) {
    const websiteAnalysis = await analyzeCompanyWebsite(resolvedDomain, companyName);

    return {
      isRecruitmentAgency: websiteAnalysis.isRecruitmentAgency,
      confidence: websiteAnalysis.confidence,
      needsReview: websiteAnalysis.confidence >= 40 && websiteAnalysis.confidence < 70,
      reasoning: websiteAnalysis.reasoning,
      domain: resolvedDomain,
      evidence: websiteAnalysis.evidence,
    };
  }

  // Step 4: Fallback to name pattern matching (lowest confidence)
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
    evidence: isLikelyAgency ? ['Name pattern match'] : [],
  };
}
