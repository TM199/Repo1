# Scripts

## Utility Scripts

### `clear-database.sql`
Truncates all application tables while preserving structure. Use for clean testing without dropping/recreating tables.

**Usage:**
```sql
-- Run in Supabase SQL Editor
\i clear-database.sql
```

**Tables Cleared:**
- companies, company_pain_signals, company_contacts
- job_postings, job_observations
- contract_awards, companies_house_filings
- icp_profiles, scan_queue
- search_results, search_profiles
- signals, signal_contacts

## Archived Scripts

The `archived/` folder contains one-time migration scripts that have already been applied to the database. These are kept for reference and should not be re-run.

### Migration History (in order of application):
1. `setup-pain-tables.sql` - Core tables (companies, job_postings, etc.)
2. `setup-icp-profiles.sql` - ICP profiles table
3. `setup-search-profiles.sql` - Legacy search profiles
4. `migrate-api-keys.sql` - API key management
5. `migrate-api-usage.sql` - Rate limiting
6. `migrate-ch-filings.sql` - Companies House tables
7. `migrate-company-contacts.sql` - Contact enrichment
8. `migrate-contract-awards-v2.sql` - Contract awards enhancements
9. `migrate-enrichment-roles.sql` - Default enrichment roles
10. `migrate-icp-contract-fields.sql` - Contract config fields
11. `migrate-icp-role-categories.sql` - Role categories
12. `migrate-icp-signals.sql` - ICP-signal linking
13. `migrate-job-postings-sprint3.sql` - Department/urgency columns
14. `migrate-notified-at.sql` - Notification tracking
15. `migrate-scan-queue.sql` - Background scan queue
16. `migrate-signal-refresh-tracking.sql` - Refresh tracking
17. `migrate-signals-to-companies.ts` - Data migration script
