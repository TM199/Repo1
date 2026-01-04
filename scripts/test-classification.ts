// Simple test script for AI agency classification
// Run: source .env.local && npx tsx scripts/test-classification.ts

import { classifyCompany } from '../src/agents/agency-classifier-agent';
import { searchCompanyWebsite } from '../src/lib/ai/tavily';

async function runTests() {
  console.log('\n=== AI Agency Classification Test Suite ===\n');

  // Test 1: Known recruitment agencies
  const knownAgencies = ['Hays', 'Michael Page', 'Robert Half'];

  console.log('--- Test 1: Known Recruitment Agencies ---\n');
  for (const company of knownAgencies) {
    try {
      console.log(`Testing: ${company}`);
      const result = await classifyCompany(company, { useTools: true });
      console.log(`  Result: ${result.isRecruitmentAgency ? '✓ Agency' : '✗ Not Agency'}`);
      console.log(`  Confidence: ${result.confidence}%`);
      console.log(`  Domain: ${result.domain || 'Not found'}`);
      console.log(`  Reasoning: ${result.reasoning.slice(0, 100)}...`);
      console.log('');
    } catch (error) {
      console.error(`  Error: ${error}`);
    }
  }

  // Test 2: Known non-agencies
  const nonAgencies = ['Tesco', 'Sainsburys', 'BBC'];

  console.log('\n--- Test 2: Known Non-Agencies ---\n');
  for (const company of nonAgencies) {
    try {
      console.log(`Testing: ${company}`);
      const result = await classifyCompany(company, { useTools: true });
      console.log(`  Result: ${result.isRecruitmentAgency ? '✗ Agency (unexpected)' : '✓ Not Agency'}`);
      console.log(`  Confidence: ${result.confidence}%`);
      console.log(`  Domain: ${result.domain || 'Not found'}`);
      console.log(`  Reasoning: ${result.reasoning.slice(0, 100)}...`);
      console.log('');
    } catch (error) {
      console.error(`  Error: ${error}`);
    }
  }

  // Test 3: Domain resolution
  console.log('\n--- Test 3: Domain Resolution (Tavily) ---\n');
  const testCompanies = ['Hays UK', 'Tesco PLC'];
  for (const company of testCompanies) {
    try {
      console.log(`Resolving domain for: ${company}`);
      const result = await searchCompanyWebsite(company);
      console.log(`  Domain: ${result.domain}`);
      console.log(`  Confidence: ${result.confidence}%`);
      console.log(`  Source: ${result.source}`);
      console.log('');
    } catch (error) {
      console.error(`  Error: ${error}`);
    }
  }

  console.log('\n=== Tests Complete ===\n');
}

runTests().catch(console.error);
