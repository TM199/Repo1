# Part 3: Industry Classifier

## Task

Create a Claude-based industry classifier that determines a company's industry from research data.

## File to Create

`src/lib/ai/industry-classifier.ts`

## Context

- Uses `generateObject` from AI SDK (already in the project)
- Uses Claude Sonnet (already configured in the project)
- Takes the output from `researchCompany()` and classifies the industry

## Implementation

```typescript
// src/lib/ai/industry-classifier.ts

import { generateObject } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { CompanyResearchResult } from './company-research';

const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Output schema
const IndustryClassificationSchema = z.object({
  primaryIndustry: z.string().describe('Main industry category (e.g., Technology, Healthcare, Finance)'),
  subSector: z.string().nullable().describe('More specific sector within industry'),
  companySize: z.enum(['micro', 'small', 'medium', 'large', 'enterprise', 'unknown']).describe('Estimated company size'),
  keyServices: z.array(z.string()).describe('Main services or products offered'),
  targetMarket: z.string().nullable().describe('Who they sell to (B2B, B2C, Government, etc.)'),
  confidence: z.number().min(0).max(100).describe('How confident in this classification'),
  reasoning: z.string().describe('Brief explanation of classification'),
});

export type IndustryClassification = z.infer<typeof IndustryClassificationSchema>;

/**
 * Classify a company's industry based on research data
 */
export async function classifyIndustry(
  companyName: string,
  research: CompanyResearchResult
): Promise<IndustryClassification> {
  console.log(`[Industry Classifier] Classifying: ${companyName}`);

  // Build context from research
  const context = buildClassificationContext(companyName, research);

  const { object } = await generateObject({
    model: anthropic('claude-sonnet-4-20250514'),
    schema: IndustryClassificationSchema,
    prompt: `# TASK: Classify the industry for "${companyName}"

## AVAILABLE INFORMATION

${context}

---

## CLASSIFICATION GUIDELINES

### Industry Categories (use these exact names when possible)
- Technology (Software, Hardware, IT Services, Cloud, Cybersecurity)
- Healthcare (Pharma, Medical Devices, Healthcare Services, Biotech)
- Finance (Banking, Insurance, Investment, Fintech)
- Manufacturing (Industrial, Consumer Goods, Automotive, Aerospace)
- Professional Services (Consulting, Legal, Accounting, Marketing)
- Retail (E-commerce, Brick & Mortar, Consumer)
- Energy (Oil & Gas, Renewables, Utilities)
- Construction (Building, Infrastructure, Real Estate)
- Telecommunications (Telecom, Media, Broadcasting)
- Transportation (Logistics, Shipping, Aviation)
- Education (EdTech, Training, Academic)
- Government (Public Sector, Defense)

### Company Size Indicators
- **micro**: <10 employees, very small operation
- **small**: 10-50 employees, small business
- **medium**: 50-250 employees, growing company
- **large**: 250-1000 employees, established company
- **enterprise**: 1000+ employees, large corporation
- **unknown**: Cannot determine

### Target Market
- **B2B**: Sells to other businesses
- **B2C**: Sells to consumers
- **B2G**: Sells to government
- **Mixed**: Multiple target markets

---

Analyze the information and classify "${companyName}".`,
  });

  console.log(`[Industry Classifier] Result for ${companyName}: ${object.primaryIndustry} (${object.confidence}%)`);

  return object;
}

/**
 * Build context string from research data
 */
function buildClassificationContext(
  companyName: string,
  research: CompanyResearchResult
): string {
  const parts: string[] = [];

  parts.push(`### Company Name: ${companyName}`);

  if (research.domain) {
    parts.push(`### Website: ${research.domain}`);
  }

  if (research.companyDescription) {
    parts.push(`### Company Description (from web search)\n${research.companyDescription}`);
  }

  if (research.aboutPage) {
    parts.push(`### About Page Summary\n${research.aboutPage}`);
  }

  if (research.servicesPage) {
    parts.push(`### Services Page Summary\n${research.servicesPage}`);
  }

  if (research.websiteContent && research.websiteContent.length > 100) {
    // Truncate to reasonable size
    const truncatedContent = research.websiteContent.slice(0, 10000);
    parts.push(`### Website Content Excerpts\n${truncatedContent}`);
  }

  if (research.newsSnippets.length > 0) {
    parts.push(`### News/External Sources\n${research.newsSnippets.join('\n\n')}`);
  }

  return parts.join('\n\n');
}

/**
 * Quick industry classification from just company name and domain
 * Use when full research isn't available
 */
export async function quickClassifyIndustry(
  companyName: string,
  domain?: string | null,
  additionalContext?: string
): Promise<IndustryClassification> {
  console.log(`[Industry Classifier] Quick classify: ${companyName}`);

  const contextParts = [`Company Name: ${companyName}`];
  if (domain) contextParts.push(`Website: ${domain}`);
  if (additionalContext) contextParts.push(`Additional Info: ${additionalContext}`);

  const { object } = await generateObject({
    model: anthropic('claude-sonnet-4-20250514'),
    schema: IndustryClassificationSchema,
    prompt: `Classify the industry for this company based on limited information:

${contextParts.join('\n')}

Make your best guess based on the company name and any available context.
Set confidence lower (30-60%) when information is limited.`,
  });

  return object;
}
```

## Testing

```typescript
import { classifyIndustry } from '@/lib/ai/industry-classifier';
import { researchCompany } from '@/lib/ai/company-research';

async function test() {
  const research = await researchCompany('Accenture');
  const classification = await classifyIndustry('Accenture', research);

  console.log('Industry:', classification.primaryIndustry);
  console.log('Sub-sector:', classification.subSector);
  console.log('Size:', classification.companySize);
  console.log('Services:', classification.keyServices);
  console.log('Confidence:', classification.confidence);
}
```

## DO NOT

- Create new AI provider configuration (use existing)
- Change the model name (use `claude-sonnet-4-20250514`)
- Modify other files
