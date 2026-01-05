# Part 1: Database Schema

## Task

Add validation columns to `company_pain_signals` table and create usage tracking.

## Instructions

Create a new SQL migration file at `scripts/migrate-signal-validation.sql` with:

1. Add validation columns to `company_pain_signals`
2. Add usage tracking columns to `profiles` table
3. Create `ai_usage_log` table for detailed tracking
4. Create necessary indexes

## SQL to Create

```sql
-- Signal validation columns
ALTER TABLE company_pain_signals
  ADD COLUMN IF NOT EXISTS validation_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS relevance_score FLOAT,
  ADD COLUMN IF NOT EXISTS relevance_reasoning TEXT,
  ADD COLUMN IF NOT EXISTS company_industry_detected TEXT,
  ADD COLUMN IF NOT EXISTS company_size_detected TEXT,
  ADD COLUMN IF NOT EXISTS opportunity_type TEXT,
  ADD COLUMN IF NOT EXISTS recommended_action TEXT,
  ADD COLUMN IF NOT EXISTS talking_points JSONB,
  ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS validation_error TEXT;

-- Add check constraint for validation_status
ALTER TABLE company_pain_signals
  DROP CONSTRAINT IF EXISTS company_pain_signals_validation_status_check;
ALTER TABLE company_pain_signals
  ADD CONSTRAINT company_pain_signals_validation_status_check
  CHECK (validation_status IN ('pending', 'validated', 'failed', 'skipped'));

-- User usage tracking (monthly quotas)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS enrichments_used_this_month INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS enrichments_month_start DATE DEFAULT CURRENT_DATE;

-- Detailed usage log
CREATE TABLE IF NOT EXISTS ai_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  signal_id UUID REFERENCES company_pain_signals(id) ON DELETE SET NULL,
  tokens_used INTEGER,
  cost_usd DECIMAL(10, 6),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_signals_validation_status
  ON company_pain_signals (validation_status, is_active)
  WHERE source IN ('contracts_finder', 'find_a_tender', 'companies_house');

CREATE INDEX IF NOT EXISTS idx_signals_pending_validation
  ON company_pain_signals (detected_at)
  WHERE validation_status = 'pending'
  AND source IN ('contracts_finder', 'find_a_tender', 'companies_house');

CREATE INDEX IF NOT EXISTS idx_usage_log_user_month
  ON ai_usage_log (user_id, created_at);
```

## After Running Migration

Update the TypeScript types in `src/types/index.ts`. Add these fields to the `PainSignal` interface:

```typescript
// In PainSignal interface, add:
validation_status?: 'pending' | 'validated' | 'failed' | 'skipped';
relevance_score?: number;
relevance_reasoning?: string;
company_industry_detected?: string;
company_size_detected?: string;
opportunity_type?: string;
recommended_action?: string;
talking_points?: string[];
validated_at?: string;
validation_error?: string;
```

## Verification

After running the migration, verify with:

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'company_pain_signals'
AND column_name LIKE '%validation%';
```

## DO NOT

- Modify any existing columns
- Change existing constraints
- Alter the primary key or foreign keys
