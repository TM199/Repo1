// Quick test for signal validation
// Run with: DOTENV_CONFIG_PATH=.env.local npx tsx -r dotenv/config scripts/test-signal-validation.ts

import { createClient } from '@supabase/supabase-js';
import { validateSignal, saveValidationResult } from '../src/agents/signal-validator-agent';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function test() {
  console.log('=== Signal Validation Test ===\n');

  // Get one pending signal with company and ICP
  const { data: signal, error } = await supabase
    .from('company_pain_signals')
    .select(`
      *,
      companies (*),
      icp_profiles (*)
    `)
    .eq('source', 'contracts_finder')
    .eq('validation_status', 'pending')
    .limit(1)
    .single();

  if (error || !signal) {
    console.log('No pending signal found:', error?.message);
    return;
  }

  console.log('Signal:', signal.signal_title);
  console.log('Company:', signal.companies?.name);
  console.log('ICP:', signal.icp_profiles?.name);
  console.log('\nStarting validation...\n');

  const startTime = Date.now();

  const result = await validateSignal(
    signal,
    signal.companies,
    signal.icp_profiles
  );

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n=== RESULT ===');
  console.log(`Duration: ${duration}s`);
  console.log(`Status: ${result.validationStatus}`);
  console.log(`Relevance: ${(result.relevanceScore * 100).toFixed(0)}%`);

  if (result.signalExplanation) {
    console.log(`\nSignal Explanation:\n${result.signalExplanation}`);
  }

  console.log(`\nIndustry: ${result.companyIndustryDetected}`);
  console.log(`Opportunity: ${result.opportunityType}`);
  console.log(`Action: ${result.recommendedAction}`);

  if (result.relevanceReasoning) {
    console.log(`\nWhy Relevant:\n${result.relevanceReasoning}`);
  }

  if (result.talkingPoints?.length) {
    console.log('\nTalking Points:');
    result.talkingPoints.forEach((tp, i) => console.log(`  ${i + 1}. ${tp}`));
  }

  if (result.success) {
    await saveValidationResult(signal.id, result);
    console.log('\n✓ Saved to database');
  } else {
    console.log('\n✗ Error:', result.error);
  }
}

test().catch(console.error);
