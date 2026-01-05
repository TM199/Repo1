/**
 * One-time backfill script for Jamie's contract signals
 *
 * Run with: npx tsx scripts/backfill-jamie-contracts.ts
 *
 * This script:
 * 1. Reads existing signals from the signals table for Jamie's ICP
 * 2. Creates corresponding company_pain_signals records
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load .env.local
config({ path: '.env.local' });

const JAMIE_ICP_ID = 'd282ba0b-55c7-4fb4-9686-82f487a0fd1f';

// Get env vars
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Helper to normalize company names (matching the DB pattern)
function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s-]/g, '')
    .trim();
}

async function backfillJamieContracts() {
  console.log('Starting backfill for Jamie ICP:', JAMIE_ICP_ID);

  // 1. Get Jamie's ICP to get user_id
  const { data: icp, error: icpError } = await supabase
    .from('icp_profiles')
    .select('user_id')
    .eq('id', JAMIE_ICP_ID)
    .single();

  if (icpError || !icp) {
    console.error('Failed to get Jamie ICP:', icpError);
    process.exit(1);
  }

  console.log('Jamie user_id:', icp.user_id);

  // 2. Get existing signals from signals table
  const { data: signals, error: signalsError } = await supabase
    .from('signals')
    .select('*')
    .eq('icp_profile_id', JAMIE_ICP_ID);

  if (signalsError) {
    console.error('Failed to get signals:', signalsError);
    process.exit(1);
  }

  console.log(`Found ${signals?.length || 0} signals to backfill`);

  if (!signals || signals.length === 0) {
    console.log('No signals to backfill');
    process.exit(0);
  }

  let created = 0;
  let skipped = 0;

  for (const signal of signals) {
    const nameNormalized = normalizeCompanyName(signal.company_name);

    // 3. Find or create company for this signal
    const { data: existingCompany } = await supabase
      .from('companies')
      .select('id')
      .eq('name_normalized', nameNormalized)
      .eq('user_id', icp.user_id)
      .single();

    let companyId: string;

    if (existingCompany) {
      companyId = existingCompany.id;
    } else {
      // Create new company with name_normalized
      const { data: newCompany, error: createError } = await supabase
        .from('companies')
        .insert({
          name: signal.company_name,
          name_normalized: nameNormalized,
          domain: signal.company_domain || null,
          region: signal.location || null,
          user_id: icp.user_id,
          hiring_pain_score: 15,
        })
        .select('id')
        .single();

      if (createError || !newCompany) {
        console.error(`Failed to create company for ${signal.company_name}:`, createError);
        skipped++;
        continue;
      }
      companyId = newCompany.id;
      console.log(`Created company: ${signal.company_name}`);
    }

    // 4. Check if signal already exists, then insert to company_pain_signals
    const source = signal.signal_detail?.includes('Find a Tender') ? 'find_a_tender' : 'contracts_finder';

    // Check if already exists
    const { data: existing } = await supabase
      .from('company_pain_signals')
      .select('id')
      .eq('company_id', companyId)
      .eq('icp_profile_id', JAMIE_ICP_ID)
      .eq('pain_signal_type', 'contract_awarded')
      .eq('signal_title', signal.signal_title)
      .single();

    if (existing) {
      console.log(`Signal already exists for ${signal.company_name}`);
      skipped++;
      continue;
    }

    const { error: insertError } = await supabase
      .from('company_pain_signals')
      .insert({
        company_id: companyId,
        icp_profile_id: JAMIE_ICP_ID,
        pain_signal_type: 'contract_awarded',
        signal_title: signal.signal_title,
        signal_detail: signal.signal_detail,
        signal_value: 0,
        pain_score_contribution: 15,
        urgency: 'short_term',
        source: source,
        detected_at: signal.detected_at,
        is_active: true,
      });

    if (insertError) {
      console.error(`Failed to insert signal for ${signal.company_name}:`, insertError);
      skipped++;
    } else {
      created++;
      console.log(`Created signal for ${signal.company_name}`);
    }
  }

  console.log(`\nBackfill complete!`);
  console.log(`Created: ${created}`);
  console.log(`Skipped: ${skipped}`);
}

backfillJamieContracts().catch(console.error);
