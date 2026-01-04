// src/lib/ai/tavily.ts
import { tavily } from '@tavily/core';

const tavilyClient = tavily({ apiKey: process.env.TAVILY_API_KEY! });

export async function searchCompanyWebsite(companyName: string): Promise<{
  domain: string | null;
  confidence: number;
  source: 'tavily';
  snippets: string[];
}> {
  try {
    const response = await tavilyClient.search(
      `${companyName} UK official website homepage`,
      {
        searchDepth: 'basic',
        maxResults: 5,
        includeAnswer: true,
      }
    );

    // Extract domain from top result
    if (response.results && response.results.length > 0) {
      const topResult = response.results[0];
      const url = new URL(topResult.url);
      const domain = url.hostname.replace(/^www\./, '');

      return {
        domain,
        confidence: 80,
        source: 'tavily',
        snippets: response.results.map(r => r.content).slice(0, 3),
      };
    }

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
        isRecruitmentAgency: z.boolean().describe('True if this is a recruitment/staffing agency'),
        confidence: z.number().min(0).max(100).describe('Confidence percentage'),
        reasoning: z.string().describe('Explanation of the classification decision'),
        evidence: z.array(z.string()).describe('Specific evidence from the website'),
      }),
      prompt: `Analyze if "${companyName}" (${domain}) is a RECRUITMENT/STAFFING AGENCY.

WEBSITE CONTENT:
${contentToAnalyze}

---

## CLASSIFICATION RULES

### MARK AS RECRUITMENT AGENCY (isRecruitmentAgency: true) IF:

The company's CORE BUSINESS MODEL is connecting job seekers with employers for a fee. Look for:

1. **Two-sided marketplace language:**
   - "Looking for a job? / Looking to hire?"
   - Separate "Candidates" and "Employers/Clients" sections
   - "Register your CV" + "Post a vacancy"

2. **Placement/staffing language:**
   - "We place candidates", "We find talent for you"
   - "Staffing solutions", "Contract staffing", "Temp-to-perm"
   - "Recruitment consultants", "Our recruiters"
   - "We've placed X,000 candidates"

3. **Revenue model indicators:**
   - Charges employers fees to find candidates
   - Provides contractors/temps on their payroll
   - "Our clients include [company logos]"

**EXAMPLES OF TRUE AGENCIES:**
- Hays, Robert Half, Michael Page, Randstad, Adecco
- Any company saying "we recruit for our clients"
- Staffing firms that employ contractors

### MARK AS NOT AN AGENCY (isRecruitmentAgency: false) IF:

1. **Regular company with careers page:**
   - Has "Join our team" or "Work with us" for THEIR OWN jobs
   - Lists internal positions only
   - This is just normal hiring, NOT an agency

2. **HR Software/Tech companies:**
   - Builds recruitment software, ATS, job boards
   - "Our platform helps recruiters..."
   - Sells tools, doesn't do recruiting

3. **Consulting/Professional services:**
   - Provides consulting, IT services, engineering services
   - Delivers projects with their own employees
   - Not placing people at client sites permanently

4. **Outsourcing companies:**
   - Runs operations for clients (call centers, IT support)
   - Employs people to deliver services, not place them

**EXAMPLES OF NON-AGENCIES:**
- Tesco (retailer with careers page)
- Workday (HR software)
- Accenture (consulting, employs own staff)
- Indeed (job board, doesn't place candidates)

### CONFIDENCE GUIDELINES:
- 90-100%: Crystal clear from website (explicit "recruitment agency" statement)
- 70-89%: Strong evidence (multiple indicators present)
- 50-69%: Mixed signals (some indicators, but unclear)
- Below 50%: Insufficient evidence (default to NOT agency)

Analyze the content and make your determination.`,
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
