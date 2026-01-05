// src/lib/ai/company-research.ts

import { searchCompanyWebsite } from './tavily';
import { tavily } from '@tavily/core';

const tavilyClient = tavily({ apiKey: process.env.TAVILY_API_KEY! });

export interface CompanyResearchResult {
  // Domain info
  domain: string | null;
  domainConfidence: number;

  // Website content
  websiteContent: string;
  aboutPage: string | null;
  servicesPage: string | null;

  // Additional info from search
  companyDescription: string | null;
  newsSnippets: string[];

  // Research metadata
  searchesPerformed: number;
  researchedAt: string;
}

/**
 * Research a company using Tavily web search
 *
 * Steps:
 * 1. Find/verify company domain (reuse existing function)
 * 2. Get website content from about/services pages
 * 3. Search for company news and descriptions
 */
export async function researchCompany(
  companyName: string,
  existingDomain?: string | null
): Promise<CompanyResearchResult> {
  console.log(`[Company Research] Starting research for: ${companyName}`);
  let searchCount = 0;

  // Step 1: Get domain (use existing or find it)
  let domain = existingDomain;
  let domainConfidence = existingDomain ? 80 : 0;

  if (!domain) {
    const domainResult = await searchCompanyWebsite(companyName);
    domain = domainResult.domain;
    domainConfidence = domainResult.confidence;
    searchCount += 3; // searchCompanyWebsite does 3 searches
  }

  // Step 2: Get website content if we have a domain
  let websiteContent = '';
  let aboutPage: string | null = null;
  let servicesPage: string | null = null;

  if (domain) {
    try {
      // Search for about page content
      const aboutSearch = await tavilyClient.search(
        `site:${domain} about us company`,
        { searchDepth: 'advanced', maxResults: 3, includeAnswer: true }
      );
      searchCount++;

      aboutPage = aboutSearch.answer || null;
      websiteContent += aboutSearch.results
        ?.map(r => `[${r.title}]\n${r.content}`)
        .join('\n\n') || '';

      // Search for services page content
      const servicesSearch = await tavilyClient.search(
        `site:${domain} services what we do solutions`,
        { searchDepth: 'advanced', maxResults: 3, includeAnswer: true }
      );
      searchCount++;

      servicesPage = servicesSearch.answer || null;
      websiteContent += '\n\n' + (servicesSearch.results
        ?.map(r => `[${r.title}]\n${r.content}`)
        .join('\n\n') || '');

    } catch (error) {
      console.error(`[Company Research] Error fetching website content:`, error);
    }
  }

  // Step 3: Search for company description and news
  let companyDescription: string | null = null;
  const newsSnippets: string[] = [];

  try {
    const descriptionSearch = await tavilyClient.search(
      `"${companyName}" company about industry sector`,
      { searchDepth: 'basic', maxResults: 5, includeAnswer: true }
    );
    searchCount++;

    companyDescription = descriptionSearch.answer || null;

    // Extract news snippets (filter out the company's own website)
    const domainLower = domain?.toLowerCase() || '';
    for (const result of descriptionSearch.results || []) {
      const resultDomain = new URL(result.url).hostname.toLowerCase();
      if (!resultDomain.includes(domainLower) && result.content) {
        newsSnippets.push(`[${result.title}] ${result.content}`);
      }
    }
  } catch (error) {
    console.error(`[Company Research] Error searching for company info:`, error);
  }

  console.log(`[Company Research] Completed for ${companyName}. Domain: ${domain}, Searches: ${searchCount}`);

  return {
    domain,
    domainConfidence,
    websiteContent: websiteContent.slice(0, 30000), // Limit size
    aboutPage,
    servicesPage,
    companyDescription,
    newsSnippets: newsSnippets.slice(0, 5),
    searchesPerformed: searchCount,
    researchedAt: new Date().toISOString(),
  };
}

/**
 * Lightweight version - just get domain and basic description
 * Use when you already have some company info and just need to verify
 */
export async function quickResearchCompany(
  companyName: string,
  existingDomain?: string | null
): Promise<{
  domain: string | null;
  description: string | null;
  confidence: number;
}> {
  if (existingDomain) {
    // Just get a quick description
    try {
      const search = await tavilyClient.search(
        `"${companyName}" company sector industry`,
        { searchDepth: 'basic', maxResults: 3, includeAnswer: true }
      );
      return {
        domain: existingDomain,
        description: search.answer || null,
        confidence: 80,
      };
    } catch {
      return { domain: existingDomain, description: null, confidence: 60 };
    }
  }

  // Find domain
  const domainResult = await searchCompanyWebsite(companyName);
  return {
    domain: domainResult.domain,
    description: null,
    confidence: domainResult.confidence,
  };
}
