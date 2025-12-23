-- Migration: Add company_contacts table for storing enriched contacts per company
-- Run this in Supabase SQL Editor

-- Create company_contacts table
CREATE TABLE IF NOT EXISTS company_contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  job_title TEXT,
  seniority TEXT,
  email TEXT,
  email_status TEXT,
  phone TEXT,
  linkedin_url TEXT,
  is_primary BOOLEAN DEFAULT FALSE,
  enrichment_source TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(company_id, email)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_company_contacts_company ON company_contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_company_contacts_email ON company_contacts(email) WHERE email IS NOT NULL;

-- Add columns to companies table for tracking enrichment
ALTER TABLE companies ADD COLUMN IF NOT EXISTS last_enriched_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS contacts_count INTEGER DEFAULT 0;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS domain_source TEXT;

-- Comment
COMMENT ON TABLE company_contacts IS 'Contacts found via LeadMagic/Prospeo enrichment for companies from pain signals';

-- Verify
SELECT
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'company_contacts') as table_exists;
