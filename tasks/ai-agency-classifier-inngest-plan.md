# AI Agency Classifier & Domain Resolution Implementation Plan

## Overview

Add AI-powered recruitment agency classification and domain resolution to Signal Mentis using **Vercel AI SDK 6.0** with Claude Sonnet, Tavily for web search, and Inngest for background processing.

**Scope (User Confirmed):**
- AI Agency Classification (replace 54 hardcoded regex patterns)
- AI Domain Resolution (add Tavily to waterfall)
- Inngest Migration (replace Vercel cron)
- **NOT included:** Firmographic enrichment, contact finding (keep LeadMagic/Prospeo)

---

## What You Need to Provide

### API Keys (Required)
1. **Anthropic API Key** - Get from https://console.anthropic.com
   - Cost: ~$3-5 per 1,000 classifications (Claude Sonnet)
2. **Tavily API Key** - Get from https://tavily.com
   - Cost: $8 per 1,000 searches (free tier: 1,000/month)

### Inngest Setup (Required)
1. Create account at https://www.inngest.com (free tier: 25K runs/month)
2. Get `INNGEST_SIGNING_KEY` from dashboard
3. Add to Vercel environment variables

### Environment Variables to Add
```bash
# AI Classification
ANTHROPIC_API_KEY=sk-ant-...
TAVILY_API_KEY=tvly-...

# Inngest
INNGEST_SIGNING_KEY=signkey-...
```

---

## Inngest MCP Server (For Testing & Debugging)

The Inngest MCP server lets Claude Code directly access your Inngest dev server to view logs, trigger functions, and debug issues during development.

### Setup Steps
1. **Start Inngest Dev Server:**
   ```bash
   npx --ignore-scripts=false inngest-cli@latest dev
   ```
   This starts the dev server at `http://127.0.0.1:8288` with MCP at `/mcp`

2. **Register MCP with Claude Code:**
   ```bash
   claude mcp add --transport http inngest-dev http://127.0.0.1:8288/mcp
   ```

### What This Enables (8 Tools)
| Tool | Purpose |
|------|---------|
| `send_event` | Trigger functions with test data |
| `invoke_function` | Execute functions directly |
| `list_functions` | See all registered functions |
| `get_run_status` | Inspect run details & logs |
| `poll_run_status` | Monitor multiple runs |
| `grep_docs` | Search Inngest documentation |
| `read_doc` | Access specific docs |
| `list_docs` | View doc structure |

### Benefits
- **No API keys needed** - runs locally
- **Real-time debugging** - Claude can see function execution logs
- **Direct testing** - Claude can trigger and monitor functions
- **Documentation access** - Claude can look up Inngest patterns

**Source:** https://www.inngest.com/docs/ai-dev-tools/mcp

---

## Vercel AI SDK 6.0 Implementation Guide

### Classification Workflow (How It Works)

```
┌─────────────────────────────────────────────────────────────────┐
│                    AGENCY CLASSIFICATION FLOW                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  INPUT: Company Name (e.g., "Acme Staffing Ltd")                │
│           ↓                                                      │
│  ┌──────────────────────────────────────────────────────┐       │
│  │ STEP 1: FIND DOMAIN                                  │       │
│  │ • Use Tavily to search: "Acme Staffing Ltd UK website"│      │
│  │ • Extract domain from top search result              │       │
│  │ • Result: acmestaffing.co.uk (80% confidence)        │       │
│  └──────────────────────────────────────────────────────┘       │
│           ↓                                                      │
│  ┌──────────────────────────────────────────────────────┐       │
│  │ STEP 2: FETCH COMPANIES HOUSE DATA                   │       │
│  │ • Search Companies House API for company             │       │
│  │ • Get SIC codes (78100 = recruitment agency)         │       │
│  │ • If SIC 78100 found → DEFINITE AGENCY (95%)        │       │
│  └──────────────────────────────────────────────────────┘       │
│           ↓                                                      │
│  ┌──────────────────────────────────────────────────────┐       │
│  │ STEP 3: ANALYZE WEBSITE CONTENT                      │       │
│  │ • Use Tavily to fetch website pages/content          │       │
│  │ • Get "About", "Services", homepage text             │       │
│  │ • Send content to Claude Sonnet for analysis         │       │
│  └──────────────────────────────────────────────────────┘       │
│           ↓                                                      │
│  ┌──────────────────────────────────────────────────────┐       │
│  │ STEP 4: CLAUDE ANALYZES BUSINESS MODEL               │       │
│  │ • Reads website content                              │       │
│  │ • Looks for: candidate portals, CV submission,       │       │
│  │   "we place", staffing solutions, job board          │       │
│  │ • Distinguishes: agency vs company with careers page │       │
│  │ • Returns: isAgency, confidence, reasoning, evidence │       │
│  └──────────────────────────────────────────────────────┘       │
│           ↓                                                      │
│  OUTPUT: { isRecruitmentAgency: true, confidence: 85,           │
│            reasoning: "Website offers staffing services...",     │
│            evidence: ["candidate portal", "submit CV"] }        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Key Insight:** The system doesn't just pattern match on company names. It actually reads and understands the website content to determine if the company's business model is recruitment/staffing.

---

### Package Installation

```bash
npm install ai @ai-sdk/anthropic @tavily/core inngest zod
```

### Project Structure (New Files)

```
signal-mentis/
├── src/
│   ├── lib/
│   │   └── ai/
│   │       ├── provider.ts           # AI provider configuration
│   │       └── tavily.ts             # Tavily search client
│   ├── tools/
│   │   ├── index.ts                  # Tool exports
│   │   ├── search-company.ts         # Tavily web search tool
│   │   ├── resolve-domain.ts         # Domain resolution tool
│   │   ├── classify-agency.ts        # Agency classification tool
│   │   └── fetch-companies-house.ts  # Companies House API tool
│   ├── agents/
│   │   └── agency-classifier-agent.ts # Main agent definition
│   ├── schemas/
│   │   └── classification.ts         # Zod schemas
│   └── inngest/
│       ├── client.ts                 # Inngest client
│       ├── functions/
│       │   ├── index.ts              # Export all functions
│       │   ├── generate-pain-signals.ts
│       │   ├── ingest-jobs.ts
│       │   ├── process-scan-queue.ts
│       │   └── classify-companies.ts # New: batch classification
│       └── route.ts → app/api/inngest/route.ts
```

---

### Core Implementation: AI Provider Setup

```typescript
// src/lib/ai/provider.ts
import { createAnthropic } from '@ai-sdk/anthropic';

export const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Use Claude Sonnet for classification (best reasoning for this task)
export const classificationModel = anthropic('claude-sonnet-4-20250514');
```

---

### Core Implementation: Tavily Search Client

```typescript
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
    // Step 1: Get website content via Tavily
    const response = await tavilyClient.search(
      `site:${domain} about services what we do`,
      {
        searchDepth: 'advanced',
        maxResults: 10,
        includeAnswer: true,
      }
    );

    const websiteContent = response.answer || '';
    const pageSnippets = response.results?.map(r => `${r.title}: ${r.content}`).join('\n') || '';
    const allContent = `${websiteContent}\n\n${pageSnippets}`;

    if (!allContent.trim()) {
      return {
        isRecruitmentAgency: false,
        confidence: 0,
        reasoning: 'Could not fetch website content',
        evidence: [],
      };
    }

    // Step 2: Send to Claude for analysis
    const { createAnthropic } = await import('@ai-sdk/anthropic');
    const { generateObject } = await import('ai');
    const { z } = await import('zod');

    const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const { object: analysis } = await generateObject({
      model: anthropic('claude-sonnet-4-20250514'),
      schema: z.object({
        isRecruitmentAgency: z.boolean().describe('True if this is a recruitment/staffing agency'),
        confidence: z.number().min(0).max(100).describe('Confidence percentage'),
        reasoning: z.string().describe('Explanation of the classification decision'),
        evidence: z.array(z.string()).describe('Specific evidence from the website'),
      }),
      prompt: `Analyze this website content and determine if "${companyName}" (${domain}) is a RECRUITMENT/STAFFING AGENCY.

WEBSITE CONTENT:
${allContent.slice(0, 8000)}

CLASSIFICATION CRITERIA:
A TRUE recruitment agency:
- Provides services to BOTH job seekers (candidates) AND employers
- Has candidate portals, CV submission, job application features
- Uses language like "we place", "staffing solutions", "talent acquisition"
- Their CORE BUSINESS is connecting candidates with employers

NOT a recruitment agency:
- Companies with a "Careers" page (they're hiring, not recruiting for others)
- Companies that outsource their hiring to agencies (they're clients)
- HR software companies (they make tools, not do recruiting)
- Job boards that only aggregate listings (no active placement)

Analyze the content and classify this company. Be conservative - only mark as agency if clearly evident.`,
    });

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
```

---

### Core Implementation: AI SDK Tools

```typescript
// src/tools/resolve-domain.ts
import { tool } from 'ai';
import { z } from 'zod';
import { searchCompanyWebsite } from '@/lib/ai/tavily';

export const resolveDomainTool = tool({
  description: `Resolve a company name to its website domain using Tavily web search.
Use for: UK company names, Ltd companies, trading names.
Returns: Primary domain with confidence score.`,
  parameters: z.object({
    companyName: z.string().describe('Company name to resolve (e.g., "Acme Ltd")'),
  }),
  execute: async ({ companyName }) => {
    const result = await searchCompanyWebsite(companyName);
    return {
      domain: result.domain,
      confidence: result.confidence,
      source: 'tavily',
    };
  },
});
```

```typescript
// src/tools/classify-agency.ts
import { tool } from 'ai';
import { z } from 'zod';
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
export const classifyAgencyTool = tool({
  description: `Analyze a company to determine if it's a recruitment/staffing agency.
This tool:
1. Finds the company's website if not provided
2. Fetches and analyzes the website content
3. Uses AI to understand if their business model is recruitment/staffing
4. Considers SIC codes as supporting evidence

Critical for: Filtering out recruitment agencies from job postings.`,
  parameters: z.object({
    companyName: z.string().describe('Company name'),
    domain: z.string().optional().describe('Company website domain if known'),
    sicCodes: z.array(z.string()).optional().describe('SIC codes from Companies House'),
  }),
  execute: async ({ companyName, domain, sicCodes }) => {
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
  },
});
```

```typescript
// src/tools/fetch-companies-house.ts
import { tool } from 'ai';
import { z } from 'zod';

export const fetchCompaniesHouseTool = tool({
  description: `Fetch official UK company data from Companies House API.
Returns: Company number, SIC codes, status, registered address.
Use for: UK companies only. Free API.`,
  parameters: z.object({
    companyName: z.string().optional().describe('Company name to search'),
    companyNumber: z.string().optional().describe('Companies House number if known'),
  }),
  execute: async ({ companyName, companyNumber }) => {
    const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
    if (!apiKey) {
      return { found: false, error: 'COMPANIES_HOUSE_API_KEY not configured' };
    }

    const baseUrl = 'https://api.companieshouse.gov.uk';
    const auth = `Basic ${Buffer.from(apiKey + ':').toString('base64')}`;

    try {
      let company;

      if (companyNumber) {
        const response = await fetch(`${baseUrl}/company/${companyNumber}`, {
          headers: { Authorization: auth },
        });
        if (response.ok) company = await response.json();
      } else if (companyName) {
        const searchResponse = await fetch(
          `${baseUrl}/search/companies?q=${encodeURIComponent(companyName)}&items_per_page=3`,
          { headers: { Authorization: auth } }
        );
        if (searchResponse.ok) {
          const results = await searchResponse.json();
          company = results.items?.[0];
        }
      }

      if (!company) {
        return { found: false, error: 'Company not found' };
      }

      return {
        found: true,
        companyNumber: company.company_number,
        companyName: company.company_name,
        companyStatus: company.company_status,
        sicCodes: company.sic_codes || [],
        incorporationDate: company.date_of_creation,
      };
    } catch (error) {
      return { found: false, error: String(error) };
    }
  },
});
```

```typescript
// src/tools/index.ts
export { resolveDomainTool } from './resolve-domain';
export { classifyAgencyTool } from './classify-agency';
export { fetchCompaniesHouseTool } from './fetch-companies-house';
```

---

### Core Implementation: Agency Classifier Agent

```typescript
// src/agents/agency-classifier-agent.ts
import { generateText } from 'ai';
import { classificationModel } from '@/lib/ai/provider';
import { resolveDomainTool, classifyAgencyTool, fetchCompaniesHouseTool } from '@/tools';
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
  if (sicCodes?.includes('78100')) {
    return {
      isRecruitmentAgency: true,
      confidence: 95,
      needsReview: false,
      reasoning: 'SIC code 78100 = Employment placement agencies (definitive match)',
      domain: domain || null,
      sicCodes,
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

  // Full AI classification with tools
  const { text, toolCalls, toolResults } = await generateText({
    model: classificationModel,
    tools: {
      resolve_domain: resolveDomainTool,
      classify_agency: classifyAgencyTool,
      fetch_companies_house: fetchCompaniesHouseTool,
    },
    maxSteps: 5, // Allow up to 5 tool calls
    prompt: `Classify if "${companyName}" is a recruitment/staffing agency.

${domain ? `Known domain: ${domain}` : 'Domain unknown - resolve it first.'}
${sicCodes?.length ? `Known SIC codes: ${sicCodes.join(', ')}` : ''}

WORKFLOW:
1. If no domain, use resolve_domain to find the company website
2. Use fetch_companies_house to get SIC codes (78100 = recruitment agency)
3. Use classify_agency to analyze website content and signals
4. Return your final classification with confidence score

CLASSIFICATION RULES:
- SIC code 78100/78200/78300 = definite recruitment agency (95% confidence)
- Website mentions "candidates", "job seekers", "submit CV" = likely agency
- Companies that HIRE through agencies are NOT agencies themselves

Return JSON: { isRecruitmentAgency, confidence, needsReview, reasoning, domain, sicCodes }`,
  });

  // Extract classification from tool results
  const classifyResult = toolResults?.find(r => r.toolName === 'classify_agency');
  const companiesHouseResult = toolResults?.find(r => r.toolName === 'fetch_companies_house');
  const domainResult = toolResults?.find(r => r.toolName === 'resolve_domain');

  // Build final result
  const result: ClassificationResult = {
    isRecruitmentAgency: classifyResult?.result?.isRecruitmentAgency ?? false,
    confidence: classifyResult?.result?.confidence ?? 50,
    needsReview: classifyResult?.result?.needsReview ?? true,
    reasoning: classifyResult?.result?.reasoning ?? text,
    domain: domainResult?.result?.domain ?? domain ?? null,
    sicCodes: companiesHouseResult?.result?.sicCodes ?? sicCodes ?? [],
  };

  return result;
}
```

---

### Core Implementation: Inngest Client & Functions

```typescript
// src/inngest/client.ts
import { Inngest } from 'inngest';

export const inngest = new Inngest({
  id: 'signal-mentis',
});
```

```typescript
// src/inngest/functions/classify-companies.ts
import { inngest } from '../client';
import { classifyCompany } from '@/agents/agency-classifier-agent';
import { createClient } from '@/lib/supabase/server';

export const classifyCompaniesFunction = inngest.createFunction(
  {
    id: 'classify-companies-batch',
    throttle: { limit: 10, period: '1m' }, // 10 per minute (API cost control)
    retries: 3,
  },
  { event: 'company/classify.requested' },
  async ({ event, step }) => {
    const { companyIds } = event.data;
    const supabase = await createClient();

    const results = [];

    for (const companyId of companyIds) {
      // Step 1: Get company data
      const company = await step.run(`get-company-${companyId}`, async () => {
        const { data } = await supabase
          .from('companies')
          .select('id, name, domain, companies_house_number')
          .eq('id', companyId)
          .single();
        return data;
      });

      if (!company) continue;

      // Step 2: Classify company
      const classification = await step.run(`classify-${companyId}`, async () => {
        return await classifyCompany(company.name, {
          domain: company.domain,
          useTools: true,
        });
      });

      // Step 3: Update database
      await step.run(`save-${companyId}`, async () => {
        await supabase
          .from('companies')
          .update({
            is_recruitment_agency: classification.isRecruitmentAgency,
            agency_confidence: classification.confidence,
            agency_reasoning: classification.reasoning,
            agency_classified_at: new Date().toISOString(),
            agency_classification_source: 'ai',
          })
          .eq('id', companyId);
      });

      results.push({ companyId, ...classification });
    }

    return { classified: results.length, results };
  }
);
```

```typescript
// src/inngest/functions/index.ts
import { classifyCompaniesFunction } from './classify-companies';
// Import other migrated functions here

export const functions = [
  classifyCompaniesFunction,
  // generatePainSignalsFunction,
  // ingestJobsFunction,
  // processScanQueueFunction,
];
```

```typescript
// src/app/api/inngest/route.ts
import { serve } from 'inngest/next';
import { inngest } from '@/inngest/client';
import { functions } from '@/inngest/functions';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
});
```

---

### Modifying Existing Code: job-boards.ts

```typescript
// src/lib/job-boards.ts - ADD this new async function

import { classifyCompany } from '@/agents/agency-classifier-agent';

/**
 * AI-powered recruitment agency detection (async)
 * Use this for uncertain cases or when pattern matching is insufficient
 */
export async function isRecruitmentAgencyAsync(
  companyName: string,
  options?: {
    domain?: string;
    sicCodes?: string[];
    jobDescription?: string;
  }
): Promise<{ isAgency: boolean; confidence: number; source: 'pattern' | 'ai' }> {
  // Fast path: Check obvious patterns first (no API call)
  if (isRecruitmentAgency(companyName, options?.jobDescription)) {
    return { isAgency: true, confidence: 90, source: 'pattern' };
  }

  // AI classification for uncertain cases
  const result = await classifyCompany(companyName, {
    domain: options?.domain,
    sicCodes: options?.sicCodes,
    useTools: true,
  });

  return {
    isAgency: result.isRecruitmentAgency,
    confidence: result.confidence,
    source: 'ai',
  };
}

// Keep existing isRecruitmentAgency() function unchanged for fast synchronous checks
```

---

### Modifying Existing Code: domain-resolver.ts

```typescript
// src/lib/domain-resolver.ts - ADD Tavily to the waterfall

import { searchCompanyWebsite } from '@/lib/ai/tavily';

/**
 * Main domain resolution function - tries multiple strategies
 * NEW WATERFALL ORDER:
 * 1. URL extract (100% confidence) - existing
 * 2. Tavily web search (80% confidence) - NEW
 * 3. Google search via Firecrawl (60% confidence) - existing
 * 4. DNS guessing (40% confidence) - existing
 */
export async function resolveDomain(
  companyName: string,
  options?: {
    contactUrl?: string;
    skipLookup?: boolean;
    skipGoogle?: boolean;
    skipTavily?: boolean;  // NEW option
    skipCache?: boolean;
  }
): Promise<DomainResolutionResult> {
  // ... existing cache check ...

  // Strategy 1: URL extract (existing)
  if (options?.contactUrl) {
    // ... existing code ...
  }

  if (!options?.skipLookup) {
    // Strategy 2: Tavily Web Search (NEW - 80% confidence)
    if (!options?.skipTavily && process.env.TAVILY_API_KEY) {
      console.log(`[Domain Resolver] Trying Tavily for: ${companyName}`);
      const tavilyResult = await searchCompanyWebsite(companyName);
      if (tavilyResult.domain && tavilyResult.confidence >= 70) {
        const result: DomainResolutionResult = {
          domain: tavilyResult.domain,
          source: 'tavily' as any, // Add 'tavily' to source type
          confidence: tavilyResult.confidence,
        };
        domainCache.set(cacheKey, result);
        return result;
      }
    }

    // Strategy 3: Google Search via Firecrawl (existing - 60% confidence)
    if (!options?.skipGoogle) {
      // ... existing Firecrawl code ...
    }

    // Strategy 4: DNS guessing (existing - 40% confidence)
    // ... existing code ...
  }

  // ... rest of existing code ...
}
```

---

## Implementation Phases

### Phase 1: Foundation (Day 1)
**Goal:** Add dependencies, types, and database schema

**Files to create:**
- `src/lib/ai/anthropic.ts` - Claude client wrapper
- `src/lib/ai/tavily.ts` - Tavily search client
- `src/types/classification.ts` - AI classification types

**Files to modify:**
- `package.json` - Add `@anthropic-ai/sdk`, `@tavily/core`, `inngest`

**Database migration:**
```sql
-- Add to companies table
ALTER TABLE companies ADD COLUMN IF NOT EXISTS is_recruitment_agency BOOLEAN DEFAULT NULL;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS agency_confidence SMALLINT DEFAULT NULL;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS agency_reasoning TEXT DEFAULT NULL;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS agency_classified_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS agency_classification_source TEXT DEFAULT NULL;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS domain_confidence SMALLINT DEFAULT NULL;

-- Create cache table
CREATE TABLE IF NOT EXISTS agency_classification_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name_normalized TEXT NOT NULL UNIQUE,
  is_recruitment_agency BOOLEAN NOT NULL,
  confidence SMALLINT NOT NULL,
  reasoning TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days'
);
```

---

### Phase 2: AI Agency Classifier (Day 2-3)
**Goal:** Replace hardcoded patterns with Claude-powered classification

**New file:** `src/lib/classification/agency-classifier.ts`
- `classifyCompanyAsAgency(companyName, domain?, sicCodes?)` - Main classification function
- Uses SIC code 78100 as strong signal (95% confidence if match)
- Falls back to Claude Sonnet for ambiguous cases
- Caches results for 30 days

**Modify:** `src/lib/job-boards.ts`
- Keep `isRecruitmentAgency()` for fast synchronous checks (keep patterns for obvious cases)
- Add `isRecruitmentAgencyAsync()` for AI-powered classification
- Hybrid approach: patterns first (fast), AI for uncertain cases

**New API route:** `src/app/api/companies/[id]/classify/route.ts`
- POST: Classify single company on-demand
- Returns: `{ isAgency, confidence, reasoning, needsReview }`

**New admin route:** `src/app/api/admin/backfill-agency-classification/route.ts`
- POST: Batch classify unclassified companies
- Rate limited to avoid API cost spikes

---

### Phase 3: AI Domain Resolution (Day 3-4)
**Goal:** Add Tavily web search to domain resolution waterfall

**New file:** `src/lib/domain/tavily-resolver.ts`
- `resolveDomainWithTavily(companyName)` - Search for company website
- Returns domain with 80% confidence (higher than Google scrape)

**Modify:** `src/lib/domain-resolver.ts`
- Add Tavily as step 2 in waterfall (before Firecrawl)
- New order:
  1. URL extract (100% confidence) - existing
  2. **Tavily web search (80% confidence) - NEW**
  3. Google search via Firecrawl (60% confidence) - existing
  4. DNS guessing (40% confidence) - existing

---

### Phase 4: Inngest Setup (Day 4-5)
**Goal:** Set up Inngest infrastructure and migrate first cron job

**New files:**
- `src/inngest/client.ts` - Inngest client config
- `src/inngest/functions/index.ts` - Export all functions
- `src/app/api/inngest/route.ts` - Webhook handler

**First migration:** `generate-pain-signals`
- Convert from single API route to step-based Inngest function
- Benefits: Each step can retry independently, better timeout handling

**Inngest function structure:**
```typescript
inngest.createFunction(
  { id: 'generate-pain-signals', throttle: { limit: 1, period: '5m' } },
  { cron: '0 7 * * *' },  // Daily at 7am
  async ({ step }) => {
    const icps = await step.run('get-icps', () => getActiveICPs());
    await step.run('stale-jobs', () => processStaleJobs(icps));
    await step.run('reposts', () => processReposts(icps));
    // ... more steps
  }
);
```

---

### Phase 5: Complete Inngest Migration (Day 5-7)
**Goal:** Migrate remaining cron jobs to Inngest

**Migration order (lowest risk first):**
1. `companies-house-signals` - Daily, isolated
2. `contracts-finder-signals` - Daily, isolated
3. `process-scan-queue` - Every 15 min, uses rate limiting
4. `ingest-jobs` - Every 4 hours, most complex

**For each migration:**
- Create Inngest function in `src/inngest/functions/`
- Test with Inngest Dev Server locally
- Deploy and verify in production
- Remove old cron from `vercel.json`

---

## Files Summary

### New Files (10)
| File | Purpose |
|------|---------|
| `src/lib/ai/anthropic.ts` | Claude API client |
| `src/lib/ai/tavily.ts` | Tavily search client |
| `src/lib/classification/agency-classifier.ts` | AI agency classification |
| `src/lib/domain/tavily-resolver.ts` | Tavily domain resolution |
| `src/types/classification.ts` | Classification types |
| `src/inngest/client.ts` | Inngest client |
| `src/inngest/functions/index.ts` | Function exports |
| `src/inngest/functions/generate-pain-signals.ts` | Pain signal generation |
| `src/app/api/inngest/route.ts` | Inngest webhook |
| `src/app/api/companies/[id]/classify/route.ts` | Classification endpoint |

### Modified Files (4)
| File | Changes |
|------|---------|
| `package.json` | Add dependencies |
| `src/lib/job-boards.ts` | Add async classification |
| `src/lib/domain-resolver.ts` | Add Tavily to waterfall |
| `vercel.json` | Remove migrated crons |

---

## Cost Estimate

| Service | Free Tier | Expected Monthly Cost |
|---------|-----------|----------------------|
| Inngest | 25K runs/month | $0 (free tier sufficient) |
| Claude Sonnet | N/A | $3-10 (1-3K classifications) |
| Tavily | 1K searches/month | $0-8 (depends on volume) |
| **Total** | | **$3-18/month** |

---

## Testing Checklist

- [ ] AI classifier correctly identifies known agencies (Hays, Michael Page, etc.)
- [ ] AI classifier correctly identifies non-agencies (actual employers)
- [ ] Domain resolution finds correct domains for UK companies
- [ ] Inngest functions run on schedule
- [ ] Inngest retries failed steps automatically
- [ ] Cache prevents duplicate API calls
- [ ] Inngest MCP server connected and working

---

## Rollback Plan

If AI classification produces poor results:
1. Set `agency_classification_source = 'pattern'` to use old patterns
2. Keep `isRecruitmentAgency()` as fallback (no code removal)

If Inngest has issues:
1. Re-enable Vercel cron in `vercel.json`
2. Inngest functions can coexist with Vercel cron during transition

---

## Quick Start for New Context

When starting implementation in a new context window, tell Claude:

> "Read the plan at tasks/ai-agency-classifier-inngest-plan.md and begin implementation. I have the following API keys ready: [list keys]. Start with Phase 1."

Or to continue from a specific phase:

> "Read tasks/ai-agency-classifier-inngest-plan.md and continue from Phase [X]."

---

## Quick Reference: Key Code Snippets

### Install Dependencies
```bash
npm install ai @ai-sdk/anthropic @tavily/core inngest zod
```

### Database Migration (Run in Supabase SQL Editor)
```sql
ALTER TABLE companies ADD COLUMN IF NOT EXISTS is_recruitment_agency BOOLEAN DEFAULT NULL;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS agency_confidence SMALLINT DEFAULT NULL;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS agency_reasoning TEXT DEFAULT NULL;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS agency_classified_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS agency_classification_source TEXT DEFAULT NULL;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS domain_confidence SMALLINT DEFAULT NULL;

CREATE TABLE IF NOT EXISTS agency_classification_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name_normalized TEXT NOT NULL UNIQUE,
  is_recruitment_agency BOOLEAN NOT NULL,
  confidence SMALLINT NOT NULL,
  reasoning TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days'
);
```

### Start Inngest Dev Server (for testing)
```bash
npx --ignore-scripts=false inngest-cli@latest dev
```

### Register Inngest MCP with Claude Code
```bash
claude mcp add --transport http inngest-dev http://127.0.0.1:8288/mcp
```

### Environment Variables (.env.local)
```bash
ANTHROPIC_API_KEY=sk-ant-...
TAVILY_API_KEY=tvly-...
INNGEST_SIGNING_KEY=signkey-...
```

---

## Files to Create (in order)

1. `src/lib/ai/provider.ts` - Anthropic client setup
2. `src/lib/ai/tavily.ts` - Tavily search functions
3. `src/tools/resolve-domain.ts` - Domain resolution tool
4. `src/tools/classify-agency.ts` - Classification tool
5. `src/tools/fetch-companies-house.ts` - Companies House tool
6. `src/tools/index.ts` - Export all tools
7. `src/agents/agency-classifier-agent.ts` - Main classifier
8. `src/inngest/client.ts` - Inngest client
9. `src/inngest/functions/classify-companies.ts` - Batch classification
10. `src/inngest/functions/index.ts` - Export functions
11. `src/app/api/inngest/route.ts` - Inngest webhook

## Files to Modify

1. `src/lib/job-boards.ts` - Add `isRecruitmentAgencyAsync()`
2. `src/lib/domain-resolver.ts` - Add Tavily to waterfall
3. `package.json` - Add dependencies
4. `vercel.json` - Remove migrated crons (after testing)
