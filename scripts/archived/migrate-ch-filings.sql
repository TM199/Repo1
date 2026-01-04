-- Sprint 5: Companies House Signal Integration
-- Run this migration in Supabase SQL Editor

-- 1. Track processed Companies House filings
CREATE TABLE IF NOT EXISTS companies_house_filings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  companies_house_number VARCHAR(8) NOT NULL,
  filing_type VARCHAR(20) NOT NULL,
  filing_date DATE NOT NULL,
  filing_description TEXT,
  officer_name TEXT,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  signal_generated BOOLEAN DEFAULT FALSE,
  raw_data JSONB,
  UNIQUE(companies_house_number, filing_type, filing_date)
);

CREATE INDEX IF NOT EXISTS idx_ch_filings_company ON companies_house_filings(company_id);
CREATE INDEX IF NOT EXISTS idx_ch_filings_date ON companies_house_filings(filing_date);

-- 2. Add Companies House fields to companies table
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS companies_house_last_checked TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS sic_codes TEXT[],
ADD COLUMN IF NOT EXISTS company_status VARCHAR(50),
ADD COLUMN IF NOT EXISTS incorporation_date DATE;

-- 3. Add source tracking to company_pain_signals
ALTER TABLE company_pain_signals
ADD COLUMN IF NOT EXISTS confidence INTEGER DEFAULT 70,
ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'job_board',
ADD COLUMN IF NOT EXISTS source_filing_id UUID REFERENCES companies_house_filings(id),
ADD COLUMN IF NOT EXISTS metadata JSONB;

CREATE INDEX IF NOT EXISTS idx_signals_source ON company_pain_signals(source);
