// src/lib/ai/tavily.ts
import { tavily } from '@tavily/core';

const tavilyClient = tavily({ apiKey: process.env.TAVILY_API_KEY! });

/**
 * EXCLUDED DOMAINS
 * These are B2B data tools, job boards, directories, and other sites that
 * appear in search results but are NOT company websites.
 */
const EXCLUDED_DOMAINS = new Set([
  // B2B Sales/Data Tools (often appear when searching companies)
  'leadiq.com', 'clearbit.com', 'zoominfo.com', 'apollo.io', 'lusha.com',
  'cognism.com', 'seamless.ai', 'hunter.io', 'rocketreach.co', 'contactout.com',
  'kaspr.io', 'salesintel.io', 'uplead.com', 'snov.io', 'findthatlead.com',
  'leadfeeder.com', 'datanyze.com', 'discoverorg.com', 'd-and-b.com', 'dnb.com',

  // Job Boards & Recruitment Platforms
  'linkedin.com', 'uk.linkedin.com', 'in.linkedin.com', 'de.linkedin.com', 'fr.linkedin.com',
  'indeed.com', 'glassdoor.com', 'reed.co.uk', 'totaljobs.com',
  'cv-library.co.uk', 'monster.com', 'jobsite.co.uk', 'cwjobs.co.uk', 'adzuna.co.uk',
  'simplyhired.com', 'careerbuilder.com', 'ziprecruiter.com', 'jooble.org',

  // Business Directories & Review Sites
  'yelp.com', 'yell.com', 'trustpilot.com', 'g2.com', 'capterra.com',
  'thomasnet.com', 'manta.com', 'bbb.org', 'yellowpages.com', 'hotfrog.co.uk',
  'cylex-uk.co.uk', 'scoot.co.uk', 'thebestof.co.uk', 'freeindex.co.uk',

  // Company Data/Registry Sites
  'companieshouse.gov.uk', 'find-and-update.company-information.service.gov.uk',
  'duedil.com', 'endole.co.uk', 'companycheck.co.uk', 'opencorporates.com',
  'crunchbase.com', 'pitchbook.com', 'owler.com', 'craft.co',

  // News/Media Sites
  'bbc.co.uk', 'theguardian.com', 'telegraph.co.uk', 'independent.co.uk',
  'dailymail.co.uk', 'mirror.co.uk', 'express.co.uk', 'standard.co.uk',
  'reuters.com', 'bloomberg.com', 'ft.com', 'forbes.com', 'businessinsider.com',

  // Social Media
  'facebook.com', 'twitter.com', 'instagram.com', 'youtube.com', 'tiktok.com',
  'pinterest.com', 'reddit.com', 'quora.com',

  // General Reference
  'wikipedia.org', 'wikimedia.org', 'britannica.com', 'dictionary.com',

  // Government Sites (not company sites)
  'gov.uk', 'nhs.uk', 'police.uk',
]);

/**
 * Check if a domain should be excluded
 */
function isExcludedDomain(domain: string): boolean {
  const cleanDomain = domain.toLowerCase().replace(/^www\./, '');

  // Direct match
  if (EXCLUDED_DOMAINS.has(cleanDomain)) return true;

  // Check if it's a subdomain of excluded domain
  for (const excluded of EXCLUDED_DOMAINS) {
    if (cleanDomain.endsWith(`.${excluded}`)) return true;
  }

  return false;
}

/**
 * Calculate relevance score for a search result
 * Higher score = more likely to be the actual company website
 */
// Common words to ignore when scoring (they appear everywhere)
const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'are', 'was', 'were',
  'been', 'being', 'have', 'has', 'had', 'will', 'would', 'could', 'should',
  'may', 'might', 'must', 'shall', 'can', 'need', 'our', 'your', 'their',
  'its', 'his', 'her', 'all', 'any', 'both', 'each', 'few', 'more', 'most',
  'other', 'some', 'such', 'than', 'too', 'very', 'just', 'but', 'not',
  'only', 'own', 'same', 'into', 'over', 'also', 'new', 'one', 'two',
]);

function calculateRelevanceScore(
  companyName: string,
  result: { url: string; title: string; content: string }
): number {
  let score = 0;
  const cleanCompanyName = companyName.toLowerCase()
    .replace(/^the\s+/i, '') // Remove leading "The"
    .replace(/\s+(ltd|limited|plc|llp|inc|corp|co|company|uk|group|holdings)\.?$/gi, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();

  // Filter out short words and stop words
  const companyWords = cleanCompanyName.split(/\s+/)
    .filter(w => w.length > 2)
    .filter(w => !STOP_WORDS.has(w));
  const domain = new URL(result.url).hostname.toLowerCase().replace(/^www\./, '');
  const title = result.title.toLowerCase();
  const content = result.content.toLowerCase();

  // DOMAIN SCORING (most important)
  // Check if company name words appear in domain
  const domainWithoutTld = domain.replace(/\.(com|co\.uk|org|org\.uk|net|io|uk|eu|biz|info)$/, '');

  for (const word of companyWords) {
    if (domainWithoutTld.includes(word)) {
      score += 30; // Strong signal: word in domain
    }
  }

  // Bonus: domain starts with first company word
  if (companyWords[0] && domainWithoutTld.startsWith(companyWords[0])) {
    score += 20;
  }

  // Bonus: domain is close match to company name (e.g., "bread-factory.co.uk" for "Bread Factory")
  const compactName = companyWords.join('');
  const hyphenatedName = companyWords.join('-');
  if (domainWithoutTld === compactName || domainWithoutTld === hyphenatedName) {
    score += 50; // Perfect match
  }

  // TITLE SCORING
  for (const word of companyWords) {
    if (title.includes(word)) {
      score += 10; // Word in title
    }
  }

  // Bonus: title contains full company name
  if (title.includes(cleanCompanyName)) {
    score += 25;
  }

  // CONTENT SCORING (lower weight - can be noisy)
  for (const word of companyWords) {
    if (content.includes(word)) {
      score += 2; // Word mentioned in content
    }
  }

  // NEGATIVE SIGNALS
  // Result is about multiple companies (directory listing)
  const directoryPatterns = [
    /\d+\s*(companies|businesses|results)/i,
    /list of/i, /directory/i, /comparison/i, /vs\./i,
    /top \d+/i, /best \d+/i,
  ];
  for (const pattern of directoryPatterns) {
    if (pattern.test(title) || pattern.test(content.slice(0, 200))) {
      score -= 30;
    }
  }

  return Math.max(0, score);
}

export async function searchCompanyWebsite(companyName: string): Promise<{
  domain: string | null;
  confidence: number;
  source: 'tavily';
  snippets: string[];
}> {
  try {
    console.log(`[Tavily] Searching for website: ${companyName}`);

    // Clean company name for better search (remove "The", suffixes)
    const searchName = companyName
      .replace(/^the\s+/i, '')
      .replace(/\s+(ltd|limited|plc|llp|inc|corp|co|company|uk|group|holdings)\.?$/gi, '')
      .trim();

    console.log(`[Tavily] Search name cleaned: "${companyName}" -> "${searchName}"`);

    // Run multiple search queries for better coverage
    const searches = await Promise.all([
      tavilyClient.search(
        `"${searchName}" official website`,
        { searchDepth: 'basic', maxResults: 5, includeAnswer: false }
      ),
      tavilyClient.search(
        `${searchName} company homepage`,
        { searchDepth: 'basic', maxResults: 5, includeAnswer: false }
      ),
      tavilyClient.search(
        `${searchName} UK contact us`,
        { searchDepth: 'basic', maxResults: 5, includeAnswer: false }
      ),
    ]);

    // Combine and deduplicate results
    const allResults = searches.flatMap(s => s.results || []);
    const seenUrls = new Set<string>();
    const uniqueResults = allResults.filter(r => {
      const dominated = seenUrls.has(r.url);
      seenUrls.add(r.url);
      return !dominated;
    });

    console.log(`[Tavily] Found ${uniqueResults.length} unique results for ${companyName}`);

    // Score and filter results
    const scoredResults = uniqueResults
      .map(result => {
        const url = new URL(result.url);
        const domain = url.hostname.replace(/^www\./, '');
        const score = calculateRelevanceScore(companyName, result);
        const excluded = isExcludedDomain(domain);

        return { result, domain, score, excluded };
      })
      .filter(r => !r.excluded) // Remove excluded domains
      .filter(r => r.score > 0)  // Must have some relevance
      .sort((a, b) => b.score - a.score); // Sort by score descending

    console.log(`[Tavily] Scored results:`, scoredResults.map(r => ({
      domain: r.domain,
      score: r.score,
      title: r.result.title.slice(0, 50),
    })));

    if (scoredResults.length > 0) {
      const best = scoredResults[0];

      // Confidence based on score
      let confidence = 50;
      if (best.score >= 100) confidence = 90;
      else if (best.score >= 70) confidence = 80;
      else if (best.score >= 40) confidence = 70;
      else if (best.score >= 20) confidence = 60;

      console.log(`[Tavily] Best match for ${companyName}: ${best.domain} (score: ${best.score}, confidence: ${confidence})`);

      return {
        domain: best.domain,
        confidence,
        source: 'tavily',
        snippets: scoredResults.slice(0, 3).map(r => r.result.content),
      };
    }

    console.log(`[Tavily] No valid results found for ${companyName}`);
    return { domain: null, confidence: 0, source: 'tavily', snippets: [] };
  } catch (error) {
    console.error('[Tavily] Search failed:', error);
    return { domain: null, confidence: 0, source: 'tavily', snippets: [] };
  }
}

/**
 * Analyze a company's website to determine if it's a recruitment agency
 *
 * WORKFLOW:
 * 1. Fetch website content via Tavily (gets page text, meta descriptions, etc.)
 * 2. Send content to Claude for analysis
 * 3. Claude determines if business model is recruitment/staffing
 *
 * Key indicators Claude looks for:
 * - Services for BOTH job seekers AND employers
 * - Candidate portals, CV submission forms
 * - Job board functionality
 * - Language like "we place candidates", "staffing solutions"
 * - NOT: companies that simply have a careers page
 */
export async function analyzeCompanyWebsite(domain: string, companyName: string): Promise<{
  isRecruitmentAgency: boolean;
  confidence: number;
  reasoning: string;
  evidence: string[];
}> {
  try {
    console.log(`[Website Analysis] Starting analysis for: ${companyName} (${domain})`);

    // Step 1: Get website content via multiple Tavily searches for comprehensive coverage
    const searches = await Promise.all([
      // Main about/services pages
      tavilyClient.search(`site:${domain} about us services`, {
        searchDepth: 'advanced',
        maxResults: 5,
        includeAnswer: true,
      }),
      // Look for recruitment-specific content
      tavilyClient.search(`site:${domain} candidates employers jobs recruitment staffing`, {
        searchDepth: 'advanced',
        maxResults: 5,
        includeAnswer: false,
      }),
      // Homepage and company description
      tavilyClient.search(`"${domain}" company what we do homepage`, {
        searchDepth: 'basic',
        maxResults: 3,
        includeAnswer: true,
      }),
    ]);

    // Combine all content
    const allAnswers = searches.map(r => r.answer || '').filter(Boolean).join('\n\n');
    const allSnippets = searches.flatMap(r =>
      r.results?.map(result => `[${result.title}]\n${result.content}`) || []
    ).join('\n\n---\n\n');

    const allContent = `TAVILY AI SUMMARIES:\n${allAnswers}\n\nPAGE CONTENT:\n${allSnippets}`;

    console.log(`[Website Analysis] Collected ${allContent.length} chars of content for ${companyName}`);

    if (allContent.length < 100) {
      console.log(`[Website Analysis] Insufficient content for ${companyName}`);
      return {
        isRecruitmentAgency: false,
        confidence: 0,
        reasoning: 'Could not fetch enough website content to analyze',
        evidence: [],
      };
    }

    // Step 2: Send to Claude for analysis (increased content limit to 50k chars)
    const { createAnthropic } = await import('@ai-sdk/anthropic');
    const { generateObject } = await import('ai');
    const { z } = await import('zod');

    const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const contentToAnalyze = allContent.slice(0, 50000); // 50k chars = ~12k tokens, plenty of room

    console.log(`[Website Analysis] Sending ${contentToAnalyze.length} chars to Claude for ${companyName}`);

    const { object: analysis } = await generateObject({
      model: anthropic('claude-sonnet-4-20250514'),
      schema: z.object({
        isRecruitmentAgency: z.boolean().describe('True if company specializes in recruitment/hiring activities'),
        confidence: z.number().min(0).max(100).describe('How certain you are'),
        reasoning: z.string().describe('Brief explanation of your decision'),
        evidence: z.array(z.string()).describe('Key evidence from the website'),
      }),
      prompt: `# TASK: Does "${companyName}" specialize in recruitment/hiring activities?

## COMPANY INFO
- Name: ${companyName}
- Domain: ${domain}

## WEBSITE CONTENT
${contentToAnalyze}

---

# CLASSIFICATION: RECRUITMENT-FOCUSED BUSINESS?

## THE QUESTION

Is this company's **PRIMARY BUSINESS** focused on recruitment, hiring, or connecting job seekers with employers?

**Mark as YES (isRecruitmentAgency = true)** if ANY of these apply:

### 1. RECRUITMENT AGENCIES
- Places candidates at client companies
- Staffing/temp agencies
- Executive search firms
- Examples: Hays, Michael Page, Robert Half, Adecco

### 2. JOB BOARDS & CAREER PLATFORMS
- Operates a job board where employers post vacancies
- Career/jobs website
- Job aggregators
- Examples: Indeed, Glassdoor, eFinancialCareers, Totaljobs, Reed, Monster

### 3. RECRUITMENT TECHNOLOGY
- ATS (Applicant Tracking Systems)
- Recruitment software
- Hiring platforms
- Examples: Workday Recruiting, Greenhouse, Lever, SmartRecruiters

### 4. HR/TALENT SERVICES
- RPO (Recruitment Process Outsourcing)
- Talent acquisition consulting
- Employer branding for hiring
- Background check/screening services for hiring

---

## Mark as NO (isRecruitmentAgency = false) if:

1. **Normal company with careers page** - Just hiring for their own jobs
2. **Non-recruitment business** - Sells products/services unrelated to hiring
3. **General HR software** - Payroll, benefits, time tracking (not hiring-focused)
4. **Consulting firms** - Deliver projects with own employees (Accenture, Deloitte)
5. **Outsourcing/BPO** - Run operations, don't place candidates (call centers)

---

## KEY DISTINCTION

**YES** = Their business IS recruitment/hiring
- "We help companies find talent"
- "Post your job / Find your next role"
- "We place candidates"

**NO** = They just HAVE jobs (like everyone else)
- "Join our team" / "Careers at [Company]"
- They're hiring for themselves, not others

---

## CONFIDENCE GUIDE

| Score | When to Use |
|-------|-------------|
| 90-100% | Clearly a recruitment/jobs business |
| 70-89% | Strong signals (job board, staffing language) |
| 50-69% | Some recruitment activity but unclear if primary |
| 0-49% | Normal company, mark as NO |

---

Analyze and classify "${companyName}".`,
    });

    console.log(`[Website Analysis] Result for ${companyName}: isAgency=${analysis.isRecruitmentAgency}, confidence=${analysis.confidence}`);
    console.log(`[Website Analysis] Reasoning: ${analysis.reasoning}`);

    return analysis;
  } catch (error) {
    console.error('[Website Analysis] Failed:', error);
    return {
      isRecruitmentAgency: false,
      confidence: 0,
      reasoning: `Analysis failed: ${error}`,
      evidence: [],
    };
  }
}
