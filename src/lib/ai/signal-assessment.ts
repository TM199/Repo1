// src/lib/ai/signal-assessment.ts

import { generateObject } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { IndustryClassification } from './industry-classifier';
import { ICPProfile, CompanyPainSignal } from '@/types';

const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Output schema
const SignalAssessmentSchema = z.object({
  // Signal Explanation
  signalExplanation: z.string().describe('Plain-English summary of what this signal means and what the company is doing (2-3 sentences)'),

  // ICP Match
  industryMatch: z.boolean().describe('Does company industry match ICP target industries?'),
  industryMatchScore: z.number().min(0).max(100).describe('How well industry matches (0-100)'),
  locationMatch: z.boolean().describe('Does company location match ICP target locations?'),
  locationMatchScore: z.number().min(0).max(100).describe('How well location matches (0-100)'),

  // Opportunity Assessment
  opportunityType: z.enum(['growth', 'transition', 'expansion', 'none']).describe('Type of opportunity this signal represents'),
  urgency: z.enum(['immediate', 'short_term', 'medium_term', 'low']).describe('How urgent is this opportunity'),
  hiringLikelihood: z.number().min(0).max(100).describe('Likelihood company will hire (0-100)'),

  // Reasoning
  reasoning: z.string().describe('Why this signal is or is not relevant to the ICP (focus on ICP match)'),
  talkingPoints: z.array(z.string()).describe('Suggested conversation starters for outreach'),
  recommendedAction: z.enum(['reach_out', 'monitor', 'skip']).describe('What should user do with this signal'),

  // Final Score
  overallScore: z.number().min(0).max(100).describe('Overall relevance score (0-100)'),
});

export type SignalAssessment = z.infer<typeof SignalAssessmentSchema>;

/**
 * Assess a signal's relevance to an ICP and opportunity potential
 */
export async function assessSignal(
  signal: CompanyPainSignal,
  companyName: string,
  companyLocation: string | null,
  industryResult: IndustryClassification,
  icp: ICPProfile
): Promise<SignalAssessment> {
  console.log(`[Signal Assessment] Assessing signal for ${companyName}`);

  const prompt = buildAssessmentPrompt(signal, companyName, companyLocation, industryResult, icp);

  const { object } = await generateObject({
    model: anthropic('claude-sonnet-4-20250514'),
    schema: SignalAssessmentSchema,
    prompt,
  });

  console.log(`[Signal Assessment] Result for ${companyName}: ${object.overallScore}% (${object.recommendedAction})`);

  return object;
}

/**
 * Build the assessment prompt
 */
function buildAssessmentPrompt(
  signal: CompanyPainSignal,
  companyName: string,
  companyLocation: string | null,
  industry: IndustryClassification,
  icp: ICPProfile
): string {
  return `# TASK: Assess signal relevance and opportunity for "${companyName}"

## USER'S IDEAL CUSTOMER PROFILE (ICP)

**Name**: ${icp.name}
**Target Industries**: ${icp.industries?.join(', ') || 'Not specified'}
**Target Locations**: ${icp.locations?.join(', ') || 'Not specified'}
**Specific Roles Looking For**: ${icp.specific_roles?.join(', ') || 'Not specified'}
**Contract Sectors**: ${icp.contract_sectors?.join(', ') || 'Not specified'}
**Contract Keywords**: ${icp.contract_keywords?.join(', ') || 'Not specified'}
**Description**: ${icp.description || 'Not specified'}

---

## COMPANY BEING EVALUATED

**Company Name**: ${companyName}
**Company Location**: ${companyLocation || 'Unknown'}
**Detected Industry**: ${industry.primaryIndustry}
**Sub-sector**: ${industry.subSector || 'Unknown'}
**Company Size**: ${industry.companySize}
**Key Services**: ${industry.keyServices.join(', ')}
**Target Market**: ${industry.targetMarket || 'Unknown'}
**Industry Confidence**: ${industry.confidence}%

---

## SIGNAL DETAILS

**Signal Type**: ${signal.pain_signal_type}
**Signal Title**: ${signal.signal_title}
**Signal Detail**: ${signal.signal_detail}
**Source**: ${signal.source}
**Detected At**: ${signal.detected_at}

${signal.metadata ? `**Additional Metadata**: ${JSON.stringify(signal.metadata, null, 2)}` : ''}

---

## ASSESSMENT GUIDELINES

### Industry Matching
- Exact match (e.g., "Technology" to "Technology") = 100%
- Related match (e.g., "IT Services" to "Technology") = 70-90%
- Partial overlap (e.g., "Tech consulting" to "Professional Services") = 40-60%
- No match = 0-30%

### Location Matching
- Exact city/region match = 100%
- Same country but different region = 50-70%
- "All UK" or nationwide should match any UK location = 80%
- No match = 0%

### Opportunity Types
- **growth**: Company winning contracts, expanding, hiring = HIGH value
- **transition**: Leadership changes, restructuring = MEDIUM value
- **expansion**: New office, new market entry = HIGH value
- **none**: No clear opportunity = LOW value

### Hiring Likelihood Indicators
- Contract win → likely hiring to deliver (60-90%)
- New leadership → new initiatives possible (40-70%)
- Capital raise → expansion likely (50-80%)
- Tender publication → planning phase (20-40%)

### Urgency Assessment
- **immediate**: Act within 1-2 weeks (recent contract win, urgent need)
- **short_term**: Act within 1 month (leadership change, growth signal)
- **medium_term**: Act within 2-3 months (tender, planning stage)
- **low**: Monitor for now (weak signal)

### Recommended Actions
- **reach_out**: Score > 60%, good opportunity, act now
- **monitor**: Score 40-60%, potential but not strong
- **skip**: Score < 40%, not relevant to ICP

### Signal Explanation
Write a clear 2-3 sentence summary that:
1. Explains what the company has done (e.g., "won a contract", "appointed a new director")
2. Mentions the value/scope if available
3. Explains what this likely means for the company (e.g., "will need to scale up delivery")

### Talking Points
Generate 2-3 specific, actionable conversation starters that:
1. Reference the specific signal (e.g., "Congratulations on the £2M contract")
2. Connect to their likely needs
3. Are natural and not salesy

---

Provide a thorough assessment of this signal's relevance to the user's ICP. Start with a clear explanation of what this signal means.`;
}

/**
 * Quick assessment without full industry classification
 * Use when you have limited information
 */
export async function quickAssessSignal(
  signal: CompanyPainSignal,
  companyName: string,
  companyIndustry: string | null,
  companyLocation: string | null,
  icp: ICPProfile
): Promise<SignalAssessment> {
  console.log(`[Signal Assessment] Quick assess for ${companyName}`);

  const { object } = await generateObject({
    model: anthropic('claude-sonnet-4-20250514'),
    schema: SignalAssessmentSchema,
    prompt: `Quickly assess this signal's relevance to the ICP.

## ICP
- Industries: ${icp.industries?.join(', ') || 'Any'}
- Locations: ${icp.locations?.join(', ') || 'Any'}

## Company
- Name: ${companyName}
- Industry: ${companyIndustry || 'Unknown'}
- Location: ${companyLocation || 'Unknown'}

## Signal
- Type: ${signal.pain_signal_type}
- Title: ${signal.signal_title}
- Detail: ${signal.signal_detail}

Assess relevance and provide recommendations. Be conservative with scores when information is limited.`,
  });

  return object;
}
