// src/inngest/functions/validate-signals.ts

import { inngest } from '../client';
import { createAdminClient } from '@/lib/supabase/server';
import {
  validateSignal,
  saveValidationResult,
} from '@/agents/signal-validator-agent';
import { CompanyPainSignal, ICPProfile, Company } from '@/types';

// Stats type
interface ValidationStats {
  signals_processed: number;
  validated: number;
  skipped: number;
  failed: number;
  error_messages: string[];
}

// Signal with relations type
interface SignalWithRelations {
  id: string;
  company_id: string;
  icp_profile_id: string;
  pain_signal_type: string;
  signal_title: string;
  signal_detail: string;
  source: string;
  detected_at: string;
  is_active: boolean;
  validation_status: string | null;
  metadata: Record<string, unknown> | null;
  companies: {
    id: string;
    name: string;
    domain: string | null;
    region: string | null;
    location: string | null;
    industry: string | null;
  };
  icp_profiles: {
    id: string;
    name: string;
    industries: string[] | null;
    locations: string[] | null;
    specific_roles: string[] | null;
    description: string | null;
  };
}

/**
 * Get pending signals that need validation
 */
async function getPendingSignals(
  supabase: ReturnType<typeof createAdminClient>,
  limit: number = 20
): Promise<SignalWithRelations[]> {
  const governmentSources = ['contracts_finder', 'find_a_tender', 'companies_house'];

  const { data, error } = await supabase
    .from('company_pain_signals')
    .select(`
      id,
      company_id,
      icp_profile_id,
      pain_signal_type,
      signal_title,
      signal_detail,
      source,
      detected_at,
      is_active,
      validation_status,
      metadata,
      companies (
        id,
        name,
        domain,
        region,
        location,
        industry
      ),
      icp_profiles (
        id,
        name,
        industries,
        locations,
        specific_roles,
        description
      )
    `)
    .in('source', governmentSources)
    .eq('is_active', true)
    .or('validation_status.is.null,validation_status.eq.pending')
    .order('detected_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch pending signals: ${error.message}`);
  }

  return (data || []) as unknown as SignalWithRelations[];
}

export const validateSignalsFunction = inngest.createFunction(
  {
    id: 'validate-pending-signals',
    retries: 2,
    throttle: {
      limit: 1,          // Only 1 instance at a time
      period: '5m',      // At least 5 min between runs
    },
  },
  [
    { cron: '*/15 * * * *' },        // Every 15 minutes
    { event: 'signals/validate' },   // Manual trigger
  ],
  async ({ step, event }) => {
    const supabase = createAdminClient();
    const stats: ValidationStats = {
      signals_processed: 0,
      validated: 0,
      skipped: 0,
      failed: 0,
      error_messages: [],
    };

    // Check if required API keys are configured
    if (!process.env.ANTHROPIC_API_KEY) {
      return {
        success: false,
        message: 'Skipped - ANTHROPIC_API_KEY not configured',
        timestamp: new Date().toISOString(),
      };
    }

    if (!process.env.TAVILY_API_KEY) {
      return {
        success: false,
        message: 'Skipped - TAVILY_API_KEY not configured',
        timestamp: new Date().toISOString(),
      };
    }

    // Get optional limit from event data
    const batchSize = (event?.data?.batchSize as number) || 20;

    // ==========================================
    // STEP 1: Get pending signals
    // ==========================================
    const pendingSignals = await step.run(
      'get-pending-signals',
      async (): Promise<SignalWithRelations[]> => {
        console.log('[validate-signals] Fetching pending signals...');
        return await getPendingSignals(supabase, batchSize);
      }
    );

    if (pendingSignals.length === 0) {
      console.log('[validate-signals] No pending signals to validate');
      return {
        success: true,
        message: 'No pending signals to validate',
        stats,
        timestamp: new Date().toISOString(),
      };
    }

    console.log(`[validate-signals] Found ${pendingSignals.length} pending signals`);

    // ==========================================
    // STEP 2: Validate each signal
    // ==========================================
    const validationResults = await step.run(
      'validate-signals-batch',
      async () => {
        const results: ValidationStats = {
          signals_processed: 0,
          validated: 0,
          skipped: 0,
          failed: 0,
          error_messages: [],
        };

        for (const signalData of pendingSignals) {
          try {
            console.log(`[validate-signals] Processing signal ${signalData.id}...`);

            // Convert to expected types
            const signal: CompanyPainSignal = {
              id: signalData.id,
              company_id: signalData.company_id,
              icp_profile_id: signalData.icp_profile_id,
              pain_signal_type: signalData.pain_signal_type,
              signal_title: signalData.signal_title,
              signal_detail: signalData.signal_detail,
              source: signalData.source,
              detected_at: signalData.detected_at,
              is_active: signalData.is_active,
              validation_status: signalData.validation_status,
              metadata: signalData.metadata,
            } as CompanyPainSignal;

            const company: Company = signalData.companies as unknown as Company;
            const icp: ICPProfile = signalData.icp_profiles as unknown as ICPProfile;

            // Validate the signal
            const result = await validateSignal(signal, company, icp);

            // Save the result
            await saveValidationResult(signal.id, result);

            results.signals_processed++;

            if (result.validationStatus === 'validated') {
              results.validated++;
            } else if (result.validationStatus === 'skipped') {
              results.skipped++;
            } else {
              results.failed++;
              if (result.error) {
                results.error_messages.push(`${signalData.id}: ${result.error}`);
              }
            }

            // Rate limit: Wait between validations to respect Tavily limits
            // Tavily free tier: 1000 searches/month
            // Being conservative: 6 second delay = ~10/min = ~14,400/day max
            await new Promise(resolve => setTimeout(resolve, 6000));

          } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            console.error(`[validate-signals] Error processing ${signalData.id}:`, err);

            results.failed++;
            results.error_messages.push(`${signalData.id}: ${message}`);

            // Mark signal as failed
            await supabase
              .from('company_pain_signals')
              .update({
                validation_status: 'failed',
                validation_error: message,
                validated_at: new Date().toISOString(),
              })
              .eq('id', signalData.id);
          }
        }

        return results;
      }
    );

    // Update final stats
    stats.signals_processed = validationResults.signals_processed;
    stats.validated = validationResults.validated;
    stats.skipped = validationResults.skipped;
    stats.failed = validationResults.failed;
    stats.error_messages = validationResults.error_messages;

    console.log(`[validate-signals] Validation complete:`, stats);

    return {
      success: true,
      stats,
      timestamp: new Date().toISOString(),
    };
  }
);
