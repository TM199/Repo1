/**
 * One-time migration to link existing signals to new companies table
 * Run this AFTER creating all new tables with setup-pain-tables.sql
 *
 * Usage: npx ts-node scripts/migrate-signals-to-companies.ts
 *
 * Or run via Next.js API route for easier execution
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(ltd|limited|plc|llp|inc|corp|corporation)\b\.?/gi, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function migrateSignalsToCompanies() {
  console.log('Starting migration of existing signals to companies...');

  // Step 1: Get all signals without company_id
  const { data: signals, error: fetchError } = await supabase
    .from('signals')
    .select('id, company_name, company_domain, industry, location')
    .is('company_id', null);

  if (fetchError) {
    console.error('Error fetching signals:', fetchError);
    return;
  }

  console.log(`Found ${signals?.length || 0} signals to migrate`);

  if (!signals || signals.length === 0) {
    console.log('No signals to migrate');
    return;
  }

  // Step 2: Group by company (using domain as primary key, then name)
  const companyMap = new Map<
    string,
    {
      name: string;
      domain: string | null;
      industry: string | null;
      location: string | null;
      signalIds: string[];
    }
  >();

  for (const signal of signals) {
    if (!signal.company_name) continue;

    // Use domain as key if available, otherwise normalized name
    const key =
      signal.company_domain?.toLowerCase() ||
      normalizeCompanyName(signal.company_name);

    if (companyMap.has(key)) {
      companyMap.get(key)!.signalIds.push(signal.id);
    } else {
      companyMap.set(key, {
        name: signal.company_name,
        domain: signal.company_domain?.toLowerCase() || null,
        industry: signal.industry,
        location: signal.location,
        signalIds: [signal.id],
      });
    }
  }

  console.log(`Found ${companyMap.size} unique companies`);

  // Step 3: Create companies and update signals
  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const [key, companyData] of companyMap) {
    try {
      // Check if company already exists (by domain or normalized name)
      let existingCompany = null;

      if (companyData.domain) {
        const { data } = await supabase
          .from('companies')
          .select('id')
          .eq('domain', companyData.domain)
          .single();
        existingCompany = data;
      }

      if (!existingCompany) {
        const { data } = await supabase
          .from('companies')
          .select('id')
          .eq('name_normalized', normalizeCompanyName(companyData.name))
          .single();
        existingCompany = data;
      }

      let companyId: string;

      if (existingCompany) {
        companyId = existingCompany.id;
      } else {
        // Create new company
        const { data: newCompany, error: createError } = await supabase
          .from('companies')
          .insert({
            name: companyData.name,
            name_normalized: normalizeCompanyName(companyData.name),
            domain: companyData.domain,
            industry: companyData.industry,
            region: companyData.location,
          })
          .select('id')
          .single();

        if (createError) {
          console.error(
            `Error creating company ${companyData.name}:`,
            createError
          );
          errors++;
          continue;
        }

        companyId = newCompany.id;
        created++;
      }

      // Update all signals for this company
      const { error: updateError } = await supabase
        .from('signals')
        .update({ company_id: companyId })
        .in('id', companyData.signalIds);

      if (updateError) {
        console.error(
          `Error updating signals for ${companyData.name}:`,
          updateError
        );
        errors++;
      } else {
        updated += companyData.signalIds.length;
      }
    } catch (err) {
      console.error(`Unexpected error for ${companyData.name}:`, err);
      errors++;
    }
  }

  console.log('\n=== Migration Complete ===');
  console.log(`Companies created: ${created}`);
  console.log(`Signals updated: ${updated}`);
  console.log(`Errors: ${errors}`);
}

// Run migration
migrateSignalsToCompanies()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
