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
  validationStatus: 'validated' | 'skipped' | 'failed';

  // Company insights
  companyIndustryDetected: string | null;
  companySizeDetected: string | null;

  // Opportunity insights
  opportunityType: string | null;
  urgency: string | null;
  recommendedAction: string | null;

  // User-facing content
  signalExplanation: string | null;
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
      // Fallback to quick research - returns simpler object
      const quickResult = await quickResearchCompany(company.name, company.domain);
      // Convert to full result format with default fields
      research = {
        domain: quickResult.domain,
        domainConfidence: quickResult.confidence,
        companyDescription: quickResult.description,
        websiteContent: '',
        aboutPage: null,
        servicesPage: null,
        newsSnippets: [],
        searchesPerformed: 1,
        researchedAt: new Date().toISOString(),
      };
    }

    console.log(`[Signal Validator] Research complete. Domain: ${research.domain}, Confidence: ${research.domainConfidence}%`);

    // ========================================
    // STEP 2: Classify the industry
    // ========================================
    console.log(`[Signal Validator] Step 2: Classifying industry...`);

    let industry: IndustryClassification;
    if (research.domainConfidence >= 50 && (research.aboutPage || research.websiteContent)) {
      // Good research data - use full classification
      industry = await classifyIndustry(company.name, research);
    } else {
      // Limited data - use quick classification
      industry = await quickClassifyIndustry(
        company.name,
        research.domain ?? undefined,
        research.companyDescription ?? undefined
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
    const validationStatus = assessment.overallScore >= 40 ? 'validated' : 'skipped';

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
      signalExplanation: assessment.signalExplanation,
      relevanceReasoning: assessment.reasoning,
      talkingPoints: assessment.talkingPoints,
      researchConfidence: research.domainConfidence,
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
      validationStatus: 'failed',
      companyIndustryDetected: null,
      companySizeDetected: null,
      opportunityType: null,
      urgency: null,
      recommendedAction: null,
      signalExplanation: null,
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
    signal_explanation: result.signalExplanation,
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
