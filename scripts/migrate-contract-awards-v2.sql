-- Migration: Enhance contract_awards table for Contracts Finder integration
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. ADD NEW COLUMNS TO CONTRACT_AWARDS
-- ============================================

-- OCDS identifier for deduplication
ALTER TABLE contract_awards ADD COLUMN IF NOT EXISTS ocid VARCHAR(100);

-- CPV codes for industry classification
ALTER TABLE contract_awards ADD COLUMN IF NOT EXISTS cpv_codes TEXT[];

-- Track whether this contract has generated a signal
ALTER TABLE contract_awards ADD COLUMN IF NOT EXISTS signal_generated BOOLEAN DEFAULT FALSE;

-- Supplier party ID from OCDS
ALTER TABLE contract_awards ADD COLUMN IF NOT EXISTS supplier_party_id VARCHAR(100);

-- Contract period
ALTER TABLE contract_awards ADD COLUMN IF NOT EXISTS contract_start_date DATE;
ALTER TABLE contract_awards ADD COLUMN IF NOT EXISTS contract_end_date DATE;

-- ============================================
-- 2. CREATE INDEXES
-- ============================================

-- Index on OCID for fast lookups and deduplication
CREATE UNIQUE INDEX IF NOT EXISTS idx_contract_awards_ocid
ON contract_awards (ocid) WHERE ocid IS NOT NULL;

-- GIN index on CPV codes for array containment queries
CREATE INDEX IF NOT EXISTS idx_contract_awards_cpv_codes
ON contract_awards USING GIN (cpv_codes);

-- Index on signal_generated for filtering unprocessed contracts
CREATE INDEX IF NOT EXISTS idx_contract_awards_signal_generated
ON contract_awards (signal_generated) WHERE signal_generated = FALSE;

-- Composite index for date-based queries
CREATE INDEX IF NOT EXISTS idx_contract_awards_date_company
ON contract_awards (award_date DESC, company_id);

-- ============================================
-- 3. ADD CONTRACT TRACKING FIELDS TO COMPANIES
-- ============================================

-- Track government supplier status
ALTER TABLE companies ADD COLUMN IF NOT EXISTS is_government_supplier BOOLEAN DEFAULT FALSE;

-- Track total contracts won
ALTER TABLE companies ADD COLUMN IF NOT EXISTS total_contracts_won INTEGER DEFAULT 0;

-- Track total contract value
ALTER TABLE companies ADD COLUMN IF NOT EXISTS total_contract_value_gbp NUMERIC(15,2) DEFAULT 0;

-- Track first contract date
ALTER TABLE companies ADD COLUMN IF NOT EXISTS first_contract_date DATE;

-- Index on government supplier for filtering
CREATE INDEX IF NOT EXISTS idx_companies_gov_supplier
ON companies (is_government_supplier) WHERE is_government_supplier = TRUE;

-- ============================================
-- 4. ADD CONTRACT-RELATED COLUMNS TO COMPANY_PAIN_SIGNALS
-- ============================================

-- Ensure source_contract_id column exists (should already from setup-pain-tables.sql)
-- This allows linking signals to the specific contract that generated them
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'company_pain_signals' AND column_name = 'source_contract_id'
    ) THEN
        ALTER TABLE company_pain_signals ADD COLUMN source_contract_id UUID REFERENCES contract_awards(id);
    END IF;
END $$;

-- ============================================
-- 5. VERIFY CHANGES
-- ============================================

-- Show contract_awards columns
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'contract_awards'
ORDER BY ordinal_position;

-- Show companies new columns
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'companies'
  AND column_name IN ('is_government_supplier', 'total_contracts_won', 'total_contract_value_gbp', 'first_contract_date')
ORDER BY ordinal_position;
