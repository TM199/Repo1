-- Sprint 3: Enhanced Job Board Analysis
-- Migration for job_postings table enhancements

-- Add department classification column
ALTER TABLE job_postings
ADD COLUMN IF NOT EXISTS department VARCHAR(50);

-- Add urgency detection columns
ALTER TABLE job_postings
ADD COLUMN IF NOT EXISTS urgency_level VARCHAR(20);

ALTER TABLE job_postings
ADD COLUMN IF NOT EXISTS has_urgency_keywords BOOLEAN DEFAULT FALSE;

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_job_postings_department
ON job_postings(department);

CREATE INDEX IF NOT EXISTS idx_job_postings_urgency
ON job_postings(urgency_level);

-- Add department_hiring_concentration signal type config (for reference)
-- Signal types are defined in code, but documenting here:
-- department_hiring_concentration: pain_score 30, urgency immediate

COMMENT ON COLUMN job_postings.department IS 'Classified department: Engineering, Sales, Operations, Finance, HR, Marketing, Customer Success, Product';
COMMENT ON COLUMN job_postings.urgency_level IS 'Detected urgency: high, medium, or null';
COMMENT ON COLUMN job_postings.has_urgency_keywords IS 'Whether job description contains urgency keywords';
