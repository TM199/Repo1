# Sprint 2: Contracts Finder Integration

## Status: COMPLETE

## Overview
Integrate UK Contracts Finder API to detect contract award signals, with full supplier matching and domain resolution using Sprint 1 utilities.

## Key Patterns from Sprint 1 (Companies House)
- Company matching: `findOrCreateCompany()` in `/src/lib/companies/company-matcher.ts`
- Domain resolution: `resolveDomain()` in `/src/lib/domain-resolver.ts`
- Signal creation: Link to ICP profiles via `company_pain_signals` table
- Deduplication: Track processed items with `signal_generated` flag

## Dependencies
- [x] Sprint 1 Complete: Company matcher, domain resolver, CH integration

---

## Implementation Tasks

### Phase A: Database Migration
- [x] A1. Create migration SQL (`scripts/migrate-contract-awards-v2.sql`)
  - Add `cpv_codes TEXT[]` column to `contract_awards` table
  - Add `signal_generated BOOLEAN DEFAULT FALSE` column
  - Add `ocid VARCHAR(100)` column for OCDS identifier
  - Add GIN index on `cpv_codes`
  - Add index on `signal_generated`
  - Add government supplier tracking fields to `companies` table

### Phase B: CPV Code Mapping
- [x] B1. Create `/src/lib/contracts-finder/cpv-mapping.ts`
- [x] B2. Implement `CPV_TO_INDUSTRY` mapping (IT, Construction, Healthcare, Financial, etc.)
- [x] B3. Implement `getCPVCodesForIndustries(industries)` function
- [x] B4. Implement `matchCPVToIndustry(cpvCodes, targetIndustries)` function

### Phase C: Enhanced Contracts Finder Client
- [x] C1. Enhance `/src/lib/contracts-finder.ts` with pagination support
- [x] C2. Add `searchAwardedContracts(params)` with date range and CPV filtering
- [x] C3. Add `getContractNotice(ocid)` for single contract lookup
- [x] C4. Add CPV code extraction from tender.items.classification
- [x] C5. Add proper error handling and rate limiting (500ms between calls)

### Phase D: Supplier Sync (CRITICAL - Reuse Sprint 1 Utilities)
- [x] D1. Create `/src/lib/contracts-finder/supplier-sync.ts`
- [x] D2. Implement `syncSupplierFromContract(supplierData)`:
  - Extract supplier name and location from OCDS party
  - Call `findOrCreateCompany()` to match/create company
  - Call `resolveDomain()` if company has no domain
  - Update company with contract data (is_government_supplier, contract counts)
  - Return company with actionability status

### Phase E: Signal Detection
- [x] E1. Create `/src/lib/contracts-finder/signals.ts`
- [x] E2. Define contract value tiers:
  - Small: £50k-£500k (pain score 20)
  - Medium: £500k-£2M (pain score 30)
  - Large: £2M+ (pain score 40)
- [x] E3. Implement `detectContractAwardSignal(company, contract, icp)`:
  - Calculate pain score based on value tier
  - Include actionability metadata (domain_resolved, enrichment_ready)
  - Return SignalCandidate
- [x] E4. Implement `detectFirstTimeContractor(company)`:
  - Check if this is company's first government contract
  - Pain score 30 if first contract
- [x] E5. Implement `detectMultipleContractWins(company, period)`:
  - Check for 2+ wins in 30 days
  - Pain score 35+ based on count

### Phase F: Contract Award Storage
- [x] F1. Implement `storeContractAward(release, companyId)` function:
  - Store contract in `contract_awards` table
  - Extract CPV codes, buyer info, value, dates
  - Link to company_id
  - Set signal_generated flag
  - Return contract record

### Phase G: Cron Job
- [x] G1. Create `/src/app/api/cron/contracts-finder-signals/route.ts`
- [x] G2. Implement cron flow:
  1. Get active ICPs with 'contracts_awarded' signal type
  2. Build CPV code filter from all ICP industries
  3. Fetch contract awards from last 14 days
  4. For each award with matching CPV codes:
     - Sync supplier (match/create company + domain resolution)
     - Store contract award
     - Find matching ICPs by industry/location
     - Create company_pain_signals for each matching ICP
  5. Recalculate company pain scores
- [x] G3. Add rate limiting (500ms between external calls)
- [x] G5. Ensure completion within 280 seconds (3 page limit)

### Phase H: Vercel Configuration
- [x] H1. Add cron schedule to `vercel.json`: `0 6 * * *` (6:00am daily)
- [x] H2. Add function maxDuration config

---

## Review

### Summary of Changes
Sprint 2 Contracts Finder integration completed successfully:

1. **Migration SQL** - Created `scripts/migrate-contract-awards-v2.sql` with:
   - Enhanced `contract_awards` table: `cpv_codes`, `ocid`, `signal_generated`, `supplier_party_id`, contract dates
   - New `companies` fields: `is_government_supplier`, `total_contracts_won`, `total_contract_value_gbp`, `first_contract_date`
   - GIN index on `cpv_codes` for array queries

2. **CPV Code Mapping** - Created `src/lib/contracts-finder/cpv-mapping.ts`:
   - Maps CPV prefixes to industries (IT: 72, 48; Construction: 45; Healthcare: 85, 33; etc.)
   - `getCPVCodesForIndustries()` - convert ICP industries to CPV prefixes
   - `matchCPVToIndustry()` - check if contract CPV matches target industries

3. **Enhanced Client** - Updated `src/lib/contracts-finder.ts`:
   - Rate limiting (500ms between requests)
   - `searchAwardedContracts()` with pagination, CPV filtering, value filtering
   - `parseContractAward()` extracts structured data from OCDS releases
   - `extractCPVCodes()` gets CPV codes from tender items
   - `getContractNotice()` for single contract lookup

4. **Supplier Sync** - Created `src/lib/contracts-finder/supplier-sync.ts`:
   - Uses `findOrCreateCompany()` from Sprint 1 for matching
   - Uses `resolveDomain()` from Sprint 1 for domain resolution
   - `storeContractAward()` stores contracts with deduplication
   - Updates company contract stats (count, value, first contract date)
   - Returns actionability status

5. **Signal Detection** - Created `src/lib/contracts-finder/signals.ts`:
   - Contract value tiers: small (£50k-500k), medium (£500k-2M), large (£2M+)
   - `detectContractAwardSignal()` - creates signal with tier-based pain score
   - `detectFirstContractSignal()` - special signal for first government contract
   - `detectMultipleContractWins()` - signal for 2+ wins in 30 days

6. **Pain Scores** - Added to `src/lib/signals/detection.ts`:
   - `contract_awarded_small`: 20 pts, short_term
   - `contract_awarded_medium`: 30 pts, immediate
   - `contract_awarded_large`: 40 pts, immediate
   - `contract_awarded_first`: 30 pts, short_term
   - `contract_awarded_multiple`: 35 pts, immediate

7. **Cron Job** - Created `/api/cron/contracts-finder-signals`:
   - Gets ICPs with 'contracts_awarded' signal type
   - Builds CPV filter from ICP industries
   - Fetches 14 days of contracts (3 pages max)
   - Syncs suppliers with domain resolution
   - Creates `company_pain_signals` for matching ICPs
   - Recalculates company pain scores

8. **Schedule** - Added to `vercel.json`: runs 6:00am daily

### Files Changed
| File | Action |
|------|--------|
| `scripts/migrate-contract-awards-v2.sql` | Created |
| `src/lib/contracts-finder/cpv-mapping.ts` | Created |
| `src/lib/contracts-finder/supplier-sync.ts` | Created |
| `src/lib/contracts-finder/signals.ts` | Created |
| `src/lib/contracts-finder/index.ts` | Created |
| `src/lib/contracts-finder.ts` | Modified (added enhanced search) |
| `src/lib/signals/detection.ts` | Modified (added contract pain scores) |
| `src/app/api/cron/contracts-finder-signals/route.ts` | Created |
| `vercel.json` | Modified (added cron + function config) |

### Next Steps
1. Run `scripts/migrate-contract-awards-v2.sql` in Supabase
2. Deploy to Vercel
3. Test by triggering `/api/cron/contracts-finder-signals` manually
4. Enable 'contracts_awarded' signal type on ICP profiles

### Cron Schedule (Daily)
| Time | Job | Description |
|------|-----|-------------|
| 5:00am | government | Planning data scraping |
| 5:30am | companies-house-signals | CH filing analysis |
| 6:00am | **contracts-finder-signals** | **Contract award signals** |
| 6:00am, 12:00pm, 6:00pm | rescan-icp-jobs | Job refresh |

---

## Previous Sprint: Companies House Integration (COMPLETE)

Sprint 1 delivered:
- `companies_house_filings` table for tracking processed filings
- `src/lib/companies-house/signals.ts` - Leadership & expansion signal detection
- `src/lib/companies-house/company-sync.ts` - CH company sync
- `/api/cron/companies-house-signals` - Daily cron job at 5:30am
- Pain scores: `new_director_appointment` (25), `leadership_reorganisation` (30), `director_gap` (20), `capital_raise` (25)
