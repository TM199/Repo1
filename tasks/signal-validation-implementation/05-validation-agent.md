# Part 5: Signal Validation Agent

## Task

Create the main validation agent that orchestrates the full validation workflow.

## File to Create

`src/agents/signal-validator-agent.ts`

## Context

- Orchestrates the validation workflow
- Calls company research → industry classifier → signal assessment
- Returns a complete validation result
- Handles errors gracefully
- Updates the signal record with results

## Dependencies (must be created first)

1. `src/lib/ai/company-research.ts` (Part 2)
2. `src/lib/ai/industry-classifier.ts` (Part 3)
3. `src/lib/ai/signal-assessment.ts` (Part 4)

## Implementation

```typescript
// src/agents/signal-validator-agent.ts

import { createAdminClient } from '@/lib/supabase/server';
import { researchCompany, quickResearchCompany, CompanyResearchResult } from '@/lib/ai/company-research';
import { classifyIndustry, quickClassifyIndustry, IndustryClassification } from '@/lib/ai/industry-classifier';
import { assessSignal, SignalAssessment } from '@/lib/ai/signal-assessment';
import { CompanyPainSignal, ICPProfile, Company } from '@/types';

export interface SignalValidationResult {
  success: boolean;
  signalId: string;

  // Validation results
  relevanceScore: number;
  validationStatus: 'validated' | 'rejected' | 'error';

  // Company insights
  companyIndustryDetected: string | null;
  companySizeDetected: string | null;

  // Opportunity insights
  opportunityType: string | null;
  urgency: string | null;
  recommendedAction: string | null;

  // User-facing content
  relevanceReasoning: string | null;
  talkingPoints: string[] | null;

  // Error handling
  error?: string;

  // Debug info
  researchConfidence?: number;
  industryConfidence?: number;
}

/**
 * Main validation function - orchestrates the full workflow
 */
export async function validateSignal(
  signal: CompanyPainSignal,
  company: Company,
  icp: ICPProfile
): Promise<SignalValidationResult> {
  const startTime = Date.now();
  console.log(`[Signal Validator] Starting validation for signal ${signal.id}`);
  console.log(`[Signal Validator] Company: ${company.name}, ICP: ${icp.name}`);

  try {
    // ========================================
    // STEP 1: Research the company
    // ========================================
    console.log(`[Signal Validator] Step 1: Researching company...`);

    let research: CompanyResearchResult;
    try {
      // Try full research first
      research = await researchCompany(company.name, company.domain);
    } catch (err) {
      console.warn(`[Signal Validator] Full research failed, trying quick research:`, err);
      // Fallback to quick research
      research = await quickResearchCompany(company.name, company.domain);
    }

    console.log(`[Signal Validator] Research complete. Domain: ${research.domain}, Confidence: ${research.confidence}%`);

    // ========================================
    // STEP 2: Classify the industry
    // ========================================
    console.log(`[Signal Validator] Step 2: Classifying industry...`);

    let industry: IndustryClassification;
    if (research.confidence >= 50 && (research.aboutPage || research.websiteContent)) {
      // Good research data - use full classification
      industry = await classifyIndustry(company.name, research);
    } else {
      // Limited data - use quick classification
      industry = await quickClassifyIndustry(
        company.name,
        research.domain,
        research.companyDescription
      );
    }

    console.log(`[Signal Validator] Industry: ${industry.primaryIndustry} (${industry.confidence}%)`);

    // ========================================
    // STEP 3: Assess signal relevance
    // ========================================
    console.log(`[Signal Validator] Step 3: Assessing signal...`);

    const assessment = await assessSignal(
      signal,
      company.name,
      company.region || company.location || null,
      industry,
      icp
    );

    console.log(`[Signal Validator] Assessment: ${assessment.overallScore}% - ${assessment.recommendedAction}`);

    // ========================================
    // STEP 4: Determine validation status
    // ========================================
    const validationStatus = assessment.overallScore >= 40 ? 'validated' : 'rejected';

    const result: SignalValidationResult = {
      success: true,
      signalId: signal.id,
      relevanceScore: assessment.overallScore / 100, // Store as 0-1
      validationStatus,
      companyIndustryDetected: industry.primaryIndustry,
      companySizeDetected: industry.companySize,
      opportunityType: assessment.opportunityType,
      urgency: assessment.urgency,
      recommendedAction: assessment.recommendedAction,
      relevanceReasoning: assessment.reasoning,
      talkingPoints: assessment.talkingPoints,
      researchConfidence: research.confidence,
      industryConfidence: industry.confidence,
    };

    const duration = Date.now() - startTime;
    console.log(`[Signal Validator] Validation complete in ${duration}ms. Status: ${validationStatus}`);

    return result;

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Signal Validator] Validation failed:`, error);

    return {
      success: false,
      signalId: signal.id,
      relevanceScore: 0,
      validationStatus: 'error',
      companyIndustryDetected: null,
      companySizeDetected: null,
      opportunityType: null,
      urgency: null,
      recommendedAction: null,
      relevanceReasoning: null,
      talkingPoints: null,
      error: message,
    };
  }
}

/**
 * Update signal record with validation results
 */
export async function saveValidationResult(
  signalId: string,
  result: SignalValidationResult
): Promise<void> {
  const supabase = createAdminClient();

  const updates: Record<string, unknown> = {
    validation_status: result.validationStatus,
    relevance_score: result.relevanceScore,
    relevance_reasoning: result.relevanceReasoning,
    company_industry_detected: result.companyIndustryDetected,
    company_size_detected: result.companySizeDetected,
    opportunity_type: result.opportunityType,
    recommended_action: result.recommendedAction,
    talking_points: result.talkingPoints,
    validated_at: new Date().toISOString(),
  };

  if (result.error) {
    updates.validation_error = result.error;
  }

  const { error } = await supabase
    .from('company_pain_signals')
    .update(updates)
    .eq('id', signalId);

  if (error) {
    console.error(`[Signal Validator] Failed to save result:`, error);
    throw error;
  }

  console.log(`[Signal Validator] Saved validation result for signal ${signalId}`);
}

/**
 * Validate a signal and save the result in one call
 */
export async function validateAndSaveSignal(
  signal: CompanyPainSignal,
  company: Company,
  icp: ICPProfile
): Promise<SignalValidationResult> {
  const result = await validateSignal(signal, company, icp);
  await saveValidationResult(signal.id, result);
  return result;
}

/**
 * Check if a signal needs validation
 */
export function needsValidation(signal: CompanyPainSignal): boolean {
  // Only validate government signals (not job board signals)
  const governmentSources = ['contracts_finder', 'find_a_tender', 'companies_house'];

  if (!governmentSources.includes(signal.source)) {
    return false;
  }

  // Check if already validated
  if (signal.validation_status && signal.validation_status !== 'pending') {
    return false;
  }

  return true;
}
```

## Testing

```typescript
import { validateSignal, saveValidationResult, needsValidation } from '@/agents/signal-validator-agent';

async function test() {
  // Mock data
  const signal = {
    id: 'test-signal-id',
    company_id: 'test-company-id',
    icp_profile_id: 'test-icp-id',
    pain_signal_type: 'contract_awarded',
    signal_title: 'AWS Contract Win',
    signal_detail: 'Company won £500k AWS contract',
    source: 'contracts_finder',
    detected_at: new Date().toISOString(),
    is_active: true,
    validation_status: 'pending',
  };

  const company = {
    id: 'test-company-id',
    name: 'Accenture UK',
    domain: 'accenture.com',
    region: 'London',
  };

  const icp = {
    id: 'test-icp-id',
    name: 'Tech Recruiters',
    industries: ['Technology', 'Professional Services'],
    locations: ['London'],
  };

  // Check if needs validation
  console.log('Needs validation:', needsValidation(signal));

  // Run validation
  const result = await validateSignal(signal, company, icp);

  console.log('Result:', JSON.stringify(result, null, 2));

  // Would save to DB
  // await saveValidationResult(signal.id, result);
}
```

## DO NOT

- Call Tavily or Claude directly (use the lib functions)
- Create new database clients (use `createAdminClient`)
- Modify any existing files
- Add pricing/credits logic (that's separate)

